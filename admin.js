/* FILE: admin.js  (GitHub par isi naam se upload karein) */
/* A2Z Build Tech - admin console */
(function () {
  'use strict';
  var $ = P.$, $$ = P.$$, esc = P.esc, inr = P.inr, nf = P.nf, api = P.api;
  var S = { data: null, month: P.thisMonth(), tab: 'dash', panel: null, open: {}, f: { party: '', staff: '', q: '' }, challenge: null, sentTo: '', armed: null, sec: null, hzParty: '', hz: null, pph: '', pdocs: {}, sph: {} };
  var TABS = [['dash', 'Overview'], ['appr', 'Approvals'], ['parties', 'Party / Company'], ['staff', 'Staff aur links'], ['cands', 'Candidates'], ['hazri', 'Hazri (Daily)'], ['pay', 'Payouts'], ['sup', 'Supplier (Site-wise)'], ['ids', 'ID dekhein'], ['money', 'Hisaab (aaya/gaya)'], ['owners', 'Owners ka hissa'], ['remind', 'Reminder'], ['set', 'Settings'], ['sec', 'Suraksha (Alert)'], ['help', 'Madad (Help)']];
  var TYPE = { agent: 'Staff (agent)', supplier: 'Manpower supplier', supervisor: 'Site supervisor' };
  var CMODE = { percent: 'Percent (%)', fixed: 'Fixed rate (trade-wise)', none: 'Koi hissa nahi (admin tay karega)' };
  function cmLabel(x) {
    if (x.commMode === 'percent') return x.pct + '%';
    if (x.commMode === 'fixed') return 'Fixed: ' + (x.fixedRates || []).map(function (r) { return r.trade + ' \u20b9' + r.rate; }).join(', ');
    if (x.commMode === 'none') return 'Koi hissa nahi';
    return 'Tay nahi \u26a0';
  }
  function fixRow(r) {
    r = r || { trade: '', rate: '' };
    return '<tr><td><input class="fr-trade" list="tradeList" value="' + esc(r.trade) + '" placeholder="Trade (jaise Fitter)" aria-label="Trade"></td><td><input class="fr-rate" type="number" min="0" step="any" value="' + esc(r.rate) + '" aria-label="Fixed rate per candidate per din"></td><td><button type="button" class="link danger" data-act="delfix">Hatayein</button></td></tr>';
  }
  /* commission ka option: percent / fixed (trade-wise) / koi nahi. Zaroori hai - pehle se kuch chuna nahi hota */
  function commBox(s, defPct, pctName) {
    var m = s.commMode || '', fr = (s.fixedRates && s.fixedRates.length) ? s.fixedRates : [null];
    return '<div class="span-all commbox"><label>Commission ka tareeka (zaroori)<select name="commMode" class="cm-sel"><option value=""' + (m ? '' : ' selected') + '>\u2014 chuniye \u2014</option><option value="percent"' + (m === 'percent' ? ' selected' : '') + '>1. Percent: pool ka % (naam + party ke saath hisaab)</option><option value="fixed"' + (m === 'fixed' ? ' selected' : '') + '>2. Fixed rate: har candidate ka trade-wise fixed \u20b9/din</option><option value="none"' + (m === 'none' ? ' selected' : '') + '>3. Koi hissa nahi (admin hi tay karta hai)</option></select></label>' +
      '<label class="cm-pct"' + (m === 'percent' ? '' : ' hidden') + '>Commission % (khali = default ' + defPct + '%)<input name="' + (pctName || 'commissionPct') + '" type="number" step="any" min="0" max="100" value="' + esc(s.commissionPct == null ? '' : s.commissionPct) + '"></label>' +
      '<div class="cm-fix"' + (m === 'fixed' ? '' : ' hidden') + '><p class="sm mu">Har trade ka ek rate (\u20b9 per candidate per din). Candidate kitne bhi ho, rate wahi rahega. Jo trade yahan nahi likha uska commission 0 aayega aur warning dikhegi.</p><div class="scroll"><table><thead><tr><th>Trade</th><th>Rate \u20b9/din</th><th></th></tr></thead><tbody class="fixRows">' + fr.map(fixRow).join('') + '</tbody></table></div><div class="row"><button type="button" class="btn sm sec" data-act="addfix">+ Trade</button></div></div>' +
      '<p class="sm mu cm-none"' + (m === 'none' ? '' : ' hidden') + '>Is staff / supplier ko koi hissa nahi banega. Poora hissa firm ka rahega.</p></div>';
  }
  function commRead(root) {
    var m = $('.cm-sel', root).value;
    return { commMode: m, fixedRates: m === 'fixed' ? $$('.fixRows tr', root).map(function (tr) { return { trade: $('.fr-trade', tr).value.trim(), rate: $('.fr-rate', tr).value }; }).filter(function (r) { return r.trade; }) : [] };
  }
  function commShow(box) {
    var m = $('.cm-sel', box).value;
    $('.cm-pct', box).hidden = m !== 'percent'; $('.cm-fix', box).hidden = m !== 'fixed'; $('.cm-none', box).hidden = m !== 'none';
  }
  var armT;

  /* ---------- small helpers ---------- */
  function unit() { return S.data.settings.perDay ? '\u20b9/din' : '\u20b9/mahina'; }

  /* ---------- photo / ID card ---------- */
  async function adminPhoto(kind, id) {
    var key = kind + id; if (S.sph[key]) return S.sph[key];
    var r = await api('POST', '/api/admin/photo', { kind: kind, id: id }); S.sph[key] = r.photo || ''; return S.sph[key];
  }
  function photoBox(dataUrl, hint) { return '<div><div class="photo-box" id="pbox">' + (dataUrl ? '<img alt="photo" src="' + esc(dataUrl) + '">' : esc(hint || 'Photo')) + '</div><label class="btn sec sm file-btn mt6">Photo chunein<input type="file" id="pfile" accept="image/*" class="hide"></label></div>'; }
  function personFields(c) {
    return '<div class="sec-h span-all">Poori jankari</div>' + fld('father', 'Pita / pati ka naam', c.father) + fld('dob', 'Janm tithi', c.dob, { type: 'date' }) + fld('address', 'Pata', c.address) +
      fld('aadhaar', 'Aadhaar (12 ank)', c.aadhaar) + fld('bank', 'Bank khata', c.bank) + fld('ifsc', 'IFSC', c.ifsc) + fld('upi', 'UPI ID', c.upi);
  }
  function aprBtn(a) { return a === 'approved' ? '<span class="pill good">approve</span>' : a === 'rejected' ? '<span class="pill bad">reject</span>' : '<span class="pill warn">approval baaki</span>'; }

  function party(id) { return S.data.parties.filter(function (p) { return p.id === id; })[0]; }

  /* "Kaam ho gaya" ki chhoti screen ke liye details */
  function partyOf(id) { return S.data.parties.filter(function (p) { return p.id === id; })[0]; }
  function sumRows(kind, id) {
    var r;
    if (kind === 'staff') { r = staff(id); if (!r) return null; return [['ID', r.serial || ''], ['Naam', r.name], ['Mobile (login ID)', r.phone], ['Prakar', TYPE[r.type] || r.type], ['Commission ka tareeka', cmLabel(Object.assign({}, r, { pct: r.commissionPct == null ? S.data.settings.commissionPct : r.commissionPct }))], ['Fixed vetan / mahina', r.fixedPay ? inr(r.fixedPay) : ''], ['Halat', r.regStatus === 'pending' ? 'Approval baaki' : 'Chalu']]; }
    if (kind === 'candidates') { r = cand(id); if (!r) return null; var p = partyOf(r.partyId); return [['Candidate ID', r.serial || ''], ['Naam', r.name], ['Mobile', r.mobile], ['Trade', r.trade], ['Party / Site', p ? p.name : ''], ['Staff / Supplier', r.staffId ? whoS(r.staffId) : 'Direct (company)'], ['Join date', r.joinDate || ''], ['Halat', r.approval === 'pending' ? 'Approval baaki' : r.status === 'left' ? 'Kaam chhod diya' : 'Kaam par']]; }
    if (kind === 'parties') { r = partyOf(id); if (!r) return null; return [['Party ID', r.serial || ''], ['Naam', r.name], ['Mobile', r.phone], ['Contact', r.contact || ''], ['Trade ke rate', String((r.rates || []).length)]]; }
    return null;
  }
  async function doneSum(kind, id, title) { var rows = sumRows(kind, id); if (rows) P.done(title, rows); else P.toast(title); }
  function whoS(id, name) { var s = id ? staff(id) : null; return s ? s.name + (s.serial ? ' (' + s.serial + ')' : '') : (name || 'Direct'); }
  function cand(id) { return S.data.candidates.filter(function (p) { return p.id === id; })[0]; }
  function staff(id) { return S.data.staff.filter(function (p) { return p.id === id; })[0]; }
  function fld(name, label, val, o) {
    o = o || {};
    return '<label>' + esc(label) + '<input name="' + name + '" type="' + (o.type || 'text') + '" value="' + esc(val == null ? '' : val) + '"' + (o.step ? ' step="' + o.step + '"' : '') + (o.min != null ? ' min="' + o.min + '"' : '') + (o.max != null ? ' max="' + o.max + '"' : '') + (o.req ? ' required' : '') + (o.list ? ' list="' + o.list + '"' : '') + (o.auto ? ' autocomplete="' + o.auto + '"' : ' autocomplete="off"') + (o.inputmode ? ' inputmode="' + o.inputmode + '"' : '') + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + '>' + (window.A2ZHints ? A2ZHints.html(o.hint === undefined ? name : o.hint) : '') + '</label>';
  }
  function sel(name, label, opts, val) {
    return '<label>' + esc(label) + '<select name="' + name + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val == null ? '' : val) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>';
  }
  function partyOpts(blank) { return (blank ? [['', blank]] : []).concat(S.data.parties.filter(function (p) { return p.active !== false; }).map(function (p) { return [p.id, p.name]; })); }
  function staffOpts(blank) { return [['', blank || '— koi nahi —']].concat(S.data.staff.map(function (s) { return [s.id, s.name]; })); }
  function link(s) { return location.origin + location.pathname.replace(/[^\/]*$/, '') + 'staff.html#' + s.token; }
  function lineOf(id) { return S.data.report.lines.filter(function (l) { return l.id === id; })[0]; }
  function dayOf(id) { var a = S.data.attendance[id]; return a ? a.days : 0; }

  /* ---------- boot and login ---------- */
  async function boot() {
    $('#month').value = S.month;
    try {
      var h = await api('GET', '/api/health');
      if (h.needsSetup) return setupScreen();
      var me = await api('GET', '/api/admin/me');
      if (me.user) return load();
      loginScreen();
    } catch (e) { $('#app').innerHTML = '<div class="note warn">' + esc(e.message) + '</div>'; }
  }
  function shell(on) { $('#tabs').classList.toggle('hide', !on); $('#topTools').classList.toggle('hide', !on); }

  function setupScreen() {
    shell(false);
    $('#app').innerHTML = '<div class="sheet login"><h2>Pehli baar setup</h2><p class="mu sm">Google Apps Script ki Script Properties me aapne jo SETUP_CODE rakha hai wo daalein, phir apna username, password aur us email ka pata jahan OTP aana chahiye.</p>' +
      '<form data-form="setup" class="grid">' + fld('code', 'Setup code', '', { req: 1 }) + fld('user', 'Username', '', { req: 1, auto: 'username' }) +
      '<label>Password (10+ akshar, akshar + ank)<input name="pass" type="password" required autocomplete="new-password"></label>' +
      fld('email', 'OTP ki email (yahin OTP aayega)', '', { req: 1, type: 'email', auto: 'email' }) +
      '<div class="msg" id="msg" role="alert"></div><button class="btn" type="submit">Account banayein</button></form></div>';
  }
  function loginScreen() {
    shell(false); S.challenge = null;
    $('#app').innerHTML = '<div class="sheet login"><h2>Admin login</h2><form data-form="login" class="grid">' + fld('user', 'Username', '', { req: 1, auto: 'username' }) +
      '<label>Password<input name="pass" type="password" required autocomplete="current-password"></label><div class="msg" id="msg" role="alert"></div><button class="btn" type="submit">Aage badhein, OTP email par bhejein</button></form></div>';
  }
  function otpScreen() {
    $('#app').innerHTML = '<div class="sheet login"><h2>OTP daalein</h2><p class="mu sm">6 ank ka OTP ' + esc(S.sentTo) + ' par bheja gaya hai. 5 minute me expire hoga.</p>' +
      '<form data-form="otp" class="grid">' + fld('otp', 'OTP', '', { req: 1, inputmode: 'numeric', auto: 'one-time-code' }) + '<div class="msg" id="msg" role="alert"></div><button class="btn" type="submit">Login karein</button></form>' +
      '<div class="row"><button class="link" data-act="resend">OTP dobara bhejein</button><button class="link" data-act="relogin">Peeche</button></div></div>';
    $('input[name=otp]').focus();
  }

  async function load() {
    S.data = await api('GET', '/api/admin/data?month=' + S.month);
    S.hz = null; S.hzKeep = null;
    render();
  }

  /* ---------- views ---------- */
  var V = {};
  V.dash = function () {
    var d = S.data, r = d.report, f = r.firm, act = d.candidates.filter(function (c) { return c.status !== 'left'; }).length, h = '';
    h += '<div class="cards">' +
      kpi('Candidates (active)', act) + kpi('Company ka bill', inr(f.bill)) + kpi('Candidates ko wage', inr(f.pay)) + kpi('Pool (margin + company %)', inr(f.pool)) + kpi('Teeno owners ko bacha', inr(f.distributable)) + '</div>';
    h += todayCard();
    h += '<div class="row"><button class="btn sec" data-act="xall">Sab kuch ek Excel me (is mahine ka)</button></div>';
    if (d.pendingCount) h += '<div class="note warn row between"><span><b>' + d.pendingCount + '</b> cheezein aapke approval ke intezaar me hain (staff registration, candidate, hazri, rate request).</span><button class="btn sm" data-act="tab" data-id="appr">Approvals kholein</button></div>';
    if (d.pending) h += '<div class="note warn row between"><span><b>' + d.pending + '</b> candidate ki entry verify karna baaki hai (staff ne daali).</span><button class="btn sm" data-act="verifyAll">Sab verify karein</button></div>';
    r.warnings.slice(0, 8).forEach(function (w) { h += '<div class="note warn">' + esc(w.msg) + '</div>'; });
    var od = r.byParty.filter(function (p) { return p.overdueDays > 0; });
    if (od.length) h += '<div class="card"><h3>Payment late (company)</h3>' + od.map(function (p) { return '<div class="row between"><span><b>' + esc(p.name) + '</b> · ' + inr(p.due) + ' baaki · <span class="bad">' + p.overdueDays + ' din late</span></span><button class="btn sm" data-act="panel" data-k="remind" data-id="' + p.id + '">Reminder</button></div>'; }).join('') + '</div>';
    h += '<div class="card"><h3>Party-wise candidates (' + P.monthName(S.month) + ')</h3>' + (r.byParty.length ? r.byParty.map(function (p) { return '<div><b>' + esc(p.name) + ':</b> <span class="trades">' + P.tradeLine(p.trades) + '</span> <span class="mu">(kul ' + p.headcount + ')</span></div>'; }).join('') : '<p class="mu">Abhi koi party nahi. "Party / Company" me jodein.</p>') + '</div>';
    h += '<div class="card"><h3>Haal ki gatividhi</h3><div class="scroll"><table><tbody>' + d.log.slice(0, 12).map(function (l) { return '<tr><td class="sm mu">' + esc(P.dt(l.at)) + '</td><td>' + esc(l.who) + '</td><td>' + esc(l.action) + '</td><td class="mu">' + esc(l.detail) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    return h;
  };
  function kpi(l, v) { return '<div class="card"><span class="lbl">' + esc(l) + '</span><span class="kpi">' + v + '</span></div>'; }

  V.parties = function () {
    var d = S.data, r = d.report, h = '<div class="row between"><h2>Party / Company</h2><div class="row"><button class="btn sec" data-act="xparties">Excel</button><button class="btn" data-act="panel" data-k="party">+ Nayi party</button></div></div>';
    if (!r.byParty.length) h += '<p class="mu">Pehle party jodein aur uska rate card bharein (company kitna deti hai, candidate ko kitna dena hai).</p>';
    r.byParty.forEach(function (p) {
      var raw = party(p.id), rem = d.reminders.filter(function (x) { return x.partyId === p.id; })[0];
      h += '<div class="card"><div class="row between"><div><h3>' + esc(p.name) + (raw.active === false ? ' <span class="pill">band</span>' : '') + '</h3><div class="sm mu">' + esc(raw.contact || '') + ' ' + esc(p.phone) + '</div></div><div class="row">' +
        (p.due > 0 ? '<span class="pill ' + (p.overdueDays ? 'red' : 'warn') + '">Baaki ' + inr(p.due) + (p.overdueDays ? ' · ' + p.overdueDays + ' din late' : '') + '</span>' : (p.receivable > 0 ? '<span class="pill good">Poora mila</span>' : '')) + '</div></div>' +
        '<div class="trades">' + P.tradeLine(p.trades) + ' <span class="mu">(kul ' + p.headcount + ')</span></div>' +
        '<div class="cards">' + mini('Company bill', inr(p.bill)) + mini('Company commission', inr(p.bonus)) + mini('Milna chahiye', inr(p.receivable)) + mini('Mil chuka', inr(p.received)) + mini('Baaki', inr(p.due)) + '</div>' +
        (rem ? '<div class="xs mu">Aakhri reminder: ' + esc(P.dt(rem.at)) + ' (' + esc(rem.channel) + ')</div>' : '') +
        '<div class="row"><button class="btn sm sec" data-act="open" data-id="' + p.id + '">' + (S.open[p.id] ? 'Candidates chhupayein' : 'Candidates dekhein') + '</button><button class="btn sm sec" data-act="panel" data-k="party" data-id="' + p.id + '">Edit / Rate card</button><button class="btn sm sec" data-act="panel" data-k="receipt" data-id="' + p.id + '">Payment mila</button><button class="btn sm sec" data-act="panel" data-k="remind" data-id="' + p.id + '">Reminder</button><button class="btn sm sec" data-act="xparty" data-id="' + p.id + '">Excel</button></div>';
      if (S.open[p.id]) h += partyTable(p.id);
      h += '</div>';
    });
    return h;
  };
  function mini(l, v) { return '<div><span class="lbl">' + esc(l) + '</span><div class="b">' + v + '</div></div>'; }
  function partyTable(pid) {
    var ls = S.data.report.lines.filter(function (l) { return l.partyId === pid; });
    if (!ls.length) return '<p class="mu">Is party me abhi koi candidate nahi.</p>';
    var byId = {}; S.data.candidates.forEach(function (c) { byId[c.id] = c; });
    return '<div class="scroll"><table><thead><tr><th>Naam</th><th>Mobile</th><th>Trade</th><th>Staff</th><th>Joining</th><th>Entry (date, time)</th><th>Din</th><th class="n">Wage</th><th class="n">Company bill</th></tr></thead><tbody>' +
      ls.map(function (l) { var c = byId[l.id]; return '<tr><td>' + esc(l.name) + (c.status === 'left' ? ' <span class="pill">chhod diya</span>' : '') + (c.verified ? '' : ' <span class="pill warn">verify baaki</span>') + '</td><td>' + esc(c.mobile) + '</td><td>' + esc(l.trade) + '</td><td>' + esc(whoS(l.staffId, l.staffName)) + '</td><td>' + esc(P.dd(c.joinDate)) + '</td><td class="sm">' + esc(P.dt(c.createdAt)) + '</td><td><input class="w-days js-days" data-id="' + l.id + '" type="number" min="0" max="31" step="0.5" value="' + l.days + '" aria-label="Din"></td><td class="n">' + inr(l.pay) + '</td><td class="n">' + inr(l.bill) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  V.staff = function () {
    var d = S.data, r = d.report, h = '<div class="row between"><h2>Staff aur unke links</h2><div class="row"><button class="btn sec" data-act="xstafflist">Excel</button><button class="btn" data-act="panel" data-k="staff">+ Naya staff</button></div></div>' +
      '<div class="note">Staff ab <b>Staff ID (ya mobile) + password</b> se login karta hai. Naya staff khud <b>registration form</b> bhar sakta hai (neeche link), phir aap <b>Approvals</b> tab me approve karte hain. Purana seedha link bhi chalta hai (jinhe aapne password nahi diya).</div>' +
      '<div class="card"><span class="lbl">Staff registration + login page</span><div class="link-box">' + esc(location.origin + location.pathname.replace(/[^\/]*$/, '') + 'staff.html') + '</div><div class="row"><button class="btn sm" data-act="copyreg">Copy</button></div></div>';
    d.staff.forEach(function (s) {
      var m = r.byStaff.filter(function (x) { return x.id === s.id; })[0], url = link(s);
      h += '<div class="card"><div class="row between"><div><h3>' + esc(s.name) + ' <span class="b">' + esc(s.serial || '') + '</span> ' + (s.regStatus === 'pending' ? '<span class="pill warn">approval baaki</span> ' : s.regStatus === 'rejected' ? '<span class="pill bad">reject</span> ' : '') + (s.hasPass ? '' : '<span class="pill">password set nahi</span> ') + (s.active === false ? '<span class="pill">band</span>' : '') + '</h3><div class="sm mu">' + esc(TYPE[s.type] || s.type) + ' · Commission <b>' + esc(cmLabel(m)) + '</b> · ' + esc(s.phone) + (m.fixed ? ' · Fixed ' + inr(m.fixed) + '/mahina' : '') + '</div></div></div>' +
        '<div class="link-box" data-link="' + s.id + '">' + esc(url) + '</div>' +
        '<div class="row"><button class="btn sm" data-act="staffid" data-id="' + s.id + '">ID card</button><button class="btn sm sec" data-act="panel" data-k="staffpw" data-id="' + s.id + '">Password set</button><button class="btn sm sec" data-act="copylink" data-id="' + s.id + '">Link copy</button><a class="btn sm sec" target="_blank" rel="noopener" href="' + esc(P.waLink(s.phone, 'A2Z Build Tech: aapka entry aur hisaab ka link: ' + url)) + '">WhatsApp par bhejein</a><button class="btn sm sec" data-act="newtoken" data-id="' + s.id + '">Naya link (purana band)</button><button class="btn sm sec" data-act="panel" data-k="staff" data-id="' + s.id + '">Edit</button><button class="btn sm sec" data-act="open" data-id="' + s.id + '">Hisaab ' + (S.open[s.id] ? 'chhupayein' : 'dekhein') + '</button></div>' +
        '<div class="cards">' + mini('Candidates', m.candidates) + mini('Kul din', nf(m.days)) + mini('Candidates ka wage', inr(m.pay)) + mini('Commission', inr(m.commission)) + mini('GST (' + d.settings.gstPct + '%)', inr(m.gst)) + mini('Staff ko milega', inr(m.net)) + '</div>';
      if (S.open[s.id]) h += staffTable(s.id);
      h += '</div>';
    });
    if (!d.staff.length) h += '<p class="mu">Abhi koi staff nahi.</p>';
    return h;
  };
  function staffTable(sid) {
    var ls = S.data.report.lines.filter(function (l) { return l.staffId === sid; });
    if (!ls.length) return '<p class="mu">Is staff ka abhi koi candidate nahi.</p>';
    var tot = S.data.report.byStaff.filter(function (x) { return x.id === sid; })[0];
    return '<div class="row between"><b>Candidate-wise hisaab (' + P.monthName(S.month) + ')</b><button class="btn sm sec" data-act="xstaff" data-id="' + sid + '">Excel</button></div><div class="scroll"><table><thead><tr><th>Naam</th><th>Party</th><th>Trade</th><th class="n">Din</th><th class="n">Wage</th><th class="n">Pool</th><th class="n">Commission</th><th class="n">GST</th><th class="n">Net</th></tr></thead><tbody>' +
      ls.map(function (l) { return '<tr><td>' + esc(l.name) + '</td><td>' + esc(l.partyName) + '</td><td>' + esc(l.trade) + '</td><td class="n">' + nf(l.days) + '</td><td class="n">' + inr(l.pay) + '</td><td class="n">' + inr(l.pool) + '</td><td class="n">' + inr(l.commission) + '</td><td class="n">' + inr(l.gst) + '</td><td class="n">' + inr(l.net) + '</td></tr>'; }).join('') +
      '<tr class="tot"><td colspan="3">Kul</td><td class="n">' + nf(tot.days) + '</td><td class="n">' + inr(tot.pay) + '</td><td class="n">' + inr(tot.pool) + '</td><td class="n">' + inr(tot.commission) + '</td><td class="n">' + inr(tot.gst) + '</td><td class="n">' + inr(tot.net) + '</td></tr></tbody></table></div>';
  }

  /* khoj tez rahe: har candidate ka lowercase text ek baar banta hai (cache), aur type karte waqt sirf neeche ki table badalti hai */
  function candList() {
    var f = S.f, q = f.q.toLowerCase().trim();
    return S.data.candidates.filter(function (c) {
      if (f.party && c.partyId !== f.party) return false;
      if (f.staff && (f.staff === '_direct' ? c.staffId : c.staffId !== f.staff)) return false;
      if (!q) return true;
      var hs = c._h || (c._h = (c.name + ' ' + c.mobile + ' ' + c.trade + ' ' + c.serial).toLowerCase());
      return hs.indexOf(q) >= 0;
    });
  }
  function candTable(list) {
    var byId = {}; S.data.report.lines.forEach(function (l) { byId[l.id] = l; });
    return '<div class="card scroll"><table><thead><tr><th>Serial</th><th>Naam</th><th>Mobile</th><th>Trade</th><th>Party</th><th>Staff</th><th>Joining</th><th>Entry (date, time)</th><th>Din</th><th>Status</th><th></th></tr></thead><tbody>' +
      (list.slice(0, 400).map(function (c) {
        var l = byId[c.id] || {}; return '<tr><td class="b">' + esc(c.serial) + '</td><td>' + esc(c.name) + ' ' + aprBtn(c.approval) + '</td><td>' + esc(c.mobile) + '</td><td>' + esc(c.trade) + '</td><td>' + esc(l.partyName || '') + '</td><td>' + esc(whoS(l.staffId, l.staffName)) + '</td><td>' + esc(P.dd(c.joinDate)) + '</td><td class="sm">' + esc(P.dt(c.createdAt)) + '<div class="xs mu">' + (c.source === 'staff' ? 'Staff link se' : 'Admin') + '</div></td><td><input class="w-days js-days" data-id="' + c.id + '" type="number" min="0" max="31" step="0.5" value="' + dayOf(c.id) + '" aria-label="Din"></td><td>' + (c.status === 'left' ? '<span class="pill">chhod diya</span>' : '<span class="pill good">chal raha</span>') + ' ' + (c.verified ? '' : '<button class="link js-verify" data-act="verify" data-id="' + c.id + '">Verify</button>') + '</td><td class="row"><button class="link" data-act="candid" data-id="' + c.id + '">ID card</button><button class="link" data-act="panel" data-k="cand" data-id="' + c.id + '">Edit</button><button class="link danger" data-act="del" data-col="candidates" data-id="' + c.id + '">Hatayein</button></td></tr>';
      }).join('') || '<tr><td colspan="11" class="mu">Koi candidate nahi mila.</td></tr>') + '</tbody></table></div>';
  };
  V.cands = function () {
    var f = S.f, list = candList();
    var h = '<div class="row between"><h2>Candidates (<span id="candN">' + list.length + '</span>)</h2><div class="row"><button class="btn sec" data-act="xcands">Excel</button><button class="btn" data-act="panel" data-k="cand">+ Naya candidate</button></div></div>' +
      '<div class="grid">' + sel('fparty', 'Party', partyOpts('Sab party'), f.party) + sel('fstaff', 'Staff', [['', 'Sab staff'], ['_direct', 'Direct (koi staff nahi)']].concat(S.data.staff.map(function (s) { return [s.id, s.name]; })), f.staff) + fld('fq', 'Khojein (naam, mobile, trade, serial)', f.q) + '</div>';
    return h + '<div id="candRes">' + candTable(list) + '</div>';
  };


  /* ---------- Hazri (Daily) ---------- */
  function dim(m) { return new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate(); }
  function hzCands(pid) { var h = S.data.hazri || {}; return S.data.candidates.filter(function (c) { return c.partyId === pid && c.approval === 'approved' && (c.status !== 'left' || h[c.id]); }); }
  function pad31(x) { x = x || ''; while (x.length < 31) x += '-'; return x; }
  function hzDays(mk, n) { var t = 0; for (var i = 0; i < n; i++) t += mk[i] === '1' ? 1 : mk[i] === 'h' ? 0.5 : 0; return t; }
  function hzDraft(pid) {
    var key = pid + '|' + S.month;
    if (S.hz && S.hz.key === key) return S.hz;
    var marks = {}; hzCands(pid).forEach(function (c) { marks[c.id] = pad31((S.data.hazri || {})[c.id]); });
    S.hz = { key: key, pid: pid, marks: marks, dirty: {} }; return S.hz;
  }
  function hzActiveParty() {
    var ps = S.data.parties.filter(function (p) { return p.active !== false; });
    if (!ps.length) return '';
    if (!ps.some(function (p) { return p.id === S.hzParty; })) S.hzParty = ps[0].id;
    return S.hzParty;
  }
  function todayCard() {
    var d = S.data; if (S.month !== d.today.slice(0, 7)) return '';
    var di = +d.today.slice(8) - 1, h = d.hazri || {}, rows = [];
    d.parties.forEach(function (p) {
      var n = 0; d.candidates.forEach(function (c) { if (c.partyId === p.id && h[c.id]) n += h[c.id][di] === '1' ? 1 : h[c.id][di] === 'h' ? 0.5 : 0; });
      if (n) rows.push('<b>' + esc(p.name) + ':</b> ' + nf(n));
    });
    return '<div class="card"><h3>Aaj (' + P.dd(d.today) + ') ki hazri</h3>' + (rows.length ? rows.join(' · ') : '<span class="mu">Aaj ki hazri abhi bhari nahi gayi. "Hazri (Daily)" tab me bharein.</span>') + '</div>';
  }

  /* ---------- Approvals ---------- */
  function marksText(mk) { var n = 0, h = 0; String(mk || '').split('').forEach(function (c) { if (c === '1') n++; else if (c === 'h') h++; }); return n + ' poore' + (h ? ' + ' + h + ' aadhe' : '') + ' din'; }
  V.appr = function () {
    var d = S.data, a = d.approvals, h = '<h2>Approvals</h2>';
    if (!d.pendingCount) return h + '<div class="note">Abhi koi approval baaki nahi hai.</div>';
    if (a.staff.length) {
      h += '<h3>Naye staff ki registration (' + a.staff.length + ')</h3>';
      a.staff.forEach(function (s) {
        h += '<div class="card"><div class="row ai-start g16"><div><div class="photo-box" id="ph-s' + s.id + '">' + (S.sph['staff' + s.id] ? '<img alt="photo" src="' + esc(S.sph['staff' + s.id]) + '">' : '<button class="link" data-act="showphoto" data-kind="staff" data-id="' + s.id + '">Photo dekhein</button>') + '</div></div><div class="grow"><h3>' + esc(s.name) + '</h3>' +
          '<div class="sm">Mobile: ' + esc(s.phone) + (s.email ? ' · ' + esc(s.email) : '') + '<br>' + (s.father ? 'Pita/pati: ' + esc(s.father) + ' · ' : '') + (s.dob ? 'Janm tithi: ' + P.dd(s.dob) + '<br>' : '') + 'Pata: ' + esc(s.address) + '<br>Aadhaar: ' + esc(s.aadhaar || '—') + ' · Bank: ' + esc(s.bank || '—') + ' ' + esc(s.ifsc || '') + ' · UPI: ' + esc(s.upi || '—') + '<br><span class="mu">Form bhara: ' + esc(P.dt(s.createdAt)) + '</span></div>' +
          '<div class="grid mt8"><label>Prakar<select id="aty-' + s.id + '"><option value="agent">Staff (candidate laata hai)</option><option value="supplier">Manpower supplier</option><option value="supervisor">Site supervisor</option></select></label></div><div id="apb-' + s.id + '">' + commBox({}, d.settings.commissionPct, 'commissionPct') + '</div>' +
          '<div class="row mt8"><button class="btn" data-act="apstaff" data-id="' + s.id + '">Approve karein</button><button class="btn sec" data-act="rjstaff" data-id="' + s.id + '">Reject</button></div></div></div></div>';
      });
    }
    if (a.cands.length) {
      h += '<h3>Candidate approval (' + a.cands.length + ')</h3><div class="note">Staff khud bhi apne candidate ko approve kar sakta hai. Aap bhi yahin se approve / reject kar sakte hain.</div><div class="card scroll"><table><thead><tr><th>Serial</th><th>Naam</th><th>Party</th><th>Trade</th><th>Staff</th><th>Bhara</th><th></th></tr></thead><tbody>' +
        a.cands.map(function (c) { return '<tr><td class="b">' + esc(c.serial) + '</td><td>' + esc(c.name) + '<div class="xs mu">' + esc(c.mobile) + (c.hasPhoto ? '' : ' · <span class="bad">photo nahi</span>') + '</div></td><td>' + esc(c.partyName) + '</td><td>' + esc(c.trade) + '</td><td>' + esc(c.staffName) + '</td><td class="sm">' + esc(P.dt(c.createdAt)) + '</td><td><div class="row"><button class="btn sm" data-act="apcand" data-id="' + c.id + '">Approve</button><button class="btn sm sec" data-act="rjcand" data-id="' + c.id + '">Reject</button></div></td></tr>'; }).join('') + '</tbody></table></div>';
    }
    if (a.att.length) {
      h += '<div class="row between"><h3>Hazri approval (' + a.att.length + ')</h3><button class="btn sm" data-act="apattall">Sab approve karein</button></div><div class="note">Staff ki bhari hazri approve hone par hi admin ke hisaab me judti hai. Badlav ho to purana approved hisaab tab tak chalta hai.</div><div class="card scroll"><table><thead><tr><th>Serial</th><th>Naam</th><th>Party</th><th>Staff</th><th>Mahina</th><th class="n">Din (naye)</th><th class="n">Abhi ke approved</th><th>Hazri</th><th></th></tr></thead><tbody>' +
        a.att.map(function (x) { return '<tr><td class="xs">' + esc(x.serial) + '</td><td>' + esc(x.name) + '</td><td>' + esc(x.partyName) + '</td><td>' + esc(x.staffName) + '</td><td>' + P.monthName(x.month) + '</td><td class="n"><b>' + nf(x.days) + '</b></td><td class="n">' + (x.current ? nf(x.current) : '—') + '</td><td class="xs">' + (x.marks ? marksText(x.marks) : 'din bhare') + '</td><td><div class="row"><button class="btn sm" data-act="apatt" data-id="' + x.candId + '" data-m="' + x.month + '">Approve</button><button class="btn sm sec" data-act="rjatt" data-id="' + x.candId + '" data-m="' + x.month + '">Wapas</button></div></td></tr>'; }).join('') + '</tbody></table></div>';
    }
    if (a.requests.length) {
      h += '<h3>Rate badalne ki request (' + a.requests.length + ')</h3><div class="card scroll"><table><thead><tr><th>Candidate</th><th>Staff</th><th class="n">Abhi ' + unit() + '</th><th class="n">Maanga ' + unit() + '</th><th>Karan</th><th></th></tr></thead><tbody>' +
        a.requests.map(function (q) { return '<tr><td>' + esc(q.name) + ' <span class="xs mu">' + esc(q.serial) + ' · ' + esc(q.trade) + '</span></td><td>' + esc(q.staffName) + '</td><td class="n">' + inr(q.current) + '</td><td class="n"><b>' + inr(q.payRate) + '</b></td><td>' + esc(q.note) + '</td><td><div class="row"><button class="btn sm" data-act="aprq" data-id="' + q.id + '">Manjoor</button><button class="btn sm sec" data-act="rjrq" data-id="' + q.id + '">Mana</button></div></td></tr>'; }).join('') + '</tbody></table></div>';
    }
    return h;
  };

  /* ---------- Hisaab: kitna aaya, kitna jana hai, party-wise aur staff-wise ---------- */
  function money() {
    var d = S.data, r = d.report, f = r.firm, adv = d.advances, advS = 0, advC = 0;
    adv.forEach(function (a) { if (a.kind === 'staff') advS += a.amount; else advC += a.amount; });
    var sum = function (arr, fn) { return arr.reduce(function (a, x) { return a + fn(x); }, 0); }, r2 = function (x) { return Math.round(x * 100) / 100; };
    var recv = r2(sum(r.byParty, function (p) { return p.receivable; })), got = r2(sum(r.byParty, function (p) { return p.received; }));
    var out = [['Candidates ko wage', f.pay], ['Staff / supplier ko commission (GST ke baad)', f.staffNet], ['GST (staff ke commission par)', f.gstOnStaff], ['GST (firm ke hisse par)', f.gstOnFirm], ['Site supervisor fixed payment', f.fixedPay], ['Office staff salary', f.officeSalaries], ['Anya kharch', f.otherExpenses], ['Teeno owners me baantna', f.distributable]];
    var total = r2(sum(out, function (x) { return x[1]; })), kharch = r2(f.officeSalaries + f.otherExpenses);
    return { recv: recv, got: got, out: out, total: total, advS: advS, advC: advC, kharch: kharch, match: Math.abs(total - recv) < 1 };
  }
  /* Kise kitna chukana tha, kitna chukaya, kitna baaki: candidates, staff, owners */
  function payRows() {
    var d = S.data, r = d.report, rows = [], adv = function (kind, id) { return d.advances.filter(function (a) { return a.kind === kind && a.refId === id; }).reduce(function (a, x) { return a + x.amount; }, 0); };
    var paid = function (kind, id) { return d.payments.filter(function (p) { return p.kind === kind && p.refId === id; }).reduce(function (a, x) { return a + x.amount; }, 0); };
    var r2 = function (x) { return Math.round(x * 100) / 100; }, add = function (kind, id, name, sub, due) { var pd = paid(kind, id); if (due > 0 || pd > 0) rows.push({ kind: kind, id: id, key: kind + ':' + id, name: name, sub: sub, due: r2(due), paid: r2(pd), left: r2(due - pd) }); };
    r.byStaff.forEach(function (x) { var st = staff(x.id); add('staff', x.id, x.name, 'Staff' + (st && st.serial ? ' ' + st.serial : ''), x.net + x.fixed - adv('staff', x.id)); });
    r.lines.forEach(function (l) { var cc = d.candidates.filter(function (x) { return x.id === l.id; })[0]; add('cand', l.id, l.name, 'Candidate ' + (cc && cc.serial ? cc.serial : '') + ' \u00b7 ' + l.partyName, l.pay - adv('cand', l.id)); });
    r.owners.forEach(function (o) { add('owner', o.id, o.name, 'Owner / ' + (o.role || 'partner'), o.amount); });
    return rows;
  }
  var MODE = { cash: 'Cash', upi: 'UPI', bank: 'Bank', other: 'Anya' };
  function payName(p) {
    var d = S.data; if (p.kind === 'staff') { var s1 = staff(p.refId); return 'Staff: ' + (s1 ? s1.name : '?'); }
    if (p.kind === 'owner') { var o = d.partners.filter(function (x) { return x.id === p.refId; })[0]; return 'Owner: ' + (o ? o.name : '?'); }
    var c = d.candidates.filter(function (x) { return x.id === p.refId; })[0]; return 'Candidate: ' + (c ? c.name : '?');
  }
  /* ---------- Suraksha (alert) ---------- */
  var SEVL = { info: 'JAANKARI', warn: 'DHYAN', high: 'KHATRA', critical: 'TURANT KARO' };
  var SACT = { revokeAdmin: ['Sab admin session band karein', 1], revokeStaff: ['Sab staff session aur link band karein', 1], lockStaff: ['Staff panel abhi band karein', 1], unlockStaff: ['Staff panel dobara kholein', 0], siteCheck: ['Website abhi jaanchein', 0], baseline: ['Naya baseline banayein (maine khud file badli)', 1] };
  var SGO = { goSettings: ['set', 'Settings kholein'], goStaff: ['staff', 'Staff aur links kholein'], goApprovals: ['appr', 'Approvals kholein'], goActivity: ['dash', 'Haal ki gatividhi dekhein'] };
  function secBanner() {
    var c = S.data && S.data.sec; if (!c || !c.high || S.tab === 'sec') return '';
    return '<div class="note alert-bar row between" role="alert"><span><b>Suraksha alert:</b> ' + c.high + ' gambhir alert aapke dekhne ke liye baaki hai. Pehle iska hal dekhein.</span><button class="btn sm" data-act="tab" data-id="sec">Abhi dekhein</button></div>';
  }
  function secWhen(iso) { try { return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }); } catch (e) { return iso; } }
  function secAgo(ms) { if (!ms) return 'abhi tak nahi'; var m = Math.round((S.sec.status.now - ms) / 60000); return m < 1 ? 'abhi' : m < 90 ? m + ' minute pehle' : m < 2880 ? Math.round(m / 60) + ' ghante pehle' : Math.round(m / 1440) + ' din pehle'; }
  function secCard(a) {
    var pb = S.sec.pb[a.kind] || { steps: [], acts: [] }, isNew = a.status === 'new', h = '';
    h += '<div class="card alert ' + esc(a.sev) + (isNew ? ' fresh' : '') + '"><div class="row between"><span><span class="pill sev-' + esc(a.sev) + '">' + (SEVL[a.sev] || '') + '</span> <b>' + esc(a.title) + '</b></span><span class="mu sm">' + esc(secWhen(a.at)) + (a.count > 1 ? ' · ' + a.count + ' baar' : '') + '</span></div>';
    if (a.detail) h += '<p class="sm mu">' + esc(a.detail) + '</p>';
    if (isNew && pb.steps.length) {
      h += '<div class="steps"><b>Abhi kya karein:</b><ol>' + pb.steps.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></div>';
      h += '<div class="row">' + (pb.acts || []).map(function (k) {
        if (SGO[k]) return '<button class="btn sec sm" data-act="secgo" data-id="' + SGO[k][0] + '">' + SGO[k][1] + '</button>';
        if (k === 'baseline') return '';
        if (SACT[k]) return '<button class="btn ' + (SACT[k][1] ? 'bad' : 'sec') + ' sm" data-act="secact" data-k="' + k + '">' + SACT[k][0] + '</button>';
        return '';
      }).join('') + '<button class="btn sm" data-act="secack" data-id="' + esc(a.id) + '">Dekh liya</button></div>';
    } else if (isNew) h += '<div class="row"><button class="btn sm" data-act="secack" data-id="' + esc(a.id) + '">Dekh liya</button></div>';
    return h + '</div>';
  }

  /* ---------- Manpower supplier: kis site (party) me kitne candidate, unke code/naam ke saath ---------- */
  function supData() {
    var d = S.data, r = d.report, out = [];
    d.staff.filter(function (s) { return s.type === 'supplier' && s.regStatus !== 'rejected'; }).forEach(function (s) {
      var me = r.byStaff.filter(function (x) { return x.id === s.id; })[0] || { commission: 0, gst: 0, net: 0, days: 0, pay: 0 };
      var ls = r.lines.filter(function (l) { return l.staffId === s.id; }).map(function (l) { var c = cand(l.id) || {}; return { id: l.id, serial: c.serial || '', name: l.name, trade: l.trade, site: l.partyName, partyId: l.partyId, status: c.status || 'active', days: l.days, pay: l.pay, rate: l.fixedRate, commission: l.commission, gst: l.gst, net: l.net }; });
      var sites = {};
      ls.forEach(function (l) { var q = sites[l.partyId] || (sites[l.partyId] = { site: l.site, trades: {}, onsite: 0, total: 0, days: 0, pay: 0, commission: 0 }); q.total++; if (l.status !== 'left') q.onsite++; q.days += l.days; q.pay += l.pay; q.commission += l.commission; var t = q.trades[l.trade] || (q.trades[l.trade] = 0); q.trades[l.trade] = t + 1; });
      out.push({ s: s, me: me, lines: ls, sites: Object.keys(sites).map(function (k) { return sites[k]; }), onsite: ls.filter(function (l) { return l.status !== 'left'; }).length });
    });
    return out;
  }
  function tradeTxt(t) { return Object.keys(t).map(function (k) { return k + ' ×' + t[k]; }).join(', '); }

  /* ---------- ID dekhein: mobile / naam / ID likhkar company (party), staff, candidate sabki ID ---------- */
  function idRecs() {
    var d = S.data;
    return d.staff.map(function (s) { return { kind: 'Staff / Supplier', serial: s.serial, name: s.name, phone: s.phone, extra: TYPE[s.type] || '' }; })
      .concat(d.candidates.map(function (c) { var p = partyOf(c.partyId); return { kind: 'Candidate', serial: c.serial, name: c.name, phone: c.mobile, extra: (c.trade || '') + (p ? ' · ' + p.name : '') + (c.staffId ? ' · ' + whoS(c.staffId) : '') }; }))
      .concat(d.parties.map(function (p) { return { kind: 'Party / Company', serial: p.serial, name: p.name, phone: p.phone, extra: p.contact || '' }; }));
  }
  function idRows(q) {
    var f = P.findIds(q, idRecs());
    if (!String(q || '').trim()) return '<div class="note">Upar mobile number, naam ya ID (jaise A2Z-S-0001 ya a2z-s-1) likhiye.</div>';
    if (!f.length) return '<div class="note warn">Kuch nahi mila. Mobile ke kam se kam 3 ank, ya naam / ID ke 2 akshar likhiye.</div>';
    return '<div class="scroll"><table><thead><tr><th>Prakar</th><th>ID</th><th>Naam</th><th>Mobile</th><th>Jankari</th></tr></thead><tbody>' + f.map(function (r) { return '<tr><td>' + esc(r.kind) + '</td><td><b>' + esc(r.serial || '—') + '</b></td><td>' + esc(r.name) + '</td><td>' + esc(r.phone || '') + '</td><td>' + esc(r.extra) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  V.ids = function () {
    return '<h2>ID dekhein</h2><div class="card"><label>Mobile / naam / ID likhiye<input id="idq" type="search" inputmode="search" autocomplete="off" placeholder="jaise 9876543210, Ram ya A2Z-S-0001" value="' + esc(S.idq || '') + '"></label><div id="idres">' + idRows(S.idq) + '</div></div>';
  };
  V.sup = function () {
    var L = supData(), h = '<div class="row between"><h2>Manpower supplier: kaun si site me kitne candidate (' + P.monthName(S.month) + ')</h2><button class="btn sec" data-act="xsup">Sab suppliers ki Excel</button></div>';
    h += '<div class="note">Yahan har manpower supplier ke candidate, unki site (party), din aur commission dikhte hain. Supplier ko payment/salary nahi milti, sirf commission.</div>';
    if (!L.length) return h + '<div class="note warn">Abhi koi Manpower supplier nahi hai. "Staff aur links" me staff banate samay Prakar = Manpower supplier chuniye.</div>';
    h += '<div class="card scroll"><table><thead><tr><th>Supplier code</th><th>Naam</th><th>Mobile</th><th>Commission ka tareeka</th><th class="n">Kaam par candidate</th><th class="n">Site</th><th class="n">Din</th><th class="n">Commission</th><th class="n">GST kata</th><th class="n">Net milega</th><th></th></tr></thead><tbody>' +
      L.map(function (x) { return '<tr><td><b>' + esc(x.s.serial || '—') + '</b></td><td>' + esc(x.s.name) + '</td><td>' + esc(x.s.phone) + '</td><td>' + esc(cmLabel(Object.assign({}, x.s, { pct: x.me.pct, fixedRates: x.s.fixedRates }))) + '</td><td class="n">' + x.onsite + '</td><td class="n">' + x.sites.length + '</td><td class="n">' + nf(x.me.days) + '</td><td class="n">' + inr(x.me.commission) + '</td><td class="n">' + inr(x.me.gst) + '</td><td class="n b">' + inr(x.me.net) + '</td><td><button class="btn sm sec" data-act="xsup1" data-id="' + x.s.id + '">Excel</button></td></tr>'; }).join('') + '</tbody></table></div>';
    L.forEach(function (x) {
      h += '<div class="card"><h3>' + esc(x.s.name) + ' <span class="b">' + esc(x.s.serial || '') + '</span></h3>' +
        (x.sites.length ? '<div class="scroll"><table><thead><tr><th>Site / Party</th><th>Kaun se trade</th><th class="n">Candidate (abhi kaam par)</th><th class="n">Din</th><th class="n">Candidates ka wage</th><th class="n">Supplier ka commission</th></tr></thead><tbody>' +
          x.sites.map(function (q) { return '<tr><td>' + esc(q.site) + '</td><td>' + esc(tradeTxt(q.trades)) + '</td><td class="n">' + q.total + ' (' + q.onsite + ')</td><td class="n">' + nf(q.days) + '</td><td class="n">' + inr(q.pay) + '</td><td class="n">' + inr(q.commission) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
          '<details><summary>Candidate-wise list (' + x.lines.length + ')</summary><div class="scroll"><table><thead><tr><th>Candidate code</th><th>Naam</th><th>Trade</th><th>Site</th><th class="n">Din</th><th class="n">Wage</th><th class="n">Commission</th></tr></thead><tbody>' +
          x.lines.map(function (l) { return '<tr><td class="xs">' + esc(l.serial) + '</td><td>' + esc(l.name) + '</td><td>' + esc(l.trade) + '</td><td>' + esc(l.site) + '</td><td class="n">' + nf(l.days) + '</td><td class="n">' + inr(l.pay) + '</td><td class="n">' + inr(l.commission) + '</td></tr>'; }).join('') + '</tbody></table></div></details>'
          : '<div class="note">Is supplier ke abhi koi approved candidate nahi hain.</div>') + '</div>';
    });
    return h;
  };
  function supSheets(L) {
    var sum = [['Supplier code', 'Naam', 'Mobile', 'Commission ka tareeka', 'Kaam par candidate', 'Site', 'Din', 'Candidates ka wage', 'Commission', 'GST kata', 'Net milega']].concat(L.map(function (x) { return [x.s.serial, x.s.name, x.s.phone, CMODE[x.s.commMode] || 'Tay nahi', x.onsite, x.sites.length, x.me.days, x.me.pay, x.me.commission, x.me.gst, x.me.net]; }));
    var site = [['Supplier code', 'Supplier', 'Site / Party', 'Trade-wise candidate', 'Kul candidate', 'Abhi kaam par', 'Din', 'Candidates ka wage', 'Supplier ka commission']], cl = [['Supplier code', 'Supplier', 'Candidate code', 'Candidate', 'Trade', 'Site / Party', 'Halat', 'Din', 'Wage', 'Fixed rate/din', 'Commission', 'GST', 'Net']];
    L.forEach(function (x) {
      x.sites.forEach(function (q) { site.push([x.s.serial, x.s.name, q.site, tradeTxt(q.trades), q.total, q.onsite, q.days, q.pay, q.commission]); });
      x.lines.forEach(function (l) { cl.push([x.s.serial, x.s.name, l.serial, l.name, l.trade, l.site, l.status === 'left' ? 'Chhod diya' : 'Kaam par', l.days, l.pay, l.rate == null ? '' : l.rate, l.commission, l.gst, l.net]); });
    });
    return [{ name: 'Supplier', rows: sum, widths: [14, 22, 14, 26, 12, 8, 8, 14, 14, 12, 14] }, { name: 'Site-wise', rows: site, widths: [14, 22, 24, 34, 10, 12, 8, 14, 16] }, { name: 'Candidates', rows: cl, widths: [14, 22, 16, 22, 14, 24, 12, 8, 12, 12, 12, 10, 12] }];
  }
  V.sec = function () {
    var d = S.sec; if (!d) return '<h2>Suraksha (Alert)</h2><div class="note">Jaanch ho rahi hai...</div>';
    var st = d.status, n = d.counts.n, h = '<div class="row between"><h2>Suraksha (Alert)</h2><div class="row"><button class="btn sec" data-act="xsec">Alerts Excel me</button>' + (n ? '<button class="btn sec" data-act="secackall">Sab dekh liya</button>' : '') + '</div></div>';
    h += '<div class="note ' + (n ? 'warn' : '') + '">' + (n ? '<b>' + n + '</b> alert aapke dekhne ke liye baaki hain. Har alert ke neeche "Abhi kya karein" ke steps hain.' : 'Abhi koi naya alert nahi. Sab shant hai.') + '</div>';
    h += '<div class="card"><h3>Nigrani ki halat</h3><div class="grid">' +
      '<div><span class="mu sm">Har ghante ki jaanch</span><br>' + (st.installed ? '<span class="pill good">chalu</span> antim: ' + esc(secAgo(st.watchAt)) : '<span class="pill warn">chalu nahi</span> <span class="sm mu">Apps Script me <b>a2zSecurityInstall</b> ek baar Run karein (guide Part K).</span>') + '</div>' +
      '<div><span class="mu sm">Staff panel</span><br>' + (st.staffLock ? '<span class="pill bad">BAND hai</span> <button class="btn sm" data-act="secact" data-k="unlockStaff">Dobara kholein</button>' : '<span class="pill good">khula hai</span>') + '</div>' +
      '<div><span class="mu sm">Alert email yahan jati hai</span><br>' + esc(st.email) + '</div>' +
      '<div><span class="mu sm">Website ki file jaanch</span><br>' + (st.baselineFiles ? '<span class="pill ' + (st.siteLast && !st.siteLast.ok ? 'bad' : 'good') + '">' + (st.siteLast ? (st.siteLast.ok ? 'sab sahi' : 'gadbad') : st.baselineFiles + ' file yaad') + '</span> ' + st.baselineFiles + ' file yaad (' + esc(secAgo(st.baselineAt)) + ')' : '<span class="pill warn">baseline nahi bana</span>') + '</div></div>' +
      '<form data-form="secsite" class="row mt6"><label class="grow">Website ka link (GitHub Pages)<input name="url" type="url" value="' + esc(st.siteUrl) + '" placeholder="https://naam.github.io/repo/"></label><button class="btn sec" type="submit">Baseline banayein</button><button class="btn sec" type="button" data-act="secact" data-k="siteCheck">Website abhi jaanchein</button></form>' +
      '<p class="sm mu">Baseline = abhi ki sahi website ka "nishaan". Baad me koi file badli (bina aapke upload kiye) to alert aata hai. Khud nayi file upload karein to dobara "Baseline banayein" dabayein.</p>' +
      '<div class="row"><button class="btn sec sm" data-act="secact" data-k="test">Test alert bhejein</button><button class="btn sec sm" data-act="secact" data-k="revokeStaff">Sab staff session band</button><button class="btn sec sm" data-act="secact" data-k="revokeAdmin">Sab admin session band</button>' + (st.staffLock ? '' : '<button class="btn bad sm" data-act="secact" data-k="lockStaff">Staff panel band karein</button>') + '</div></div>';
    h += '<h3>Alerts</h3>' + (d.alerts.length ? d.alerts.map(secCard).join('') : '<div class="note">Abhi tak koi alert nahi aaya.</div>');
    return h;
  };
  async function secLoad() { S.sec = await api('GET', '/api/admin/sec-data'); if (S.data) S.data.sec = S.sec.counts; render(); }
  V.help = function () { return '<h2>Madad (Help) - A2Z Sahayak</h2><div class="note">Website me jo bhi kaam hote hain (form kahan milega, hazri kaise bharein, paisa kaise chukayein...) uska step-by-step tareeka poochhein. Gupt cheezein (password, OTP, SETUP_CODE) ye kabhi nahi batata.</div><div id="helpBox"></div>'; };
  V.money = function () {
    var d = S.data, r = d.report, m = money(), h = '<div class="row between"><h2>Hisaab: kitna aaya, kitna jana hai (' + P.monthName(S.month) + ')</h2><div class="row"><button class="btn sec" data-act="xall">Sab kuch Excel me</button><button class="btn" data-act="panel" data-k="advance">+ Advance</button></div></div>';
    h += '<div class="cards">' + kpi('Companies se aana (kul)', inr(m.recv)) + kpi('Aa chuka', inr(m.got)) + kpi('Abhi aana baaki', inr(r.byParty.reduce(function (a, p) { return a + p.due; }, 0))) + kpi('Advance de chuke', inr(m.advS + m.advC)) + kpi('Kharch likha (office + anya)', inr(m.kharch)) + kpi('Chukaya (kul)', inr(S.data.payments.reduce(function (a, p) { return a + p.amount; }, 0))) + kpi('Chukana baaki', inr(payRows().reduce(function (a, x) { return a + Math.max(0, x.left); }, 0))) + '</div>';
    h += '<h3>Jo paisa aayega wo kahan jayega</h3><div class="card scroll"><table><tbody>' + m.out.map(function (x, i) { return '<tr><td>' + (i + 1) + '. ' + esc(x[0]) + '</td><td class="n">' + inr(x[1]) + '</td></tr>'; }).join('') + '<tr class="tot"><td>Kul jana</td><td class="n">' + inr(m.total) + '</td></tr><tr><td>Kul aana (bill + company ka commission)</td><td class="n">' + inr(m.recv) + '</td></tr></tbody></table></div>' +
      (m.match ? '<div class="note">Aana = jana. Hisaab barabar hai.</div>' : '<div class="note warn">Aane aur jane me ' + inr(Math.abs(m.total - m.recv)) + ' ka farak hai. Kharch / fixed payment dobara dekhein.</div>');
    h += '<h3>Party-wise paisa aur commission</h3><div class="card scroll"><table><thead><tr><th>Party</th><th class="n">Candidates</th><th class="n">Din</th><th class="n">Company bill</th><th class="n">Company commission</th><th class="n">Candidates ka wage</th><th class="n">Margin</th><th class="n">Pool</th><th class="n">Staff commission</th><th class="n">Firm ka hissa</th><th class="n">Aana</th><th class="n">Aaya</th><th class="n">Baaki</th></tr></thead><tbody>';
    var T = { hc: 0, days: 0, bill: 0, bonus: 0, pay: 0, margin: 0, pool: 0, sc: 0, fs: 0, rc: 0, got: 0, due: 0 };
    r.byParty.forEach(function (p) {
      var sc = r.lines.filter(function (l) { return l.partyId === p.id; }).reduce(function (a, l) { return a + l.commission; }, 0), fs = p.pool - sc;
      T.hc += p.headcount; T.days += p.days; T.bill += p.bill; T.bonus += p.bonus; T.pay += p.pay; T.margin += p.margin; T.pool += p.pool; T.sc += sc; T.fs += fs; T.rc += p.receivable; T.got += p.received; T.due += p.due;
      h += '<tr><td><b>' + esc(p.name) + '</b></td><td class="n">' + p.headcount + '</td><td class="n">' + nf(p.days) + '</td><td class="n">' + inr(p.bill) + '</td><td class="n">' + inr(p.bonus) + '</td><td class="n">' + inr(p.pay) + '</td><td class="n">' + inr(p.margin) + '</td><td class="n">' + inr(p.pool) + '</td><td class="n">' + inr(sc) + '</td><td class="n">' + inr(fs) + '</td><td class="n">' + inr(p.receivable) + '</td><td class="n">' + inr(p.received) + '</td><td class="n">' + inr(p.due) + '</td></tr>';
    });
    h += '<tr class="tot"><td>Kul</td><td class="n">' + T.hc + '</td><td class="n">' + nf(T.days) + '</td><td class="n">' + inr(T.bill) + '</td><td class="n">' + inr(T.bonus) + '</td><td class="n">' + inr(T.pay) + '</td><td class="n">' + inr(T.margin) + '</td><td class="n">' + inr(T.pool) + '</td><td class="n">' + inr(T.sc) + '</td><td class="n">' + inr(T.fs) + '</td><td class="n">' + inr(T.rc) + '</td><td class="n">' + inr(T.got) + '</td><td class="n">' + inr(T.due) + '</td></tr></tbody></table></div>';
    h += '<h3>Staff-wise (party ke hisaab se)</h3><div class="card scroll"><table><thead><tr><th>Staff</th><th>Party</th><th class="n">Candidates</th><th class="n">Din</th><th class="n">Candidates ka wage</th><th class="n">Commission</th><th class="n">GST</th><th class="n">Net</th><th class="n">Advance</th><th class="n">Baaki dena</th></tr></thead><tbody>';
    r.byStaff.forEach(function (s) {
      var sa = d.advances.filter(function (a) { return a.kind === 'staff' && a.refId === s.id; }).reduce(function (a, x) { return a + x.amount; }, 0), parts = {};
      r.lines.filter(function (l) { return l.staffId === s.id; }).forEach(function (l) { var q = parts[l.partyId] || (parts[l.partyId] = { name: l.partyName, c: 0, days: 0, pay: 0, comm: 0, gst: 0, net: 0 }); q.c++; q.days += l.days; q.pay += l.pay; q.comm += l.commission; q.gst += l.gst; q.net += l.net; });
      h += '<tr class="tot"><td><b>' + esc(s.name) + '</b> <span class="xs mu">' + esc(staff(s.id) ? staff(s.id).serial : '') + '</span></td><td>Kul</td><td class="n">' + s.candidates + '</td><td class="n">' + nf(s.days) + '</td><td class="n">' + inr(s.pay) + '</td><td class="n">' + inr(s.commission) + '</td><td class="n">' + inr(s.gst) + '</td><td class="n">' + inr(s.net + s.fixed) + '</td><td class="n">' + inr(sa) + '</td><td class="n">' + inr(Math.round((s.net + s.fixed - sa) * 100) / 100) + '</td></tr>';
      Object.keys(parts).forEach(function (k) { var q = parts[k]; h += '<tr><td></td><td>' + esc(q.name) + '</td><td class="n">' + q.c + '</td><td class="n">' + nf(q.days) + '</td><td class="n">' + inr(q.pay) + '</td><td class="n">' + inr(q.comm) + '</td><td class="n">' + inr(q.gst) + '</td><td class="n">' + inr(q.net) + '</td><td></td><td></td></tr>'; });
    });
    h += '</tbody></table></div>';
    var pr = payRows();
    h += '<div class="row between"><h3>Kise kitna chukaya gaya (' + P.monthName(S.month) + ')</h3></div><div class="note">Advance pehle hi ghat chuka hai. Yahan wo rakam hai jo asli me di gayi (cash / UPI / bank). Rakam dene par "Chukaya" dabayein.</div><div class="card scroll"><table><thead><tr><th>Kisko</th><th class="n">Dena tha (advance ke baad)</th><th class="n">Chukaya</th><th class="n">Baaki</th><th></th></tr></thead><tbody>' +
      (pr.map(function (x) { return '<tr><td><b>' + esc(x.name) + '</b><div class="xs mu">' + esc(x.sub) + '</div></td><td class="n">' + inr(x.due) + '</td><td class="n">' + inr(x.paid) + '</td><td class="n">' + (x.left > 0.004 ? '<b>' + inr(x.left) + '</b>' : x.left < -0.004 ? '<span class="bad">' + inr(x.left) + ' (zyada)</span>' : '<span class="pill good">Poora chukaya</span>') + '</td><td>' + (x.left > 0.004 ? '<button class="btn sm" data-act="panel" data-k="pay" data-id="' + esc(x.key) + '">Chukaya</button>' : '') + '</td></tr>'; }).join('') || '<tr><td colspan="5" class="mu">Is mahine abhi kisi ko kuch dena nahi bana. Hazri approve karein.</td></tr>') + '</tbody></table></div>' +
      '<h3>Chukaye gaye payments (' + P.monthName(S.month) + ')</h3><div class="card scroll"><table><thead><tr><th>Tarikh</th><th>Kisko</th><th>Tareeka</th><th>Note</th><th class="n">Rakam</th><th></th></tr></thead><tbody>' +
      (S.data.payments.map(function (p) { return '<tr><td>' + P.dd(p.date) + '</td><td>' + esc(payName(p)) + '</td><td>' + esc(MODE[p.mode] || p.mode) + '</td><td>' + esc(p.note) + '</td><td class="n">' + inr(p.amount) + '</td><td><button class="link danger" data-act="del" data-col="payments" data-id="' + p.id + '">Hatayein</button></td></tr>'; }).join('') || '<tr><td colspan="6" class="mu">Is mahine koi payment record nahi.</td></tr>') + '</tbody></table></div>';
    h += '<h3>Advance (' + P.monthName(S.month) + ')</h3><div class="card scroll"><table><thead><tr><th>Tarikh</th><th>Kisko</th><th>Note</th><th class="n">Rakam</th><th></th></tr></thead><tbody>' +
      (d.advances.map(function (a) { var who = a.kind === 'staff' ? staff(a.refId) : d.candidates.filter(function (c) { return c.id === a.refId; })[0]; return '<tr><td>' + P.dd(a.date) + '</td><td>' + (a.kind === 'staff' ? 'Staff: ' : 'Candidate: ') + esc(who ? who.name : '?') + '</td><td>' + esc(a.note) + '</td><td class="n">' + inr(a.amount) + '</td><td><button class="link danger" data-act="del" data-col="advances" data-id="' + a.id + '">Hatayein</button></td></tr>'; }).join('') || '<tr><td colspan="5" class="mu">Is mahine koi advance nahi.</td></tr>') + '</tbody></table></div>';
    return h;
  };

  /* payout.js se poora hisaab turant: save se pehle ki bhari hazri bhi judti hai */
  function liveReport(dr) {
    var d = S.data, att = {}, m = d.month;
    d.candidates.forEach(function (c) { var a = d.attendance[c.id]; if (a && !a.pending) { att[c.id] = {}; att[c.id][m] = { days: a.days }; } });
    Object.keys(dr.dirty).forEach(function (cid) { att[cid] = {}; att[cid][m] = { days: hzDays(dr.marks[cid], dim(m)) }; });
    return A2ZPayout.compute({ month: m, settings: d.settings, parties: d.parties, staff: d.staff, candidates: d.candidates.filter(function (c) { return c.approval === 'approved'; }), attendance: att, expenses: d.expenses, partners: d.partners, receipts: d.receipts, asOf: d.today });
  }
  V.hazri = function () {
    var d = S.data, pid = hzActiveParty(), n = dim(S.month);
    var h = '<div class="row between"><h2>Hazri (Daily) – ' + P.monthName(S.month) + '</h2><div class="row"><button class="btn sec" data-act="xhazri">Excel (is party ki)</button><button class="btn sec" data-act="xhazriall">Excel (sab party)</button></div></div>';
    if (!pid) return h + '<p class="mu">Pehle "Party / Company" me party jodein, phir candidates.</p>';
    var dr = hzDraft(pid), cs = hzCands(pid), byId = {}, pendingKey = {}, live = liveReport(dr); live.lines.forEach(function (l) { byId[l.id] = l; }); d.approvals.att.forEach(function (a) { if (a.month === S.month) pendingKey[a.candId] = true; });
    var dirtyN = Object.keys(dr.dirty).length, today = S.month === d.today.slice(0, 7) ? +d.today.slice(8) : 0;
    h += '<div class="note">Din ke upar number dabane se us din <b>sab</b> candidate hazir ho jate hain (dobara dabane par hat jate hain). Ek candidate ke box par dabayein: <b>P</b> = poora din, <b>½</b> = aadha din, <b>·</b> = gair-hazir. Candidate ka rate jo party ke rate card / candidate me tay hai, usi se din × rate = wage apne aap banta hai. Bhar kar <b>Save</b> dabayein.</div>';
    h += '<div class="grid">' + sel('hzp', 'Party', partyOpts(), pid) + '</div>';
    if (!cs.length) return h + '<p class="mu">Is party me abhi koi candidate nahi. "Candidates" tab me jodein.</p>';
    var head = '<th>Serial</th><th>Naam</th><th>Trade</th>', i, foot = '<td colspan="3"><b>Roz kitne hazir</b></td>', grand = 0;
    for (i = 1; i <= n; i++) head += '<th class="hzh' + (i === today ? ' td' : '') + '"><button class="hzd" data-act="hzday" data-d="' + i + '" title="Is din sab ko hazir/hatayein">' + i + '</button></th>';
    head += '<th class="n">Din</th><th class="n">Wage</th><th class="n">Company bill</th>';
    for (i = 0; i < n; i++) { var cnt = 0; cs.forEach(function (c) { var m = dr.marks[c.id][i]; cnt += m === '1' ? 1 : m === 'h' ? 0.5 : 0; }); grand += cnt; foot += '<td class="hzc' + (i + 1 === today ? ' td' : '') + '">' + (cnt ? nf(cnt) : '') + '</td>'; }
    var totWage = 0, totBill = 0;
    var body = cs.map(function (c) {
      var mk = dr.marks[c.id], l = byId[c.id] || {}, dd = hzDays(mk, n), cells = '';
      totWage += l.pay || 0; totBill += l.bill || 0;
      for (var k = 0; k < n; k++) { var v = mk[k]; cells += '<td class="hzt' + (k + 1 === today ? ' td' : '') + '"><button class="hz hz' + (v === '1' ? 'p' : v === 'h' ? 'h' : 'a') + '" data-act="hzcell" data-id="' + c.id + '" data-d="' + (k + 1) + '" aria-label="' + esc(c.name) + ' din ' + (k + 1) + '">' + (v === '1' ? 'P' : v === 'h' ? '½' : '·') + '</button></td>'; }
      return '<tr><td class="xs">' + esc(c.serial) + '</td><td class="hzn">' + esc(c.name) + (pendingKey[c.id] ? ' <span class="pill warn" title="Staff ne badlav bheja hai">staff ka badlav approval me</span>' : '') + (c.status === 'left' ? ' <span class="pill">chhoda</span>' : '') + '</td><td class="sm">' + esc(c.trade) + '</td>' + cells + '<td class="n"><b>' + nf(dd) + '</b></td><td class="n">' + inr(l.pay || 0) + '</td><td class="n">' + inr(l.bill || 0) + '</td></tr>';
    }).join('');
    h += '<div class="card"><div class="scroll" id="hzs"><table class="hzT"><thead><tr>' + head + '</tr></thead><tbody>' + body + '<tr class="tot">' + foot + '<td class="n">' + nf(grand) + '</td><td class="n">' + inr(totWage) + '</td><td class="n">' + inr(totBill) + '</td></tr></tbody></table></div></div>';
    h += '<h3>Hisaab ki poori kadi (abhi ki hazri se, live)</h3>' + payOrder(live) + (dirtyN ? '<div class="note">Ye andaza hai: save se pehle ke badlav bhi isme joda gaya hai.</div>' : '');
    h += '<div class="row">' + (dirtyN ? '<span class="pill warn">' + dirtyN + ' candidate ki hazri save nahi hui</span>' : '<span class="pill good">Sab save hai</span>') + '<button class="btn" data-act="hzsave"' + (dirtyN ? '' : ' disabled') + '>Hazri save karein</button></div>';
    h += '<p class="sm mu">Is mahine ki hazri yahin se bharein. Yahan bharne ke baad candidate ke din apne aap jud jate hain aur Payouts → Owners ka hissa tak sab hisaab badal jata hai.</p>';
    return h;
  };

  /* Payment ka kram: 1 candidates, 2 staff / supplier, 3 teeno owner */
  function payOrder(rep) {
    var r = rep || S.data.report, f = r.firm, st = r.byStaff;
    var net = st.reduce(function (a, x) { return a + x.net; }, 0), fixed = st.reduce(function (a, x) { return a + x.fixed; }, 0);
    var h = '<div class="cards">';
    h += '<div class="card"><span class="lbl">Pehle: Candidates ko wage</span><span class="kpi">' + inr(f.pay) + '</span><div class="sm mu">' + r.byParty.map(function (p) { return esc(p.name) + ' ' + inr(p.pay); }).join(' · ') + '</div></div>';
    h += '<div class="card"><span class="lbl">Phir: Staff / Supplier ko (GST ke baad)</span><span class="kpi">' + inr(net + fixed) + '</span><div class="sm mu">' + (st.map(function (x) { return esc(x.name) + ' ' + inr(x.net + x.fixed); }).join(' · ') || 'Koi nahi') + '</div></div>';
    h += '<div class="card"><span class="lbl">Aakhir: Teeno owners me barabar</span><span class="kpi">' + inr(f.distributable) + '</span><div class="sm mu">' + r.owners.map(function (o) { return esc(o.name) + ' ' + inr(o.amount); }).join(' · ') + '</div></div>';
    return h + '</div>';
  }

  V.pay = function () {
    var r = S.data.report, f = r.firm, st = r.byStaff, S0 = r.settings;
    var tot = function (k) { return inr(st.reduce(function (a, x) { return a + x[k]; }, 0)); };
    var h = '<div class="row between"><h2>Payouts (' + P.monthName(S.month) + ')</h2><div class="row"><button class="btn sec" data-act="xall">Sab kuch Excel me</button></div></div>';
    h += payOrder();
    h += '<div class="card"><h3>Staff / Manpower supplier / Supervisor</h3><div class="scroll"><table><thead><tr><th>Naam</th><th>Prakar</th><th>Commission ka tareeka</th><th class="n">Candidates</th><th class="n">Din</th><th class="n">Candidates ka wage</th><th class="n">Commission</th><th class="n">GST kata</th><th class="n">Net milega</th><th class="n">Fixed</th></tr></thead><tbody>' +
      st.map(function (x) { return '<tr><td>' + esc(x.name) + '</td><td>' + esc(TYPE[x.type] || x.type) + '</td><td>' + esc(cmLabel(x)) + '</td><td class="n">' + x.candidates + '</td><td class="n">' + nf(x.days) + '</td><td class="n">' + inr(x.pay) + '</td><td class="n">' + inr(x.commission) + '</td><td class="n">' + inr(x.gst) + '</td><td class="n b">' + inr(x.net) + '</td><td class="n">' + inr(x.fixed) + '</td></tr>'; }).join('') +
      '<tr class="tot"><td colspan="5">Kul</td><td class="n">' + tot('pay') + '</td><td class="n">' + tot('commission') + '</td><td class="n">' + tot('gst') + '</td><td class="n">' + tot('net') + '</td><td class="n">' + tot('fixed') + '</td></tr></tbody></table></div></div>';
    h += '<div class="card"><h3>Company-wise</h3><div class="scroll"><table><thead><tr><th>Party</th><th class="n">Candidates</th><th class="n">Din</th><th class="n">Bill</th><th class="n">Wage</th><th class="n">Margin</th><th class="n">Company ' + S0.billPct + '%</th><th class="n">Pool</th><th class="n">Milna chahiye</th><th class="n">Baaki</th></tr></thead><tbody>' +
      r.byParty.map(function (p) { return '<tr><td>' + esc(p.name) + '</td><td class="n">' + p.headcount + '</td><td class="n">' + nf(p.days) + '</td><td class="n">' + inr(p.bill) + '</td><td class="n">' + inr(p.pay) + '</td><td class="n">' + inr(p.margin) + '</td><td class="n">' + inr(p.bonus) + '</td><td class="n">' + inr(p.pool) + '</td><td class="n">' + inr(p.receivable) + '</td><td class="n">' + inr(p.due) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    h += '<div class="note">Hisaab: Pool = (company bill − candidate wage) + company ka commission. Staff ka commission teen tareeke se bante hain: (1) pool ka % , (2) trade-wise fixed rate × candidate × din, (3) koi hissa nahi (admin tay karta hai). Direct bheje candidates ka bhi koi hissa nahi banta. Usme se GST ' + S0.gstPct + '% kata jata hai, baaki "Net" staff ko milta hai. Poore hisaab ke liye "Owners ka hissa" dekhein.</div>';
    return h;
  };

  V.owners = function () {
    var d = S.data, r = d.report, f = r.firm;
    function row(l, v, cls) { return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + l + '</td><td class="n">' + v + '</td></tr>'; }
    var h = '<div class="row between"><h2>Owners ka hissa (' + P.monthName(S.month) + ')</h2><button class="btn sec" data-act="xowners">Excel</button></div><div class="cards">' +
      r.owners.map(function (o) { return '<div class="card"><span class="lbl">' + esc(o.role) + '</span><h3>' + esc(o.name) + '</h3><span class="kpi ' + (o.amount < 0 ? 'bad' : '') + '">' + inr(o.amount) + '</span><span class="sm mu">Hissa ' + nf(o.share) + ' · ' + esc(o.phone) + '</span></div>'; }).join('') + '</div>';
    h += '<div class="card"><h3>Hisaab, ek ek line</h3><div class="scroll"><table><tbody>' +
      row('Company ka kul bill', inr(f.bill)) + row('− Candidates ko wage', inr(f.pay)) + row('= Margin', inr(f.margin), 'tot') + row('+ Company ka commission (' + r.settings.billPct + '% of bill)', inr(f.bonus)) + row('= Pool', inr(f.pool), 'tot') +
      row('− Staff / supplier ka commission', inr(f.staffCommission)) + row('= Firm ka hissa', inr(f.firmShare), 'tot') + row('− GST firm ke hisse par (' + r.settings.gstFirmPct + '%)', inr(f.gstOnFirm)) +
      row('− Site supervisor ki fixed payment', inr(f.fixedPay)) + row('− Office staff ki salary', inr(f.officeSalaries)) + row('− Anya kharch', inr(f.otherExpenses)) +
      row('= Teeno me baantne ke liye bacha', inr(f.distributable), 'tot') + '</tbody></table></div>' +
      '<p class="sm mu">Staff ke commission par kata GST (' + inr(f.gstOnStaff) + ') + firm ke hisse par GST (' + inr(f.gstOnFirm) + ') = kul GST ' + inr(f.gstTotal) + ' (pool ka ' + r.settings.gstPct + '%). Sarkar ko jama karne se pehle CA se jaanch lein.</p></div>';
    h += '<div class="card"><h3>Hissa (barabar = sabke liye 1)</h3><form data-form="partners" class="grid">' + d.partners.map(function (p, i) { return '<input type="hidden" name="id' + i + '" value="' + esc(p.id) + '">' + fld('name' + i, 'Naam', p.name) + fld('role' + i, 'Pad', p.role) + fld('phone' + i, 'Mobile', p.phone, { type: 'tel' }) + fld('share' + i, 'Hissa', p.share, { type: 'number', step: 'any', min: 0 }); }).join('') + '<button class="btn" type="submit">Save</button></form></div>';
    h += '<div class="card"><div class="row between"><h3>Is mahine ke kharch</h3><button class="btn sm" data-act="panel" data-k="expense">+ Kharch</button></div><div class="scroll"><table><tbody>' +
      (d.expenses.map(function (e) { return '<tr><td>' + (e.category === 'office' ? 'Office salary' : 'Anya') + '</td><td>' + esc(e.label) + '</td><td class="n">' + inr(e.amount) + '</td><td><button class="link danger" data-act="del" data-col="expenses" data-id="' + e.id + '">Hatayein</button></td></tr>'; }).join('') || '<tr><td class="mu">Koi kharch nahi daala</td></tr>') + '</tbody></table></div></div>';
    return h;
  };

  function remindText(p, raw) {
    return 'Namaste ' + (raw.contact || p.name) + ' ji,\nA2Z Build Tech ki taraf se yaad dila rahe hain ki ' + P.monthName(S.month) + ' ke manpower bill ka ' + inr(p.due) + ' abhi baaki hai (due date: ' + P.dd(p.dueDate) + ').\nKripya jald bhugtan karein. Dhanyavad.\n- A2Z Build Tech, Maihar (M.P.)';
  }
  V.remind = function () {
    var d = S.data, list = d.report.byParty.filter(function (p) { return p.receivable > 0; });
    var h = '<h2>Company ko reminder (' + P.monthName(S.month) + ')</h2><div class="note">Reminder bhejne ka button WhatsApp kholta hai (message pehle se likha hua). SMS tab chalega jab server par SMS provider laga ho.</div>';
    h += '<div class="card scroll"><table><thead><tr><th>Party</th><th class="n">Milna chahiye</th><th class="n">Mil chuka</th><th class="n">Baaki</th><th>Due date</th><th>Halat</th><th>Aakhri reminder</th><th></th></tr></thead><tbody>' +
      (list.map(function (p) {
        var rem = d.reminders.filter(function (x) { return x.partyId === p.id; })[0];
        return '<tr><td>' + esc(p.name) + '</td><td class="n">' + inr(p.receivable) + '</td><td class="n">' + inr(p.received) + '</td><td class="n b">' + inr(p.due) + '</td><td>' + esc(P.dd(p.dueDate)) + '</td><td>' + (p.due <= 0 ? '<span class="pill good">Poora mila</span>' : p.overdueDays ? '<span class="pill red">' + p.overdueDays + ' din late</span>' : '<span class="pill warn">Abhi time hai</span>') + '</td><td class="sm">' + (rem ? esc(P.dt(rem.at)) + ' (' + esc(rem.channel) + ')' : '—') + '</td><td>' + (p.due > 0 ? '<button class="btn sm" data-act="panel" data-k="remind" data-id="' + p.id + '">Reminder</button>' : '') + '</td></tr>';
      }).join('') || '<tr><td colspan="8" class="mu">Is mahine ka koi bill nahi bana.</td></tr>') + '</tbody></table></div>';
    return h;
  };

  V.set = function () {
    var d = S.data, s = d.settings;
    return '<h2>Settings</h2><div class="card"><h3>Hisaab ke default (party ya staff ke andar alag bhi rakh sakte hain)</h3><form data-form="settings" class="grid">' +
      fld('commissionPct', 'Default commission % (sirf "Percent" option wale staff ke liye)', s.commissionPct, { type: 'number', step: 'any', min: 0, max: 100 }) + fld('gstPct', 'Staff ke commission par GST % (kata jata hai)', s.gstPct, { type: 'number', step: 'any', min: 0, max: 100 }) +
      fld('billPct', 'Company jo commission deti hai (% of bill)', s.billPct, { type: 'number', step: 'any', min: 0, max: 100 }) + sel('perDay', 'Rate kaise tay hote hain', [['1', 'Per-din rate (\u20b9/din) - mistri 1000/din jaise'], ['0', 'Mahine ka rate (\u00f7 mahine ke din)']], s.perDay ? '1' : '0') + fld('basisDays', 'Ek mahine ke din (rate ka hisaab)', s.basisDays, { type: 'number', min: 1, max: 31 }) +
      fld('gstFirmPct', 'Firm ke hisse par GST %', s.gstFirmPct, { type: 'number', step: 'any', min: 0, max: 100 }) + fld('payDays', 'Company ko payment ke din (mahine ke ant se)', s.payDays, { type: 'number', min: 0, max: 180 }) + '<button class="btn" type="submit">Save</button></form></div>' +
      '<div class="card"><h3>OTP ki email badlein</h3><form data-form="contact" class="grid">' + fld('email', 'Nayi email', '', { type: 'email', req: 1 }) + '<label>Abhi ka password<input name="pass" type="password" required autocomplete="current-password"></label><button class="btn" type="submit">Badlein</button></form></div>' +
      '<div class="card"><h3>Password badlein</h3><form data-form="password" class="grid"><label>Purana password<input name="old" type="password" required autocomplete="current-password"></label><label>Naya password (10+ akshar, akshar + ank)<input name="pass" type="password" required autocomplete="new-password"></label><button class="btn" type="submit">Badlein</button></form><div class="msg" id="msg" role="alert"></div></div>' +
      '<div class="card"><h3>Backup</h3><p class="sm mu">Poora data ek file me. Har hafte download karke surakshit rakhein.</p><div><button class="btn sec" data-act="backup">Backup download</button></div></div>' +
      '<div class="card"><h3>OTP kaise bheja ja raha hai</h3><p><span class="pill good">Email</span> OTP Gmail ke zariye aapki registered email par jata hai. Data aapki Google Sheet me hai.</p></div>' +
      '<div class="card"><h3>Poori gatividhi (aakhri 60)</h3><div class="scroll"><table><tbody>' + d.log.map(function (l) { return '<tr><td class="sm mu">' + esc(P.dt(l.at)) + '</td><td>' + esc(l.who) + '</td><td>' + esc(l.action) + '</td><td class="mu">' + esc(l.detail) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  };

  /* ---------- forms (panels) ---------- */
  function rateRow(r) {
    r = r || { trade: '', bill: '', pay: '' };
    return '<tr><td><input class="r-trade" value="' + esc(r.trade) + '" placeholder="Trade (jaise Fitter)" aria-label="Trade"></td><td><input class="r-bill" type="number" min="0" step="any" value="' + esc(r.bill) + '" aria-label="Company deti hai"></td><td><input class="r-pay" type="number" min="0" step="any" value="' + esc(r.pay) + '" aria-label="Candidate ko"></td><td><button type="button" class="link danger" data-act="delrate">Hatayein</button></td></tr>';
  }
  var PANELS = {
    party: function (id) {
      var p = id ? party(id) : { name: '', phone: '', contact: '', address: '', gstin: '', billPct: '', basisDays: '', payDays: '', rates: [], active: true };
      return '<h3>' + (id ? 'Party edit' : 'Nayi party') + '</h3><form data-form="party" class="grid"><input type="hidden" name="id" value="' + esc(id || '') + '">' + fld('name', 'Party / Company ka naam', p.name, { req: 1 }) + fld('contact', 'Contact person', p.contact) + fld('phone', 'Mobile', p.phone, { type: 'tel' }) + fld('email', 'Email (reminder ke liye)', p.email, { type: 'email' }) + fld('gstin', 'GSTIN', p.gstin) + fld('address', 'Pata', p.address) +
        fld('billPct', 'Is party ka commission % (khali = default)', p.billPct, { type: 'number', step: 'any', min: 0, max: 100 }) + fld('basisDays', 'Mahine ke din (sirf mahine-wale rate me)', p.basisDays, { type: 'number', min: 1, max: 31 }) + fld('payDays', 'Payment ke din (khali = default)', p.payDays, { type: 'number', min: 0 }) +
        sel('active', 'Halat', [['true', 'Chalu'], ['false', 'Band']], String(p.active !== false)) +
        '<div class="note">Rate card: har trade ka rate (' + unit() + '). "Company deti hai" = company se kitna milta hai. "Candidate ko" = candidate ko kitna dena hai.</div>' +
        '<div class="scroll"><table><thead><tr><th>Trade</th><th>Company deti hai (' + unit() + ')</th><th>Candidate ko (' + unit() + ')</th><th></th></tr></thead><tbody id="rateRows">' + (p.rates.length ? p.rates : [null]).map(rateRow).join('') + '</tbody></table></div>' +
        '<div class="row"><button type="button" class="btn sm sec" data-act="addrate">+ Trade</button></div><div class="msg" id="msg" role="alert"></div><div class="row"><button class="btn" type="submit">Save</button><button class="btn sec" type="button" data-act="closepanel">Band karein</button></div></form>';
    },
    staff: function (id) {
      var s = id ? staff(id) : { name: '', phone: '', type: 'agent', commMode: '', fixedRates: [], commissionPct: '', fixedPay: '', fixedFrom: '', active: true, email: '' };
      return '<h3>' + (id ? 'Staff edit' : 'Naya staff') + '</h3><form data-form="staff" class="grid"><input type="hidden" name="id" value="' + esc(id || '') + '">' + fld('name', 'Naam', s.name, { req: 1 }) + fld('phone', 'Mobile', s.phone, { type: 'tel' }) + fld('email', 'Email', s.email, { type: 'email' }) +
        sel('type', 'Prakar', [['agent', 'Staff (candidate laata hai)'], ['supplier', 'Manpower supplier (company me kaam nahi karta)'], ['supervisor', 'Site supervisor (fixed payment)']], s.type) +
        commBox(s, S.data.settings.commissionPct) + fld('fixedPay', 'Fixed payment / salary \u20b9 per mahina (company staff ke liye; commission iske saath alag se milega. Manpower supplier ke liye 0)', s.fixedPay, { type: 'number', min: 0, step: 'any' }) + fld('fixedFrom', 'Fixed payment kis mahine se', s.fixedFrom, { type: 'month' }) +
        sel('active', 'Halat', [['true', 'Chalu'], ['false', 'Band (login / link bhi band)']], String(s.active !== false)) + personFields(s) +
        '<div class="span-all">' + photoBox(S.pph, 'Photo (ID card ke liye)') + '</div>' + P.docSlots(id ? s.docKeys : [], S.pdocs, !!id) + '<div class="msg" id="msg" role="alert"></div><div class="row"><button class="btn" type="submit">Save</button><button class="btn sec" type="button" data-act="closepanel">Band karein</button></div></form>';
    },
    staffpw: function (id) {
      var s = staff(id);
      return '<h3>' + esc(s.name) + ': login password set karein</h3><div class="note">Staff ID: <b>' + esc(s.serial || '') + '</b> ya mobile ' + esc(s.phone) + '. Password staff ko alag se (phone par) bataiye aur kahiye ki login ke baad "Password badlein" kar le.</div><form data-form="staffpw" class="grid"><input type="hidden" name="id" value="' + esc(id) + '">' +
        fld('pass', 'Naya password (10+ akshar, akshar + ank)', '', { type: 'password', req: 1 }) + '<div class="msg" id="msg" role="alert"></div><div class="row"><button class="btn" type="submit">Password set karein</button><button class="btn sec" type="button" data-act="closepanel">Band karein</button></div></form>';
    },
    advance: function () {
      var who = [['', '— chuniye —']].concat(S.data.staff.map(function (x) { return ['s:' + x.id, 'Staff: ' + x.name]; }), S.data.candidates.filter(function (c) { return c.status !== 'left'; }).map(function (c) { return ['c:' + c.id, 'Candidate: ' + c.name + ' (' + c.serial + ')']; }));
      return '<h3>Advance diya (' + P.monthName(S.month) + ')</h3><div class="note">Jis mahine ke hisaab se kaatna hai wahi mahina upar chuna hai. Staff ke "Baaki milna" aur candidate ke "Dena baaki" me ye ghat jata hai.</div><form data-form="advance" class="grid">' + sel('who', 'Kisko', who, '') + fld('amount', 'Rakam', '', { type: 'number', min: 0, step: 'any', req: 1 }) + fld('date', 'Tarikh', S.data.today, { type: 'date' }) + fld('note', 'Note', '') +
        '<div class="msg" id="msg" role="alert"></div><div class="row"><button class="btn" type="submit">Save</button><button class="btn sec" type="button" data-act="closepanel">Band karein</button></div></form>';
    },
    pay: function (key) {
      var row = payRows().filter(function (x) { return x.key === key; })[0]; if (!row) return '<div class="note warn">Ye entry nahi mili.</div><button class="btn sec" data-act="closepanel">Band karein</button>';
      return '<h3>Payment chukaya: ' + esc(row.name) + '</h3><div class="note">' + esc(row.sub) + ' \u00b7 Dena tha ' + inr(row.due) + ' \u00b7 Chukaya ' + inr(row.paid) + ' \u00b7 <b>Baaki ' + inr(row.left) + '</b></div><form data-form="pay" class="grid"><input type="hidden" name="key" value="' + esc(key) + '">' +
        fld('amount', 'Kitna diya (\u20b9)', row.left > 0 ? row.left : '', { type: 'number', min: 0, step: 'any', req: 1 }) + fld('date', 'Tarikh', S.data.today, { type: 'date' }) + sel('mode', 'Kaise diya', [['cash', 'Cash'], ['upi', 'UPI'], ['bank', 'Bank transfer'], ['other', 'Anya']], 'cash') + fld('note', 'Note (jaise UPI ref no.)', '') +
        '<div class="msg" id="msg" role="alert"></div><div class="row"><button class="btn" type="submit">Payment save karein</button><button class="btn sec" type="button" data-act="closepanel">Band karein</button></div></form>';
    },
    cand: function (id) {
      var c = id ? S.data.candidates.filter(function (x) { return x.id === id; })[0] : { name: '', mobile: '', trade: '', partyId: '', staffId: '', joinDate: '', payRate: '', billRate: '', status: 'active' };
      var trades = {}; S.data.parties.forEach(function (p) { (p.rates || []).forEach(function (r) { trades[r.trade] = 1; }); });
      return '<h3>' + (id ? 'Candidate edit' : 'Naya candidate') + '</h3><form data-form="cand" class="grid"><input type="hidden" name="id" value="' + esc(id || '') + '">' + fld('name', 'Naam', c.name, { req: 1 }) + fld('mobile', 'Mobile', c.mobile, { type: 'tel' }) + fld('trade', 'Trade', c.trade, { req: 1, list: 'tradeList' }) +
        '<datalist id="tradeList">' + Object.keys(trades).map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist>' +
        sel('partyId', 'Party', partyOpts('— chuniye —'), c.partyId) + sel('staffId', 'Staff', staffOpts('Direct (koi staff nahi)'), c.staffId || '') + fld('joinDate', 'Joining date', c.joinDate, { type: 'date' }) +
        fld('payRate', 'Candidate rate ' + unit() + ' (khali = rate card)', c.payRate == null ? '' : c.payRate, { type: 'number', min: 0, step: 'any' }) + fld('billRate', 'Company rate ' + unit() + ' (khali = rate card)', c.billRate == null ? '' : c.billRate, { type: 'number', min: 0, step: 'any' }) +
        sel('status', 'Halat', [['active', 'Chal raha hai'], ['left', 'Kaam chhod diya']], c.status) + (id ? '' : fld('days', 'Is mahine ke din', '', { type: 'number', min: 0, max: 31, step: '0.5' })) +
        fld('mobile2', 'Dusra mobile', c.mobile2) + fld('emergency', 'Emergency contact', c.emergency) + fld('emergencyPhone', 'Emergency mobile', c.emergencyPhone) + fld('experience', 'Anubhav', c.experience) + personFields(c) +
        '<div class="span-all">' + photoBox(S.pph, 'Candidate ki photo') + '</div>' + P.docSlots(id ? c.docKeys : [], S.pdocs, !!id) + '<label class="consent span-all"><input type="checkbox" id="consentBox"' + (id && c.consentAt ? ' checked disabled' : '') + '> Candidate ki sahmati li gayi (<a href="terms.html" target="_blank" rel="noopener">Terms</a> + photo/document ke istemal ki). ' + (id && c.consentAt ? 'Darj: ' + esc(String(c.consentAt).slice(0, 10)) : '') + '</label>' +
        '<div class="msg" id="msg" role="alert"></div><div class="row"><button class="btn" type="submit">Save</button><button class="btn sec" type="button" data-act="closepanel">Band karein</button></div></form>';
    },
    receipt: function (id) {
      var p = party(id), rp = S.data.report.byParty.filter(function (x) { return x.id === id; })[0];
      return '<h3>' + esc(p.name) + ': payment mila (' + P.monthName(S.month) + ')</h3><p class="sm mu">Baaki abhi: ' + inr(rp.due) + '</p><form data-form="receipt" class="grid"><input type="hidden" name="partyId" value="' + esc(id) + '">' + fld('amount', 'Rakam ₹', rp.due > 0 ? rp.due : '', { type: 'number', step: 'any', min: 0, req: 1 }) + fld('date', 'Tarikh', new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10), { type: 'date' }) + fld('note', 'Note (UPI / cheque no.)', '') + '<div class="msg" id="msg" role="alert"></div><div class="row"><button class="btn" type="submit">Save</button><button class="btn sec" type="button" data-act="closepanel">Band karein</button></div></form>';
    },
    expense: function () {
      return '<h3>Kharch jodein (' + P.monthName(S.month) + ')</h3><form data-form="expense" class="grid">' + sel('category', 'Prakar', [['office', 'Office staff ki salary'], ['other', 'Anya kharch']], 'office') + fld('label', 'Vivaran', '', { ph: 'jaise: office staff, kiraya' }) + fld('amount', 'Rakam ₹', '', { type: 'number', step: 'any', min: 0, req: 1 }) + '<div class="msg" id="msg" role="alert"></div><div class="row"><button class="btn" type="submit">Save</button><button class="btn sec" type="button" data-act="closepanel">Band karein</button></div></form>';
    },
    remind: function (id) {
      var p = party(id), rp = S.data.report.byParty.filter(function (x) { return x.id === id; })[0], txt = remindText(rp, p);
      var real = !!p.email;
      return '<h3>' + esc(p.name) + ': reminder</h3><p class="sm mu">Baaki ' + inr(rp.due) + ' · Mobile: ' + (esc(p.phone) || '<span class="bad">daala nahi (Edit me daalein)</span>') + ' · Email: ' + (esc(p.email) || '<span class="mu">daali nahi</span>') + '</p><label>Sandesh (badal sakte hain)<textarea id="remText" name="message">' + esc(txt) + '</textarea></label><div class="row">' +
        '<a class="btn" id="waBtn" target="_blank" rel="noopener" data-act="logwa" data-id="' + id + '" href="' + esc(P.waLink(p.phone, txt)) + '">WhatsApp se bhejein</a>' +
        (real ? '<button class="btn sec" data-act="sendmail" data-id="' + id + '">Email bhejein</button>' : '') +
        '<button class="btn sec" data-act="copytext">Copy</button><button class="btn sec" data-act="logcall" data-id="' + id + '">Phone kiya (note karein)</button><button class="btn sec" data-act="closepanel">Band karein</button></div>';
    }
  };

  function collect(form) { var fd = new FormData(form), o = {}; fd.forEach(function (v, k) { o[k] = v; }); return o; }
  function setMsg(t) { var m = $('#msg'); if (m) m.textContent = t || ''; else if (t) P.toast(t); }

  var FORMS = {
    setup: async function (f) { var o = collect(f); await api('POST', '/api/setup', o); P.toast('Account ban gaya. Ab login karein.'); loginScreen(); },
    login: async function (f) { var o = collect(f), r = await api('POST', '/api/admin/login', o); S.challenge = r.challenge; S.sentTo = r.sentTo; otpScreen(); },
    otp: async function (f) { var o = collect(f); await api('POST', '/api/admin/verify', { challenge: S.challenge, otp: o.otp }); S.challenge = null; await load(); },
    secsite: async function (f) { var o = collect(f), r = await api('POST', '/api/admin/sec-action', { act: 'baseline', url: o.url }); P.toast(r.msg); await secLoad(); },
    party: async function (f) {
      var o = collect(f), rates = $$('#rateRows tr', f).map(function (tr) { return { trade: $('.r-trade', tr).value, bill: $('.r-bill', tr).value, pay: $('.r-pay', tr).value }; }).filter(function (r) { return r.trade.trim(); });
      var item = { name: o.name, contact: o.contact, phone: o.phone, email: o.email, gstin: o.gstin, address: o.address, billPct: o.billPct, basisDays: o.basisDays, payDays: o.payDays, active: o.active === 'true', rates: rates };
      if (o.id) item.id = o.id; await save('parties', item);
    },
    staff: async function (f) {
      var o = collect(f), item = { name: o.name, phone: o.phone, email: o.email, type: o.type, commissionPct: o.commissionPct, commMode: commRead(f).commMode, fixedRates: commRead(f).fixedRates, fixedPay: o.fixedPay, fixedFrom: o.fixedFrom, active: o.active === 'true', father: o.father, dob: o.dob, address: o.address, aadhaar: o.aadhaar, bank: o.bank, ifsc: o.ifsc, upi: o.upi };
      if (o.id) item.id = o.id; await save('staff', item, S.pph, S.pdocs);
    },
    cand: async function (f) {
      var o = collect(f), item = { name: o.name, mobile: o.mobile, trade: o.trade, partyId: o.partyId, staffId: o.staffId || null, joinDate: o.joinDate, payRate: o.payRate, billRate: o.billRate, status: o.status, mobile2: o.mobile2, emergency: o.emergency, emergencyPhone: o.emergencyPhone, experience: o.experience, father: o.father, dob: o.dob, address: o.address, aadhaar: o.aadhaar, bank: o.bank, ifsc: o.ifsc, upi: o.upi };
      if (o.id) item.id = o.id;
      var r = await api('POST', '/api/admin/save', { col: 'candidates', item: item, consent: (document.getElementById('consentBox') && document.getElementById('consentBox').checked) || undefined, photo: S.pph || undefined, docs: Object.keys(S.pdocs).length ? S.pdocs : undefined });
      if (!o.id && o.days !== '' && o.days != null) await api('POST', '/api/admin/attendance', { candId: r.id, month: S.month, days: o.days });
      S.panel = null; await load(); await doneSum('candidates', r.id || o.id, o.id ? 'Candidate ki jankari save ho gayi' : 'Naya candidate jud gaya');
    },
    staffpw: async function (f) { var o = collect(f); await api('POST', '/api/admin/staff-password', { id: o.id, pass: o.pass }); S.panel = null; await load(); P.toast('Password set ho gaya. Ab approve / login chalega.'); },
    advance: async function (f) {
      var o = collect(f), kind = o.who.slice(0, 2) === 's:' ? 'staff' : 'cand';
      if (!o.who) throw new Error('Kisko advance diya wo chuniye');
      await save('advances', { kind: kind, refId: o.who.slice(2), month: S.month, amount: o.amount, date: o.date, note: o.note });
    },
    pay: async function (f) {
      var o = collect(f), row = payRows().filter(function (x) { return x.key === o.key; })[0], i = o.key.indexOf(':');
      if (!row) throw new Error('Entry nahi mili');
      if (!(o.amount > 0)) throw new Error('Rakam 0 se zyada likhein');
      if (o.amount > row.left + 0.5) throw new Error('Baaki sirf ' + inr(row.left) + ' hai. Isse zyada nahi chukaya ja sakta.');
      await save('payments', { kind: o.key.slice(0, i), refId: o.key.slice(i + 1), month: S.month, amount: o.amount, date: o.date, mode: o.mode, note: o.note });
    },
    receipt: async function (f) { var o = collect(f); await save('receipts', { partyId: o.partyId, month: S.month, amount: o.amount, date: o.date, note: o.note }); },
    expense: async function (f) { var o = collect(f); await save('expenses', { month: S.month, category: o.category, label: o.label, amount: o.amount }); },
    settings: async function (f) { await api('POST', '/api/admin/settings', { settings: collect(f) }); await load(); P.toast('Settings save ho gayi'); },
    partners: async function (f) {
      var o = collect(f), list = S.data.partners.map(function (p, i) { return { id: o['id' + i], name: o['name' + i], role: o['role' + i], phone: o['phone' + i], share: o['share' + i] }; });
      await api('POST', '/api/admin/partners', { list: list }); await load(); P.toast('Hissa save ho gaya');
    },
    contact: async function (f) { await api('POST', '/api/admin/contact', collect(f)); f.reset(); P.toast('OTP ki email badal di'); },
    password: async function (f) { var o = collect(f); await api('POST', '/api/admin/password', o); P.toast('Password badla. Dobara login karein.'); loginScreen(); }
  };
  async function save(col, item, photo, docs) {
    var r = await api('POST', '/api/admin/save', { col: col, item: item, photo: photo || undefined, docs: docs && Object.keys(docs).length ? docs : undefined }); S.panel = null; S.pph = ''; S.pdocs = {}; S.sph = {}; await load();
    var nw = !item.id, T = { staff: nw ? 'Naya staff ban gaya' : 'Staff ki jankari save ho gayi', parties: nw ? 'Nayi party jud gayi' : 'Party ki jankari save ho gayi' };
    if (T[col]) await doneSum(col, r.id || item.id, T[col]); else P.toast('\u2713 Save ho gaya');
  }

  /* ---------- render ---------- */
  function keepScroll() { var e = $('#hzs'); S.hzKeep = e ? e.scrollLeft : null; }
  function render() {
    shell(true);
    $('#tabs').innerHTML = TABS.map(function (t) { return '<button data-act="tab" data-id="' + t[0] + '" aria-current="' + (t[0] === S.tab) + '">' + t[1] + (t[0] === 'sec' && S.data.sec && S.data.sec.n ? ' <span class="pill bad">' + S.data.sec.n + '</span>' : '') + (t[0] === 'appr' && S.data.pendingCount ? ' <span class="pill warn">' + S.data.pendingCount + '</span>' : '') + '</button>'; }).join('');
    $('#month').value = S.month;
    var pn = S.panel ? '<div class="panel" id="panel">' + PANELS[S.panel.k](S.panel.id) + '</div>' : '';
    var ae = document.activeElement, keep = ae && ae.id === 'fq' ? ae.selectionStart : null;
    $('#app').innerHTML = pn + secBanner() + V[S.tab]();
    if (S.tab === 'help' && window.A2ZHelp) window.A2ZHelp.mount($('#helpBox'), 'admin', { quick: ['a-setup', 'a-cand-admin', 'a-hazri', 'a-paid', 'a-money', 'a-staff-approve', 'a-excel'], hello: 'Admin ke saare kaam: staff / candidate approve karna, hazri, advance, kise kitna chukaya, owners ka hissa, Excel, backup. Apna sawal likhein ya chunein.' });
    if (S.panel) { var el = $('#panel'); if (el && S.panel.fresh) { el.scrollIntoView({ block: 'nearest' }); S.panel.fresh = false; } }
    if (S.hzKeep != null) { var hs = $('#hzs'); if (hs) hs.scrollLeft = S.hzKeep; S.hzKeep = null; }
    if (keep !== null) { var q = $('#fq'); if (q) { q.focus(); q.setSelectionRange(keep, keep); } }
  }

  /* ---------- exports ---------- */
  function exportRows(lines, withPool) {
    var head = ['Naam', 'Party', 'Trade', 'Staff', 'Din', 'Wage', 'Company bill'].concat(withPool ? ['Pool', 'Commission', 'GST', 'Net'] : []);
    return [head].concat(lines.map(function (l) { return [l.name, l.partyName, l.trade, whoS(l.staffId, l.staffName), l.days, l.pay, l.bill].concat(withPool ? [l.pool, l.commission, l.gst, l.net] : []); }));
  }
  var XW = [24, 18, 14, 16, 8, 12, 14, 12, 12, 10, 12];
  function dayHead(n) { var a = []; for (var i = 1; i <= n; i++) a.push(String(i)); return a; }
  function hzSheetRows(pids) {
    var n = dim(S.month), h = S.data.hazri || {}, rows = [['Party', 'Naam', 'Trade'].concat(dayHead(n), ['Kul din'])], cnt = [['Party'].concat(dayHead(n), ['Kul din (man-days)'])];
    pids.forEach(function (pid) {
      var p = party(pid), tot = [], sum = 0, i; for (i = 0; i < n; i++) tot.push(0);
      hzCands(pid).forEach(function (c) {
        var mk = (S.hz && S.hz.key === pid + '|' + S.month && S.hz.marks[c.id]) || pad31(h[c.id]), row = [p.name, c.name, c.trade], d = 0;
        for (i = 0; i < n; i++) { var v = mk[i] === '1' ? 1 : mk[i] === 'h' ? 0.5 : 0; row.push(v === 1 ? 'P' : v === 0.5 ? '½' : ''); tot[i] += v; d += v; }
        row.push(d); rows.push(row);
      });
      sum = tot.reduce(function (a, b) { return a + b; }, 0); cnt.push([p.name].concat(tot, [sum]));
    });
    return { rows: rows, cnt: cnt, w: [22, 22, 14].concat(dayHead(n).map(function () { return 4; }), [9]) };
  }
  function allSheets() {
    var d = S.data, r = d.report, f = r.firm, n = dim(S.month);
    var hz = hzSheetRows(d.parties.map(function (p) { return p.id; }));
    var st = [['Naam', 'Prakar', 'Commission ka tareeka', 'Candidates', 'Din', 'Candidates ka wage', 'Pool', 'Commission', 'GST kata', 'Net milega', 'Fixed payment']].concat(r.byStaff.map(function (x) { return [x.name, TYPE[x.type] || x.type, cmLabel(x), x.candidates, x.days, x.pay, x.pool, x.commission, x.gst, x.net, x.fixed]; }));
    var pt = [['Party', 'Candidates', 'Din', 'Bill', 'Wage', 'Margin', 'Company %', 'Pool', 'Milna chahiye', 'Mil chuka', 'Baaki']].concat(r.byParty.map(function (p) { return [p.name, p.headcount, p.days, p.bill, p.pay, p.margin, p.bonus, p.pool, p.receivable, p.received, p.due]; }));
    var ord = [['Kram', 'Kisko', 'Rakam']].concat([[1, 'Candidates ko wage (kul)', f.pay]], r.byParty.map(function (p) { return ['', '   ' + p.name, p.pay]; }),
      [[2, 'Staff / Supplier ko (GST ke baad + fixed)', r.byStaff.reduce(function (a, x) { return a + x.net + x.fixed; }, 0)]], r.byStaff.map(function (x) { return ['', '   ' + x.name, x.net + x.fixed]; }),
      [[3, 'Teeno owners me barabar', f.distributable]], r.owners.map(function (o) { return ['', '   ' + o.name, o.amount]; }));
    return [
      { name: 'Hazri (roz)', rows: hz.rows, widths: hz.w },
      { name: 'Party din-wise ginti', rows: hz.cnt, widths: [22].concat(dayHead(n).map(function () { return 4; }), [18]) },
      { name: 'Candidate hisaab', rows: exportRows(r.lines, true), widths: XW },
      { name: 'Staff payout', rows: st, widths: [22, 18, 6, 11, 8, 18, 12, 12, 10, 12, 14] },
      { name: 'Company-wise', rows: pt, widths: [22, 11, 8, 12, 12, 12, 12, 12, 14, 12, 12] },
      { name: 'Payment kram', rows: ord, widths: [8, 44, 14] },
      { name: 'Owners ka hissa', rows: ownersRows(), widths: [46, 16] },
      { name: 'Party-wise hisaab', rows: partyRows(), widths: [22, 11, 8, 12, 14, 14, 12, 12, 14, 12, 12, 12, 12] },
      { name: 'Staff-wise hisaab', rows: staffRows(), widths: [22, 22, 11, 8, 16, 12, 10, 12, 12, 12] },
      { name: 'Aaya-gaya', rows: flowRows(), widths: [46, 16] },
      { name: 'Chukaya (paid)', rows: [['Kisko', 'Prakar', 'Dena tha', 'Chukaya', 'Baaki']].concat(payRows().map(function (x) { return [x.name, x.kind === 'cand' ? 'Candidate' : x.kind === 'staff' ? 'Staff' : 'Owner', x.due, x.paid, x.left]; })), widths: [26, 12, 14, 14, 14] },
      { name: 'Payment record', rows: [['Tarikh', 'Kisko', 'Tareeka', 'Note', 'Rakam']].concat(S.data.payments.map(function (p) { return [P.dd(p.date), payName(p), MODE[p.mode] || p.mode, p.note, p.amount]; })), widths: [12, 28, 12, 26, 14] },
      { name: 'Advance', rows: [['Tarikh', 'Kisko', 'Naam', 'Note', 'Rakam']].concat(d.advances.map(function (a) { var w = a.kind === 'staff' ? staff(a.refId) : d.candidates.filter(function (c) { return c.id === a.refId; })[0]; return [P.dd(a.date), a.kind === 'staff' ? 'Staff' : 'Candidate', w ? w.name : '', a.note, a.amount]; })), widths: [12, 12, 24, 26, 12] },
      { name: 'Kharch', rows: [['Prakar', 'Vivaran', 'Rakam']].concat(d.expenses.map(function (e) { return [e.category === 'office' ? 'Office salary' : 'Anya', e.label, e.amount]; })), widths: [16, 36, 14] }
    ];
  }
  function partyRows() {
    var r = S.data.report, rows = [['Party', 'Candidates', 'Din', 'Company bill', 'Company commission', 'Candidates ka wage', 'Margin', 'Pool', 'Staff commission', 'Firm ka hissa', 'Aana', 'Aaya', 'Baaki']];
    r.byParty.forEach(function (p) { var sc = r.lines.filter(function (l) { return l.partyId === p.id; }).reduce(function (a, l) { return a + l.commission; }, 0); rows.push([p.name, p.headcount, p.days, p.bill, p.bonus, p.pay, p.margin, p.pool, sc, Math.round((p.pool - sc) * 100) / 100, p.receivable, p.received, p.due]); });
    return rows;
  }
  function staffRows() {
    var r = S.data.report, rows = [['Staff', 'Party', 'Candidates', 'Din', 'Candidates ka wage', 'Commission', 'GST', 'Net (fixed sahit)', 'Advance', 'Baaki dena']];
    r.byStaff.forEach(function (s) {
      var sa = S.data.advances.filter(function (a) { return a.kind === 'staff' && a.refId === s.id; }).reduce(function (a, x) { return a + x.amount; }, 0);
      rows.push([s.name, 'Kul', s.candidates, s.days, s.pay, s.commission, s.gst, s.net + s.fixed, sa, Math.round((s.net + s.fixed - sa) * 100) / 100]);
      var parts = {}; r.lines.filter(function (l) { return l.staffId === s.id; }).forEach(function (l) { var q = parts[l.partyId] || (parts[l.partyId] = [s.name, l.partyName, 0, 0, 0, 0, 0, 0, '', '']); q[2]++; q[3] += l.days; q[4] += l.pay; q[5] += l.commission; q[6] += l.gst; q[7] += l.net; });
      Object.keys(parts).forEach(function (k) { rows.push(parts[k]); });
    });
    return rows;
  }
  function flowRows() {
    var m = money(), rows = [['Hisaab', 'Rakam'], ['Companies se aana (kul)', m.recv], ['Aa chuka', m.got], ['Advance de chuke (staff)', m.advS], ['Advance de chuke (candidate)', m.advC], ['Kharch likha (office + anya)', m.kharch], ['Asli chukaya (cash / UPI / bank)', S.data.payments.reduce(function (a, p) { return a + p.amount; }, 0)], ['--- Jo paisa aayega wo kahan jayega ---', '']];
    m.out.forEach(function (x) { rows.push([x[0], x[1]]); }); rows.push(['Kul jana', m.total]); return rows;
  }
  function ownersRows() {
    var r = S.data.report, f = r.firm;
    return [['Hisaab', 'Rakam'], ['Company ka kul bill', f.bill], ['Candidates ko wage', f.pay], ['Margin', f.margin], ['Company ka commission', f.bonus], ['Pool', f.pool], ['Staff / supplier ka commission', f.staffCommission], ['Firm ka hissa', f.firmShare],
      ['GST firm ke hisse par', f.gstOnFirm], ['Site supervisor fixed', f.fixedPay], ['Office salary', f.officeSalaries], ['Anya kharch', f.otherExpenses], ['Teeno me baantne ke liye bacha', f.distributable]]
      .concat(r.owners.map(function (o) { return [o.name + ' (' + o.role + ')', o.amount]; }));
  }
  /* Standard company format: har sheet par company naam, heading, period, total aur signature */
  var XT = { 'Hazri (roz)': 'Daily Attendance Register', 'Party din-wise ginti': 'Party-wise Man-days Summary', 'Candidate hisaab': 'Candidate-wise Payment Statement', 'Staff payout': 'Staff / Supplier Commission Statement',
    'Company-wise': 'Party-wise Billing Summary', 'Payment kram': 'Payment Sequence Statement', 'Owners ka hissa': 'Owners Profit Share Statement', 'Party-wise hisaab': 'Party-wise Account Statement', 'Staff-wise hisaab': 'Staff-wise Account Statement',
    'Aaya-gaya': 'Cash Inflow & Outflow Statement', 'Chukaya (paid)': 'Payments Made Statement', 'Payment record': 'Payment Register', 'Advance': 'Advance Register', 'Kharch': 'Expense Register', 'Supplier': 'Manpower Supplier Statement',
    'Site-wise': 'Site-wise Deployment Report', 'Candidates': 'Candidates List', 'Party': 'Client Party List', 'Staff': 'Staff List', 'Suraksha alerts': 'Security Alert Report', 'Hazri': 'Daily Attendance Register', 'Din-wise ginti': 'Day-wise Man-days Summary' };
  var XNT = { 'Payment kram': 1, 'Staff-wise hisaab': 1, 'Owners ka hissa': 1, 'Aaya-gaya': 1, 'Suraksha alerts': 1, 'Party': 1, 'Candidates': 1, 'Staff': 1, 'Supplier': 1 };
  function xbook(sheets, name) {
    var meta = { period: P.monthName(S.month) };
    sheets = sheets.map(function (sh) { return { name: sh.name, rows: sh.rows, widths: sh.widths, title: sh.title || XT[sh.name] || sh.name, total: XNT[sh.name] ? false : sh.total }; });
    P.download(A2ZXlsx.writeBook(sheets, meta), name + '-' + S.month + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }

  /* ---------- events ---------- */
  function docRefresh() { var el = document.querySelector('.docslots'); if (el && S.panel) { var rec = S.panel.k === 'staff' ? staff(S.panel.id) : cand(S.panel.id); el.outerHTML = P.docSlots(S.panel.id && rec ? rec.docKeys : [], S.pdocs, !!S.panel.id); } }
  var A = {
    xsup: function () { var L = supData(); if (!L.length) { P.toast('Koi manpower supplier nahi hai'); return; } xbook(supSheets(L), 'A2Z-supplier-hisaab'); },
    xsup1: function (b) { var L = supData().filter(function (x) { return x.s.id === b.dataset.id; }); if (L.length) xbook(supSheets(L), 'A2Z-supplier-' + (L[0].s.serial || 'x')); },
    docpend: function (b) { P.viewImage(S.pdocs[b.dataset.doc], 'Document'); },
    docdrop: function (b) { delete S.pdocs[b.dataset.doc]; docRefresh(); },
    docview: async function (b) { var r = await api('POST', '/api/admin/photo', { kind: S.panel.k === 'staff' ? 'staff' : 'cand', id: S.panel.id, doc: b.dataset.doc }); if (r.photo) P.viewImage(r.photo, 'Document'); else P.toast('Document nahi mila'); },
    tab: async function (b) { S.tab = b.dataset.id; S.panel = null; render(); if (S.tab === 'sec') await secLoad(); },
    secgo: function (b) { S.tab = b.dataset.id; S.panel = null; render(); },
    secack: async function (b) { await api('POST', '/api/admin/sec-ack', { id: b.dataset.id }); await secLoad(); },
    secackall: async function () { await api('POST', '/api/admin/sec-ack', { all: true }); await secLoad(); },
    secact: async function (b) {
      var k = b.dataset.k, info = SACT[k], hard = { revokeAdmin: 1, revokeStaff: 1, lockStaff: 1 }[k];
      if (hard && S.armed !== b) { arm(b, 'Pakka? Dobara dabayein'); return; }
      S.armed = null; var act = k === 'siteCheck' ? 'watch' : k, r = await api('POST', '/api/admin/sec-action', { act: act });
      if (r.relogin) { S.data = null; S.sec = null; loginScreen(); P.toast(r.msg); return; }
      P.toast(r.msg || 'Ho gaya'); await secLoad();
    },
    xsec: function () {
      var rows = [['Samay (IST)', 'Gambhirta', 'Kya hua', 'Vivaran', 'Kitni baar', 'Halat']].concat(S.sec.alerts.map(function (a) { return [secWhen(a.at), SEVL[a.sev] || a.sev, a.title, a.detail, a.count, a.status === 'new' ? 'dekhna baaki' : 'dekh liya']; }));
      xbook([{ name: 'Suraksha alerts', rows: rows, widths: [20, 14, 46, 60, 10, 14] }], 'A2Z-suraksha');
    },
    panel: function (b) { S.pph = ''; S.pdocs = {}; S.panel = { k: b.dataset.k, id: b.dataset.id || '', fresh: true }; render(); },
    staffid: async function (b) {
      var st = staff(b.dataset.id), ph = st.hasPhoto ? await adminPhoto('staff', st.id) : '';
      P.idCardShow({ kind: 'staff', serial: st.serial || 'ID baaki', name: st.name, role: TYPE[st.type] || 'Staff', mobile: st.phone, joined: P.dd((st.approvedAt || st.createdAt || '').slice(0, 10)), photo: ph });
    },
    candid: async function (b) {
      var c = S.data.candidates.filter(function (x) { return x.id === b.dataset.id; })[0], p = party(c.partyId), ph = c.hasPhoto ? await adminPhoto('cand', c.id) : '';
      P.idCardShow({ kind: 'cand', serial: c.serial, name: c.name, role: c.trade + (p ? ' · ' + p.name : ''), mobile: c.mobile, joined: P.dd(c.joinDate), photo: ph, lines: c.emergency ? ['Emergency: ' + c.emergency + ' ' + (c.emergencyPhone || '')] : [] });
    },
    showphoto: async function (b) { var ph = await adminPhoto(b.dataset.kind, b.dataset.id); var el = $('#ph-' + (b.dataset.kind === 'staff' ? 's' : 'c') + b.dataset.id); if (el) el.innerHTML = ph ? '<img alt="photo" src="' + esc(ph) + '">' : 'Photo nahi'; },
    copyreg: function () { P.copy(location.origin + location.pathname.replace(/[^\/]*$/, '') + 'staff.html'); },
    apstaff: async function (b) {
      var id = b.dataset.id, box = $('#apb-' + id), cr = commRead(box);
      if (!cr.commMode) throw new Error('Pehle commission ka tareeka chuniye (percent / fixed rate / koi hissa nahi)');
      if (cr.commMode === 'fixed' && !cr.fixedRates.length) throw new Error('Fixed rate chuna hai to kam se kam ek trade ka rate likhiye');
      await api('POST', '/api/admin/staff-approve', { id: id, type: $('#aty-' + id).value, commMode: cr.commMode, fixedRates: cr.fixedRates, commissionPct: $('[name=commissionPct]', box).value });
      await load(); await doneSum('staff', id, 'Staff approve ho gaya. Ab wo login kar sakta hai');
    },
    rjstaff: async function (b) { await api('POST', '/api/admin/staff-approve', { id: b.dataset.id, ok: false }); await load(); P.toast('Registration reject ho gaya'); },
    apcand: async function (b) { await api('POST', '/api/admin/cand-approve', { id: b.dataset.id }); await load(); await doneSum('candidates', b.dataset.id, 'Candidate approve ho gaya'); },
    rjcand: async function (b) { await api('POST', '/api/admin/cand-approve', { id: b.dataset.id, ok: false }); await load(); P.toast('Candidate reject ho gaya'); },
    apatt: async function (b) { await api('POST', '/api/admin/att-approve', { items: [{ candId: b.dataset.id, month: b.dataset.m }] }); await load(); P.toast('Hazri approve ho gayi'); },
    rjatt: async function (b) { await api('POST', '/api/admin/att-approve', { items: [{ candId: b.dataset.id, month: b.dataset.m }], ok: false }); await load(); P.toast('Hazri wapas kar di'); },
    apattall: async function () { var items = S.data.approvals.att.map(function (x) { return { candId: x.candId, month: x.month }; }); await api('POST', '/api/admin/att-approve', { items: items }); await load(); P.toast(items.length + ' hazri approve ho gayi'); },
    aprq: async function (b) { await api('POST', '/api/admin/request-decide', { id: b.dataset.id }); await load(); P.toast('Naya rate lag gaya'); },
    rjrq: async function (b) { await api('POST', '/api/admin/request-decide', { id: b.dataset.id, ok: false }); await load(); P.toast('Request mana kar di'); },
    closepanel: function () { S.panel = null; S.pph = ''; S.pdocs = {}; render(); },
    open: function (b) { S.open[b.dataset.id] = !S.open[b.dataset.id]; render(); },
    logout: async function () { try { await api('POST', '/api/admin/logout', {}); } catch (e) { /* ignore */ } S.data = null; loginScreen(); },
    relogin: function () { loginScreen(); },
    resend: async function () { await api('POST', '/api/admin/resend', { challenge: S.challenge }); P.toast('OTP dobara bheja'); },
    copylink: function (b) { P.copy(link(staff(b.dataset.id))); },
    newtoken: async function (b) {
      if (S.armed !== b) { arm(b, 'Pakka? purana link band ho jayega'); return; }
      await api('POST', '/api/admin/staff-token', { id: b.dataset.id }); await load(); P.toast('Naya link ban gaya. Staff ko bhejein.');
    },
    del: async function (b) {
      if (S.armed !== b) { arm(b, 'Pakka?'); return; }
      await api('POST', '/api/admin/delete', { col: b.dataset.col, id: b.dataset.id }); S.armed = null; await load(); P.toast('Hata diya');
    },
    verify: async function (b) { await api('POST', '/api/admin/save', { col: 'candidates', item: { id: b.dataset.id, verified: true } }); await load(); },
    verifyAll: async function () {
      var list = S.data.candidates.filter(function (c) { return !c.verified && c.status !== 'left'; });
      for (var i = 0; i < list.length; i++) await api('POST', '/api/admin/save', { col: 'candidates', item: { id: list[i].id, verified: true } });
      await load(); P.toast(list.length + ' candidate verify ho gaye');
    },
    addfix: function (b) { $('.fixRows', b.closest('.commbox')).insertAdjacentHTML('beforeend', fixRow()); },
    delfix: function (b) { var tb = b.closest('tbody'), tr = b.closest('tr'); if ($$('tr', tb).length > 1) tr.remove(); else $$('input', tr).forEach(function (i) { i.value = ''; }); },
    addrate: function () { $('#rateRows').insertAdjacentHTML('beforeend', rateRow()); },
    delrate: function (b) { var tr = b.closest('tr'); if ($$('#rateRows tr').length > 1) tr.remove(); else $$('input', tr).forEach(function (i) { i.value = ''; }); },
    copytext: function () { P.copy($('#remText').value); },
    logwa: function (b) { api('POST', '/api/admin/reminder', { partyId: b.dataset.id, month: S.month, channel: 'whatsapp' }).then(load).catch(function () { /* the link still opens */ }); },
    logcall: async function (b) { await api('POST', '/api/admin/reminder', { partyId: b.dataset.id, month: S.month, channel: 'call' }); S.panel = null; await load(); P.toast('Note kar liya'); },
    sendmail: async function (b) { await api('POST', '/api/admin/reminder', { partyId: b.dataset.id, month: S.month, channel: 'email', message: $('#remText').value }); S.panel = null; await load(); P.toast('Email bhej diya'); },
    backup: async function () { var r = await api('POST', '/api/admin/backup', {}); P.download(JSON.stringify(r.data, null, 1), r.name, 'application/json'); P.toast('Backup download ho gaya'); },
    xparty: function (b) { var ls = S.data.report.lines.filter(function (l) { return l.partyId === b.dataset.id; }); P.xlsxDownload(exportRows(ls, false), 'party-' + S.month + '.xlsx', 'Party', XW, 'Party-wise Candidate Statement', P.monthName(S.month)); },
    xstaff: function (b) { var ls = S.data.report.lines.filter(function (l) { return l.staffId === b.dataset.id; }); P.xlsxDownload(exportRows(ls, true), 'staff-' + S.month + '.xlsx', 'Staff', XW, 'Staff-wise Candidate Statement', P.monthName(S.month)); },
    xall: function () { xbook(allSheets(), 'A2Z-sab-hisaab'); },
    xowners: function () { xbook([{ name: 'Owners ka hissa', rows: ownersRows(), widths: [46, 16] }], 'A2Z-owners'); },
    xparties: function () {
      var rows = [['Party', 'Mobile', 'Email', 'Contact', 'Pata', 'GSTIN', 'Company %', 'Mahine ke din', 'Payment ke din', 'Halat', 'Rate card']].concat(S.data.parties.map(function (p) { return [p.name, p.phone, p.email || '', p.contact, p.address, p.gstin, p.billPct == null ? '' : p.billPct, p.basisDays == null ? '' : p.basisDays, p.payDays == null ? '' : p.payDays, p.active === false ? 'Band' : 'Chalu', (p.rates || []).map(function (r) { return r.trade + ': company ' + r.bill + ' / candidate ' + r.pay; }).join(' | ')]; }));
      xbook([{ name: 'Party', rows: rows, widths: [24, 14, 24, 18, 30, 18, 10, 10, 10, 8, 60] }], 'A2Z-parties');
    },
    xcands: function () {
      var rows = [['Serial', 'Naam', 'Pita/pati', 'Mobile', 'Dusra mobile', 'Trade', 'Party', 'Staff', 'Joining', 'Janm tithi', 'Pata', 'Aadhaar', 'Bank', 'IFSC', 'UPI', 'Emergency', 'Emergency mobile', 'Anubhav', 'Candidate rate', 'Company rate', 'Halat', 'Approval', 'Entry date']].concat(S.data.candidates.map(function (c) { var p = party(c.partyId), t = c.staffId ? staff(c.staffId) : null; return [c.serial, c.name, c.father, c.mobile, c.mobile2, c.trade, p ? p.name : '', t ? t.name : 'Direct', c.joinDate, c.dob, c.address, c.aadhaar, c.bank, c.ifsc, c.upi, c.emergency, c.emergencyPhone, c.experience, c.payRate == null ? '' : c.payRate, c.billRate == null ? '' : c.billRate, c.status === 'left' ? 'Chhoda' : 'Chalu', c.approval, P.dt(c.createdAt)]; }));
      xbook([{ name: 'Candidates', rows: rows, widths: [14, 22, 20, 14, 14, 14, 22, 16, 12, 12, 30, 16, 18, 13, 18, 18, 14, 18, 12, 12, 9, 10, 22] }], 'A2Z-candidates');
    },
    xstafflist: function () {
      var rows = [['Staff ID', 'Naam', 'Pita/pati', 'Mobile', 'Email', 'Prakar', 'Commission ka tareeka', 'Commission %', 'Fixed rates (trade: \u20b9/din)', 'Fixed payment', 'Janm tithi', 'Pata', 'Aadhaar', 'Bank', 'IFSC', 'UPI', 'Registration', 'Halat']].concat(S.data.staff.map(function (x) { return [x.serial, x.name, x.father, x.phone, x.email, TYPE[x.type] || x.type, CMODE[x.commMode] || 'Tay nahi', x.commMode === 'percent' && x.commissionPct != null ? x.commissionPct : '', (x.fixedRates || []).map(function (r) { return r.trade + ': ' + r.rate; }).join(', '), x.fixedPay, x.dob, x.address, x.aadhaar, x.bank, x.ifsc, x.upi, x.regStatus, x.active === false ? 'Band' : 'Chalu']; }));
      xbook([{ name: 'Staff', rows: rows, widths: [14, 22, 20, 14, 24, 20, 24, 12, 24, 14, 12, 30, 16, 18, 13, 18, 12, 8] }], 'A2Z-staff');
    },
    xhazri: function () { var pid = hzActiveParty(), x = hzSheetRows([pid]); xbook([{ name: 'Hazri', rows: x.rows, widths: x.w }, { name: 'Din-wise ginti', rows: x.cnt, widths: [22].concat(x.w.slice(3, -1), [18]) }], 'A2Z-hazri'); },
    xhazriall: function () { var x = hzSheetRows(S.data.parties.map(function (p) { return p.id; })); xbook([{ name: 'Hazri', rows: x.rows, widths: x.w }, { name: 'Party din-wise ginti', rows: x.cnt, widths: [22].concat(x.w.slice(3, -1), [18]) }], 'A2Z-hazri-sab'); },
    hzcell: function (b) {
      var dr = S.hz, id = b.dataset.id, i = +b.dataset.d - 1, mk = dr.marks[id], v = mk[i], nx = v === '-' ? '1' : v === '1' ? 'h' : '-';
      dr.marks[id] = mk.slice(0, i) + nx + mk.slice(i + 1); dr.dirty[id] = true; keepScroll(); render();
    },
    hzday: function (b) {
      var dr = S.hz, i = +b.dataset.d - 1, cs = hzCands(dr.pid).filter(function (c) { return c.status !== 'left'; });
      var all = cs.length && cs.every(function (c) { return dr.marks[c.id][i] === '1'; }), nx = all ? '-' : '1';
      cs.forEach(function (c) { var mk = dr.marks[c.id]; if (mk[i] !== nx) { dr.marks[c.id] = mk.slice(0, i) + nx + mk.slice(i + 1); dr.dirty[c.id] = true; } });
      keepScroll(); render();
    },
    hzsave: async function () {
      var dr = S.hz, ids = Object.keys(dr.dirty); if (!ids.length) return;
      await api('POST', '/api/admin/hazri-save', { month: S.month, items: ids.map(function (id) { return { candId: id, marks: dr.marks[id] }; }) });
      var keep = S.hzParty; await load(); S.hzParty = keep; P.toast('Hazri save ho gayi. Hisaab badal gaya.');
    }
  };
  function arm(b, text) {
    if (S.armed) S.armed.textContent = S.armed.dataset.label || S.armed.textContent;
    b.dataset.label = b.textContent; b.textContent = text; S.armed = b; clearTimeout(armT);
    armT = setTimeout(function () { if (S.armed === b) { b.textContent = b.dataset.label; S.armed = null; } }, 3500);
  }
  function guard(fn) { return function (a, b) { return Promise.resolve().then(function () { return fn(a, b); }).catch(function (e) { if (e && e.status === 401 && S.data) { S.data = null; loginScreen(); P.toast('Login dobara karein'); } else setMsg(e.message || String(e)); }); }; }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var fn = A[b.dataset.act]; if (!fn) return;
    if (b.tagName === 'A' && b.dataset.act !== 'logwa') e.preventDefault();
    guard(fn)(b, e);
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('form[data-form]'); if (!f) return;
    e.preventDefault(); setMsg('');
    var fn = FORMS[f.dataset.form]; if (fn) guard(fn)(f);
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.classList.contains('doc-file') && t.files && t.files[0]) { var dk = t.dataset.doc, df = t.files[0]; t.value = ''; P.photoFromFile(df, { kind: 'doc' }).then(function (u) { S.pdocs[dk] = u; docRefresh(); }, function (x) { if (x.message !== 'cancel') P.toast(x.message); }); return; }
    if (t.id === 'pfile' && t.files && t.files[0]) { P.photoFromFile(t.files[0], { kind: 'photo' }).then(function (u) { S.pph = u; var pb = $('#pbox'); if (pb) pb.innerHTML = '<img alt="photo" src="' + esc(u) + '">'; }, function (x) { P.toast(x.message); }); t.value = ''; return; }
    if (t.classList.contains('cm-sel')) { commShow(t.closest('.commbox')); return; }
    if (t.classList.contains('js-days')) {
      guard(async function () { await api('POST', '/api/admin/attendance', { candId: t.dataset.id, month: S.month, days: t.value || 0 }); await load(); P.toast('Din save ho gaye'); })();
    } else if (t.name === 'fparty') { S.f.party = t.value; render(); } else if (t.name === 'fstaff') { S.f.staff = t.value; render(); } else if (t.name === 'hzp') { S.hzParty = t.value; S.hz = null; render(); }
  });
  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'idq') { S.idq = e.target.value; clearTimeout(S.idT); S.idT = setTimeout(function () { var rs = $('#idres'); if (rs) rs.innerHTML = idRows(S.idq); }, 100); return; }
    var t = e.target;
    if (t.id === 'fq') {
      S.f.q = t.value; clearTimeout(S.fqT);
      S.fqT = setTimeout(function () { var rs = $('#candRes'); if (!rs || S.tab !== 'cands') { render(); return; } var l = candList(); rs.innerHTML = candTable(l); var n = $('#candN'); if (n) n.textContent = l.length; }, 120);
    }
    if (t.id === 'remText') { var a = $('#waBtn'); if (a && S.panel) { var p = party(S.panel.id); a.href = P.waLink(p.phone, t.value); } }
  });
  $('#month').addEventListener('change', function (e) { if (/^\d{4}-\d{2}$/.test(e.target.value)) { S.month = e.target.value; guard(load)(); } });

  boot();
})();
