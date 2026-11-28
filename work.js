/* FILE: work.js  (GitHub par isi naam se upload karein) */
/* A2Z Build Tech - DAILY KAAM (civil / mechanical): staff aur admin dono ki screen ka saajha code.
 * Aaj ka kaam = aaj tak ka kul kaam - kal tak ka kul kaam. Kaam ki keemat = kaam x rate. Munafa = keemat - labour ka kharch.
 * Rate, keemat aur munafa sirf Admin ki screen par dikhte hain. */
(function () {
  'use strict';
  var esc = P.esc, nf = P.nf, inr = P.inr, $ = P.$;
  var W = { st: { f: {}, open: false, editId: null, prev: null, snap: null, rev: null, mail: null, cat: null, af: { party: '', cat: '' } }, host: null };
  var CAT = { civil: 'Civil', mech: 'Mechanical' }, STATUS = { '': ['Admin ne dekha nahi', 'warn'], ok: ['Theek hai', 'good'], sudhar: ['Sudhar chahiye', 'bad'] };
  W.CAT = CAT;

  /* ---------- hisaab ---------- */
  function num(v) { if (v == null || String(v).trim() === '') return null; var x = parseFloat(String(v).replace(/,/g, '')); return isFinite(x) ? x : null; }
  function r3(x) { return Math.round(x * 1000) / 1000; }
  function r2(x) { return Math.round(x * 100) / 100; }
  W.total = function (f) { var t = 1, any = false; ['l', 'b', 'h', 'n'].forEach(function (k) { var x = num(f[k]); if (x !== null) { any = true; t *= x; } }); return any ? r3(t) : null; };
  function labourOf(f, c) { return c.labour.filter(function (x) { return x.category === f.category; }).map(function (x) { return { id: x.id, name: x.name, count: parseInt(f['lab_' + x.id], 10) || 0 }; }).filter(function (x) { return x.count > 0; }); }
  function workOf(f, c) { return c.works.filter(function (x) { return x.id === f.workId; })[0] || null; }
  W.payload = function () {
    var f = W.st.f, c = W.host.ctx();
    return { id: W.st.editId || undefined, date: f.date, partyId: f.partyId, site: (f.site || '').trim(), team: (f.team || '').trim(), category: f.category, workId: f.workId, mode: f.mode || 'cum', l: f.l, b: f.b, h: f.h, n: f.n, note: f.note || '', labour: labourOf(f, c).map(function (x) { return { id: x.id, count: x.count }; }), reprice: f.reprice ? true : undefined };
  };

  function calc() {
    var st = W.st, f = st.f, c = W.host.ctx(), w = workOf(f, c), tot = W.total(f), prev = st.prev == null ? 0 : st.prev, lab = labourOf(f, c), people = lab.reduce(function (a, x) { return a + x.count; }, 0);
    var qty = tot == null ? null : (f.mode === 'direct' ? tot : r3(tot - prev)), o = { w: w, tot: tot, prev: prev, qty: qty, people: people, lab: lab, unit: w ? w.unit : '' };
    if (W.host.admin) {
      var rate = st.snap && !f.reprice ? st.snap.rate : (c.rateOf ? c.rateOf(f.workId, f.partyId) : 0), cost = 0;
      lab.forEach(function (x) { var lr = st.snap && !f.reprice && st.snap.labour[x.id] != null ? st.snap.labour[x.id] : (c.lrate ? c.lrate(x.id) : 0); cost += x.count * lr; });
      o.rate = rate; o.cost = r2(cost); o.value = qty == null ? 0 : r2(qty * rate); o.profit = r2(o.value - o.cost);
    }
    return o;
  }
  function previewHtml() {
    var o = calc(), f = W.st.f, u = esc(o.unit), h = '';
    if (!W.st.f.partyId || !f.site || !f.workId) h += '<div>Party, jagah aur kaam chunne par "kal tak ka kul kaam" yahan dikhega.</div>';
    else h += '<div>Kal tak ka kul kaam (is jagah ka): <b>' + nf(o.prev) + ' ' + u + '</b></div>';
    if (o.tot == null) h += '<div class="mu">Naap likhein (lambai × chaudai × unchai × sankhya).</div>';
    else if (f.mode === 'direct') h += '<div>Aaj ka kaam: <b>' + nf(o.tot) + ' ' + u + '</b></div>';
    else h += '<div>Aaj tak ka kul: <b>' + nf(o.tot) + '</b> − kal tak ka kul <b>' + nf(o.prev) + '</b> = <b class="' + (o.qty > 0 ? 'good' : 'bad') + '">aaj ka kaam ' + nf(o.qty) + ' ' + u + '</b>' + (o.qty <= 0 ? ' (aaj tak ka kul kal se zyada hona chahiye)' : '') + '</div>';
    h += '<div>Aaj ke labour: <b>' + o.people + '</b> ' + (o.lab.length ? '(' + o.lab.map(function (x) { return esc(x.name) + ' ' + x.count; }).join(', ') + ')' : '') + '</div>';
    if (W.host.admin && o.qty > 0) h += '<div>Kaam ki keemat ' + inr(o.value) + ' (' + nf(o.qty) + ' × ' + inr(o.rate) + ') − labour kharch ' + inr(o.cost) + ' = munafa <b class="' + (o.profit >= 0 ? 'good' : 'bad') + '">' + inr(o.profit) + '</b>' + (!o.rate ? ' <span class="bad">· is kaam ka rate tay nahi</span>' : '') + '</div>';
    return h;
  }
  W.refresh = function () { var e = $('#wprev'); if (e) e.innerHTML = previewHtml(); };
  function fetchPrev() {
    var f = W.st.f; W.st.prev = null;
    if (!f.date || !f.partyId || !(f.site || '').trim() || !f.workId) { W.refresh(); return Promise.resolve(); }
    var key = [f.date, f.partyId, f.site, f.workId, W.st.editId].join('|'); W.st.pk = key;
    return W.host.call('work-prev', { date: f.date, partyId: f.partyId, site: f.site, workId: f.workId, id: W.st.editId || undefined }).then(function (r) { if (W.st.pk === key) { W.st.prev = r.prev; W.refresh(); } }).catch(function () { W.refresh(); });
  }

  /* ---------- form ---------- */
  function opts(list, cur, ph) { return (ph ? '<option value="">' + esc(ph) + '</option>' : '') + list.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (String(x[0]) === String(cur) ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join(''); }
  function inp(label, key, o) {
    o = o || {}; var f = W.st.f;
    return '<label>' + esc(label) + (o.req ? ' *' : '') + '<input data-w="' + key + '" type="' + (o.type || 'text') + '" value="' + esc(f[key] == null ? '' : f[key]) + '"' + (o.list ? ' list="' + o.list + '"' : '') + (o.max ? ' max="' + o.max + '"' : '') + (o.num ? ' inputmode="decimal" min="0" step="any"' : '') + (o.maxlen ? ' maxlength="' + o.maxlen + '"' : '') + ' autocomplete="off">' + (o.hint ? '<span class="hint">' + esc(o.hint) + '</span>' : '') + '</label>';
  }
  W.form = function (title) {
    var st = W.st, f = st.f, c = W.host.ctx(), works = c.works.filter(function (x) { return x.category === f.category; }), labs = c.labour.filter(function (x) { return x.category === f.category; });
    var sites = c.sites.filter(function (s) { return !f.partyId || s.partyId === f.partyId; }), w = workOf(f, c);
    var h = '<div class="card" id="wform"><h3>' + esc(title) + '</h3><div class="grid">' +
      inp('Tarikh', 'date', { type: 'date', max: c.today, req: 1, hint: 'Jis din kaam hua' }) +
      '<label>Party *<select data-w="partyId">' + opts(c.parties.filter(function (p) { return !p.category || p.category === f.category || p.id === f.partyId; }).map(function (p) { return [p.id, p.name + (p.category ? (p.category === 'mech' ? ' (Mechanical)' : ' (Civil)') : '')]; }), f.partyId, '— party chuniye —') + '</select></label>' +
      inp('Jagah (site) *', 'site', { list: 'wsites', maxlen: 80, hint: 'Party ki kaun si jagah / block par kaam hua. Pehle likhi jagah suggestion me aayegi.' }) +
      inp('Team ka naam *', 'team', { list: 'wteams', maxlen: 60, hint: 'Jaise "Team 1", "Rakesh ki team". Alag-alag team alag likhein.' }) +
      '<label>Kaam ka prakar *<select data-w="category">' + opts([['civil', 'Civil'], ['mech', 'Mechanical']], f.category) + '</select></label>' +
      '<label>Kaun sa kaam *<select data-w="workId">' + opts(works.map(function (x) { return [x.id, x.name + ' (' + x.unit + ')']; }), f.workId, works.length ? '— kaam chuniye —' : '— list khali: Admin se kahein —') + '</select></label></div>' +
      '<datalist id="wsites">' + sites.map(function (s) { return '<option value="' + esc(s.site) + '">'; }).join('') + '</datalist><datalist id="wteams">' + c.teams.map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist>' +
      '<fieldset class="card"><legend>Naap kaise likhna hai</legend><label class="row"><input type="radio" name="wmode" data-w="mode" value="cum"' + (f.mode !== 'direct' ? ' checked' : '') + '> Aaj tak ka kul naap likhunga (aaj ka kaam apne aap nikal jayega)</label>' +
      '<label class="row"><input type="radio" name="wmode" data-w="mode" value="direct"' + (f.mode === 'direct' ? ' checked' : '') + '> Sirf aaj ka naap likhunga</label>' +
      '<div class="grid">' + inp('Lambai', 'l', { num: 1 }) + inp('Chaudai', 'b', { num: 1 }) + inp('Unchai / gehrai', 'h', { num: 1 }) + inp('Sankhya / matra', 'n', { num: 1, hint: 'Nos, kg, ya kitni baar. Jo na ho use khali chhodein (1 maana jayega).' }) + '</div>' +
      '<span class="hint">Udaharan: 15 m lamba × 1 × 1 = 15 m³. Kal tak ka kul 15 tha aur aaj tak ka kul 17 hai to aaj ka kaam 17 − 15 = 2 m³.</span></fieldset>' +
      '<fieldset class="card"><legend>Aaj kitne labour lage (' + esc(CAT[f.category] || '') + ')</legend>' + (labs.length ? '<div class="grid">' + labs.map(function (x) { return inp(x.name, 'lab_' + x.id, { type: 'number', num: 1 }).replace('step="any"', 'step="1"'); }).join('') + '</div>' : '<div class="note warn">Labour ki list khali hai. Admin ko "Daily Kaam" tab me "Kaam / labour ki list" bharni hogi.</div>') + '</fieldset>' +
      '<div class="note" id="wprev">' + previewHtml() + '</div>' + inp('Note (zaruri nahi)', 'note', { maxlen: 300 });
    if (W.host.admin && st.editId) h += '<label class="row"><input type="checkbox" data-w="reprice"' + (f.reprice ? ' checked' : '') + '> Aaj ke rate lagayein (nahi to is entry ke purane rate hi rahenge)</label>';
    h += '<div class="msg" id="wmsg" role="alert"></div><div class="row"><button class="btn" data-wact="wsave">' + (st.editId ? 'Badlav save karein' : 'Save karein') + '</button><button class="btn sec" data-wact="wcancel">Band karein</button></div></div>';
    return h;
  };

  /* ---------- tables ---------- */
  function labTxt(l) { return (l.labour || []).map(function (x) { return esc(x.name) + ' ' + x.count; }).join(', '); }
  function sp(l) { var s = STATUS[l.status || ''] || STATUS['']; return '<span class="pill ' + s[1] + '">' + s[0] + '</span>'; }
  W.staffList = function (logs) {
    if (!logs.length) return '<div class="note">Is mahine abhi koi kaam darj nahi hua. "+ Aaj ka kaam likhein" dabayein.</div>';
    return '<div class="card scroll"><table><thead><tr><th>Tarikh</th><th>Party / jagah</th><th>Team</th><th>Kaam</th><th class="n">Aaj ka kaam</th><th class="n">Labour</th><th>Admin ka jawab</th><th></th></tr></thead><tbody>' + logs.map(function (l) {
      return '<tr><td>' + P.dd(l.date) + '</td><td>' + esc(l.partyName) + '<div class="xs mu">' + esc(l.site) + '</div></td><td>' + esc(l.team) + '</td><td>' + esc(l.workName) + '</td><td class="n">' + nf(l.qty) + ' ' + esc(l.unit) + '<div class="xs mu">kul ' + nf(l.cumTotal) + '</div></td><td class="n">' + l.people + '<div class="xs mu">' + labTxt(l) + '</div></td><td>' + sp(l) + (l.remark ? '<div class="sm">' + esc(l.remark) + '</div>' : '') + '</td><td>' +
        (l.status === 'ok' ? '' : '<button class="btn sec sm" data-wact="wedit" data-id="' + esc(l.id) + '">Badlein</button> ') + (!l.status ? '<button class="btn sec sm" data-wact="wdel" data-id="' + esc(l.id) + '">Hatayein</button>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  };

  function agg(logs, keyFn, labelFn) {
    var m = {}, order = [];
    logs.forEach(function (l) { var k = keyFn(l), g = m[k]; if (!g) { g = m[k] = { label: labelFn(l), n: 0, people: 0, value: 0, cost: 0, profit: 0, dates: {}, teams: {} }; order.push(k); } g.n++; g.people += l.people; g.value += l.value; g.cost += l.cost; g.profit += l.profit; g.dates[l.date] = 1; g.teams[l.team] = 1; });
    return order.map(function (k) { var g = m[k]; g.value = r2(g.value); g.cost = r2(g.cost); g.profit = r2(g.profit); g.days = Object.keys(g.dates).length; g.nteams = Object.keys(g.teams).length; return g; });
  }
  function aggTable(title, head, rows, extra) {
    var t = { n: 0, people: 0, value: 0, cost: 0, profit: 0 };
    return '<h3>' + title + '</h3><div class="card scroll"><table><thead><tr><th>' + head + '</th>' + (extra ? '<th class="n">' + extra[0] + '</th>' : '') + '<th class="n">Entry</th><th class="n">Labour (din)</th><th class="n">Kaam ki keemat</th><th class="n">Labour kharch</th><th class="n">Munafa</th></tr></thead><tbody>' + rows.map(function (g) {
      t.n += g.n; t.people += g.people; t.value += g.value; t.cost += g.cost; t.profit += g.profit;
      return '<tr><td>' + g.label + '</td>' + (extra ? '<td class="n">' + extra[1](g) + '</td>' : '') + '<td class="n">' + g.n + '</td><td class="n">' + g.people + '</td><td class="n">' + inr(g.value) + '</td><td class="n">' + inr(g.cost) + '</td><td class="n ' + (g.profit >= 0 ? 'good' : 'bad') + '">' + inr(g.profit) + '</td></tr>';
    }).join('') + '<tr class="tot"><td>Kul</td>' + (extra ? '<td></td>' : '') + '<td class="n">' + t.n + '</td><td class="n">' + t.people + '</td><td class="n">' + inr(t.value) + '</td><td class="n">' + inr(t.cost) + '</td><td class="n">' + inr(t.profit) + '</td></tr></tbody></table></div>';
  }
  var pName = function (c, id) { var p = c.parties.filter(function (x) { return x.id === id; })[0]; return p ? p.name : '?'; };
  var sName = function (c, id) { var p = (c.staff || []).filter(function (x) { return x.id === id; })[0]; return p ? p.name : ''; };
  W.filtered = function (logs) { var a = W.st.af; return logs.filter(function (l) { return (!a.party || l.partyId === a.party) && (!a.cat || l.category === a.cat); }); };
  W.sheets = function (logs, c) {
    var rows = [['Tarikh', 'Party', 'Jagah', 'Team', 'Prakar', 'Kaam', 'Ikai', 'Aaj tak ka kul', 'Aaj ka kaam', 'Rate', 'Labour', 'Labour ka vivaran', 'Kaam ki keemat', 'Labour kharch', 'Munafa', 'Staff', 'Halat', 'Admin ka jawab']];
    logs.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); }).forEach(function (l) { rows.push([l.date, pName(c, l.partyId), l.site, l.team, CAT[l.category], l.workName, l.unit, l.cumTotal, l.qty, l.rate, l.people, (l.labour || []).map(function (x) { return x.name + ' ' + x.count; }).join(', '), l.value, l.cost, l.profit, sName(c, l.staffId), (STATUS[l.status || ''] || [''])[0], l.remark || '']); });
    function g(name, head, list, widths) { var r = [[head, 'Entry', 'Labour (din)', 'Kaam ki keemat', 'Labour kharch', 'Munafa']]; list.forEach(function (x) { r.push([x.label, x.n, x.people, x.value, x.cost, x.profit]); }); return { name: name, rows: r, widths: widths || [34, 10, 14, 16, 16, 16] }; }
    return [{ name: 'Daily Kaam', rows: rows, widths: [12, 22, 20, 16, 11, 24, 8, 12, 12, 10, 9, 30, 14, 14, 14, 16, 16, 30], title: 'Daily Work & Labour Cost Statement', totalHeaders: ['Labour', 'Kaam ki keemat', 'Labour kharch', 'Munafa'] },
      g('Party-wise', 'Party', agg(logs, function (l) { return l.partyId; }, function (l) { return pName(c, l.partyId); })),
      g('Jagah-wise', 'Party / Jagah', agg(logs, function (l) { return l.partyId + '|' + l.site; }, function (l) { return pName(c, l.partyId) + ' / ' + l.site; })),
      g('Team-wise', 'Party / Jagah / Team', agg(logs, function (l) { return l.partyId + '|' + l.site + '|' + l.team; }, function (l) { return pName(c, l.partyId) + ' / ' + l.site + ' / ' + l.team; }), [44, 10, 14, 16, 16, 16]),
      g('Din-wise', 'Tarikh', agg(logs, function (l) { return l.date; }, function (l) { return l.date; }).sort(function (a, b) { return a.label.localeCompare(b.label); }))];
  };

  /* ---------- admin ki poori screen ---------- */
  W.adminView = function (d, month) {
    var st = W.st, c = W.host.ctx(), logs = W.filtered(d.worklogs || []), h = '<div class="row between"><h2>Daily Kaam – ' + P.monthName(month) + '</h2><div class="row"><button class="btn sec" data-wact="wmailopen">Party ko bhejein</button><button class="btn sec" data-wact="wxl">Excel</button></div></div>';
    h += '<div class="note">Staff roz ka kaam yahan likhta hai. Aap dekh sakte hain, badal sakte hain aur "Jawab" likh sakte hain (staff ko dikhega). Rate aur munafa sirf aapko dikhte hain.</div>';
    h += '<div class="grid"><label>Party<select data-wf="party">' + opts(c.parties.map(function (p) { return [p.id, p.name]; }), st.af.party, 'Sabhi party') + '</select></label><label>Civil / Mechanical<select data-wf="cat">' + opts([['civil', 'Civil'], ['mech', 'Mechanical']], st.af.cat, 'Dono') + '</select></label></div>';
    var t = logs.reduce(function (a, l) { a.v += l.value; a.c += l.cost; a.p += l.profit; a.n += l.people; if (!l.status) a.w++; if (!l.rate || (l.labour || []).some(function (x) { return !x.rate; })) a.nr++; return a; }, { v: 0, c: 0, p: 0, n: 0, w: 0, nr: 0 });
    h += '<div class="grid"><div class="card"><span class="xs mu">Kaam ki keemat</span><b>' + inr(t.v) + '</b></div><div class="card"><span class="xs mu">Labour kharch</span><b>' + inr(t.c) + '</b></div><div class="card"><span class="xs mu">Munafa</span><b class="' + (t.p >= 0 ? 'good' : 'bad') + '">' + inr(t.p) + '</b></div><div class="card"><span class="xs mu">Labour (kul din)</span><b>' + t.n + '</b></div><div class="card"><span class="xs mu">Aapke dekhne baaki</span><b>' + t.w + '</b></div></div>';
    if (t.nr) h += '<div class="note warn">' + t.nr + ' entry me kaam ya labour ka rate tay nahi tha (0). Neeche "Kaam / labour ki list" me rate bharein, phir us entry ko "Dekhein / badlein" me "Aaj ke rate lagayein" tick karke save karein.</div>';
    if (st.mail) h += W.mailBox(c);
    if (st.open || st.rev) h += W.adminPanel(c, logs);
    if (!logs.length) h += '<div class="note">Is mahine / filter me koi kaam darj nahi hai.</div>';
    else {
      h += aggTable('Party-wise', 'Party', agg(logs, function (l) { return l.partyId; }, function (l) { return esc(pName(c, l.partyId)); }));
      h += aggTable('Jagah-wise (kaun si party ki kaun si jagah)', 'Party / Jagah', agg(logs, function (l) { return l.partyId + '|' + l.site; }, function (l) { return esc(pName(c, l.partyId)) + ' / ' + esc(l.site); }), ['Team', function (g) { return g.nteams; }]);
      h += aggTable('Team-wise (kaun si team ne kahan kitna kaam kiya)', 'Party / Jagah / Team', agg(logs, function (l) { return l.partyId + '|' + l.site + '|' + l.team; }, function (l) { return esc(pName(c, l.partyId)) + ' / ' + esc(l.site) + ' / ' + esc(l.team); }), ['Din', function (g) { return g.days; }]);
      h += aggTable('Din-wise', 'Tarikh', agg(logs, function (l) { return l.date; }, function (l) { return P.dd(l.date); }).reverse(), null);
      h += '<h3>Poori entry (' + logs.length + ')</h3><div class="card scroll"><table><thead><tr><th>Tarikh</th><th>Party / jagah</th><th>Team</th><th>Kaam</th><th class="n">Naap</th><th class="n">Labour</th><th class="n">Keemat</th><th class="n">Kharch</th><th class="n">Munafa</th><th>Staff / halat</th><th></th></tr></thead><tbody>' + logs.map(function (l) {
        return '<tr><td>' + P.dd(l.date) + '</td><td>' + esc(pName(c, l.partyId)) + '<div class="xs mu">' + esc(l.site) + '</div></td><td>' + esc(l.team) + '</td><td>' + esc(l.workName) + '<div class="xs mu">' + CAT[l.category] + '</div></td><td class="n">' + nf(l.qty) + ' ' + esc(l.unit) + '<div class="xs mu">kul ' + nf(l.cumTotal) + '</div></td><td class="n">' + l.people + '<div class="xs mu">' + labTxt(l) + '</div></td><td class="n">' + inr(l.value) + '<div class="xs mu">@ ' + inr(l.rate) + '</div></td><td class="n">' + inr(l.cost) + '</td><td class="n ' + (l.profit >= 0 ? 'good' : 'bad') + '">' + inr(l.profit) + '</td><td>' + esc(sName(c, l.staffId)) + '<div>' + sp(l) + '</div>' + (l.remark ? '<div class="xs">' + esc(l.remark) + '</div>' : '') + '</td><td><button class="btn sec sm" data-wact="wrev" data-id="' + esc(l.id) + '">Dekhein / badlein</button></td></tr>';
      }).join('') + '</tbody></table></div>';
    }
    return h + W.catalogView(d);
  };
  W.adminPanel = function (c, logs) {
    var st = W.st, l = (W.host.logs() || []).filter(function (x) { return x.id === st.editId; })[0];
    if (!l) return '';
    return W.form('Entry dekhein / badlein: ' + P.dd(l.date) + ' · ' + esc(pName(c, l.partyId)) + ' · ' + esc(l.team)).replace('<div class="msg" id="wmsg"', '<div class="grid"><label>Aapka jawab (staff ko dikhega)<input data-w="remark" maxlength="300" value="' + esc(st.f.remark || '') + '"></label><label>Halat<select data-w="status">' + opts([['', 'Abhi dekha nahi'], ['ok', 'Theek hai'], ['sudhar', 'Sudhar chahiye']], st.f.status) + '</select></label></div><div class="msg" id="wmsg"').replace('<button class="btn sec" data-wact="wcancel">', '<button class="btn sec" data-wact="wdel" data-id="' + esc(l.id) + '">Entry hatayein</button><button class="btn sec" data-wact="wcancel">');
  };
  W.mailBox = function (c) {
    var m = W.st.mail, p = c.parties.filter(function (x) { return x.id === m.partyId; })[0];
    return '<div class="card"><h3>Party ko kaam ka vivaran email se bhejein</h3><div class="grid"><label>Party<select data-wm="partyId">' + opts(c.parties.map(function (x) { return [x.id, x.name + (x.email ? '' : ' (email nahi)')]; }), m.partyId, '— party chuniye —') + '</select></label><label>Se<input type="date" data-wm="from" value="' + esc(m.from) + '"></label><label>Tak<input type="date" data-wm="to" value="' + esc(m.to) + '"></label></div>' +
      '<span class="hint">Party ko sirf kaam, rate aur keemat jati hai. Labour ka kharch aur munafa nahi jata. Aapke "jawab" (note) saath jate hain.' + (p && !p.email ? ' Is party ki email nahi hai (Party / Company me Edit karke daalein).' : '') + '</span><div class="msg" id="wmsg" role="alert"></div><div class="row"><button class="btn" data-wact="wmailsend">Email bhejein</button><button class="btn sec" data-wact="wmailclose">Band karein</button></div></div>';
  };
  W.catalogView = function (d) {
    var cat = d.catalog || [], st = W.st, e = st.cat;
    var h = '<h3>Kaam / labour ki list aur rate</h3><div class="note">Yahan tay hota hai ki kaun-kaun se kaam hote hain (aur unka rate) aur har tarah ke labour ka roz ka kharch. Kisi party ka alag rate ho to "Party / Company" me us party ke Edit me likhein. Rate 0 = abhi tay nahi.</div>';
    if (!cat.length) h += '<div class="row"><button class="btn" data-wact="wseed">Civil + Mechanical ki shuruaati list bhar dein</button></div>';
    h += '<div class="card"><div class="grid"><label>Kya<select data-wc="kind">' + opts([['work', 'Kaam'], ['labour', 'Labour']], e && e.kind || 'work') + '</select></label><label>Civil / Mechanical<select data-wc="category">' + opts([['civil', 'Civil'], ['mech', 'Mechanical']], e && e.category || 'civil') + '</select></label>' +
      '<label>Naam<input data-wc="name" maxlength="60" value="' + esc(e ? e.name : '') + '"></label><label>Ikai (sirf kaam ke liye)<input data-wc="unit" maxlength="12" placeholder="m3, m2, rmt, kg, nos" value="' + esc(e ? e.unit : '') + '"></label><label>Rate (₹) – kaam ka per ikai, labour ka per din<input data-wc="rate" type="number" min="0" step="any" value="' + esc(e ? e.rate : '') + '"></label></div><div class="msg" id="wcmsg" role="alert"></div><div class="row"><button class="btn" data-wact="wcatsave">' + (e && e.id ? 'Badlav save karein' : 'List me jodein') + '</button>' + (e ? '<button class="btn sec" data-wact="wcatnew">Naya likhein</button>' : '') + '</div></div>';
    ['civil', 'mech'].forEach(function (k) {
      [['work', 'kaam'], ['labour', 'labour']].forEach(function (kk) {
        var rows = cat.filter(function (x) { return x.category === k && x.kind === kk[0]; });
        if (!rows.length) return;
        h += '<h4>' + CAT[k] + ' – ' + kk[1] + '</h4><div class="card scroll"><table><thead><tr><th>Naam</th><th>' + (kk[0] === 'work' ? 'Ikai' : '') + '</th><th class="n">Rate (₹)</th><th>Halat</th><th></th></tr></thead><tbody>' + rows.map(function (x) {
          return '<tr><td>' + esc(x.name) + '</td><td>' + esc(x.unit) + '</td><td class="n">' + (x.rate ? inr(x.rate) : '<span class="bad">tay nahi</span>') + '</td><td>' + (x.active === false ? '<span class="pill">band</span>' : '<span class="pill good">chalu</span>') + '</td><td><button class="btn sec sm" data-wact="wcatedit" data-id="' + esc(x.id) + '">Badlein</button> <button class="btn sec sm" data-wact="wcatdel" data-id="' + esc(x.id) + '">Hatayein</button></td></tr>';
        }).join('') + '</tbody></table></div>';
      });
    });
    return h;
  };

  /* ---------- events ---------- */
  function setF(k, v) { W.st.f[k] = v; }
  function formFromLog(l) {
    var f = { date: l.date, partyId: l.partyId, site: l.site, team: l.team, category: l.category, workId: l.workId, mode: l.mode, l: l.l == null ? '' : l.l, b: l.b == null ? '' : l.b, h: l.h == null ? '' : l.h, n: l.n == null ? '' : l.n, note: l.note || '', status: l.status || '', remark: l.remark || '' };
    (l.labour || []).forEach(function (x) { f['lab_' + x.id] = x.count; }); return f;
  }
  document.addEventListener('input', function (e) {
    var t = e.target, d = t.dataset || {};
    if (d.w) { if (d.w === 'mode') return; setF(d.w, t.value); if (d.w === 'site') { clearTimeout(W.st.pt); W.st.pt = setTimeout(fetchPrev, 350); } else W.refresh(); }
    else if (d.wm) W.st.mail[d.wm] = t.value;
  });
  document.addEventListener('change', function (e) {
    var t = e.target, d = t.dataset || {};
    if (d.w === 'mode') { setF('mode', t.value); W.refresh(); }
    else if (d.w === 'category') { setF('category', t.value); setF('workId', ''); (function () { var c0 = W.host.ctx(), p0 = c0.parties.filter(function (p) { return p.id === W.st.f.partyId; })[0]; if (p0 && p0.category && p0.category !== t.value) setF('partyId', ''); })(); W.host.render(); }
    else if (d.w === 'partyId' || d.w === 'date' || d.w === 'workId') { setF(d.w, t.value); W.host.render(); fetchPrev(); }
    else if (d.w === 'status' || d.w === 'reprice') { setF(d.w, d.w === 'reprice' ? t.checked : t.value); if (d.w === 'reprice') W.refresh(); }
    else if (d.w === 'site') { setF('site', t.value); fetchPrev(); }
    else if (d.wf) { W.st.af[d.wf] = t.value; W.host.render(); }
    else if (d.wm) { W.st.mail[d.wm] = t.value; }
    else if (d.wc) { var c = W.st.cat = W.st.cat || {}; c[d.wc] = t.value; }
  });
  document.addEventListener('input', function (e) { var d = e.target.dataset || {}; if (d.wc) { var c = W.st.cat = W.st.cat || {}; c[d.wc] = e.target.value; } });
  function msg(t, id) { var m = $('#' + (id || 'wmsg')); if (m) m.textContent = t || ''; else if (t) P.toast(t); }
  var ACT = {
    wnew: function () { var c = W.host.ctx(); W.st.f = { date: c.today, mode: 'cum', category: 'civil', partyId: c.parties.length === 1 ? c.parties[0].id : '' }; W.st.editId = null; W.st.prev = null; W.st.snap = null; W.st.open = true; W.host.render(); window.scrollTo(0, 0); },
    wedit: function (b) { var l = W.host.logs().filter(function (x) { return x.id === b.dataset.id; })[0]; if (!l) return; W.st.f = formFromLog(l); W.st.editId = l.id; W.st.snap = null; W.st.open = true; W.st.rev = null; W.host.render(); fetchPrev(); window.scrollTo(0, 0); },
    wrev: function (b) { var l = W.host.logs().filter(function (x) { return x.id === b.dataset.id; })[0]; if (!l) return; W.st.f = formFromLog(l); W.st.editId = l.id; W.st.snap = { rate: l.rate, labour: {} }; (l.labour || []).forEach(function (x) { W.st.snap.labour[x.id] = x.rate; }); W.st.rev = l.id; W.st.open = false; W.host.render(); fetchPrev(); var p = $('#wform'); if (p) p.scrollIntoView({ block: 'center' }); },
    wcancel: function () { W.st.open = false; W.st.rev = null; W.st.editId = null; W.host.render(); },
    wsave: async function (b) {
      var p = W.payload(); msg('');
      if (!p.partyId) return msg('Party chuniye'); if (!p.site) return msg('Jagah likhein'); if (!p.team) return msg('Team ka naam likhein'); if (!p.workId) return msg('Kaam chuniye');
      var o = calc(); if (o.tot == null) return msg('Naap likhein'); if (!(o.qty > 0)) return msg('Aaj ka kaam 0 se zyada hona chahiye. Aaj tak ka kul kal se zyada likhein.'); if (!o.people) return msg('Kam se kam 1 labour likhein');
      if (W.host.admin) { p.status = W.st.f.status || ''; p.remark = W.st.f.remark || ''; }
      b.disabled = true; try { await W.host.save(p, o); W.st.open = false; W.st.rev = null; W.st.editId = null; } catch (x) { b.disabled = false; msg(x.message); }
    },
    wdel: async function (b) { if (!window.confirm('Ye entry hata dein?')) return; try { await W.host.del(b.dataset.id); W.st.open = false; W.st.rev = null; W.st.editId = null; } catch (x) { P.toast(x.message); } },
    wxl: function () { W.host.excel(W.filtered(W.host.logs())); },
    wmailopen: function () { var m = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10); W.st.mail = { partyId: W.st.af.party || '', from: m.slice(0, 7) + '-01', to: m }; W.host.render(); },
    wmailclose: function () { W.st.mail = null; W.host.render(); },
    wmailsend: async function (b) { var m = W.st.mail; if (!m.partyId) return msg('Party chuniye'); b.disabled = true; try { var r = await W.host.call('work-mail', m); P.toast('Email bhej di (' + r.sent + ' entry, kul ' + inr(r.total) + ')'); W.st.mail = null; W.host.render(); } catch (x) { b.disabled = false; msg(x.message); } },
    wcatedit: function (b) { var x = (W.host.ctx().catalog || []).filter(function (y) { return y.id === b.dataset.id; })[0]; if (x) { W.st.cat = Object.assign({}, x); W.host.render(); var el = $('[data-wc="name"]'); if (el) el.scrollIntoView({ block: 'center' }); } },
    wcatnew: function () { W.st.cat = null; W.host.render(); },
    wcatsave: async function (b) { var c = W.st.cat || {}; b.disabled = true; try { await W.host.catSave({ id: c.id, kind: c.kind || 'work', category: c.category || 'civil', name: c.name, unit: c.unit || '', rate: c.rate === '' || c.rate == null ? 0 : c.rate, active: c.active !== false }); W.st.cat = null; } catch (x) { b.disabled = false; msg(x.message, 'wcmsg'); } },
    wcatdel: async function (b) { if (!window.confirm('Ye list se hata dein? Purani entry me iska naam bana rahega.')) return; try { await W.host.catDel(b.dataset.id); } catch (x) { P.toast(x.message); } },
    wseed: async function () { try { await W.host.seed(); } catch (x) { P.toast(x.message); } }
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-wact]'); if (!b || !ACT[b.dataset.wact] || !W.host) return;
    Promise.resolve(ACT[b.dataset.wact](b)).catch(function (x) { P.toast(x.message || String(x)); });
  });
  W.ACT = ACT;
  window.A2ZWork = W;
})();
