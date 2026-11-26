/* FILE: master.js  (GitHub par isi naam se upload karein) */
/* A2Z Build Tech - POORA DASHBOARD (sirf admin panel): shuru se aaj tak sab kuch ek jagah. Sirf dikhata hai. */
(function () {
  'use strict';
  var P = window.P, esc = P.esc, M = {}, PAGE = 100;
  var TYPES = [['party', 'Party'], ['staff', 'Staff'], ['cand', 'Candidate'], ['hazri', 'Hazri'], ['advance', 'Advance'], ['payment', 'Payment'], ['receipt', 'Party se mila'], ['expense', 'Kharch'], ['work', 'Daily Kaam'], ['duty', 'Duty'], ['request', 'Request'], ['reminder', 'Reminder'], ['log', 'Admin log']];
  var TLAB = {}; TYPES.forEach(function (t) { TLAB[t[0]] = t[1]; });
  var inr = function (n) { return P.inr ? P.inr(n) : '₹' + (Number(n) || 0).toLocaleString('en-IN'); };

  /* ---------- filter ---------- */
  M.filter = function (d, st) {
    var q = String(st.q || '').toLowerCase().trim(), toks = q ? q.split(/\s+/) : [];
    return d.entries.filter(function (e) {
      if (st.type && e.t !== st.type) return false;
      if (st.from && e.d < st.from) return false;
      if (st.to && e.d > st.to) return false;
      if (!toks.length) return true;
      var h = e._h || (e._h = (e.title + ' ' + e.party + ' ' + e.who + ' ' + e.note + ' ' + TLAB[e.t] + ' ' + e.d).toLowerCase());
      return toks.every(function (t) { return h.indexOf(t) >= 0; });
    });
  };
  M.results = function (d, st) {
    var list = M.filter(d, st), pages = Math.max(1, Math.ceil(list.length / PAGE)), pg = Math.min(Math.max(0, st.page || 0), pages - 1), rows = list.slice(pg * PAGE, pg * PAGE + PAGE);
    return '<div class="card scroll"><div class="sm mu">' + list.length + ' entry mili' + (list.length > PAGE ? ' (dikha rahe: ' + (pg * PAGE + 1) + '-' + (pg * PAGE + rows.length) + ')' : '') + '</div><table><thead><tr><th>Tarikh</th><th>Prakar</th><th>Vivaran</th><th>Party</th><th>Kisne</th><th class="n">Rakam / ginti</th><th>Note</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (e) { return '<tr><td>' + (e.d ? P.dd(e.d) : '-') + '</td><td><span class="pill">' + esc(TLAB[e.t] || e.t) + '</span></td><td>' + esc(e.title) + '</td><td>' + esc(e.party) + '</td><td>' + esc(e.who) + '</td><td class="n">' + (e.amt == null ? '' : (e.t === 'hazri' ? e.amt + ' din' : e.t === 'duty' ? e.amt + ' ghante' : e.t === 'request' ? esc(e.amt) : inr(e.amt))) + '</td><td class="sm">' + esc(e.note) + '</td></tr>'; }).join('') : '<tr><td colspan="7" class="mu">Is filter me koi entry nahi.</td></tr>') + '</tbody></table></div>' +
      (pages > 1 ? '<div class="row noprint"><button class="btn sm sec" data-act="mpage" data-n="' + (pg - 1) + '"' + (pg ? '' : ' disabled') + '>Pichhla</button><span class="sm mu">Page ' + (pg + 1) + ' / ' + pages + '</span><button class="btn sm sec" data-act="mpage" data-n="' + (pg + 1) + '"' + (pg < pages - 1 ? '' : ' disabled') + '>Agla</button></div>' : '');
  };

  /* ---------- graph: mahine-wise bill aur mila ---------- */
  function chart(rows) {
    if (rows.length < 2) return '';
    var show = rows.slice(-24), W = 720, H = 190, pl = 8, pb = 22, max = 1; show.forEach(function (r) { max = Math.max(max, r.bill, r.received); });
    var bw = Math.max(4, Math.floor((W - pl * 2) / show.length / 2.6)), gap = (W - pl * 2) / show.length, o = '';
    show.forEach(function (r, i) {
      var x = pl + i * gap, h1 = Math.round((H - pb) * r.bill / max), h2 = Math.round((H - pb) * r.received / max);
      o += '<rect class="mc-b" x="' + x + '" y="' + (H - pb - h1) + '" width="' + bw + '" height="' + h1 + '"><title>' + esc(r.m) + ' bill ' + inr(r.bill) + '</title></rect>' +
        '<rect class="mc-r" x="' + (x + bw + 1) + '" y="' + (H - pb - h2) + '" width="' + bw + '" height="' + h2 + '"><title>' + esc(r.m) + ' mila ' + inr(r.received) + '</title></rect>';
      if (show.length <= 14 || i % 2 === 0) o += '<text class="mc-t" x="' + x + '" y="' + (H - 6) + '">' + esc(r.m.slice(2)) + '</text>';
    });
    return '<div class="card"><h4>Mahine-wise: company bill aur party se mila</h4><div class="scroll"><svg class="mchart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Mahine-wise bill aur mila"><line class="mc-ax" x1="0" y1="' + (H - pb) + '" x2="' + W + '" y2="' + (H - pb) + '"/>' + o + '</svg></div><div class="sm"><span class="mc-key mc-kb"></span> Company bill &nbsp; <span class="mc-key mc-kr"></span> Party se mila</div></div>';
  };

  /* ---------- poora screen ---------- */
  M.html = function (d, st) {
    var T = d.totals, Mo = d.money, C = d.counts;
    var kp = function (l, v, n) { return '<div class="card"><span class="lbl">' + l + '</span><span class="kpi">' + v + '</span>' + (n ? '<span class="xs mu">' + n + '</span>' : '') + '</div>'; };
    var counts = {}; d.entries.forEach(function (e) { counts[e.t] = (counts[e.t] || 0) + 1; });
    var h = '<div class="row between"><h2>Poora Dashboard</h2><div class="row"><button class="btn sec" data-act="mrefresh">Taza karein</button><button class="btn sec" data-act="xmaster">Excel (sab)</button></div></div>';
    h += '<div class="note">Shuru se aaj tak ka sab kuch ek jagah: ' + C.months + ' mahine ka hisaab aur ' + d.totalEntries + ' entry' + (d.capped ? ' (sabse nayi ' + d.entries.length + ' dikha rahe, poori ke liye Excel / mahine ka tab dekhein)' : '') + '. Ye sirf dekhne ke liye hai; badalne ke liye us entry wale tab me jayein.</div>';
    h += '<h3>Kul jod (shuru se aaj tak)</h3><div class="cards">' +
      kp('Company ka kul bill', inr(T.bill), 'party ko jo bill bana') + kp('Labour ki kul payment', inr(T.pay), 'hazri ke hisaab se') + kp('Margin (bill - payment)', inr(T.margin)) + kp('Staff ko commission', inr(T.commission)) +
      kp('Owners ka munafa', inr(T.profit), 'kharch ke baad') + kp('Party se mila', inr(Mo.receiptsAll)) + kp('Party se baaki', inr(T.due), 'mahine-wise baaki ka jod') + kp('Labour ko chukaya', inr(Mo.paidCand)) +
      kp('Staff ko chukaya', inr(Mo.paidStaff)) + kp('Advance diya', inr(Mo.advCand + Mo.advStaff), 'labour ' + inr(Mo.advCand) + ' · staff ' + inr(Mo.advStaff)) + kp('Daily Kaam ki keemat', inr(Mo.workValue), 'labour kharch ' + inr(Mo.workCost) + ' · munafa ' + inr(Mo.workProfit)) + kp('Kul hazri (din)', String(T.days)) + '</div>';
    h += '<h3>Abhi kya-kya hai</h3><div class="cards">' + kp('Party', C.partiesActive + ' chalu', 'kul ' + C.parties) + kp('Staff', C.staffActive + ' chalu', 'kul ' + C.staff) + kp('Candidates', C.candidatesActive + ' chalu', 'kul ' + C.candidates + (C.candidatesPending ? ' · approval baaki ' + C.candidatesPending : '')) +
      kp('Abhi duty par', String(C.dutyLive), 'staff') + kp('Requests', String(C.requestsOpen) + ' baaki', 'kul ' + C.requests) + '</div>';
    h += chart(d.months);
    h += '<h3>Mahine-wise hisaab</h3><div class="card scroll"><table><thead><tr><th>Mahina</th><th class="n">Hazri (din)</th><th class="n">Company bill</th><th class="n">Labour payment</th><th class="n">Margin</th><th class="n">Staff commission</th><th class="n">Kharch + fixed</th><th class="n">Owners ka munafa</th><th class="n">Milna chahiye</th><th class="n">Mil chuka</th><th class="n">Baaki</th><th class="n">Daily Kaam</th></tr></thead><tbody>' +
      (d.months.length ? d.months.slice().reverse().map(function (r) { return '<tr><td>' + esc(P.monthName ? P.monthName(r.m) : r.m) + '</td><td class="n">' + r.days + '</td><td class="n">' + inr(r.bill) + '</td><td class="n">' + inr(r.pay) + '</td><td class="n">' + inr(r.margin) + '</td><td class="n">' + inr(r.commission) + '</td><td class="n">' + inr(r.expenses) + '</td><td class="n">' + inr(r.profit) + '</td><td class="n">' + inr(r.receivable) + '</td><td class="n">' + inr(r.received) + '</td><td class="n">' + inr(r.due) + '</td><td class="n">' + inr(r.workValue) + '</td></tr>'; }).join('') : '<tr><td colspan="12" class="mu">Abhi koi mahine ka hisaab nahi.</td></tr>') +
      '</tbody></table></div>';
    h += '<h3>Sab entry (shuru se aaj tak)</h3><div class="card"><div class="row mchips">' + '<button class="chip' + (st.type ? '' : ' on') + '" data-act="mtype" data-id="">Sab (' + d.entries.length + ')</button>' +
      TYPES.filter(function (t) { return counts[t[0]]; }).map(function (t) { return '<button class="chip' + (st.type === t[0] ? ' on' : '') + '" data-act="mtype" data-id="' + t[0] + '">' + t[1] + ' (' + counts[t[0]] + ')</button>'; }).join('') + '</div>' +
      '<div class="grid"><label>Khojein (naam, party, rakam, kuch bhi)<input id="mq" type="search" autocomplete="off" value="' + esc(st.q || '') + '" placeholder="jaise: Ram advance"></label><label>Tarikh se<input type="date" data-m="from" value="' + esc(st.from || '') + '"></label><label>Tarikh tak<input type="date" data-m="to" value="' + esc(st.to || '') + '"></label></div></div>' +
      '<div id="mres">' + M.results(d, st) + '</div>';
    return h;
  };

  /* ---------- Excel ---------- */
  M.sheets = function (d, st) {
    var list = M.filter(d, st), ent = [['Tarikh', 'Prakar', 'Vivaran', 'Party', 'Kisne', 'Rakam / ginti', 'Note']];
    list.forEach(function (e) { ent.push([e.d, TLAB[e.t] || e.t, e.title, e.party, e.who, e.amt == null ? '' : e.amt, e.note]); });
    var mo = [['Mahina', 'Hazri (din)', 'Company bill', 'Labour payment', 'Margin', 'Staff commission', 'Kharch + fixed', 'Owners ka munafa', 'Milna chahiye', 'Mil chuka', 'Baaki', 'Daily Kaam']];
    d.months.forEach(function (r) { mo.push([r.m, r.days, r.bill, r.pay, r.margin, r.commission, r.expenses, r.profit, r.receivable, r.received, r.due, r.workValue]); });
    var T = d.totals, Mo = d.money, kj = [['Vivaran', 'Rakam']];
    [['Company ka kul bill', T.bill], ['Labour ki kul payment', T.pay], ['Margin', T.margin], ['Staff ko commission', T.commission], ['Owners ka munafa', T.profit], ['Party se mila', Mo.receiptsAll], ['Party se baaki', T.due], ['Labour ko chukaya', Mo.paidCand], ['Staff ko chukaya', Mo.paidStaff], ['Advance (labour)', Mo.advCand], ['Advance (staff)', Mo.advStaff], ['Daily Kaam ki keemat', Mo.workValue], ['Daily Kaam: labour kharch', Mo.workCost], ['Daily Kaam: munafa', Mo.workProfit]].forEach(function (x) { kj.push(x); });
    return [{ name: 'Kul jod', rows: kj, widths: [34, 18], title: 'Overall Business Summary (Since Start)', totalHeaders: [] },
      { name: 'Mahine-wise', rows: mo, widths: [12, 12, 16, 16, 14, 16, 16, 18, 16, 14, 14, 14], title: 'Month-wise Business Summary' },
      { name: 'Sab entries', rows: ent, widths: [12, 16, 56, 22, 18, 16, 40], title: 'All Entries Register (Since Start)', totalHeaders: [] }];
  };
  window.A2ZMaster = M;
})();
