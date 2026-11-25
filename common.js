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
  /* kaam chalte waqt upar patti + cursor, taaki pata rahe ki click ho gaya aur kaam ho raha hai */
  var busyN = 0;
  function busyOn() { busyN++; if (busyN === 1) { var b = document.createElement('div'); b.id = 'busybar'; b.className = 'busybar'; b.setAttribute('role', 'progressbar'); b.setAttribute('aria-label', 'Kaam ho raha hai'); document.body.appendChild(b); document.body.classList.add('busy'); } }
  function busyOff() { busyN = Math.max(0, busyN - 1); if (busyN === 0) { var b = document.getElementById('busybar'); if (b) b.remove(); document.body.classList.remove('busy'); } }
  /* "Kaam ho gaya" ki chhoti screen: title + details ki list (ID, naam, mobile ...) + Copy / Theek hai */
  C.done = function (title, rows, note) {
    var old = document.getElementById('doneBox'); if (old) old.remove();
    var ov = document.createElement('div'); ov.className = 'imged-ov'; ov.id = 'doneBox'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    var tr = (rows || []).filter(function (r) { return r && r[1] !== '' && r[1] != null; }).map(function (r) { return '<tr><th>' + C.esc(r[0]) + '</th><td>' + C.esc(r[1]) + '</td></tr>'; }).join('');
    ov.innerHTML = '<div class="imged donebox"><div class="done-tick" aria-hidden="true">\u2713</div><h3>' + C.esc(title) + '</h3>' + (tr ? '<table class="donetbl"><tbody>' + tr + '</tbody></table>' : '') + (note ? '<p class="sm mu">' + C.esc(note) + '</p>' : '') +
      '<div class="imged-row"><button type="button" class="btn" id="doneOk">Theek hai</button>' + (tr ? '<button type="button" class="btn sec" id="doneCopy">Details copy karein</button>' : '') + '</div></div>';
    document.body.appendChild(ov);
    var text = title + '\n' + (rows || []).filter(function (r) { return r && r[1] !== '' && r[1] != null; }).map(function (r) { return r[0] + ': ' + r[1]; }).join('\n');
    ov.querySelector('#doneOk').addEventListener('click', function () { ov.remove(); });
    var cp = ov.querySelector('#doneCopy'); if (cp) cp.addEventListener('click', function () { C.copy(text); });
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    ov.querySelector('#doneOk').focus();
  };
  /* ID dhundhna: "a2z-s-1", "A2Z-C-00012", mobile ya naam se. recs = [{kind, serial, name, phone, extra}] */
  C.idKey = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^(a2z[a-z])0*(\d+)$/, '$1$2'); };
  C.findIds = function (q, recs) {
    var raw = String(q || '').trim(); if (raw.length < 2) return [];
    var k = C.idKey(raw), digits = raw.replace(/\D/g, ''), low = raw.toLowerCase();
    return recs.filter(function (r) {
      var sk = C.idKey(r.serial);
      if (sk && (sk === k || (k.length >= 5 && sk.indexOf(k) === 0))) return true;
      if (digits.length >= 3 && String(r.phone || '').replace(/\D/g, '').indexOf(digits) >= 0) return true;
      return String(r.name || '').toLowerCase().indexOf(low) >= 0;
    }).slice(0, 40);
  };
  C.toast = function (m) { var t = C.$('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('on'); }, 2800); };

  /* Apps Script se baat: har request POST {a:'kaam', ...data, t:admin token, st:staff token}.
     Purane REST jaise naam (GET /api/admin/data?month=..) yahan action me badal jate hain. */
  var TKEY = 'a2z_admin_token';
  /* login tab tak rahe jab tak logout na karein: localStorage me rakhte hain (refresh / naya tab / mobile band-khol par bhi) */
  function tget() { try { return localStorage.getItem(TKEY) || sessionStorage.getItem(TKEY) || ''; } catch (e) { return ''; } }
  function tset(v) { try { if (v) { localStorage.setItem(TKEY, v); } else { localStorage.removeItem(TKEY); sessionStorage.removeItem(TKEY); } } catch (e) { try { if (v) sessionStorage.setItem(TKEY, v); else sessionStorage.removeItem(TKEY); } catch (x) { /* ignore */ } } }
  C.api = async function (method, url, body, headers) {
    var cfg = window.A2Z_CONFIG || {}, base = cfg.API_URL || '';
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(base)) throw new Error('config.js me Apps Script ka link (API_URL) abhi daala nahi gaya. Guide dekhein.');
    var u = String(url).replace(/^\/api\//, ''), qi = u.indexOf('?'), action = qi < 0 ? u : u.slice(0, qi), q = {};
    if (qi >= 0) u.slice(qi + 1).split('&').forEach(function (p) { var kv = p.split('='); q[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); });
    var r, j = null; busyOn();
    try {
      if (action === 'health') r = await fetch(base, { method: 'GET', cache: 'no-store' });
      else {
        var payload = Object.assign({}, body || {}, q, { a: action });
        var t = tget(); if (t) payload.t = t;
        if (headers && headers['x-staff-token']) payload.st = headers['x-staff-token'];
        r = await fetch(base, { method: 'POST', cache: 'no-store', body: JSON.stringify(payload) });   // content-type nahi: "simple request", Google ke liye zaruri
      }
      j = await r.json();
    } catch (e) { busyOff(); throw new Error('Server se connect nahi ho pa raha. Internet jaanchein ya thodi der baad koshish karein.'); }
    busyOff();
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
  C.xlsxDownload = function (rows, name, sheet, widths, title, period) {
    C.download(A2ZXlsx.writeBook([{ name: sheet, rows: rows, widths: widths, title: title }], { period: period || '' }), name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  /* ---------- photo / document: edit + crop + 100 KB se chhoti JPEG ----------
   * P.photoFromFile(file, {kind:'photo'|'doc'}) -> Promise<dataURL>.  Editor me: crop (khichkar / zoom), ghumana, roshni, contrast.
   * Save dabate hi file apne-aap 100 KB (max 100000 bytes) ke andar ho jati hai. Cancel par reject('cancel'). */
  var MAXB = 100000;
  C.MAX_IMG_BYTES = MAXB;
  C.dataUrlBytes = function (u) { var i = String(u).indexOf(','); var b64 = String(u).slice(i + 1); return Math.floor(b64.length * 3 / 4) - (b64.slice(-2) === '==' ? 2 : b64.slice(-1) === '=' ? 1 : 0); };
  C.kb = function (n) { return (Math.round(n / 102.4) / 10).toFixed(1) + ' KB'; };
  var ASPECTS = { photo: [4, 5], doc: [1, 1.414], wide: [1.414, 1], sq: [1, 1] };
  C.encodeUnder = function (cv, maxBytes) {
    /* canvas ko JPEG me badal kar maxBytes ke andar le aata hai: pehle quality ghatata, phir size chhota karta */
    var cur = cv, scale = 1;
    for (var round = 0; round < 12; round++) {
      var q = 0.9;
      while (q >= 0.35) { var out = cur.toDataURL('image/jpeg', q); if (C.dataUrlBytes(out) <= maxBytes) return out; q -= 0.1; }
      scale *= 0.85; var c2 = document.createElement('canvas'); c2.width = Math.max(40, Math.round(cv.width * scale)); c2.height = Math.max(40, Math.round(cv.height * scale));
      var x2 = c2.getContext('2d'); x2.fillStyle = '#fff'; x2.fillRect(0, 0, c2.width, c2.height); x2.drawImage(cv, 0, 0, c2.width, c2.height); cur = c2;
    }
    return cur.toDataURL('image/jpeg', 0.3);
  };
  C.photoFromFile = function (file, opt) {
    opt = opt || {};
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('Sirf photo (image) chunein')); return; }
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('Photo padh nahi pai')); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('Ye photo khul nahi rahi. Dusri photo chunein.')); };
        img.onload = function () { openEditor(img, opt, resolve, reject); };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  };
  function openEditor(img, opt, resolve, reject) {
    var VW = 300, kind = opt.kind === 'doc' ? 'doc' : 'photo', st = { rot: 0, zoom: 1, bri: 100, con: 100, ox: 0, oy: 0, asp: kind };
    var ov = document.createElement('div'); ov.className = 'imged-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="imged"><h3>' + (kind === 'doc' ? 'Document edit karein' : 'Photo edit karein') + '</h3>' +
      '<p class="sm mu">Photo ko ungli / mouse se khichkar sahi jagah layein. Zoom se crop karein. Save karte hi file 100 KB ke andar ho jayegi.</p>' +
      '<div class="imged-view"><canvas id="imgCv"></canvas></div>' +
      '<div class="imged-row"><label>Frame <select id="imgAsp"><option value="photo">Photo (4:5)</option><option value="doc">Document (A4 khada)</option><option value="wide">Document (A4 lita)</option><option value="sq">Chauras</option></select></label></div>' +
      '<div class="imged-row"><label>Zoom / crop <input id="imgZoom" type="range" min="100" max="400" value="100"></label><label>Roshni <input id="imgBri" type="range" min="60" max="160" value="100"></label><label>Contrast <input id="imgCon" type="range" min="60" max="180" value="100"></label></div>' +
      '<div class="imged-row"><button type="button" class="btn sm sec" id="imgRl">↶ Ghumayein</button><button type="button" class="btn sm sec" id="imgRr">↷ Ghumayein</button><button type="button" class="btn sm sec" id="imgReset">Reset</button></div>' +
      '<div class="sm" id="imgInfo" aria-live="polite"></div>' +
      '<div class="imged-row"><button type="button" class="btn" id="imgSave">Save (100 KB ke andar)</button><button type="button" class="btn sec" id="imgCancel">Cancel</button></div></div>';
    document.body.appendChild(ov);
    var $o = function (id) { return ov.querySelector('#' + id); }, cv = $o('imgCv'), cx = cv.getContext('2d');
    $o('imgAsp').value = st.asp;
    function dims() { var r = ASPECTS[st.asp], w = r[0] >= r[1] ? VW : Math.round(VW * r[0] / r[1] * 1.0), h = r[0] >= r[1] ? Math.round(VW * r[1] / r[0]) : VW; if (r[0] < r[1]) { w = Math.round(VW * r[0] / r[1]); h = VW; } return [w, h]; }
    function draw(c, w, h, scaleOut) {
      /* image ko rotate karke frame me bitha deta hai. ox, oy frame ke hisaab se (0..1) */
      var rot = st.rot % 360, sw = (rot % 180) ? img.height : img.width, sh = (rot % 180) ? img.width : img.height;
      var base = Math.max(w / sw, h / sh) * st.zoom, x = c.getContext('2d');
      x.save(); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
      x.filter = 'brightness(' + st.bri + '%) contrast(' + st.con + '%)';
      var mx = Math.max(0, (sw * base - w) / 2), my = Math.max(0, (sh * base - h) / 2);
      x.translate(w / 2 + Math.max(-mx, Math.min(mx, st.ox * w)), h / 2 + Math.max(-my, Math.min(my, st.oy * h)));
      x.rotate(rot * Math.PI / 180); x.scale(base, base); x.drawImage(img, -img.width / 2, -img.height / 2); x.restore();
    }
    function paint() { var d = dims(); cv.width = d[0]; cv.height = d[1]; draw(cv, d[0], d[1]); }
    function info() { try { var d = dims(), k = 900 / Math.max(d[0], d[1]), o = document.createElement('canvas'); o.width = Math.round(d[0] * k); o.height = Math.round(d[1] * k); draw(o, o.width, o.height); $o('imgInfo').textContent = 'Abhi file ka size: lagbhag ' + C.kb(C.dataUrlBytes(C.encodeUnder(o, MAXB))) + ' (limit 100 KB)'; } catch (e) {} }
    var tmr = null; function upd() { paint(); clearTimeout(tmr); tmr = setTimeout(info, 250); }
    var drag = null;
    cv.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, ox: st.ox, oy: st.oy }; try { cv.setPointerCapture(e.pointerId); } catch (x) {} });
    cv.addEventListener('pointermove', function (e) { if (!drag) return; st.ox = drag.ox + (e.clientX - drag.x) / cv.clientWidth; st.oy = drag.oy + (e.clientY - drag.y) / cv.clientHeight; paint(); });
    var end = function () { if (drag) { drag = null; info(); } }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', function (e) { e.preventDefault(); st.zoom = Math.max(1, Math.min(4, st.zoom + (e.deltaY < 0 ? .1 : -.1))); $o('imgZoom').value = Math.round(st.zoom * 100); upd(); }, { passive: false });
    $o('imgZoom').addEventListener('input', function (e) { st.zoom = e.target.value / 100; upd(); });
    $o('imgBri').addEventListener('input', function (e) { st.bri = +e.target.value; upd(); });
    $o('imgCon').addEventListener('input', function (e) { st.con = +e.target.value; upd(); });
    $o('imgAsp').addEventListener('change', function (e) { st.asp = e.target.value; st.ox = st.oy = 0; upd(); });
    $o('imgRl').addEventListener('click', function () { st.rot = (st.rot + 270) % 360; st.ox = st.oy = 0; upd(); });
    $o('imgRr').addEventListener('click', function () { st.rot = (st.rot + 90) % 360; st.ox = st.oy = 0; upd(); });
    $o('imgReset').addEventListener('click', function () { st.rot = 0; st.zoom = 1; st.bri = 100; st.con = 100; st.ox = st.oy = 0; $o('imgZoom').value = 100; $o('imgBri').value = 100; $o('imgCon').value = 100; upd(); });
    function close() { clearTimeout(tmr); ov.remove(); }
    $o('imgCancel').addEventListener('click', function () { close(); reject(new Error('cancel')); });
    $o('imgSave').addEventListener('click', function () {
      try {
        var d = dims(), k = (kind === 'doc' || st.asp !== 'photo' ? 1100 : 640) / Math.max(d[0], d[1]), o = document.createElement('canvas'); o.width = Math.round(d[0] * k); o.height = Math.round(d[1] * k); draw(o, o.width, o.height);
        var out = C.encodeUnder(o, MAXB); close(); resolve(out);
      } catch (e) { close(); reject(new Error('Photo save nahi ho pai. Dusri photo chunein.')); }
    });
    paint(); info();
  }
  /* documents ke 4 khane (Aadhaar aage / peeche, bank passbook, anya) */
  C.DOCS = [['aadhaar', 'Aadhaar (aage)'], ['aadhaarBack', 'Aadhaar (peeche)'], ['bank', 'Bank passbook / cheque'], ['other', 'Anya document']];
  C.docSlots = function (have, pending, canView) {
    have = have || []; pending = pending || {};
    return '<div class="docslots span-all"><b>Documents (photo khinch kar ya file se; har file 100 KB ke andar apne-aap)</b><div class="docgrid">' + C.DOCS.map(function (d) {
      var k = d[0], isNew = !!pending[k], saved = have.indexOf(k) >= 0;
      return '<div class="doccard"><div class="b">' + C.esc(d[1]) + '</div><div class="sm ' + (isNew || saved ? 'ok' : 'mu') + '">' + (isNew ? 'Naya chuna (' + C.kb(C.dataUrlBytes(pending[k])) + ')' : saved ? 'Save hai' : 'Khali') + '</div>' +
        '<label class="btn sec sm file-btn mt6">' + (isNew || saved ? 'Badlein' : 'Chunein') + '<input type="file" accept="image/*" class="hide doc-file" data-doc="' + k + '"></label>' +
        (isNew ? ' <button type="button" class="link" data-act="docpend" data-doc="' + k + '">Dekhein</button>' : saved && canView ? ' <button type="button" class="link" data-act="docview" data-doc="' + k + '">Dekhein</button>' : '') +
        (isNew ? ' <button type="button" class="link danger" data-act="docdrop" data-doc="' + k + '">Hatayein</button>' : '') + '</div>';
    }).join('') + '</div></div>';
  };
  C.viewImage = function (url, title) {
    var ov = document.createElement('div'); ov.className = 'imged-ov'; ov.setAttribute('role', 'dialog');
    ov.innerHTML = '<div class="imged"><h3>' + C.esc(title || 'Document') + '</h3><div class="imged-view"><img id="viewImg" alt="document"></div><div class="imged-row"><button type="button" class="btn sec" id="viewClose">Band karein</button></div></div>';
    ov.querySelector('#viewImg').src = url; ov.querySelector('#viewClose').addEventListener('click', function () { ov.remove(); }); document.body.appendChild(ov);
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
