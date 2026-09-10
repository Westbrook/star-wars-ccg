// A UI convenience over GEMP's decisions. No card legality is calculated here.
export const CONTINUE_DELAY_MS = 2000;

export function noActionDecision(element, playerId) {
  if (!playerId || element.getAttribute('type') !== 'D' ||
      element.getAttribute('decisionType') !== 'CARD_ACTION_CHOICE' ||
      element.getAttribute('participantId') !== playerId) return null;
  const parameters = Array.from(element.getElementsByTagName('parameter'));
  const values = name => parameters.filter(p => p.getAttribute('name') === name).map(p => p.getAttribute('value'));
  const noPass = values('noPass');
  if (noPass.length !== 1 || noPass[0] !== 'false' ||
      ['cardId', 'actionId', 'blueprintId', 'actionText'].some(name => values(name).length)) return null;
  const id = element.getAttribute('id');
  return id ? {id, result: '', element} : null;
}

export function createCountdown({onChange, onContinue, now = () => performance.now(),
  schedule = (fn, ms) => setTimeout(fn, ms), unschedule = id => clearTimeout(id), delay = CONTINUE_DELAY_MS}) {
  let pending = null, timer = null, revision = 0;
  const snapshot = () => pending && {...pending, seconds: Math.max(1, Math.ceil(pending.remaining / 1000))};
  const clear = () => {revision++; if (timer !== null) unschedule(timer); timer = null;};
  const cancel = () => {clear(); pending = null; onChange(null);};
  const finish = () => {
    if (!pending) return;
    const token = pending.token;
    cancel(); // Clear first: a click and a timeout can never both submit.
    onContinue(token);
  };
  const tick = () => {
    if (!pending || pending.paused) return;
    const time = now();
    pending.remaining -= Math.max(0, time - pending.last);
    pending.last = time;
    if (pending.remaining <= 0) return finish();
    onChange(snapshot());
    const activeRevision = revision;
    timer = schedule(() => {if (revision === activeRevision) tick();}, Math.min(100, pending.remaining));
  };
  return {
    start(token, paused = false) {
      cancel();
      pending = {token, remaining: delay, last: now(), paused};
      if (paused) onChange(snapshot()); else tick();
    },
    pause() {
      if (!pending || pending.paused) return;
      pending.remaining = Math.max(0, pending.remaining - Math.max(0, now() - pending.last));
      pending.paused = true; clear(); onChange(snapshot());
    },
    resume() {
      if (!pending || !pending.paused) return;
      pending.paused = false; pending.last = now(); tick();
    },
    continueNow: finish, cancel, getState: snapshot,
  };
}

// Export the adapter so its event/decision lifecycle can be checked without a browser.
export function installAutoContinue(prototype, {render, isHidden = () => document.hidden, clock = {}}) {
  if (prototype.holotableAutoContinueInstalled) return;
  prototype.holotableAutoContinueInstalled = true;
  const states = new WeakMap();
  function stateFor(ui) {
    if (states.has(ui)) return states.get(ui);
    const state = {active: null, manuallyPaused: false, received: false, latest: null,
      blocked: false, handled: new WeakSet()};
    state.countdown = createCountdown({...clock,
      onChange: snapshot => render(ui, snapshot, {
        pause: () => {state.manuallyPaused = true; state.countdown.pause();},
        resume: () => {state.manuallyPaused = false; if (!isHidden()) state.countdown.resume();},
        continueNow: () => state.countdown.continueNow(),
      }),
      onContinue: token => {
        if (state.active !== token || state.blocked || (state.received && state.latest !== token.element) ||
            ui.replayMode || ui.spectatorMode ||
            token.channel !== ui.channelNumber || token.player !== ui.bottomPlayerId ||
            !noActionDecision(token.element, ui.bottomPlayerId)) return;
        // Visibility can change just before its event is delivered. Keep the prompt usable.
        if (isHidden()) {state.countdown.start(token, true); return;}
        ui.cleanupDecision();
        ui.decisionFunction(token.id, '');
      },
    });
    states.set(ui, state);
    return state;
  }
  const cancel = ui => {
    const state = states.get(ui);
    if (state) {state.active = null; state.countdown.cancel();}
  };
  const invalidate = ui => {
    cancel(ui);
    const state = stateFor(ui);
    state.received = true; state.latest = null;
    return state;
  };
  const block = ui => {invalidate(ui).blocked = true;};
  for (const method of ['emptyDecision', 'integerDecision', 'multipleChoiceDecision', 'arbitraryCardsDecision',
    'actionChoiceDecision', 'cardActionChoiceDecision', 'cardSelectionDecision']) {
    const original = prototype[method];
    prototype[method] = function(element, ...args) {
      if (this.replayMode || this.spectatorMode) return original.call(this, element, ...args);
      const state = stateFor(this);
      // GEMP queues prompts behind animations. Ignore a queued prompt after a newer
      // response, submission or error, even when the server reuses its decision ID.
      if (state.blocked || (state.received && state.latest !== element) || state.handled.has(element)) return;
      state.handled.add(element);
      cancel(this);
      const decision = noActionDecision(element, this.bottomPlayerId);
      if (!decision) return original.call(this, element, ...args);
      this.cleanupDecision();
      this.stopDecisionCountdown();
      // A fresh object identifies this occurrence. GEMP reuses decision IDs (often "1").
      const token = {...decision, channel: this.channelNumber, player: this.bottomPlayerId};
      state.active = token; state.manuallyPaused = false;
      state.countdown.start(token, isHidden());
    };
  }
  // Native auto-pass can skip a nonempty action list. This wrapper only times empty lists.
  prototype.startDecisionCountdown = function() {this.stopDecisionCountdown();};
  for (const method of ['cleanupDecision', 'participant']) {
    const original = prototype[method];
    prototype[method] = function(...args) {cancel(this); return original.apply(this, args);};
  }
  const submit = prototype.decisionFunction;
  prototype.decisionFunction = function(...args) {invalidate(this); return submit.apply(this, args);};
  const error = prototype.showErrorDialog;
  prototype.showErrorDialog = function(...args) {block(this); return error.apply(this, args);};
  for (const method of ['startGameSession', 'startReplaySession']) {
    const original = prototype[method];
    prototype[method] = function(...args) {
      invalidate(this).blocked = false; // Wait for a fresh response in the new session.
      return original.apply(this, args);
    };
  }
  const process = prototype.processGameEventsXml;
  prototype.processGameEventsXml = function(element, ...args) {
    // Clock-only polls retain the deadline. Actual events or a new channel invalidate it.
    const events = Array.from(element.getElementsByTagName('ge'));
    if (element.getAttribute('cn') !== this.channelNumber || events.length) {
      const state = invalidate(this);
      // Record this before native processing can enqueue or display any decision.
      if (!state.blocked) state.latest = events.filter(event => event.getAttribute('type') === 'D').at(-1) || null;
    }
    return process.call(this, element, ...args);
  };
  prototype.holotableContinueVisibility = function() {
    const state = states.get(this);
    if (!state) return;
    if (isHidden()) state.countdown.pause();
    else if (!state.manuallyPaused) state.countdown.resume();
  };
  prototype.holotableCancelContinue = function() {block(this);};
}

export function renderCountdown(ui, snapshot, controls) {
  let panel = ui.holotableCountdownPanel;
  if (!snapshot) {
    panel?.remove(); ui.holotableCountdownPanel = null; return;
  }
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'holo-countdown';
    const status = document.createElement('span');
    status.className = 'holo-countdown-status'; status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true');
    const pause = document.createElement('button'); pause.type = 'button'; pause.className = 'holo-countdown-pause';
    pause.onclick = () => pause.getAttribute('aria-pressed') === 'true' ? controls.resume() : controls.pause();
    const next = document.createElement('button'); next.type = 'button'; next.textContent = 'Continue now';
    next.onclick = controls.continueNow;
    panel.append(status, pause, next);
    (ui.alertButtons?.[0] || document.body).append(panel);
    ui.holotableCountdownPanel = panel;
  }
  const status = panel.querySelector('.holo-countdown-status');
  const text = snapshot.paused ? 'No actions available · Auto-continue paused' : `No actions available · Continuing in ${snapshot.seconds}s`;
  if (status.textContent !== text) status.textContent = text;
  const pause = panel.querySelector('.holo-countdown-pause');
  pause.textContent = snapshot.paused ? 'Resume' : 'Pause';
  pause.setAttribute('aria-pressed', String(snapshot.paused));
  panel.style.setProperty('--countdown-progress', String(snapshot.remaining / CONTINUE_DELAY_MS));
}
