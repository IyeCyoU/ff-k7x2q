'use strict';
/* ============ install + offline + updates ============
   Registers the offline support when the app is served from a website (not when opened as a file).
   Updates, without nagging:
   - when the app is opened or comes back to the screen, a waiting update is applied straight away:
     nothing is being edited at that moment, so there is nothing to ask;
   - only when an update arrives while you are using the app does it ask "A new version is ready";
   - Reload always reloads: some phones never announce the switch, so the page reloads after 3 s anyway;
   - a guard stops it from reloading in a loop if a phone refuses to switch. */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    const SW_KEY = 'fbfund.swApplied';
    let reloading = false, wantReload = false, quietUntil = Date.now() + 15000;
    const reloadOnce = () => { if (!reloading) { reloading = true; location.reload(); } };
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (wantReload) reloadOnce(); });
    const busy = () => { const a = document.activeElement; return !!document.querySelector('#modalRoot [data-modal]') || !!(a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)); };
    const recentlyApplied = () => { try { return Date.now() - +(sessionStorage.getItem(SW_KEY) || 0) < 30000; } catch (e) { return false; } };
    const apply = w => {
      wantReload = true;
      document.querySelectorAll('.sw-update').forEach(x => x.remove());
      try { sessionStorage.setItem(SW_KEY, String(Date.now())); } catch (e) {}
      w.postMessage('skipWaiting');
      setTimeout(reloadOnce, 3000);
    };
    const offer = w => {
      document.querySelectorAll('.sw-update').forEach(x => x.remove());
      const el = document.createElement('div'); el.className = 'toast sw-update'; el.setAttribute('role', 'status');
      el.append('A new version is ready. ');
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = 'Reload';
      b.style.marginLeft = '8px';
      b.onclick = () => apply(w);
      el.append(b); document.body.append(el);
    };
    const settle = w => {
      if (!w || !navigator.serviceWorker.controller) return;   // first install: nothing to replace
      if (Date.now() < quietUntil && !busy() && !recentlyApplied()) apply(w); else offer(w);
    };
    navigator.serviceWorker.register('sw.js').then(reg => {
      if (reg.waiting) settle(reg.waiting);
      reg.addEventListener('updatefound', () => { const w = reg.installing; if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') settle(w); }); });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        quietUntil = Date.now() + 15000;                         // just came back: apply quietly, as on opening
        reg.update().then(() => { if (reg.waiting) settle(reg.waiting); }).catch(() => {});
      });
    }).catch(() => {});
  });
}
