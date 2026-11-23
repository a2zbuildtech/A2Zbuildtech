/* FILE: pwa.js  (GitHub par isi naam se upload karein) */
/* Website ko mobile par "app" ki tarah install karne ke liye: service worker chalu karta hai aur "App install karein" patti dikhata hai. */
(function () {
  'use strict';
  try { if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) {}
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
