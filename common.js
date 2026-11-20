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

  /* fetch wrapper: throws an Error whose message is the server's text (Hindi/Hinglish) */
  C.api = async function (method, url, body, headers) {
    var opt = { method: method, headers: Object.assign({}, headers || {}), credentials: 'same-origin' };
    if (body !== undefined) { opt.headers['content-type'] = 'application/json'; opt.body = JSON.stringify(body); }
    var r, j = null;
    try { r = await fetch(url, opt); } catch (e) { throw new Error('Server se connect nahi ho pa raha. Internet jaanchein.'); }
    try { j = await r.json(); } catch (e) { /* not json */ }
    if (!r.ok) { var err = new Error((j && j.error) || ('Galti ' + r.status)); err.status = r.status; err.errors = j && j.errors; throw err; }
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

  C.tradeLine = function (trades) {
    return trades.length ? trades.map(function (t) { return t.count + ' ' + C.esc(t.trade); }).join(' · ') : '<span class="mu">Abhi koi candidate nahi</span>';
  };
  C.waLink = function (phone, text) { return 'https://wa.me/91' + String(phone || '').replace(/\D/g, '').slice(-10) + '?text=' + encodeURIComponent(text); };
})();
