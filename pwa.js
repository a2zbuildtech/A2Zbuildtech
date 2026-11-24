/* FILE: pwa.js  (GitHub par isi naam se upload karein) */
/* Website ko mobile par "app" ki tarah install karne ke liye: service worker chalu karta hai aur "App install karein" patti dikhata hai. */
(function () {
  'use strict';
  /* Password ki jagah "aankh" (eye) button: dabane par likha hua password dikhta hai, dobara dabane par chhup jata hai.
     Ye sab password khanon par apne-aap lagta hai (admin, staff aur main website), isliye is file me hai. */
  var EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.9 17.9A10.9 10.9 0 0 1 12 19C5 19 1 12 1 12a19 19 0 0 1 5-5.9M9.9 5.2A10.4 10.4 0 0 1 12 5c7 0 11 7 11 7a19 19 0 0 1-2.2 3.2M14.1 14.1A3 3 0 1 1 9.9 9.9"/><path d="M1 1l22 22"/></svg>';
  function hide(inp, btn) { if (inp.type !== 'password') { inp.type = 'password'; } btn.setAttribute('aria-pressed', 'false'); btn.setAttribute('aria-label', 'Password dikhayein'); btn.title = 'Password dikhayein'; btn.innerHTML = EYE; }
  function wrapOne(inp) {
    if (inp.getAttribute('data-eye') || !inp.parentNode) return;
    inp.setAttribute('data-eye', '1');
    var w = document.createElement('span'); w.className = 'pwwrap';
    inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
    var b = document.createElement('button'); b.type = 'button'; b.className = 'pweye'; b.tabIndex = 0; hide(inp, b); w.appendChild(b);
    var timer = 0;
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });
    b.addEventListener('click', function () {
      if (inp.type === 'password') {
        inp.type = 'text'; b.setAttribute('aria-pressed', 'true'); b.setAttribute('aria-label', 'Password chhupayein'); b.title = 'Password chhupayein'; b.innerHTML = EYE_OFF;
        clearTimeout(timer); timer = setTimeout(function () { hide(inp, b); }, 20000);   // 20 second baad apne-aap chhup jata hai
      } else { clearTimeout(timer); hide(inp, b); }
      try { inp.focus(); } catch (e) {}
    });
    var f = inp.form; if (f) f.addEventListener('submit', function () { clearTimeout(timer); hide(inp, b); }, true);
    document.addEventListener('visibilitychange', function () { if (document.hidden) { clearTimeout(timer); hide(inp, b); } });
  }
  var queued = false;
  function scan() { queued = false; var l = document.querySelectorAll('input[type="password"]:not([data-eye])'); for (var i = 0; i < l.length; i++) wrapOne(l[i]); }
  function queue() { scan(); }   // turant (usi micro-task me) chalta hai, taaki likhte samay khana na hile
  try { new MutationObserver(queue).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queue); else queue();
})();

(function () {
  'use strict';
  try { if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) {}
  /* ---- Update ka message: naya sw.js aate hi "Naya update aaya hai" bar dikhti hai ---- */
  (function () {
    if (!('serviceWorker' in navigator)) return;
    var reloading = false, clicked = false, bar = null, ver = '';
    function showBar(reg) {
      if (bar || !reg || !reg.waiting) return;
      bar = document.createElement('div'); bar.className = 'update-bar'; bar.setAttribute('role', 'alert'); bar.id = 'updateBar';
      var t = document.createElement('span'); t.textContent = 'Naya update aaya hai. Click karke update karein.';
      var go = document.createElement('button'); go.type = 'button'; go.id = 'updateNow'; go.textContent = 'Abhi update karein';
      var x = document.createElement('button'); x.type = 'button'; x.className = 'ub-x'; x.textContent = 'Baad me';
      go.addEventListener('click', function () { clicked = true; go.disabled = true; go.textContent = 'Update ho raha hai...'; try { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {} setTimeout(function () { location.reload(); }, 4000); });
      x.addEventListener('click', function () { if (bar) { bar.remove(); bar = null; } });
      bar.appendChild(t); bar.appendChild(go); bar.appendChild(x); document.body.appendChild(bar);
    }
    function watch(reg) {
      if (reg.waiting && navigator.serviceWorker.controller) showBar(reg);
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing; if (!nw) return;
        nw.addEventListener('statechange', function () { if (nw.state === 'installed' && navigator.serviceWorker.controller) showBar(reg); });
      });
      function chk() { try { reg.update().catch(function () {}); } catch (e) {} }
      setInterval(chk, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) chk(); });
      window.addEventListener('focus', chk);
      chk();
    }
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (reloading || !clicked) return; reloading = true; location.reload(); });
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'VERSION') { ver = e.data.version; var v = document.getElementById('verTag'); if (v) v.textContent = ver; }
    });
    function tag() {
      if (document.getElementById('verTag') || !document.body) return;
      var v = document.createElement('div'); v.id = 'verTag'; v.className = 'ver-tag'; v.textContent = ver; document.body.appendChild(v);
      try { if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'VERSION' }); } catch (e) {}
    }
    navigator.serviceWorker.ready.then(function (reg) { watch(reg); tag(); try { if (reg.active) reg.active.postMessage({ type: 'VERSION' }); } catch (e) {} }).catch(function () {});
    window.__a2zShowUpdate = showBar;
  })();
  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  if (standalone) return;
  function skipped() { try { return localStorage.getItem('a2z_pwa_skip') === '1'; } catch (e) { return false; } }
  function remember() { try { localStorage.setItem('a2z_pwa_skip', '1'); } catch (e) {} }
  function bar(text, btnText, onBtn) {
    if (skipped() || document.getElementById('pwabar')) return;
    var d = document.createElement('div'); d.id = 'pwabar'; d.className = 'pwa-bar'; d.setAttribute('role', 'region'); d.setAttribute('aria-label', 'App install');
    var t = document.createElement('span'); t.textContent = text; d.appendChild(t);
    if (btnText) { var b = document.createElement('button'); b.type = 'button'; b.className = 'pwa-go'; b.textContent = btnText; b.addEventListener('click', onBtn); d.appendChild(b); }
    var x = document.createElement('button'); x.type = 'button'; x.className = 'pwa-x'; x.setAttribute('aria-label', 'Band karein'); x.textContent = '×'; x.addEventListener('click', function () { remember(); d.remove(); }); d.appendChild(x);
    document.body.appendChild(d);
  }
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    bar('A2Z ko apne phone me app ki tarah rakhein', 'App install karein', function () { if (!deferred) return; deferred.prompt(); deferred.userChoice.then(function () { deferred = null; var b = document.getElementById('pwabar'); if (b) b.remove(); }); });
  });
  window.addEventListener('appinstalled', function () { var b = document.getElementById('pwabar'); if (b) b.remove(); remember(); });
  var ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua)) setTimeout(function () { bar('iPhone me: neeche Share (↑) dabayein, phir "Add to Home Screen"', null); }, 1500);
})();
