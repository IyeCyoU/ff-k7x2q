'use strict';
/* ============ install + offline + updates ============
   Registers the offline support when the app is served from a website (not when opened as a file).

   Updates never ask anything. There is no "A new version is ready" message any more:
   - the app page always comes from the website first, so opening the app already shows the newest version;
   - the offline copy (service worker) switches to the new release by itself, in the background;
   - if the app was left open across a release, it refreshes itself once, the next time you come back
     to it and nothing is being typed or edited. One refresh per release at most, so it cannot loop.
   (Before 1.6.1 the app asked first. On phones where the switch never completed, the question came
   back on every visit even though the new version was already on screen.) */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    const KEY_TRIED = 'fbfund.refreshedFor';
    const busy = () => { const a = document.activeElement; return !!document.querySelector('#modalRoot [data-modal]') || !!(a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)); };
    // the release now on the website, read from the small offline-support file
    const releasedVersion = () => fetch('sw.js', {cache: 'no-store'}).then(r => r.ok ? r.text() : '').then(t => (t.match(/family-fund-(\d+\.\d+\.\d+)-/) || [])[1] || '');
    const refreshIfBehind = () => releasedVersion().then(v => {
      if (!v || v === APP_VERSION || busy()) return;
      let tried = ''; try { tried = sessionStorage.getItem(KEY_TRIED) || ''; } catch (e) { return; }   // no way to remember: never risk a loop
      if (tried === v) return;
      try { sessionStorage.setItem(KEY_TRIED, v); } catch (e) { return; }
      location.reload();
    }).catch(() => {});
    navigator.serviceWorker.register('sw.js').then(reg => {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        reg.update().catch(() => {});
        refreshIfBehind();
      });
    }).catch(() => {});
  });
}
