import {installAutoContinue, renderCountdown} from './auto-continue.js';

// Keep game navigation in the wrapper. GEMP owns the game channel and every choice.
if (window.parent !== window) {
  const originalOpen = window.open.bind(window);
  window.open = function(url, ...args) {
    try {
      const target = new URL(url, window.location.href);
      if (target.origin === window.location.origin && target.pathname === '/gemp-swccg/game.html') {
        window.parent.postMessage({type: 'holotable-game', url: target.pathname + target.search}, window.location.origin);
        return null;
      }
    } catch {}
    return originalOpen(url, ...args);
  };
}
if (window.GempSwccgGameUI) {
  installAutoContinue(window.GempSwccgGameUI.prototype, {render: renderCountdown});
  document.addEventListener('visibilitychange', () => window.ui?.holotableContinueVisibility?.());
  window.addEventListener('pagehide', () => window.ui?.holotableCancelContinue?.());
  window.addEventListener('offline', () => {
    const ui = window.ui;
    ui?.holotableCancelContinue?.();
    if (ui?.holotableAutoContinueInstalled && !ui.replayMode) ui.showErrorDialog('Connection lost', 'Reconnect and refresh this table to continue.', true, false, false);
  });
}
