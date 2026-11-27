/* FILE: sw.js  (GitHub par isi naam se upload karein) */
/* A2Z app ka service worker: sirf website ki apni files ko yaad rakhta hai taaki app turant khule.
 * Network pehle: internet ho to hamesha nayi file leta hai (update ruke nahi). Internet na ho to yaad ki hui file dikhata hai.
 * Google (Apps Script) ke API jawab, photo, hisaab ya koi bhi data kabhi save nahi karta; POST ko chhuta hi nahi. */
/* VERSION: har baar website update upload karte samay ye number badhaya jata hai. Isi se purane phone/browser ko pata chalta hai ki naya update aaya hai. */
var VERSION = 'v18';
var CACHE = 'a2z-shell-' + VERSION;
var SHELL = ['index.html', 'staff.html', 'admin.html', 'style.css', 'portal.css', 'help.css', 'hints.js', 'terms.html', 'terms.css', 'data.js', 'calc.js', 'app.js', 'common.js', 'staff.js', 'admin.js', 'payout.js', 'work.js', 'duty.js', 'master.js', 'xlsx-lite.js', 'help.js', 'kb-staff.js', 'kb-admin.js', 'pwa.js', 'logo.svg', 'icon-192.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); })); }));
});
/* Naya version tabhi chalu hota hai jab user "Abhi update karein" dabaye (pehli baar install par turant chalu). */
self.addEventListener('message', function (e) {
  var d = e.data || {};
  if (d.type === 'SKIP_WAITING') self.skipWaiting();
  if (d.type === 'VERSION' && e.source) e.source.postMessage({ type: 'VERSION', version: VERSION });
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== self.location.origin) return;
  e.respondWith(fetch(r).then(function (res) {
    if (res && res.ok && res.type === 'basic') { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, cp); }); }
    return res;
  }).catch(function () {
    return caches.match(r, { ignoreSearch: true }).then(function (m) { return m || caches.match(u.pathname.indexOf('admin') >= 0 ? 'admin.html' : u.pathname.indexOf('staff') >= 0 ? 'staff.html' : 'index.html'); });
  }));
});
