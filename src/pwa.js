'use strict';
/* ============ install + offline + updates ============
   Registers the offline support when the app is served from a website (not when opened as a file),
   and offers "A new version is ready" instead of needing the app to be opened twice. */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    let wantReload = false, reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (wantReload && !reloading) { reloading = true; location.reload(); } });
    const offer = w => {
      if (!w || !navigator.serviceWorker.controller) return;   // first install: nothing to replace
      const old = document.querySelector('.sw-update'); if (old) old.remove();
      const el = document.createElement('div'); el.className = 'toast sw-update'; el.setAttribute('role', 'status');
      el.append('A new version is ready. ');
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = 'Reload';
      b.style.marginLeft = '8px';
      b.onclick = () => { wantReload = true; w.postMessage('skipWaiting'); };
      el.append(b); document.body.append(el);
    };
    navigator.serviceWorker.register('sw.js').then(reg => {
      if (reg.waiting) offer(reg.waiting);
      reg.addEventListener('updatefound', () => { const w = reg.installing; if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); }); });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    }).catch(() => {});
  });
}
