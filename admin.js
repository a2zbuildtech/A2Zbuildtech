/* FILE: admin.js  (GitHub par isi naam se upload karein) */
/* A2Z Build Tech - admin console */
(function () {
  'use strict';
  var $ = P.$, $$ = P.$$, esc = P.esc, inr = P.inr, nf = P.nf, api = P.api;
  var S = { data: null, month: P.thisMonth(), tab: 'dash', panel: null, open: {}, f: { party: '', staff: '', q: '' }, challenge: null, sentTo: '', armed: null, hzParty: '', hz: null };
  var TABS = [['dash', 'Overview'], ['parties', 'Party / Company'], ['staff', 'Staff aur links'], ['cands', 'Candidates'], ['hazri', 'Hazri (Daily)'], ['pay', 'Payouts'], ['owners', 'Owners ka hissa'], ['remind', 'Reminder'], ['set', 'Settings']];
  var TYPE = { agent: 'Staff (agent)', supplier: 'Manpower supplier', supervisor: 'Site supervisor' };
  var armT;

  /* ---------- small helpers ---------- */
  function party(id) { return S.data.parties.filter(function (p) { return p.id === id; })[0]; }
  function staff(id) { return S.data.staff.filter(function (p) { return p.id === id; })[0]; }
  function fld(name, label, val, o) {
    o = o || {};
    return '<label>' + esc(label) + '<input name="' + name + '" type="' + (o.type || 'text') + '" value="' + esc(val == null ? '' : val) + '"' + (o.step ? ' step="' + o.step + '"' : '') + (o.min != null ? ' min="' + o.min + '"' : '') + (o.max != null ? ' max="' + o.max + '"' : '') + (o.req ? ' required' : '') + (o.list ? ' list="' + o.list + '"' : '') + (o.auto ? ' autocomplete="' + o.auto + '"' : ' autocomplete="off"') + (o.inputmode ? ' inputmode="' + o.inputmode + '"' : '') + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + '></label>';
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
      ls.map(function (l) { var c = byId[l.id]; return '<tr><td>' + esc(l.name) + (c.status === 'left' ? ' <span class="pill">chhod diya</span>' : '') + (c.verified ? '' : ' <span class="pill warn">verify baaki</span>') + '</td><td>' + esc(c.mobile) + '</td><td>' + esc(l.trade) + '</td><td>' + esc(l.staffName || 'Direct') + '</td><td>' + esc(P.dd(c.joinDate)) + '</td><td class="sm">' + esc(P.dt(c.createdAt)) + '</td><td><input class="w-days js-days" data-id="' + l.id + '" type="number" min="0" max="31" step="0.5" value="' + l.days + '" aria-label="Din"></td><td class="n">' + inr(l.pay) + '</td><td class="n">' + inr(l.bill) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  V.staff = function () {
    var d = S.data, r = d.report, h = '<div class="row between"><h2>Staff aur unke links</h2><div class="row"><button class="btn sec" data-act="xstafflist">Excel</button><button class="btn" data-act="panel" data-k="staff">+ Naya staff</button></div></div>' +
      '<div class="note">Har staff ka alag link hai. Link kholkar wo apne candidates ki entry karta hai aur apna hisaab dekhta hai. Link sirf us staff ko bhejein.</div>';
    d.staff.forEach(function (s) {
      var m = r.byStaff.filter(function (x) { return x.id === s.id; })[0], url = link(s);
      h += '<div class="card"><div class="row between"><div><h3>' + esc(s.name) + ' ' + (s.active === false ? '<span class="pill">band</span>' : '') + '</h3><div class="sm mu">' + esc(TYPE[s.type] || s.type) + ' · Commission <b>' + m.pct + '%</b> · ' + esc(s.phone) + (m.fixed ? ' · Fixed ' + inr(m.fixed) + '/mahina' : '') + '</div></div></div>' +
        '<div class="link-box" data-link="' + s.id + '">' + esc(url) + '</div>' +
        '<div class="row"><button class="btn sm" data-act="copylink" data-id="' + s.id + '">Link copy</button><a class="btn sm sec" target="_blank" rel="noopener" href="' + esc(P.waLink(s.phone, 'A2Z Build Tech: aapka entry aur hisaab ka link: ' + url)) + '">WhatsApp par bhejein</a><button class="btn sm sec" data-act="newtoken" data-id="' + s.id + '">Naya link (purana band)</button><button class="btn sm sec" data-act="panel" data-k="staff" data-id="' + s.id + '">Edit</button><button class="btn sm sec" data-act="open" data-id="' + s.id + '">Hisaab ' + (S.open[s.id] ? 'chhupayein' : 'dekhein') + '</button></div>' +
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

  V.cands = function () {
    var d = S.data, f = S.f, byId = {}; d.report.lines.forEach(function (l) { byId[l.id] = l; });
    var q = f.q.toLowerCase();
    var list = d.candidates.filter(function (c) { return (!f.party || c.partyId === f.party) && (!f.staff || (f.staff === '_direct' ? !c.staffId : c.staffId === f.staff)) && (!q || (c.name + ' ' + c.mobile + ' ' + c.trade).toLowerCase().indexOf(q) >= 0); });
    var h = '<div class="row between"><h2>Candidates (' + list.length + ')</h2><div class="row"><button class="btn sec" data-act="xcands">Excel</button><button class="btn" data-act="panel" data-k="cand">+ Naya candidate</button></div></div>' +
      '<div class="grid">' + sel('fparty', 'Party', partyOpts('Sab party'), f.party) + sel('fstaff', 'Staff', [['', 'Sab staff'], ['_direct', 'Direct (koi staff nahi)']].concat(S.data.staff.map(function (s) { return [s.id, s.name]; })), f.staff) + fld('fq', 'Khojein (naam, mobile, trade)', f.q) + '</div>';
    h += '<div class="card scroll"><table><thead><tr><th>Naam</th><th>Mobile</th><th>Trade</th><th>Party</th><th>Staff</th><th>Joining</th><th>Entry (date, time)</th><th>Din</th><th>Status</th><th></th></tr></thead><tbody>' +
      (list.slice(0, 400).map(function (c) {
        var l = byId[c.id] || {}; return '<tr><td>' + esc(c.name) + '</td><td>' + esc(c.mobile) + '</td><td>' + esc(c.trade) + '</td><td>' + esc(l.partyName || '') + '</td><td>' + esc(l.staffName || 'Direct') + '</td><td>' + esc(P.dd(c.joinDate)) + '</td><td class="sm">' + esc(P.dt(c.createdAt)) + '<div class="xs mu">' + (c.source === 'staff' ? 'Staff link se' : 'Admin') + '</div></td><td><input class="w-days js-days" data-id="' + c.id + '" type="number" min="0" max="31" step="0.5" value="' + dayOf(c.id) + '" aria-label="Din"></td><td>' + (c.status === 'left' ? '<span class="pill">chhod diya</span>' : '<span class="pill good">chal raha</span>') + ' ' + (c.verified ? '' : '<button class="link js-verify" data-act="verify" data-id="' + c.id + '">Verify</button>') + '</td><td class="row"><button class="link" data-act="panel" data-k="cand" data-id="' + c.id + '">Edit</button><button class="link danger" data-act="del" data-col="candidates" data-id="' + c.id + '">Hatayein</button></td></tr>';
      }).join('') || '<tr><td colspan="10" class="mu">Koi candidate nahi mila.</td></tr>') + '</tbody></table></div>';
    return h;
  };


  /* ---------- Hazri (Daily) ---------- */
  function dim(m) { return new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate(); }
  function hzCands(pid) { var h = S.data.hazri || {}; return S.data.candidates.filter(function (c) { return c.partyId === pid && (c.status !== 'left' || h[c.id]); }); }
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
  V.hazri = function () {
    var d = S.data, pid = hzActiveParty(), n = dim(S.month);
    var h = '<div class="row between"><h2>Hazri (Daily) – ' + P.monthName(S.month) + '</h2><div class="row"><button class="btn sec" data-act="xhazri">Excel (is party ki)</button><button class="btn sec" data-act="xhazriall">Excel (sab party)</button></div></div>';
    if (!pid) return h + '<p class="mu">Pehle "Party / Company" me party jodein, phir candidates.</p>';
    var dr = hzDraft(pid), cs = hzCands(pid), byId = {}; d.report.lines.forEach(function (l) { byId[l.id] = l; });
    var dirtyN = Object.keys(dr.dirty).length, today = S.month === d.today.slice(0, 7) ? +d.today.slice(8) : 0;
    h += '<div class="note">Din ke upar number dabane se us din <b>sab</b> candidate hazir ho jate hain (dobara dabane par hat jate hain). Ek candidate ke box par dabayein: <b>P</b> = poora din, <b>½</b> = aadha din, <b>·</b> = gair-hazir. Candidate ka rate jo party ke rate card / candidate me tay hai, usi se din × rate = wage apne aap banta hai. Bhar kar <b>Save</b> dabayein.</div>';
    h += '<div class="grid">' + sel('hzp', 'Party', partyOpts(), pid) + '</div>';
    if (!cs.length) return h + '<p class="mu">Is party me abhi koi candidate nahi. "Candidates" tab me jodein.</p>';
    var head = '<th>Naam</th><th>Trade</th>', i, foot = '<td colspan="2"><b>Roz kitne hazir</b></td>', grand = 0;
    for (i = 1; i <= n; i++) head += '<th class="hzh' + (i === today ? ' td' : '') + '"><button class="hzd" data-act="hzday" data-d="' + i + '" title="Is din sab ko hazir/hatayein">' + i + '</button></th>';
    head += '<th class="n">Din</th><th class="n">Wage</th><th class="n">Company bill</th>';
    for (i = 0; i < n; i++) { var cnt = 0; cs.forEach(function (c) { var m = dr.marks[c.id][i]; cnt += m === '1' ? 1 : m === 'h' ? 0.5 : 0; }); grand += cnt; foot += '<td class="hzc' + (i + 1 === today ? ' td' : '') + '">' + (cnt ? nf(cnt) : '') + '</td>'; }
    var totWage = 0, totBill = 0;
    var body = cs.map(function (c) {
      var mk = dr.marks[c.id], l = byId[c.id] || {}, dd = hzDays(mk, n), cells = '';
      totWage += l.pay || 0; totBill += l.bill || 0;
      for (var k = 0; k < n; k++) { var v = mk[k]; cells += '<td class="hzt' + (k + 1 === today ? ' td' : '') + '"><button class="hz hz' + (v === '1' ? 'p' : v === 'h' ? 'h' : 'a') + '" data-act="hzcell" data-id="' + c.id + '" data-d="' + (k + 1) + '" aria-label="' + esc(c.name) + ' din ' + (k + 1) + '">' + (v === '1' ? 'P' : v === 'h' ? '½' : '·') + '</button></td>'; }
      return '<tr><td class="hzn">' + esc(c.name) + (c.status === 'left' ? ' <span class="pill">chhoda</span>' : '') + '</td><td class="sm">' + esc(c.trade) + '</td>' + cells + '<td class="n"><b>' + nf(dd) + '</b></td><td class="n">' + (dr.dirty[c.id] ? '<span class="mu">save ke baad</span>' : inr(l.pay || 0)) + '</td><td class="n">' + (dr.dirty[c.id] ? '' : inr(l.bill || 0)) + '</td></tr>';
    }).join('');
    h += '<div class="card"><div class="scroll" id="hzs"><table class="hzT"><thead><tr>' + head + '</tr></thead><tbody>' + body + '<tr class="tot">' + foot + '<td class="n">' + nf(grand) + '</td><td class="n">' + (dirtyN ? '' : inr(totWage)) + '</td><td class="n">' + (dirtyN ? '' : inr(totBill)) + '</td></tr></tbody></table></div></div>';
    h += '<div class="row">' + (dirtyN ? '<span class="pill warn">' + dirtyN + ' candidate ki hazri save nahi hui</span>' : '<span class="pill good">Sab save hai</span>') + '<button class="btn" data-act="hzsave"' + (dirtyN ? '' : ' disabled') + '>Hazri save karein</button></div>';
    h += '<p class="sm mu">Is mahine ki hazri yahin se bharein. Yahan bharne ke baad candidate ke din apne aap jud jate hain aur Payouts → Owners ka hissa tak sab hisaab badal jata hai.</p>';
    return h;
  };

  /* Payment ka kram: 1 candidates, 2 staff / supplier, 3 teeno owner */
  function payOrder() {
    var r = S.data.report, f = r.firm, st = r.byStaff;
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
    h += '<div class="card"><h3>Staff / Manpower supplier / Supervisor</h3><div class="scroll"><table><thead><tr><th>Naam</th><th>Prakar</th><th class="n">%</th><th class="n">Candidates</th><th class="n">Din</th><th class="n">Candidates ka wage</th><th class="n">Commission</th><th class="n">GST kata</th><th class="n">Net milega</th><th class="n">Fixed</th></tr></thead><tbody>' +
      st.map(function (x) { return '<tr><td>' + esc(x.name) + '</td><td>' + esc(TYPE[x.type] || x.type) + '</td><td class="n">' + x.pct + '%</td><td class="n">' + x.candidates + '</td><td class="n">' + nf(x.days) + '</td><td class="n">' + inr(x.pay) + '</td><td class="n">' + inr(x.commission) + '</td><td class="n">' + inr(x.gst) + '</td><td class="n b">' + inr(x.net) + '</td><td class="n">' + inr(x.fixed) + '</td></tr>'; }).join('') +
      '<tr class="tot"><td colspan="5">Kul</td><td class="n">' + tot('pay') + '</td><td class="n">' + tot('commission') + '</td><td class="n">' + tot('gst') + '</td><td class="n">' + tot('net') + '</td><td class="n">' + tot('fixed') + '</td></tr></tbody></table></div></div>';
    h += '<div class="card"><h3>Company-wise</h3><div class="scroll"><table><thead><tr><th>Party</th><th class="n">Candidates</th><th class="n">Din</th><th class="n">Bill</th><th class="n">Wage</th><th class="n">Margin</th><th class="n">Company ' + S0.billPct + '%</th><th class="n">Pool</th><th class="n">Milna chahiye</th><th class="n">Baaki</th></tr></thead><tbody>' +
      r.byParty.map(function (p) { return '<tr><td>' + esc(p.name) + '</td><td class="n">' + p.headcount + '</td><td class="n">' + nf(p.days) + '</td><td class="n">' + inr(p.bill) + '</td><td class="n">' + inr(p.pay) + '</td><td class="n">' + inr(p.margin) + '</td><td class="n">' + inr(p.bonus) + '</td><td class="n">' + inr(p.pool) + '</td><td class="n">' + inr(p.receivable) + '</td><td class="n">' + inr(p.due) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    h += '<div class="note">Hisaab: Pool = (company bill − candidate wage) + company ka commission. Staff ka commission = pool × staff %. Usme se GST ' + S0.gstPct + '% kata jata hai, baaki "Net" staff ko milta hai. Poore hisaab ke liye "Owners ka hissa" dekhein.</div>';
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
      fld('commissionPct', 'Staff / supplier commission %', s.commissionPct, { type: 'number', step: 'any', min: 0, max: 100 }) + fld('gstPct', 'Staff ke commission par GST % (kata jata hai)', s.gstPct, { type: 'number', step: 'any', min: 0, max: 100 }) +
      fld('billPct', 'Company jo commission deti hai (% of bill)', s.billPct, { type: 'number', step: 'any', min: 0, max: 100 }) + fld('basisDays', 'Ek mahine ke din (rate ka hisaab)', s.basisDays, { type: 'number', min: 1, max: 31 }) +
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
        fld('billPct', 'Is party ka commission % (khali = default)', p.billPct, { type: 'number', step: 'any', min: 0, max: 100 }) + fld('basisDays', 'Mahine ke din (khali = default)', p.basisDays, { type: 'number', min: 1, max: 31 }) + fld('payDays', 'Payment ke din (khali = default)', p.payDays, { type: 'number', min: 0 }) +
        sel('active', 'Halat', [['true', 'Chalu'], ['false', 'Band']], String(p.active !== false)) +
        '<div class="note">Rate card: har trade ka mahine ka rate. "Company deti hai" = company se kitna milta hai. "Candidate ko" = candidate ko kitna dena hai.</div>' +
        '<div class="scroll"><table><thead><tr><th>Trade</th><th>Company deti hai (₹/mahina)</th><th>Candidate ko (₹/mahina)</th><th></th></tr></thead><tbody id="rateRows">' + (p.rates.length ? p.rates : [null]).map(rateRow).join('') + '</tbody></table></div>' +
        '<div class="row"><button type="button" class="btn sm sec" data-act="addrate">+ Trade</button></div><div class="msg" id="msg" role="alert"></div><div class="row"><button class="btn" type="submit">Save</button><button class="btn sec" type="button" data-act="closepanel">Band karein</button></div></form>';
    },
    staff: function (id) {
      var s = id ? staff(id) : { name: '', phone: '', type: 'agent', commissionPct: '', fixedPay: '', fixedFrom: '', active: true };
      return '<h3>' + (id ? 'Staff edit' : 'Naya staff') + '</h3><form data-form="staff" class="grid"><input type="hidden" name="id" value="' + esc(id || '') + '">' + fld('name', 'Naam', s.name, { req: 1 }) + fld('phone', 'Mobile', s.phone, { type: 'tel' }) +
        sel('type', 'Prakar', [['agent', 'Staff (candidate laata hai)'], ['supplier', 'Manpower supplier (company me kaam nahi karta)'], ['supervisor', 'Site supervisor (fixed payment)']], s.type) +
        fld('commissionPct', 'Commission % (khali = default ' + S.data.settings.commissionPct + '%)', s.commissionPct, { type: 'number', step: 'any', min: 0, max: 100 }) + fld('fixedPay', 'Fixed payment ₹/mahina (supervisor)', s.fixedPay, { type: 'number', min: 0, step: 'any' }) + fld('fixedFrom', 'Fixed payment kis mahine se', s.fixedFrom, { type: 'month' }) +
        sel('active', 'Halat', [['true', 'Chalu'], ['false', 'Band (link bhi band)']], String(s.active !== false)) + '<div class="msg" id="msg" role="alert"></div><div class="row"><button class="btn" type="submit">Save</button><button class="btn sec" type="button" data-act="closepanel">Band karein</button></div></form>';
    },
    cand: function (id) {
      var c = id ? S.data.candidates.filter(function (x) { return x.id === id; })[0] : { name: '', mobile: '', trade: '', partyId: '', staffId: '', joinDate: '', payRate: '', billRate: '', status: 'active' };
      var trades = {}; S.data.parties.forEach(function (p) { (p.rates || []).forEach(function (r) { trades[r.trade] = 1; }); });
      return '<h3>' + (id ? 'Candidate edit' : 'Naya candidate') + '</h3><form data-form="cand" class="grid"><input type="hidden" name="id" value="' + esc(id || '') + '">' + fld('name', 'Naam', c.name, { req: 1 }) + fld('mobile', 'Mobile', c.mobile, { type: 'tel' }) + fld('trade', 'Trade', c.trade, { req: 1, list: 'tradeList' }) +
        '<datalist id="tradeList">' + Object.keys(trades).map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist>' +
        sel('partyId', 'Party', partyOpts('— chuniye —'), c.partyId) + sel('staffId', 'Staff', staffOpts('Direct (koi staff nahi)'), c.staffId || '') + fld('joinDate', 'Joining date', c.joinDate, { type: 'date' }) +
        fld('payRate', 'Candidate rate (khali = rate card)', c.payRate == null ? '' : c.payRate, { type: 'number', min: 0, step: 'any' }) + fld('billRate', 'Company rate (khali = rate card)', c.billRate == null ? '' : c.billRate, { type: 'number', min: 0, step: 'any' }) +
        sel('status', 'Halat', [['active', 'Chal raha hai'], ['left', 'Kaam chhod diya']], c.status) + (id ? '' : fld('days', 'Is mahine ke din', '', { type: 'number', min: 0, max: 31, step: '0.5' })) +
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
    party: async function (f) {
      var o = collect(f), rates = $$('#rateRows tr', f).map(function (tr) { return { trade: $('.r-trade', tr).value, bill: $('.r-bill', tr).value, pay: $('.r-pay', tr).value }; }).filter(function (r) { return r.trade.trim(); });
      var item = { name: o.name, contact: o.contact, phone: o.phone, email: o.email, gstin: o.gstin, address: o.address, billPct: o.billPct, basisDays: o.basisDays, payDays: o.payDays, active: o.active === 'true', rates: rates };
      if (o.id) item.id = o.id; await save('parties', item);
    },
    staff: async function (f) {
      var o = collect(f), item = { name: o.name, phone: o.phone, type: o.type, commissionPct: o.commissionPct, fixedPay: o.fixedPay, fixedFrom: o.fixedFrom, active: o.active === 'true' };
      if (o.id) item.id = o.id; await save('staff', item);
    },
    cand: async function (f) {
      var o = collect(f), item = { name: o.name, mobile: o.mobile, trade: o.trade, partyId: o.partyId, staffId: o.staffId || null, joinDate: o.joinDate, payRate: o.payRate, billRate: o.billRate, status: o.status };
      if (o.id) item.id = o.id;
      var r = await api('POST', '/api/admin/save', { col: 'candidates', item: item });
      if (!o.id && o.days !== '' && o.days != null) await api('POST', '/api/admin/attendance', { candId: r.id, month: S.month, days: o.days });
      S.panel = null; await load(); P.toast('Save ho gaya');
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
  async function save(col, item) { await api('POST', '/api/admin/save', { col: col, item: item }); S.panel = null; await load(); P.toast('Save ho gaya'); }

  /* ---------- render ---------- */
  function keepScroll() { var e = $('#hzs'); S.hzKeep = e ? e.scrollLeft : null; }
  function render() {
    shell(true);
    $('#tabs').innerHTML = TABS.map(function (t) { return '<button data-act="tab" data-id="' + t[0] + '" aria-current="' + (t[0] === S.tab) + '">' + t[1] + '</button>'; }).join('');
    $('#month').value = S.month;
    var pn = S.panel ? '<div class="panel" id="panel">' + PANELS[S.panel.k](S.panel.id) + '</div>' : '';
    var ae = document.activeElement, keep = ae && ae.id === 'fq' ? ae.selectionStart : null;
    $('#app').innerHTML = pn + V[S.tab]();
    if (S.panel) { var el = $('#panel'); if (el && S.panel.fresh) { el.scrollIntoView({ block: 'nearest' }); S.panel.fresh = false; } }
    if (S.hzKeep != null) { var hs = $('#hzs'); if (hs) hs.scrollLeft = S.hzKeep; S.hzKeep = null; }
    if (keep !== null) { var q = $('#fq'); if (q) { q.focus(); q.setSelectionRange(keep, keep); } }
  }

  /* ---------- exports ---------- */
  function exportRows(lines, withPool) {
    var head = ['Naam', 'Party', 'Trade', 'Staff', 'Din', 'Wage', 'Company bill'].concat(withPool ? ['Pool', 'Commission', 'GST', 'Net'] : []);
    return [head].concat(lines.map(function (l) { return [l.name, l.partyName, l.trade, l.staffName || 'Direct', l.days, l.pay, l.bill].concat(withPool ? [l.pool, l.commission, l.gst, l.net] : []); }));
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
    var st = [['Naam', 'Prakar', '%', 'Candidates', 'Din', 'Candidates ka wage', 'Pool', 'Commission', 'GST kata', 'Net milega', 'Fixed payment']].concat(r.byStaff.map(function (x) { return [x.name, TYPE[x.type] || x.type, x.pct, x.candidates, x.days, x.pay, x.pool, x.commission, x.gst, x.net, x.fixed]; }));
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
      { name: 'Kharch', rows: [['Prakar', 'Vivaran', 'Rakam']].concat(d.expenses.map(function (e) { return [e.category === 'office' ? 'Office salary' : 'Anya', e.label, e.amount]; })), widths: [16, 36, 14] }
    ];
  }
  function ownersRows() {
    var r = S.data.report, f = r.firm;
    return [['Hisaab', 'Rakam'], ['Company ka kul bill', f.bill], ['Candidates ko wage', f.pay], ['Margin', f.margin], ['Company ka commission', f.bonus], ['Pool', f.pool], ['Staff / supplier ka commission', f.staffCommission], ['Firm ka hissa', f.firmShare],
      ['GST firm ke hisse par', f.gstOnFirm], ['Site supervisor fixed', f.fixedPay], ['Office salary', f.officeSalaries], ['Anya kharch', f.otherExpenses], ['Teeno me baantne ke liye bacha', f.distributable]]
      .concat(r.owners.map(function (o) { return [o.name + ' (' + o.role + ')', o.amount]; }));
  }
  function xbook(sheets, name) { P.download(A2ZXlsx.writeBook(sheets), name + '-' + S.month + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }

  /* ---------- events ---------- */
  var A = {
    tab: function (b) { S.tab = b.dataset.id; S.panel = null; render(); },
    panel: function (b) { S.panel = { k: b.dataset.k, id: b.dataset.id || '', fresh: true }; render(); },
    closepanel: function () { S.panel = null; render(); },
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
    addrate: function () { $('#rateRows').insertAdjacentHTML('beforeend', rateRow()); },
    delrate: function (b) { var tr = b.closest('tr'); if ($$('#rateRows tr').length > 1) tr.remove(); else $$('input', tr).forEach(function (i) { i.value = ''; }); },
    copytext: function () { P.copy($('#remText').value); },
    logwa: function (b) { api('POST', '/api/admin/reminder', { partyId: b.dataset.id, month: S.month, channel: 'whatsapp' }).then(load).catch(function () { /* the link still opens */ }); },
    logcall: async function (b) { await api('POST', '/api/admin/reminder', { partyId: b.dataset.id, month: S.month, channel: 'call' }); S.panel = null; await load(); P.toast('Note kar liya'); },
    sendmail: async function (b) { await api('POST', '/api/admin/reminder', { partyId: b.dataset.id, month: S.month, channel: 'email', message: $('#remText').value }); S.panel = null; await load(); P.toast('Email bhej diya'); },
    backup: async function () { var r = await api('POST', '/api/admin/backup', {}); P.download(JSON.stringify(r.data, null, 1), r.name, 'application/json'); P.toast('Backup download ho gaya'); },
    xparty: function (b) { var ls = S.data.report.lines.filter(function (l) { return l.partyId === b.dataset.id; }); P.xlsxDownload(exportRows(ls, false), 'party-' + S.month + '.xlsx', 'Party', XW); },
    xstaff: function (b) { var ls = S.data.report.lines.filter(function (l) { return l.staffId === b.dataset.id; }); P.xlsxDownload(exportRows(ls, true), 'staff-' + S.month + '.xlsx', 'Staff', XW); },
    xall: function () { xbook(allSheets(), 'A2Z-sab-hisaab'); },
    xowners: function () { xbook([{ name: 'Owners ka hissa', rows: ownersRows(), widths: [46, 16] }], 'A2Z-owners'); },
    xparties: function () {
      var rows = [['Party', 'Mobile', 'Email', 'Contact', 'Pata', 'GSTIN', 'Company %', 'Mahine ke din', 'Payment ke din', 'Halat', 'Rate card']].concat(S.data.parties.map(function (p) { return [p.name, p.phone, p.email || '', p.contact, p.address, p.gstin, p.billPct == null ? '' : p.billPct, p.basisDays == null ? '' : p.basisDays, p.payDays == null ? '' : p.payDays, p.active === false ? 'Band' : 'Chalu', (p.rates || []).map(function (r) { return r.trade + ': company ' + r.bill + ' / candidate ' + r.pay; }).join(' | ')]; }));
      xbook([{ name: 'Party', rows: rows, widths: [24, 14, 24, 18, 30, 18, 10, 10, 10, 8, 60] }], 'A2Z-parties');
    },
    xcands: function () {
      var rows = [['Naam', 'Mobile', 'Trade', 'Party', 'Staff', 'Joining', 'Candidate rate', 'Company rate', 'Status', 'Verify', 'Entry date']].concat(S.data.candidates.map(function (c) { var p = party(c.partyId), t = c.staffId ? staff(c.staffId) : null; return [c.name, c.mobile, c.trade, p ? p.name : '', t ? t.name : 'Direct', c.joinDate, c.payRate == null ? '' : c.payRate, c.billRate == null ? '' : c.billRate, c.status === 'left' ? 'Chhoda' : 'Chalu', c.verified ? 'Haan' : 'Nahi', P.dt(c.createdAt)]; }));
      xbook([{ name: 'Candidates', rows: rows, widths: [24, 14, 16, 22, 18, 12, 14, 14, 9, 8, 22] }], 'A2Z-candidates');
    },
    xstafflist: function () {
      var rows = [['Naam', 'Mobile', 'Prakar', 'Commission %', 'Fixed payment', 'Halat']].concat(S.data.staff.map(function (x) { return [x.name, x.phone, TYPE[x.type] || x.type, x.commissionPct == null ? '' : x.commissionPct, x.fixedPay, x.active === false ? 'Band' : 'Chalu']; }));
      xbook([{ name: 'Staff', rows: rows, widths: [24, 14, 20, 12, 14, 8] }], 'A2Z-staff');
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
    if (t.classList.contains('js-days')) {
      guard(async function () { await api('POST', '/api/admin/attendance', { candId: t.dataset.id, month: S.month, days: t.value || 0 }); await load(); P.toast('Din save ho gaye'); })();
    } else if (t.name === 'fparty') { S.f.party = t.value; render(); } else if (t.name === 'fstaff') { S.f.staff = t.value; render(); } else if (t.name === 'hzp') { S.hzParty = t.value; S.hz = null; render(); }
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'fq') { S.f.q = t.value; render(); }
    if (t.id === 'remText') { var a = $('#waBtn'); if (a && S.panel) { var p = party(S.panel.id); a.href = P.waLink(p.phone, t.value); } }
  });
  $('#month').addEventListener('change', function (e) { if (/^\d{4}-\d{2}$/.test(e.target.value)) { S.month = e.target.value; guard(load)(); } });

  boot();
})();
