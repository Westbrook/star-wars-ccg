import {installAutoContinue, renderCountdown} from './auto-continue.js';

// Keep game navigation in the wrapper. GEMP owns the game channel and every choice.
if (window.parent !== window) {
  const openGame = url => {
    try {
      const target = new URL(url, window.location.href);
      const ids = target.searchParams.getAll('gameId');
      if (target.origin !== window.location.origin || target.pathname !== '/gemp-swccg/game.html' ||
          ids.length !== 1 || !/^[A-Za-z0-9_-]{1,128}$/.test(ids[0])) return false;
      window.parent.postMessage({type: 'holotable-game', url: target.pathname + '?gameId=' + encodeURIComponent(ids[0])}, window.location.origin);
      return true;
    } catch { return false; }
  };
  const originalOpen = window.open.bind(window);
  window.open = function(url, ...args) {
    if (openGame(url)) return null;
    return originalOpen(url, ...args);
  };
  // The lobby also opens existing tables through ordinary Play/Watch anchors.
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target?.closest?.('a[href]');
    if (link && !link.hasAttribute('download') && openGame(link.href)) event.preventDefault();
  });
}
if (window.GempSwccgGameUI) {
  installAutoContinue(window.GempSwccgGameUI.prototype, {render: renderCountdown});
  if (window.parent !== window && window.GempSwccgGameUI.prototype.gameErrorMap) {
    const originalErrors = window.GempSwccgGameUI.prototype.gameErrorMap;
    window.GempSwccgGameUI.prototype.gameErrorMap = function(...args) {
      const errors = originalErrors.apply(this, args);
      for (const status of [401, 403, 404]) errors[status] = () => {
        this.holotableCancelContinue();
        window.parent.postMessage({type: 'holotable-game-error', status, url: window.location.href}, window.location.origin);
      };
      return errors;
    };
  }
  document.addEventListener('visibilitychange', () => window.ui?.holotableContinueVisibility?.());
  window.addEventListener('pagehide', () => window.ui?.holotableCancelContinue?.());
  window.addEventListener('offline', () => {
    const ui = window.ui;
    ui?.holotableCancelContinue?.();
    if (ui?.holotableAutoContinueInstalled && !ui.replayMode) ui.showErrorDialog('Connection lost', 'Reconnect and refresh this table to continue.', true, false, false);
  });
}
