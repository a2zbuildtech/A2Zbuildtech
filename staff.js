/* FILE: staff.js  (GitHub par isi naam se upload karein) */
/* A2Z Build Tech - STAFF PANEL: login / registration, profile + ID card, candidate admission form,
   roz ki hazri (live payment), apna hisaab. Staff sirf apna hi data dekhta hai (server ye pakka karta hai). */
(function () {
  'use strict';
  var $ = P.$, esc = P.esc, inr = P.inr, nf = P.nf;
  var HASH = (location.hash || '').slice(1), SKEY = 'a2z_staff_token';
  function tget() { try { return localStorage.getItem(SKEY) || sessionStorage.getItem(SKEY) || ''; } catch (e) { return ''; } }
  function tset(v) { try { if (v) { localStorage.setItem(SKEY, v); } else { localStorage.removeItem(SKEY); sessionStorage.removeItem(SKEY); } } catch (e) { try { if (v) sessionStorage.setItem(SKEY, v); else sessionStorage.removeItem(SKEY); } catch (x) { /* ignore */ } } }
  var LINK = /^[0-9a-f]{32}$/.test(HASH);                 // purana seedha link bhi chalta hai
  var TOKEN = LINK ? HASH : tget();
  var S = { month: P.thisMonth(), tab: 'home', view: null, screen: '', f: {}, form: null, hz: null, duty: {}, adv: null, af: {}, hzParty: '', q: '', photos: {}, rq: null, pw: false, msg: '' };
  var TYPE = { agent: 'Staff', supplier: 'Manpower supplier', supervisor: 'Site supervisor', office: 'Office staff' };
  var OFFICE_TABS = ['home', 'duty', 'hisaab', 'ids', 'help'];
  function tabs() { return S.view && S.view.staff && S.view.staff.type === 'office' ? TABS.filter(function (t) { return OFFICE_TABS.indexOf(t[0]) >= 0; }) : TABS; }
  var TABS = [['home', 'Meri profile / ID'], ['cands', 'Candidates'], ['duty', 'Duty (IN / OUT)'], ['hazri', 'Hazri (Daily)'], ['work', 'Daily Kaam'], ['hisaab', 'Mera hisaab'], ['ids', 'ID dekhein'], ['help', 'Madad (Help)']];

  function api(method, url, body) { return P.api(method, url, body, { 'x-staff-token': TOKEN }); }
  function unit() { return S.view && S.view.perDay ? '/din' : '/mahina'; }

  /* ---------- chhote form helpers ---------- */
  function fld(label, key, o) {
    o = o || {}; var v = S.f[key] == null ? '' : S.f[key];
    return '<label>' + esc(label) + (o.req ? ' *' : '') + '<input data-f="' + key + '" type="' + (o.type || 'text') + '" value="' + esc(v) + '"' + (o.list ? ' list="' + o.list + '"' : '') + (o.max ? ' maxlength="' + o.max + '"' : '') + (o.mode ? ' inputmode="' + o.mode + '"' : '') + ' autocomplete="off"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + '>' + (window.A2ZHints ? A2ZHints.html(o.hintKey || key) : '') + '</label>';
  }
  function photoBox(dataUrl, hint) { return '<div><div class="photo-box" id="pbox">' + (dataUrl ? '<img alt="photo" src="' + esc(dataUrl) + '">' : esc(hint || 'Photo')) + '</div><label class="btn sec sm file-btn mt6">Photo chunein<input type="file" id="photoFile" accept="image/*" class="hide"></label></div>'; }
  function showPage(html) { $('#app').innerHTML = html; }
  function setTopbar(on) { ['monthBox', 'tabs', 'logout'].forEach(function (id) { $('#' + id).classList.toggle('hide', !on || (id === 'logout' && LINK)); }); }

  /* ---------- login / registration ---------- */
  function loginScreen(msg) {
    S.screen = 'login'; setTopbar(false); $('#who').textContent = 'A2Z Build Tech'; $('#whoSub').textContent = 'Staff panel';
    showPage('<div class="panel login"><h2>Staff login</h2>' + (msg ? '<div class="note warn">' + esc(msg) + '</div>' : '') +
      '<label>Staff ID (jaise A2Z-S-0001) ya mobile number<input id="lid" autocomplete="username" maxlength="40"></label>' +
      '<label>Password<input id="lpw" type="password" autocomplete="current-password" maxlength="100"></label>' +
      '<div class="msg" id="lmsg" role="alert"></div><button class="btn" data-act="login">Login</button>' +
      '<div class="sm"><button class="link" data-act="forgot">Password bhool gaye?</button></div><hr><p class="sm">Pehli baar aaye hain?</p><button class="btn sec" data-act="regform">Naya staff registration</button></div>');
    $('#lid').focus();
  }
  function regScreen() {
    S.screen = 'reg'; setTopbar(false);
    showPage('<div class="panel"><h2>Naya staff registration</h2><div class="note">Apni poori jankari bharein aur photo lagayein. Admin jaanch kar <b>approve</b> karega, tabhi aapka Staff ID banega aur login chalega.</div>' +
      '<div class="row ai-start">' + photoBox(S.f.photo, 'Apni photo') + '<div class="form-grid grow">' +
      fld('Poora naam', 'name', { req: 1, max: 80 }) + fld('Pita / pati ka naam', 'father', { max: 80 }) + fld('Janm tithi', 'dob', { type: 'date' }) +
      fld('Mobile number', 'phone', { req: 1, mode: 'numeric', max: 14 }) + fld('Email', 'email', { type: 'email', max: 80 }) + fld('Pura pata', 'address', { req: 1, max: 200 }) +
      '</div></div>' + P.docSlots([], S.f.docs, false) + '<div class="sec-h">Bank / pehchan (zaruri hone par)</div><div class="form-grid">' +
      fld('Aadhaar number (12 ank)', 'aadhaar', { mode: 'numeric', max: 14 }) + fld('Bank khata number', 'bank', { mode: 'numeric', max: 22 }) + fld('IFSC', 'ifsc', { max: 11, ph: 'SBIN0001234' }) + fld('UPI ID', 'upi', { max: 60 }) +
      '</div><div class="sec-h">Apna password banayein</div><div class="form-grid">' +
      fld('Password (10+ akshar, akshar aur ank dono)', 'pass', { type: 'password', req: 1, max: 100 }) + fld('Password dobara', 'pass2', { type: 'password', req: 1, max: 100 }) +
      '</div>' + '<label class="consent span-all"><input type="checkbox" id="consentBox"> Maine <a href="terms.html" target="_blank" rel="noopener">Terms / Niyam aur Shartein</a> padh liye hain aur main unse tatha apni photo, documents aur jankari ke kaam ke liye istemal (DPDP Act) se sahmat hu.</label>' +
      '<div class="hide"><input data-f="website" tabindex="-1" autocomplete="off" aria-hidden="true"></div>' +
      '<div class="msg" id="lmsg" role="alert"></div><div class="row"><button class="btn" data-act="register">Registration bhejein</button><button class="btn sec" data-act="backlogin">Wapas login par</button></div></div>');
  }

  /* ---------- load ---------- */
  async function load() {
    try { S.view = await api('GET', '/api/staff/me?month=' + S.month); }
    catch (e) {
      if (!LINK && e.status === 401) { tset(''); TOKEN = ''; loginScreen('Login ka samay khatam ho gaya. Dobara login karein.'); return; }
      setTopbar(false); showPage('<div class="note warn"><b>Ye kaam nahi kar raha.</b><br>' + esc(e.message) + '</div>' + (LINK ? '' : '<button class="btn" data-act="backlogin">Login par jayein</button>')); return;
    }
    S.screen = 'app'; $('#who').textContent = S.view.staff.name; $('#whoSub').textContent = (TYPE[S.view.staff.type] || 'Staff') + (S.view.staff.serial ? ' · ' + S.view.staff.serial : '');
    setTopbar(true); $('#month').value = S.month; S.hz = null; render(); pingSync();
  }
  function render() {
    if (S.screen !== 'app') return;
    var sx = ($('#hzs') || {}).scrollLeft;
    if (tabs().every(function (t) { return t[0] !== S.tab; })) S.tab = 'home';
    $('#tabs').innerHTML = tabs().map(function (t) { return '<button data-act="tab" data-id="' + t[0] + '" aria-current="' + (t[0] === S.tab) + '">' + t[1] + (t[0] === 'cands' && pendingCands() ? ' (' + pendingCands() + ')' : '') + '</button>'; }).join('');
    showPage(({ home: homeView, cands: candsView, hazri: hazriView, work: workView, duty: dutyView, hisaab: hisaabView, ids: idsView, help: helpView })[S.tab]());
    if (S.tab === 'help' && window.A2ZHelp) window.A2ZHelp.mount($('#helpBox'), 'staff', { ai: function (q, kb, hist) { return api('POST', '/api/staff/ai', { q: q, kb: kb, hist: hist }); }, quick: ['s-register', 's-cand-add', 's-hazri', 's-hisaab', 's-profile', 's-search', 's-rate'], hello: 'Staff panel ke saare kaam: login, registration, ID card, candidate admission form, hazri, hisaab. Apna sawal likhein, jaise "admission form kahan se milega?"' });
    if (sx && $('#hzs')) $('#hzs').scrollLeft = sx;
  }
  /* ---------- Daily Kaam (staff sirf entry karta hai; rate / keemat / munafa ise dikhte hi nahi) ---------- */
  function workView() {
    var Wk = window.A2ZWork, w = S.view.work || { works: [], labour: [], sites: [], logs: [] };
    return '<div class="row between"><h2>Daily Kaam</h2><button class="btn" data-wact="wnew">+ Aaj ka kaam likhein</button></div><div class="note">Yahan roz ka kaam aur kitne labour lage wo likhein. Kaam ka rate aur hisaab sirf admin dekhta hai. Admin ka jawab (theek hai / sudhar karein) neeche dikhega.</div>' +
      (Wk.st.open ? Wk.form('Naya kaam / badlav') : '') + Wk.staffList(w.logs);
  }
  (function () {
    var Wk = window.A2ZWork; if (!Wk) return;
    Wk.host = {
      admin: false,
      ctx: function () {
        var w = S.view.work || { works: [], labour: [], sites: [] };
        return { parties: S.view.parties.filter(function (p) { return p.model !== 'labour'; }), works: w.works, labour: w.labour, sites: w.sites, teams: [], today: new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10), catalog: [], staff: [] };
      },
      logs: function () { return (S.view.work && S.view.work.logs) || []; },
      render: function () { render(); },
      call: function (path, body) { return api('POST', '/api/staff/' + path, body); },
      save: async function (p) { await api('POST', '/api/staff/work-save', p); await load(); P.toast('\u2713 Kaam save ho gaya'); },
      del: async function (id) { await api('POST', '/api/staff/work-del', { id: id }); await load(); P.toast('Entry hata di'); },
      excel: function () {}
    };
  })();
  /* ---------- Duty IN / OUT ---------- */
  function dutyView() { return window.A2ZDuty.staffHtml(S.view.duty, S.duty); }
  var pingT = null;
  function pingSync() {
    var on = S.view && S.view.duty && S.view.duty.open;
    if (!on) { if (pingT) { clearInterval(pingT); pingT = null; } return; }
    if (pingT) return;
    var send = function () { if (document.hidden) return; window.A2ZDuty.pos(true).then(function (p) { return api('POST', '/api/staff/duty-ping', p); }).then(function (r) { if (r && r.on === false) { load(); } }).catch(function () {}); };
    send(); pingT = setInterval(send, 5 * 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && pingT) send(); });
  }
  function getGps() {
    S.duty.gps = true; S.duty.err = ''; if (S.tab === 'duty') render();
    return window.A2ZDuty.pos(false).then(function (p) { S.duty.pos = p; S.duty.gps = false; S.duty.err = ''; }).catch(function (e) { S.duty.pos = null; S.duty.gps = false; S.duty.err = e.message; }).then(function () { if (S.tab === 'duty') render(); });
  }
  function helpView() { return '<h2>Madad (Help) - A2Z Sahayak</h2><div class="note">Koi bhi kaam samajh na aaye to yahan poochhein; step-by-step bataya jayega.</div><div id="helpBox"></div>'; }
  function pendingCands() { return S.view.candidates.filter(function (c) { return c.approval === 'pending'; }).length; }
  function k(l, v) { return '<div class="card"><span class="lbl">' + esc(l) + '</span><span class="kpi">' + v + '</span></div>'; }
  function approvalPill(a) { return a === 'approved' ? '<span class="pill good">approve</span>' : a === 'rejected' ? '<span class="pill bad">reject</span>' : '<span class="pill warn">approval baaki</span>'; }
  function hzPill(s) { return s === 'approved' ? '<span class="pill good">admin ne approve kiya</span>' : s === 'pending' ? '<span class="pill warn">admin approval baaki</span>' : s === 'rejected' ? '<span class="pill bad">admin ne wapas kiya</span>' : ''; }
  function summary() {
    var t = S.view.totals;
    return '<div class="cards">' + k('Candidates', t.candidates) + k('Kul din', nf(t.days)) + k('Candidates ka wage', inr(t.pay)) + k('Aapka commission', inr(t.commission)) + k('GST kata (' + S.view.gstPct + '%)', inr(t.gst)) + k('Aapko milega', inr(t.net)) +
      (t.fixed ? k('Fixed payment', inr(t.fixed)) : '') + (t.advance ? k('Advance liya', inr(t.advance)) : '') + (t.paid ? k('Aapko mil chuka', inr(t.paid)) : '') + k('Baaki milna', inr(t.payable)) + '</div>';
  }

  /* ---------- Meri profile / ID ---------- */
  /* ID dekhein: apni aur apne candidates ki ID, mobile / naam / ID likhkar */
  function idRecs() {
    var v = S.view, st = v.staff;
    return [{ kind: 'Meri ID', serial: st.serial, name: st.name, phone: st.phone, extra: TYPE[st.type] || '' }].concat(v.candidates.map(function (c) { return { kind: 'Candidate', serial: c.serial, name: c.name, phone: c.mobile, extra: (c.trade || '') + (c.partyName ? ' \u00b7 ' + c.partyName : '') + (c.approval === 'pending' ? ' \u00b7 approval baaki' : '') }; }));
  }
  function idRows(q) {
    if (!String(q || '').trim()) return '<div class="note">Mobile number, naam ya ID (jaise A2Z-C-00012 ya a2z-c-12) likhiye.</div>';
    var f = P.findIds(q, idRecs()); if (!f.length) return '<div class="note warn">Kuch nahi mila. Mobile ke kam se kam 3 ank, ya naam / ID ke 2 akshar likhiye.</div>';
    return '<div class="scroll"><table><thead><tr><th>Prakar</th><th>ID</th><th>Naam</th><th>Mobile</th><th>Jankari</th></tr></thead><tbody>' + f.map(function (r) { return '<tr><td>' + esc(r.kind) + '</td><td><b>' + esc(r.serial || '\u2014') + '</b></td><td>' + esc(r.name) + '</td><td>' + esc(r.phone || '') + '</td><td>' + esc(r.extra) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function idsView() {
    return '<h2>ID dekhein</h2><div class="card"><label>Mobile / naam / ID likhiye<input id="idq" type="search" inputmode="search" autocomplete="off" placeholder="jaise 9876543210, Ram ya A2Z-C-00012" value="' + esc(S.idq || '') + '"></label><div id="idres">' + idRows(S.idq) + '</div></div>';
  }
  function homeView() {
    var st = S.view.staff, ph = S.photos.self;
    if (st.hasPhoto && ph === undefined) fetchPhoto('self', 'self', '');
    return '<div class="card"><div class="row ai-start g18"><div class="photo-box">' + (ph ? '<img alt="photo" src="' + esc(ph) + '">' : 'Photo') + '</div><div class="grow"><h2>' + esc(st.name) + '</h2>' +
      '<div class="sm mu">' + esc(TYPE[st.type] || 'Staff') + '</div><div class="b big-serial">' + esc(st.serial || 'ID baaki') + '</div>' +
      '<div class="sm">Mobile: ' + esc(st.phone) + (st.email ? ' · ' + esc(st.email) : '') + '<br>' + (st.father ? 'Pita/pati: ' + esc(st.father) + '<br>' : '') + (st.dob ? 'Janm tithi: ' + P.dd(st.dob) + '<br>' : '') + (st.address ? 'Pata: ' + esc(st.address) + '<br>' : '') + 'Commission: ' + st.pct + '%</div>' +
      '<div class="row noprint mt10"><button class="btn" data-act="myid">Meri ID card</button><button class="btn sec" data-act="pwpanel">Password badlein</button></div></div></div></div>' +
      (S.pw ? '<div class="panel"><h3>Password badlein</h3><div class="form-grid">' + fld('Purana password', 'old', { type: 'password' }) + fld('Naya password (10+, akshar + ank)', 'npw', { type: 'password' }) + '</div><div class="msg" id="lmsg"></div><div class="row"><button class="btn" data-act="pwsave">Badlein</button><button class="btn sec" data-act="pwpanel">Rehne dein</button></div></div>' : '') +
      '<h2>' + P.monthName(S.month) + ' ka saar</h2>' + summary() +
      (S.view.pendingHazri ? '<div class="note warn">' + S.view.pendingHazri + ' candidate ki hazri admin ke approval me hai. Approve hone tak ye admin ke hisaab me nahi judti.</div>' : '') +
      (pendingCands() ? '<div class="note warn">' + pendingCands() + ' candidate ka approval baaki hai. "Candidates" tab me approve karein, tabhi hazri bhar paayenge.</div>' : '') +
      partyModes();
  }
  /* party kis tarah kaam deti hai: staff ko tarika aur "kya karna hai" dikhta hai (rate / bill nahi) */
  var MODEL_ST = {
    labour: ['Labour supply + commission', 'Labour ki payment party tay karti hai. Hazri roz bharein. Daily Kaam (naap) is party ke liye nahi likhna.'],
    measure: ['Naap / wazan / length ka kaam', 'Labour ki payment company tay karti hai. Hazri bharein aur "Daily Kaam" me roz ka naap aur labour likhein; party ka bill usi se banta hai.'],
    '': ['Tarika abhi admin ne tay nahi kiya', 'Pehle jaisa chalta hai: hazri roz bharein. Poochhna ho to Admin se kahein.']
  };
  function partyModes() {
    var ps = (S.view.parties || []); if (!ps.length) return '';
    return '<h3>Party kis tarah kaam deti hai</h3><div class="card scroll"><table><thead><tr><th>Party</th><th>Tarika</th><th>Aapko kya karna hai</th></tr></thead><tbody>' + ps.map(function (p) { var m = MODEL_ST[p.model || ''] || MODEL_ST['']; return '<tr><td>' + esc(p.name) + '</td><td><span class="pill ' + (p.model === 'labour' ? 'good' : p.model === 'measure' ? 'warn' : '') + '">' + esc(m[0]) + '</span></td><td class="sm">' + esc(m[1]) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  /* ---------- Candidates ---------- */
  /* khoj tez rahe: lowercase text ek baar cache hota hai; type karte waqt sirf table badalti hai */
  function candTable(qs) {
    var q = String(qs || '').toLowerCase().trim(), list = S.view.candidates.filter(function (c) { if (!q) return true; var hs = c._h || (c._h = (c.name + ' ' + c.serial + ' ' + c.mobile + ' ' + c.trade + ' ' + c.partyName).toLowerCase()); return hs.indexOf(q) >= 0; });
    return '<div class="card scroll"><table><thead><tr><th>Serial</th><th>Naam</th><th>Party</th><th>Trade</th><th class="n">Rate' + unit() + '</th><th>Halat</th><th></th></tr></thead><tbody>' +
      (list.map(function (c) {
        return '<tr><td class="b">' + esc(c.serial) + '</td><td>' + esc(c.name) + (c.status === 'left' ? ' <span class="pill">chhod diya</span>' : '') + '<div class="xs mu">' + esc(c.mobile) + '</div></td><td>' + esc(c.partyName) + '</td><td>' + esc(c.trade) + '</td><td class="n">' + inr(c.payRate) + '</td><td>' + approvalPill(c.approval) + '</td><td class="noprint"><div class="row">' +
          '<button class="link" data-act="editcand" data-id="' + c.id + '">Badlein</button>' + (c.approval === 'pending' ? '<button class="link" data-act="approvecand" data-id="' + c.id + '">Approve</button>' : '') +
          '<button class="link" data-act="candid" data-id="' + c.id + '">ID card</button><button class="link" data-act="ratereq" data-id="' + c.id + '">Rate request</button></div></td></tr>';
      }).join('') || '<tr><td colspan="7" class="mu">Koi candidate nahi mila. "+ Naya candidate" se admission form bharein.</td></tr>') + '</tbody></table></div>';
  }
  function candsView() {
    if (S.form) return candForm();
    return '<div class="row between"><h2>Mere candidates (' + S.view.candidates.length + ')</h2><button class="btn" data-act="newcand">+ Naya candidate (admission form)</button></div>' +
      '<div class="row"><label class="grow">Khojein (naam / serial number / mobile)<input id="q" value="' + esc(S.q) + '" placeholder="jaise A2Z-C-00012"></label></div>' +
      (S.rq ? rateForm() : '') +
      '<div id="candRes">' + candTable(S.q) + '</div>' +
      (S.view.requests.length ? '<h3>Rate requests</h3><div class="card scroll"><table><thead><tr><th>Candidate</th><th class="n">Naya rate</th><th>Karan</th><th>Halat</th></tr></thead><tbody>' + S.view.requests.map(function (r) {
        var c = S.view.candidates.filter(function (x) { return x.id === r.candId; })[0] || {};
        return '<tr><td>' + esc(c.name || '') + ' <span class="xs mu">' + esc(c.serial || '') + '</span></td><td class="n">' + inr(r.payRate) + '</td><td>' + esc(r.note) + '</td><td>' + (r.status === 'approved' ? '<span class="pill good">admin ne manjoor kiya</span>' : r.status === 'rejected' ? '<span class="pill bad">admin ne mana kiya</span>' : '<span class="pill warn">admin approval baaki</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '');
  }
  function rateForm() {
    var c = S.view.candidates.filter(function (x) { return x.id === S.rq; })[0]; if (!c) return '';
    return '<div class="panel"><h3>Rate badalne ki request: ' + esc(c.name) + '</h3><div class="note">Rate admin ne tay kiya hai (abhi ' + inr(c.payRate) + unit() + '). Aap sirf request bhej sakte hain; admin approve karega tabhi naya rate lagega.</div>' +
      '<div class="form-grid">' + fld('Naya rate (' + unit() + ')', 'rate', { type: 'number', mode: 'decimal' }) + fld('Karan', 'rnote', { max: 100 }) + '</div><div class="msg" id="lmsg"></div><div class="row"><button class="btn" data-act="ratesend">Request bhejein</button><button class="btn sec" data-act="ratecancel">Rehne dein</button></div></div>';
  }
  function candForm() {
    var f = S.f, edit = !!f.id, trades = {};
    S.view.parties.forEach(function (p) { p.trades.forEach(function (t) { trades[t] = 1; }); });
    var pOpts = '<option value="">— party chuniye —</option>' + S.view.parties.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === f.partyId ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('');
    return '<div class="panel"><div class="row between"><h2>' + (edit ? 'Candidate badlein (' + esc(f.serial) + ')' : 'Candidate admission form') + '</h2></div>' +
      '<div class="note">Candidate ki poori jankari aur photo bharein. Rate admin tay karta hai (party ke rate card se). Save ke baad candidate ko <b>approve</b> karein, tabhi uski hazri bhar sakenge.</div>' +
      '<div class="row ai-start">' + photoBox(f.photo, 'Candidate ki photo') + '<div class="form-grid grow"><label>Party *<select data-f="partyId">' + pOpts + '</select></label>' +
      fld('Candidate ka poora naam', 'name', { req: 1, max: 80 }) + fld('Pita / pati ka naam', 'father', { max: 80 }) + fld('Trade (kaam)', 'trade', { req: 1, list: 'trades', max: 40 }) + fld('Janm tithi', 'dob', { type: 'date' }) + fld('Joining date', 'joinDate', { type: 'date' }) + '</div></div>' +
      '<datalist id="trades">' + Object.keys(trades).map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist>' +
      '<div class="sec-h">Sampark</div><div class="form-grid">' + fld('Mobile', 'mobile', { mode: 'numeric', max: 14 }) + fld('Dusra mobile', 'mobile2', { mode: 'numeric', max: 14 }) + fld('Pura pata', 'address', { max: 200 }) + fld('Emergency me kisko phone karein', 'emergency', { max: 80 }) + fld('Emergency mobile', 'emergencyPhone', { mode: 'numeric', max: 14 }) + '</div>' +
      P.docSlots(f.docKeys, f.docs, edit) +
      '<div class="sec-h">Pehchan, bank aur anubhav</div><div class="form-grid">' + fld('Aadhaar (12 ank)', 'aadhaar', { mode: 'numeric', max: 14 }) + fld('Bank khata', 'bank', { mode: 'numeric', max: 22 }) + fld('IFSC', 'ifsc', { max: 11 }) + fld('UPI ID', 'upi', { max: 60 }) + fld('Anubhav (kitne saal / kahan)', 'experience', { max: 120 }) + '</div>' +
      (edit ? '<label class="mw240">Halat<select data-f="status"><option value="active"' + (f.status !== 'left' ? ' selected' : '') + '>Kaam par hai</option><option value="left"' + (f.status === 'left' ? ' selected' : '') + '>Kaam chhod diya</option></select></label>' : '') +
      (edit ? '' : '<label class="consent span-all"><input type="checkbox" id="consentBox"> Candidate ne <a href="terms.html" target="_blank" rel="noopener">Terms / Niyam aur Shartein</a> padh/sun liye hain aur wo apni photo, documents aur jankari ke kaam ke liye istemal (DPDP Act) se sahmat hai (candidate ki raza se hi tick karein).</label>') +
      '<div class="msg" id="lmsg" role="alert"></div><div class="row"><button class="btn" data-act="savecand">Save karein</button><button class="btn sec" data-act="cancelcand">Band karein</button></div></div>';
  }

  /* ---------- Hazri (Daily) ---------- */
  function dim(m) { return new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate(); }
  function pad31(x) { x = x || ''; while (x.length < 31) x += '-'; return x; }
  function hzList(pid) { return S.view.candidates.filter(function (c) { return c.partyId === pid && c.approval === 'approved' && c.status !== 'left'; }); }
  function hzActiveParty() {
    var ids = {}; S.view.candidates.forEach(function (c) { if (c.approval === 'approved' && c.status !== 'left') ids[c.partyId] = c.partyName; });
    var keys = Object.keys(ids); if (!keys.length) return '';
    if (keys.indexOf(S.hzParty) < 0) S.hzParty = keys[0];
    return S.hzParty;
  }
  function hzDraft(pid) {
    var key = pid + '|' + S.month; if (S.hz && S.hz.key === key) return S.hz;
    var marks = {}; hzList(pid).forEach(function (c) { marks[c.id] = pad31(c.marks); });
    S.hz = { key: key, pid: pid, marks: marks, dirty: {} }; return S.hz;
  }
  function daysOf(mk, n) { var t = 0; for (var i = 0; i < n; i++) t += mk[i] === '1' ? 1 : mk[i] === 'h' ? 0.5 : 0; return t; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function hazriView() {
    var pid = hzActiveParty(), n = dim(S.month), h = '<div class="row between"><h2>Hazri (Daily) – ' + P.monthName(S.month) + '</h2></div>';
    if (!pid) return h + '<div class="note warn">Abhi koi approve kiya hua candidate nahi. Pehle "Candidates" tab me admission form bharein aur candidate ko approve karein.</div>';
    var dr = hzDraft(pid), cs = hzList(pid), today = S.month === P.thisMonth() ? +new Date(Date.now() + 330 * 60000).toISOString().slice(8, 10) : 0, i;
    var partyOpts = {}; S.view.candidates.forEach(function (c) { if (c.approval === 'approved' && c.status !== 'left') partyOpts[c.partyId] = c.partyName; });
    h += '<div class="note">Din ke number par dabane se us din <b>sab</b> hazir. Candidate ke box par dabayein: <b>P</b> = poora din, <b>½</b> = aadha din, <b>·</b> = gair-hazir. Neeche wage aur aapka commission turant dikhta hai (andaza). <b>Save</b> ke baad admin approve karega tabhi final hoga.</div>';
    h += '<div class="grid"><label>Party<select data-f="hzp">' + Object.keys(partyOpts).map(function (id) { return '<option value="' + esc(id) + '"' + (id === pid ? ' selected' : '') + '>' + esc(partyOpts[id]) + '</option>'; }).join('') + '</select></label></div>';
    var head = '<th>Serial</th><th>Naam / trade</th>', foot = '<td colspan="2"><b>Roz kitne hazir</b></td>', tot = { days: 0, pay: 0, comm: 0, gst: 0, net: 0 }, grand = 0;
    for (i = 1; i <= n; i++) head += '<th class="hzh' + (i === today ? ' td' : '') + '"><button class="hzd" data-act="hzday" data-d="' + i + '">' + i + '</button></th>';
    head += '<th class="n">Din</th><th class="n">Rate' + unit() + '</th><th class="n">Wage</th><th>Halat</th>';
    for (i = 0; i < n; i++) { var cnt = 0; cs.forEach(function (c) { var m = dr.marks[c.id][i]; cnt += m === '1' ? 1 : m === 'h' ? 0.5 : 0; }); grand += cnt; foot += '<td class="hzc' + (i + 1 === today ? ' td' : '') + '">' + (cnt ? nf(cnt) : '') + '</td>'; }
    var body = cs.map(function (c) {
      var mk = dr.marks[c.id], d = daysOf(mk, n), cells = '', f = c.fac;
      tot.days += d; tot.pay += d * f.payDay; tot.comm += d * f.commDay; tot.gst += d * f.gstDay; tot.net += d * f.netDay;
      for (var j = 0; j < n; j++) { var v = mk[j]; cells += '<td class="hzt' + (j + 1 === today ? ' td' : '') + '"><button class="hz hz' + (v === '1' ? 'p' : v === 'h' ? 'h' : 'a') + '" data-act="hzcell" data-id="' + c.id + '" data-d="' + (j + 1) + '" aria-label="' + esc(c.name) + ' din ' + (j + 1) + '">' + (v === '1' ? 'P' : v === 'h' ? '½' : '·') + '</button></td>'; }
      return '<tr><td class="xs">' + esc(c.serial) + '</td><td class="hzn">' + esc(c.name) + '<div class="xs mu">' + esc(c.trade) + '</div></td>' + cells + '<td class="n"><b>' + nf(d) + '</b></td><td class="n">' + inr(c.payRate) + '</td><td class="n">' + inr(r2(d * f.payDay)) + '</td><td class="xs">' + (dr.dirty[c.id] ? '<span class="pill warn">save nahi hua</span>' : hzPill(c.hstatus)) + '</td></tr>';
    }).join('');
    h += '<div class="card"><div class="scroll" id="hzs"><table class="hzT"><thead><tr>' + head + '</tr></thead><tbody>' + body + '<tr class="tot">' + foot + '<td class="n">' + nf(grand) + '</td><td></td><td class="n">' + inr(r2(tot.pay)) + '</td><td></td></tr></tbody></table></div></div>';
    h += '<div class="cards">' + k('Is party ke candidates ka kul wage', inr(r2(tot.pay))) + k('Aapka commission', inr(r2(tot.comm))) + k('GST kata', inr(r2(tot.gst))) + k('Aapko milega (andaza)', inr(r2(tot.net))) + '</div>';
    var nd = Object.keys(dr.dirty).length;
    h += '<div class="row">' + (nd ? '<span class="pill warn">' + nd + ' candidate ki hazri save nahi hui</span>' : '<span class="pill good">Sab save hai</span>') + '<button class="btn" data-act="hzsave"' + (nd ? '' : ' disabled') + '>Hazri save karein</button></div>';
    return h;
  }

  /* ---------- Mera hisaab ---------- */
  function commNote(st) {
    if (st.commMode === 'percent') return 'Commission = candidate ke kaam se bane munafe ka ' + st.pct + '%.';
    if (st.commMode === 'fixed') return 'Commission = har candidate ke din \u00d7 uske trade ka fixed rate (' + (st.fixedRates || []).map(function (r) { return esc(r.trade) + ' \u20b9' + esc(r.rate) + '/din'; }).join(', ') + '). Candidate kitne bhi hon, rate wahi rehta hai.';
    if (st.commMode === 'none') return 'Aapke liye koi commission tay nahi hai (admin hi tay karta hai).';
    return 'Aapka commission ka tareeka admin ne abhi tay nahi kiya, isliye abhi commission \u20b90 dikh raha hai.';
  }
  /* ---------- labour ko advance (staff deta hai, mahine ke ant ki payment se kat jata hai) ---------- */
  function advBox(v) {
    var cs = v.candidates.filter(function (c) { return c.approval === 'approved' && c.status !== 'left'; });
    if (!S.adv) return '<div class="row noprint"><button class="btn" data-act="advnew">+ Labour / candidate ko advance dein</button></div>';
    var f = S.af;
    return '<div class="card" id="advform"><h3>Advance dein</h3><div class="note">Jo advance aap apne candidate (mistri / labour) ko dete hain wo yahan likhein. Ye us mahine ke "Dena baaki" me se kat jayega, isliye mahine ke ant ki payment utni kam banegi.</div><div class="grid">' +
      '<label>Candidate *<select data-af="candId"><option value="">— chuniye —</option>' + cs.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === f.candId ? ' selected' : '') + '>' + esc(c.name) + ' (' + esc(c.trade) + ' · ' + esc(c.partyName) + ')</option>'; }).join('') + '</select></label>' +
      '<label>Rakam (Rs) *<input data-af="amount" type="number" min="1" step="any" inputmode="decimal" value="' + esc(f.amount || '') + '"></label>' +
      '<label>Tarikh<input data-af="date" type="date" value="' + esc(f.date || '') + '"></label>' +
      '<label>Note (zaruri nahi)<input data-af="note" maxlength="100" value="' + esc(f.note || '') + '"></label></div><div class="msg" id="advmsg" role="alert"></div>' +
      '<div class="row"><button class="btn" data-act="advsave">Advance save karein</button><button class="btn sec" data-act="advcancel">Band karein</button></div></div>';
  }
  function hisaabView() {
    var v = S.view, t = v.totals;
    return '<div class="row between noprint"><h2>Mera hisaab (' + P.monthName(S.month) + ')</h2><button class="btn sec" data-act="print">Print</button></div>' + summary() +
      '<h3>Party-wise</h3><div class="card scroll"><table><thead><tr><th>Party</th><th class="n">Candidates</th><th class="n">Din</th><th class="n">Candidates ka wage</th><th class="n">Commission</th><th class="n">GST</th><th class="n">Net</th></tr></thead><tbody>' +
      (v.byParty.map(function (p) { return '<tr><td>' + esc(p.name) + '</td><td class="n">' + p.candidates + '</td><td class="n">' + nf(p.days) + '</td><td class="n">' + inr(p.pay) + '</td><td class="n">' + inr(p.commission) + '</td><td class="n">' + inr(p.gst) + '</td><td class="n">' + inr(p.net) + '</td></tr>'; }).join('') || '<tr><td colspan="7" class="mu">Abhi koi hisaab nahi</td></tr>') +
      '<tr class="tot"><td>Kul</td><td class="n">' + t.candidates + '</td><td class="n">' + nf(t.days) + '</td><td class="n">' + inr(t.pay) + '</td><td class="n">' + inr(t.commission) + '</td><td class="n">' + inr(t.gst) + '</td><td class="n">' + inr(t.net) + '</td></tr></tbody></table></div>' +
      '<h3>Candidate-wise</h3><div class="card scroll"><table><thead><tr><th>Serial</th><th>Naam</th><th>Party</th><th>Trade</th><th class="n">Din</th><th class="n">Rate' + unit() + '</th><th class="n">Wage</th><th class="n">Advance</th><th class="n">Chukaya</th><th class="n">Dena baaki</th></tr></thead><tbody>' +
      (v.candidates.filter(function (c) { return c.approval === 'approved'; }).map(function (c) { return '<tr><td class="xs">' + esc(c.serial) + '</td><td>' + esc(c.name) + '</td><td>' + esc(c.partyName) + '</td><td>' + esc(c.trade) + '</td><td class="n">' + nf(c.days) + '</td><td class="n">' + inr(c.payRate) + '</td><td class="n">' + inr(c.pay) + '</td><td class="n">' + inr(c.advance) + '</td><td class="n">' + inr(c.paid) + '</td><td class="n">' + inr(r2(c.pay - c.advance - c.paid)) + '</td></tr>'; }).join('') || '<tr><td colspan="9" class="mu">Koi nahi</td></tr>') + '</tbody></table></div>' +
      advBox(v) +
      '<h3>Advance (aapne / admin ne diya)</h3><div class="card scroll"><table><thead><tr><th>Tarikh</th><th>Kiska</th><th>Kisne</th><th>Note</th><th class="n">Rakam</th><th></th></tr></thead><tbody>' + (v.advances.length ? v.advances.map(function (a) { var c = v.candidates.filter(function (x) { return x.id === a.refId; })[0]; var mine = a.by === 'staff:' + v.staff.id; return '<tr><td>' + P.dd(a.date) + '</td><td>' + (a.kind === 'staff' ? 'Aapka' : esc(c ? c.name : '')) + '</td><td>' + (mine ? 'Aapne' : 'Admin ne') + '</td><td>' + esc(a.note) + '</td><td class="n">' + inr(a.amount) + '</td><td>' + (mine ? '<button class="link danger" data-act="deladv" data-id="' + a.id + '">Hatayein (aaj ki)</button>' : '') + '</td></tr>'; }).join('') : '<tr><td colspan="6" class="mu">Is mahine koi advance nahi.</td></tr>') + '</tbody></table></div>' +
      (v.payments.length ? '<h3>Payments (jo chukaye gaye)</h3><div class="card scroll"><table><thead><tr><th>Tarikh</th><th>Kisko</th><th>Tareeka</th><th>Note</th><th class="n">Rakam</th></tr></thead><tbody>' + v.payments.map(function (p) { var c = v.candidates.filter(function (x) { return x.id === p.refId; })[0]; return '<tr><td>' + P.dd(p.date) + '</td><td>' + (p.kind === 'staff' ? 'Aapko' : esc(c ? c.name : '')) + '</td><td>' + esc(({ cash: 'Cash', upi: 'UPI', bank: 'Bank', other: 'Anya' })[p.mode] || p.mode) + '</td><td>' + esc(p.note) + '</td><td class="n">' + inr(p.amount) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '') +
      '<div class="note">' + commNote(v.staff) + ' Isme se GST ' + v.gstPct + '% kat kar "Net" milta hai. Jo hazri admin ne approve nahi ki wo yahan andaze me judti hai, admin ke final hisaab me approve hone par judti hai.</div>';
  }

  /* ---------- photos ---------- */
  async function fetchPhoto(key, kind, id) {
    S.photos[key] = '';
    try { var r = await api('POST', '/api/staff/photo', { kind: kind === 'self' ? 'self' : 'cand', id: id }); S.photos[key] = r.photo || ''; } catch (e) { S.photos[key] = ''; }
    if (S.screen === 'app' && S.tab === 'home') render();
  }

  /* ---------- actions ---------- */
  function refreshDocs() { var el = document.querySelector('.docslots'); if (el) el.outerHTML = P.docSlots(S.f.docKeys, S.f.docs, !!S.f.id); }
  var A = {
    advnew: function () { S.adv = true; S.af = { date: new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10) }; render(); var e = $('#advform'); if (e) e.scrollIntoView({ block: 'center' }); },
    advcancel: function () { S.adv = false; render(); },
    advsave: async function (b) {
      var f = S.af, m = $('#advmsg'); if (!f.candId) { m.textContent = 'Candidate chuniye'; return; } if (!(Number(f.amount) > 0)) { m.textContent = 'Rakam likhein'; return; }
      b.disabled = true;
      try { var r = await api('POST', '/api/staff/advance-save', { candId: f.candId, amount: f.amount, date: f.date, note: f.note || '', month: S.month }); S.view = r.view; S.adv = false; render(); P.toast(r.warn ? r.warn : '\u2713 Advance darj ho gaya'); }
      catch (x) { b.disabled = false; m.textContent = x.message; }
    },
    deladv: async function (b) { if (!window.confirm('Ye advance hata dein?')) return; var r = await api('POST', '/api/staff/advance-del', { id: b.dataset.id, month: S.month }); S.view = r.view; render(); P.toast('Advance hata diya'); },
    dstart: function (b) { S.duty = { mode: b.dataset.mode, photo: '', pos: null, err: '', gps: true, busy: false }; render(); getGps(); },
    dgps: function () { return getGps(); },
    dcancel: function () { S.duty = {}; render(); },
    dconfirm: async function (b) {
      var d = S.duty; if (!d.photo || d.gps) return; d.busy = true; render();
      try { var r = await api('POST', '/api/staff/duty-' + d.mode, Object.assign({ photo: d.photo, month: S.month }, d.pos ? { lat: d.pos.lat, lng: d.pos.lng, acc: d.pos.acc } : {})); S.view = r.view; var was = d.mode; S.duty = {}; render(); pingSync(); P.toast(was === 'in' ? '\u2713 IN ho gaya. Duty shuru.' : '\u2713 OUT ho gaya. Aaj ki attendance lag gayi.'); }
      catch (x) { d.busy = false; render(); var m = $('#dmsg'); if (m) m.textContent = x.message; }
    },
    docpend: function (b) { P.viewImage(S.f.docs[b.dataset.doc], 'Document'); },
    docdrop: function (b) { delete S.f.docs[b.dataset.doc]; refreshDocs(); },
    docview: async function (b) { var r = await api('POST', '/api/staff/photo', { kind: 'cand', id: S.f.id, doc: b.dataset.doc }); if (r.photo) P.viewImage(r.photo, 'Document'); else P.toast('Document nahi mila'); },
    tab: function (b) { S.tab = b.dataset.id; S.form = null; S.rq = null; render(); },
    regform: function () { S.f = {}; regScreen(); },
    forgot: async function (b) {
      var id = $('#lid').value.trim(); $('#lmsg').textContent = '';
      if (!id) { $('#lmsg').textContent = 'Upar apna Staff ID ya mobile number likhein, phir "Password bhool gaye?" dabayein'; return; }
      b.disabled = true;
      try { var r = await P.api('POST', '/api/staff/forgot', { id: id }); $('#lmsg').innerHTML = '<span class="ok">' + esc(r.msg || 'Request chali gayi') + '</span>'; }
      catch (e) { $('#lmsg').textContent = e.message; }
      b.disabled = false;
    },
    backlogin: function () { S.f = {}; loginScreen(); },
    logout: async function () { try { await api('POST', '/api/staff/logout', {}); } catch (e) { /* ignore */ } tset(''); TOKEN = ''; S.view = null; loginScreen(); },
    login: async function (b) {
      var id = $('#lid').value.trim(), pw = $('#lpw').value; $('#lmsg').textContent = '';
      if (!id || !pw) { $('#lmsg').textContent = 'ID / mobile aur password likhein'; return; }
      b.disabled = true;
      try { var r = await P.api('POST', '/api/staff/login', { id: id, pass: pw }); TOKEN = r.token; tset(TOKEN); await load(); }
      catch (e) { b.disabled = false; $('#lmsg').textContent = e.message; }
    },
    register: async function (b) {
      var f = S.f; $('#lmsg').textContent = '';
      if (!f.photo) { $('#lmsg').textContent = 'Apni photo lagayein'; return; }
      if (!$('#consentBox').checked) { $('#lmsg').textContent = 'Terms padhkar sahmati ka tick lagayein'; return; }
      b.disabled = true;
      try {
        await P.api('POST', '/api/staff/register', { website: f.website || '', consent: true, photo: f.photo, docs: f.docs || undefined, item: { name: f.name, father: f.father, dob: f.dob, phone: f.phone, email: f.email, address: f.address, aadhaar: f.aadhaar, bank: f.bank, ifsc: f.ifsc, upi: f.upi, pass: f.pass, pass2: f.pass2 } });
        S.f = {}; showPage('<div class="panel login"><h2>Registration mil gaya</h2><div class="note">Admin aapki jankari jaanch kar approve karega. Approve hone par aapko <b>Staff ID</b> milegi (email dene par email bhi aayegi) aur aap apne mobile number / ID aur password se login kar paayenge.</div><button class="btn" data-act="backlogin">Login page</button></div>');
      } catch (e) { b.disabled = false; $('#lmsg').textContent = e.message; }
    },
    myid: async function () {
      var st = S.view.staff, ph = S.photos.self; if (ph === undefined || ph === '') { await fetchPhoto('self', 'self', ''); ph = S.photos.self; }
      P.idCardShow({ kind: 'staff', serial: st.serial || 'ID baaki', name: st.name, role: TYPE[st.type] || 'Staff', mobile: st.phone, joined: P.dd((st.joinedAt || '').slice(0, 10)), photo: ph });
    },
    pwpanel: function () { S.pw = !S.pw; S.f.old = ''; S.f.npw = ''; render(); },
    pwsave: async function () {
      try { await api('POST', '/api/staff/password', { old: S.f.old, pass: S.f.npw }); tset(''); TOKEN = ''; S.pw = false; loginScreen('Password badal gaya. Naye password se login karein.'); }
      catch (e) { $('#lmsg').textContent = e.message; }
    },
    newcand: function () { S.f = { status: 'active', partyId: S.view.parties.length === 1 ? S.view.parties[0].id : '' }; S.form = true; render(); window.scrollTo(0, 0); },
    editcand: async function (b) {
      var c = S.view.candidates.filter(function (x) { return x.id === b.dataset.id; })[0]; S.f = Object.assign({}, c); S.f.photo = ''; S.form = true; render();
      var r = await api('POST', '/api/staff/photo', { kind: 'cand', id: c.id }).catch(function () { return {}; }); if (r.photo && S.form && S.f.id === c.id) { S.f.photo = r.photo; S.f.photoOld = true; var pb = $('#pbox'); if (pb) pb.innerHTML = '<img alt="photo" src="' + esc(r.photo) + '">'; }
    },
    cancelcand: function () { S.form = null; S.f = {}; render(); },
    savecand: async function (b) {
      var f = S.f, item = {}; ['id', 'partyId', 'name', 'father', 'mobile', 'mobile2', 'trade', 'dob', 'joinDate', 'address', 'aadhaar', 'bank', 'ifsc', 'upi', 'emergency', 'emergencyPhone', 'experience', 'status'].forEach(function (x) { if (f[x] !== undefined) item[x] = f[x]; });
      if (!f.id && !$('#consentBox').checked) { $('#lmsg').textContent = 'Candidate ki sahmati ka tick lagayein (Terms + data use)'; return; }
      b.disabled = true;
      try {
        var r = await api('POST', '/api/staff/cand-save', { month: S.month, consent: f.id ? undefined : true, item: item, photo: f.photo && !f.photoOld ? f.photo : undefined, docs: f.docs && Object.keys(f.docs).length ? f.docs : undefined });
        S.view = r.view; S.form = null; S.f = {}; S.hz = null; render();
        var nc = r.view.candidates.filter(function (c) { return c.id === (r.id || f.id); })[0] || {};
        P.done(f.id ? 'Candidate ki jankari save ho gayi' : 'Naya candidate jud gaya', [['Candidate ID', r.serial || nc.serial || ''], ['Naam', nc.name || item.name], ['Mobile', nc.mobile || item.mobile], ['Trade', nc.trade || item.trade], ['Party / Site', nc.partyName || ''], ['Halat', nc.approval === 'pending' || !f.id ? 'Approval baaki' : 'Chalu']], f.id ? '' : 'Ab "Approve" dabayein, tabhi hazri bharna shuru hoga.');
      } catch (e) { b.disabled = false; $('#lmsg').textContent = e.message; }
    },
    approvecand: async function (b) {
      try { var r = await api('POST', '/api/staff/cand-approve', { id: b.dataset.id, month: S.month }); S.view = r.view; S.hz = null; render(); var ac = r.view.candidates.filter(function (c) { return c.id === b.dataset.id; })[0] || {}; P.done('Candidate approve ho gaya', [['Candidate ID', ac.serial || ''], ['Naam', ac.name || ''], ['Trade', ac.trade || ''], ['Party / Site', ac.partyName || '']], 'Ab hazri bhar sakte hain.'); }
      catch (e) { P.toast(e.message); }
    },
    candid: async function (b) {
      var c = S.view.candidates.filter(function (x) { return x.id === b.dataset.id; })[0], ph = '';
      if (c.hasPhoto) { var r = await api('POST', '/api/staff/photo', { kind: 'cand', id: c.id }).catch(function () { return {}; }); ph = r.photo || ''; }
      if (c.approval !== 'approved') P.toast('Dhyan: candidate abhi approve nahi hai.');
      P.idCardShow({ kind: 'cand', serial: c.serial, name: c.name, role: c.trade + ' · ' + c.partyName, mobile: c.mobile, joined: P.dd(c.joinDate), photo: ph, lines: c.emergency ? ['Emergency: ' + c.emergency + ' ' + (c.emergencyPhone || '')] : [] });
    },
    ratereq: function (b) { S.rq = b.dataset.id; S.f.rate = ''; S.f.rnote = ''; render(); },
    ratecancel: function () { S.rq = null; render(); },
    ratesend: async function () {
      try { var r = await api('POST', '/api/staff/rate-request', { candId: S.rq, payRate: S.f.rate, note: S.f.rnote, month: S.month }); S.view = r.view; S.rq = null; render(); P.toast('Request admin ko bhej di gayi.'); }
      catch (e) { $('#lmsg').textContent = e.message; }
    },
    hzcell: function (b) { var dr = S.hz, id = b.dataset.id, i = +b.dataset.d - 1, mk = dr.marks[id], v = mk[i], nx = v === '-' ? '1' : v === '1' ? 'h' : '-'; dr.marks[id] = mk.slice(0, i) + nx + mk.slice(i + 1); dr.dirty[id] = true; render(); },
    hzday: function (b) {
      var dr = S.hz, i = +b.dataset.d - 1, cs = hzList(dr.pid), all = cs.length && cs.every(function (c) { return dr.marks[c.id][i] === '1'; }), nx = all ? '-' : '1';
      cs.forEach(function (c) { var mk = dr.marks[c.id]; if (mk[i] !== nx) { dr.marks[c.id] = mk.slice(0, i) + nx + mk.slice(i + 1); dr.dirty[c.id] = true; } }); render();
    },
    hzsave: async function (b) {
      var dr = S.hz, ids = Object.keys(dr.dirty); if (!ids.length) return; b.disabled = true;
      try { var r = await api('POST', '/api/staff/hazri-save', { month: S.month, items: ids.map(function (id) { return { candId: id, marks: dr.marks[id] }; }) }); S.view = r.view; S.hz = null; render(); P.toast('Hazri save ho gayi. Admin approve karega.'); }
      catch (e) { b.disabled = false; P.toast(e.message); }
    },
    print: function () { window.print(); }
  };

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || !A[b.dataset.act]) return;
    Promise.resolve(A[b.dataset.act](b)).catch(function (x) { P.toast(x.message || String(x)); });
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'idq') { S.idq = t.value; clearTimeout(S.idT); S.idT = setTimeout(function () { var rs = $('#idres'); if (rs) rs.innerHTML = idRows(S.idq); }, 100); return; }
    if (t.dataset && t.dataset.af) { S.af[t.dataset.af] = t.value; return; }
    if (t.dataset && t.dataset.f) S.f[t.dataset.f] = t.value;
    else if (t.id === 'q') { S.q = t.value; clearTimeout(S.qT); S.qT = setTimeout(function () { var rs = $('#candRes'); if (rs) rs.innerHTML = candTable(S.q); }, 120); }
  });
  document.addEventListener('change', async function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.af) { S.af[t.dataset.af] = t.value; return; }
    if (t.id === 'dutyFile' && t.files && t.files[0]) { var df0 = t.files[0]; t.value = ''; try { S.duty.photo = await window.A2ZDuty.selfie(df0); render(); } catch (x) { P.toast(x.message); } return; }
    if (t.dataset && t.dataset.f === 'hzp') { S.hzParty = t.value; S.hz = null; render(); }
    else if (t.dataset && t.dataset.f) S.f[t.dataset.f] = t.value;
    else if (t.classList.contains('doc-file') && t.files && t.files[0]) {
      var dk = t.dataset.doc, df = t.files[0]; t.value = '';
      try { var du = await P.photoFromFile(df, { kind: 'doc' }); S.f.docs = S.f.docs || {}; S.f.docs[dk] = du; refreshDocs(); } catch (x) { if (x.message !== 'cancel') P.toast(x.message); }
    }
    else if (t.id === 'photoFile' && t.files && t.files[0]) {
      try { S.f.photo = await P.photoFromFile(t.files[0], { kind: 'photo' }); S.f.photoOld = false; var pb = $('#pbox'); if (pb) pb.innerHTML = '<img alt="photo" src="' + esc(S.f.photo) + '">'; } catch (x) { P.toast(x.message); }
      t.value = '';
    }
  });
  $('#month').addEventListener('change', function (e) {
    if (!/^\d{4}-\d{2}$/.test(e.target.value)) return;
    if (S.hz && Object.keys(S.hz.dirty).length && !window.confirm('Bina save ki hazri hai. Mahina badalne par ye hat jayegi. Aage badhein?')) { e.target.value = S.month; return; }
    S.month = e.target.value; load();
  });
  window.addEventListener('hashchange', function () { if (/^[0-9a-f]{32}$/.test((location.hash || '').slice(1))) location.reload(); });

  if (TOKEN) load(); else loginScreen();
})();
