/* FILE: common.js  (GitHub par isi naam se upload karein) */
/* Shared helpers for the admin console and the staff page */
(function () {
  'use strict';
  var C = window.P = {};
  C.$ = function (s, r) { return (r || document).querySelector(s); };
  C.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  C.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  C.inr = function (n) { n = +n || 0; return (n < 0 ? '−' : '') + '₹' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); };
  C.nf = function (n) { return (+n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }); };
  C.dt = function (iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d)) return '';
    return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  };
  C.dd = function (iso) {
    if (!iso) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); if (!m) return '';
    return m[3] + '-' + m[2] + '-' + m[1];
  };
  C.thisMonth = function () { return new Date(Date.now() + 330 * 60000).toISOString().slice(0, 7); };
  C.monthName = function (m) {
    var n = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return /^\d{4}-\d{2}$/.test(m) ? n[+m.slice(5) - 1] + ' ' + m.slice(0, 4) : m;
  };
  var tt;
  C.toast = function (m) { var t = C.$('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('on'); }, 2800); };

  /* Apps Script se baat: har request POST {a:'kaam', ...data, t:admin token, st:staff token}.
     Purane REST jaise naam (GET /api/admin/data?month=..) yahan action me badal jate hain. */
  var TKEY = 'a2z_admin_token';
  function tget() { try { return sessionStorage.getItem(TKEY) || ''; } catch (e) { return ''; } }
  function tset(v) { try { if (v) sessionStorage.setItem(TKEY, v); else sessionStorage.removeItem(TKEY); } catch (e) { /* ignore */ } }
  C.api = async function (method, url, body, headers) {
    var cfg = window.A2Z_CONFIG || {}, base = cfg.API_URL || '';
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(base)) throw new Error('config.js me Apps Script ka link (API_URL) abhi daala nahi gaya. Guide dekhein.');
    var u = String(url).replace(/^\/api\//, ''), qi = u.indexOf('?'), action = qi < 0 ? u : u.slice(0, qi), q = {};
    if (qi >= 0) u.slice(qi + 1).split('&').forEach(function (p) { var kv = p.split('='); q[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); });
    var r, j = null;
    try {
      if (action === 'health') r = await fetch(base, { method: 'GET', cache: 'no-store' });
      else {
        var payload = Object.assign({}, body || {}, q, { a: action });
        var t = tget(); if (t) payload.t = t;
        if (headers && headers['x-staff-token']) payload.st = headers['x-staff-token'];
        r = await fetch(base, { method: 'POST', cache: 'no-store', body: JSON.stringify(payload) });   // content-type nahi: "simple request", Google ke liye zaruri
      }
      j = await r.json();
    } catch (e) { throw new Error('Server se connect nahi ho pa raha. Internet jaanchein ya thodi der baad koshish karein.'); }
    if (!j || typeof j !== 'object') throw new Error('Server ka jawab samajh nahi aaya');
    var code = j._s || 200;
    if (action === 'admin/verify' && code === 200 && j.token) { tset(j.token); delete j.token; }
    if (action === 'admin/logout' || (action === 'admin/password' && code === 200)) tset('');
    if (code === 401 && /^admin\//.test(action) && action !== 'admin/login' && action !== 'admin/verify' && action !== 'admin/password' && action !== 'admin/contact') tset('');
    if (code >= 400) { var err = new Error(j.error || ('Galti ' + code)); err.status = code; err.errors = j.errors; throw err; }
    return j;
  };

  C.copy = function (text) {
    function fb() { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); C.toast('Copy ho gaya'); } catch (e) { C.toast('Copy nahi hua, khud chunkar copy karein'); } t.remove(); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { C.toast('Copy ho gaya'); }, fb); else fb();
  };

  C.download = function (bytes, name, type) {
    var blob = new Blob([bytes], { type: type || 'application/octet-stream' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  };
  C.xlsxDownload = function (rows, name, sheet, widths) {
    C.download(A2ZXlsx.write(rows, sheet, widths), name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

    /* ---------- photo: file -> chhoti JPEG (dataURL). Server ko 400KB se badi nahi chahiye ---------- */
  C.photoFromFile = function (file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('Sirf photo (image) chunein')); return; }
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('Photo padh nahi pai')); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('Ye photo khul nahi rahi. Dusri photo chunein.')); };
        img.onload = function () {
          var max = 480, k = Math.min(1, max / Math.max(img.width, img.height)), w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
          var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
          var q = 0.82, out = cv.toDataURL('image/jpeg', q);
          while (out.length > 260000 && q > 0.3) { q -= 0.1; out = cv.toDataURL('image/jpeg', q); }
          resolve(out);
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  };

  /* ---------- ID card (PNG): staff ya candidate. o = {kind, serial, name, role, mobile, lines:[..], photo, joined} ---------- */
  C.idCard = function (o) {
    return new Promise(function (resolve) {
      var W = 760, H = 480, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var x = cv.getContext('2d'), staff = o.kind === 'staff';
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
      x.fillStyle = staff ? '#14365c' : '#1f5d3a'; x.fillRect(0, 0, W, 92);
      x.fillStyle = '#ffffff'; x.font = '800 34px Arial, sans-serif'; x.fillText('A2Z BUILD TECH', 28, 50);
      x.font = '15px Arial, sans-serif'; x.fillText('All Type Manpower Supplier  |  ' + (staff ? 'STAFF ID CARD' : 'WORKER ID CARD'), 28, 76);
      x.fillStyle = '#e8eef5'; x.fillRect(28, 120, 220, 270); x.strokeStyle = '#9aa7b5'; x.lineWidth = 2; x.strokeRect(28, 120, 220, 270);
      function text() {
        x.fillStyle = '#111'; x.textBaseline = 'alphabetic';
        x.font = '700 30px Arial, sans-serif'; x.fillText(String(o.name || '').slice(0, 26), 275, 150);
        x.font = '18px Arial, sans-serif'; x.fillStyle = '#444'; x.fillText(String(o.role || ''), 275, 180);
        x.fillStyle = '#111'; x.font = '800 30px Arial, sans-serif'; x.fillText(String(o.serial || ''), 275, 235);
        x.font = '16px Arial, sans-serif'; x.fillStyle = '#222';
        var y = 275, lines = [].concat(o.mobile ? ['Mobile: ' + o.mobile] : [], o.joined ? ['Joining: ' + o.joined] : [], o.lines || []);
        lines.slice(0, 5).forEach(function (l) { x.fillText(String(l).slice(0, 44), 275, y); y += 26; });
        x.fillStyle = staff ? '#14365c' : '#1f5d3a'; x.fillRect(0, H - 62, W, 62);
        x.fillStyle = '#fff'; x.font = '14px Arial, sans-serif';
        x.fillText('Vivek Nagar, Ward no. 19, Maihar, MP - 485771', 28, H - 36); x.fillText('a2zbuildtech@gmail.com', 28, H - 14);
        x.textAlign = 'right'; x.fillText('Company seal / signature', W - 28, H - 14); x.textAlign = 'left';
        var lg = new Image(); lg.onload = function () { x.drawImage(lg, W - 88, 8, 76, 76); resolve(cv); }; lg.onerror = function () { resolve(cv); }; lg.src = 'logo.svg';
      }
      if (!o.photo) { x.fillStyle = '#777'; x.font = '16px Arial, sans-serif'; x.fillText('Photo nahi', 98, 260); text(); return; }
      var im = new Image(); im.onload = function () {
        var k = Math.max(220 / im.width, 270 / im.height), w = im.width * k, h = im.height * k;
        x.save(); x.beginPath(); x.rect(28, 120, 220, 270); x.clip(); x.drawImage(im, 28 + (220 - w) / 2, 120 + (270 - h) / 2, w, h); x.restore(); text();
      };
      im.onerror = function () { text(); }; im.src = o.photo;
    });
  };
  C.idCardShow = async function (o) {
    var cv = await C.idCard(o), url = cv.toDataURL('image/png');
    var box = document.createElement('div'); box.id = 'idmodal'; box.className = 'modal';
    box.innerHTML = '<div class="modal-in"><img alt="ID card" class="idimg" src="' + url + '"><div class="row noprint"><button class="btn" data-idact="dl">PNG download</button><button class="btn sec" data-idact="print">Print</button><button class="btn sec" data-idact="close">Band karein</button></div></div>';
    document.body.appendChild(box);
    box.addEventListener('click', function (e) {
      var a = e.target.getAttribute && e.target.getAttribute('data-idact');
      if (a === 'close' || e.target === box) box.remove();
      else if (a === 'print') { document.body.classList.add('printing-id'); window.print(); setTimeout(function () { document.body.classList.remove('printing-id'); }, 500); }
      else if (a === 'dl') { var l = document.createElement('a'); l.href = url; l.download = (o.serial || 'id-card') + '.png'; document.body.appendChild(l); l.click(); l.remove(); }
    });
  };

  C.tradeLine = function (trades) {
    return trades.length ? trades.map(function (t) { return t.count + ' ' + C.esc(t.trade); }).join(' · ') : '<span class="mu">Abhi koi candidate nahi</span>';
  };
  C.waLink = function (phone, text) { return 'https://wa.me/91' + String(phone || '').replace(/\D/g, '').slice(-10) + '?text=' + encodeURIComponent(text); };
})();
