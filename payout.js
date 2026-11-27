/* FILE: payout.js  (GitHub par isi naam se upload karein) - hisaab ka engine, Apps Script wale A2Z_Payout.gs jaisa hi */
/*
 * A2Z Build Tech - payout engine
 * Pure functions: attendance + rates in, bills, wages, commissions, GST and
 * owners' shares out. Used by the server (source of truth) and by the tests.
 *
 * Money is rounded to paise on every line, and totals add the rounded lines,
 * so the numbers on screen always add up exactly.
 *
 * Model (all percentages are settings, nothing is hard wired):
 *   company bill      = bill rate x days / basis days      (perDay setting: rate is per day, basis = 1)
 *   candidate wage    = pay rate  x days / basis days
 *   margin            = bill - wage
 *   company bonus     = bill x party bill %            (e.g. 5% of total bill)
 *   pool              = margin + bonus
 *   staff commission  = depends on the option the admin chose for that staff (commMode):
 *       percent -> pool x staff %            (e.g. 40%)
 *       fixed   -> fixed rupees per candidate per day, trade by trade (e.g. fitter 200, welder 150)
 *       none    -> no share (admin's own candidates; admin alone decides rate and agreement)
 *       (blank) -> not chosen yet: 0 and a warning, nothing is assumed
 *   GST on commission = commission x GST %             (deducted from the staff)
 *   firm share        = pool - staff commission
 *   GST on firm share = firm share x firm GST %
 *   owners' profit    = firm share - firm GST - supervisor fixed pay
 *                       - office salaries - other expenses
 *   each owner        = owners' profit x share weight / total weights
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.A2ZPayout = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULTS = { commissionPct: 40, gstPct: 18, billPct: 5, basisDays: 26, gstFirmPct: 18, payDays: 15, perDay: 0 };

  function num(x, d) { x = parseFloat(x); return isFinite(x) ? x : (d == null ? 0 : d); }
  function nn(x, d) { x = num(x, d); return x < 0 ? 0 : x; }
  function has(x) { return x !== null && x !== undefined && x !== ''; }
  function r2(x) { return Math.round((x + (x >= 0 ? 1e-9 : -1e-9)) * 100) / 100; }
  function sum(list, f) {
    var p = 0;
    list.forEach(function (x) { p += Math.round((f ? f(x) : x) * 100); });
    return p / 100;
  }
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' '); }
  function validMonth(m) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(m)); }
  function monthEnd(m) {   // 'YYYY-MM' -> 'YYYY-MM-DD' of the last day
    var y = +m.slice(0, 4), mo = +m.slice(5, 7), d = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    return m + '-' + (d < 10 ? '0' : '') + d;
  }
  function addDays(iso, n) {
    var d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000); }

  /* commission option of a staff: percent | fixed | none | '' (not chosen yet) */
  function modeOf(st) { var m = st && st.commMode; return (m === 'percent' || m === 'fixed' || m === 'none') ? m : ''; }
  function findFixed(st, trade) {
    var t = norm(trade), list = (st && st.fixedRates) || [];
    for (var i = 0; i < list.length; i++) if (norm(list[i].trade) === t && has(list[i].rate)) return nn(list[i].rate);
    return null;
  }
  function findRate(party, trade) {
    var t = norm(trade), list = (party && party.rates) || [];
    for (var i = 0; i < list.length; i++) if (norm(list[i].trade) === t) return list[i];
    return null;
  }

  /* split an amount by weights; the leftover paise go to the first people so the total is exact */
  function splitByWeight(total, weights) {
    var w = weights.map(function (x) { return nn(x, 0); }), tw = w.reduce(function (a, b) { return a + b; }, 0);
    if (!w.length) return [];
    if (tw <= 0) { w = w.map(function () { return 1; }); tw = w.length; }
    var tp = Math.round(total * 100), out = w.map(function (x) { return Math.floor(tp * x / tw); });
    var left = tp - out.reduce(function (a, b) { return a + b; }, 0);
    if (tp < 0) { out = w.map(function (x) { return Math.ceil(tp * x / tw); }); left = tp - out.reduce(function (a, b) { return a + b; }, 0); }
    var step = left > 0 ? 1 : -1, i = 0;
    while (left !== 0) { out[i % out.length] += step; left -= step; i++; }
    return out.map(function (x) { return x / 100; });
  }

  function compute(inp) {
    var month = inp.month;
    if (!validMonth(month)) throw new Error('month must look like 2026-11');
    var S = Object.assign({}, DEFAULTS, inp.settings || {});
    ['commissionPct', 'gstPct', 'billPct', 'gstFirmPct'].forEach(function (k) { S[k] = Math.min(nn(S[k], DEFAULTS[k]), 100); });
    S.basisDays = nn(S.basisDays, 26) > 0 ? nn(S.basisDays, 26) : 26;
    S.payDays = Math.floor(nn(S.payDays, 15));
    var parties = inp.parties || [], staff = inp.staff || [], cands = inp.candidates || [];
    var att = inp.attendance || {}, expenses = inp.expenses || [], partners = inp.partners || [], receipts = inp.receipts || [];
    var asOf = inp.asOf || null;
    var pById = {}, sById = {};
    parties.forEach(function (p) { pById[p.id] = p; });
    staff.forEach(function (s) { sById[s.id] = s; });

    var warnings = [], lines = [], modeWarned = {}, commToWarned = {}, modelWarned = {};
    /* kaam ka tarika: party.model = 'labour' (labour supply, payment party tay karti hai, hume commission) | 'measure' (naap / wazan / length ka kaam:
       labour ki payment hum tay karte hain, party ko bill kaam ki keemat (Daily Kaam) se banta hai) | '' (tay nahi = purana tarika: hazri x rate). */
    var workValue = inp.workValue || {}, dutyDays = inp.dutyDays || {}, alloc = {};
    parties.forEach(function (p) {
      if (p.model !== 'measure') return;
      var wv = r2(nn(workValue[p.id], 0)), mine = cands.filter(function (c) { return c.partyId === p.id; }).map(function (c) { var r = att[c.id] && att[c.id][month]; return { id: c.id, days: r ? nn(r.days, 0) : 0 }; }).filter(function (x) { return x.days > 0; });
      if (wv > 0 && !mine.length) { warnings.push({ kind: 'mnodays', id: p.id, msg: p.name + ': is mahine kaam ki keemat ' + wv + ' hai par kisi candidate ki hazri nahi hai, isliye bill kisi ko nahi bata' }); return; }
      if (wv > 0) splitByWeight(wv, mine.map(function (x) { return x.days; })).forEach(function (v, i) { alloc[mine[i].id] = v; });
    });
    cands.forEach(function (c) {
      var party = pById[c.partyId];
      if (!party) { warnings.push({ kind: 'party', msg: c.name + ': party not found' }); return; }
      var st = c.staffId ? sById[c.staffId] : null;
      var card = findRate(party, c.trade);
      var measure = party.model === 'measure';
      var billRate = measure ? 0 : (has(c.billRate) ? nn(c.billRate) : (card ? nn(card.bill) : 0));
      var payRate = has(c.payRate) ? nn(c.payRate) : (card ? nn(card.pay) : 0);
      var active = c.status !== 'left';
      var rec = att[c.id] && att[c.id][month];
      var days = rec ? nn(rec.days, 0) : 0;
      var basis = S.perDay ? 1 : (has(party.basisDays) && nn(party.basisDays) > 0 ? nn(party.basisDays) : S.basisDays);   // perDay=1: rate seedha rupaye/din
      var f = days / basis;
      var partyPaid = party.model === 'labour' && party.labourPaidBy === 'party';   // party seedha labour ko payment deti hai; company ka bill sirf commission
      var bill = measure ? nn(alloc[c.id], 0) : r2(billRate * f), partyWage = r2(payRate * f), pay = partyPaid ? 0 : partyWage, margin = r2(bill - pay);
      if (measure && f > 0) billRate = r2(bill / f);
      var billPct = has(party.billPct) ? Math.min(nn(party.billPct), 100) : (party.model ? 0 : S.billPct);
      var bonus = r2(bill * billPct / 100), pool = r2(margin + bonus);
      var mode = st ? modeOf(st) : 'direct', pct = 0, fixedRate = null, comm = 0;
      /* party-wise commission: party.commTo = [staff id...] (admin ne chuna). Jo staff list me nahi, use is party se commission nahi jata. commTo tay nahi (purani party) = pehle jaisa, par chetavani. */
      /* STRICT: admin ne jab tak nahi chuna (commTo tay nahi), kisi staff ko commission nahi jata. */
      var restricted = Array.isArray(party.commTo), blocked = !!(st && !(restricted && party.commTo.indexOf(st.id) >= 0));
      if (st && !restricted && !commToWarned[party.id]) { commToWarned[party.id] = 1; warnings.push({ kind: 'commto', id: party.id, msg: party.name + ': is party ka commission kis staff ko jaye ye admin ne tay nahi kiya, isliye abhi kisi staff ko commission nahi ja raha' }); }
      if (blocked) { /* commission nahi: poora pool firm ka */ }
      else if (mode === 'percent') { pct = has(st.commissionPct) ? Math.min(nn(st.commissionPct), 100) : S.commissionPct; comm = r2(Math.max(pool, 0) * pct / 100); }
      else if (mode === 'fixed') {
        fixedRate = findFixed(st, c.trade);
        comm = fixedRate == null ? 0 : r2(fixedRate * f);
        if (days > 0 && fixedRate == null) warnings.push({ kind: 'fixedrate', id: c.id, msg: st.name + ': "' + c.trade + '" ka fixed rate tay nahi hai (' + c.name + ')' });
        if (days > 0 && comm > Math.max(pool, 0) + 0.004) warnings.push({ kind: 'commhigh', id: c.id, msg: c.name + ': fixed commission pool se zyada hai (firm ko ghata)' });
      }
      if (mode === '' && st && !modeWarned[st.id]) { modeWarned[st.id] = 1; warnings.push({ kind: 'commmode', id: st.id, msg: st.name + ': commission ka option (percent / fixed / koi nahi) abhi chuna nahi gaya, isliye commission 0 hai' }); }
      var gst = r2(comm * S.gstPct / 100), net = r2(comm - gst);
      if (!party.model && !modelWarned[party.id]) { modelWarned[party.id] = 1; warnings.push({ kind: 'model', id: party.id, msg: party.name + ': ye party kis tarah kaam deti hai (labour + commission / naap ka kaam) ye tay nahi hai' }); }
      if (party.model === 'labour' && has(c.payRate) && card && has(card.pay) && Math.abs(nn(c.payRate) - nn(card.pay)) > 0.004) warnings.push({ kind: 'partypay', id: c.id, msg: c.name + ': party ne ' + card.trade + ' ki payment ' + nn(card.pay) + ' tay ki hai, par candidate me ' + nn(c.payRate) + ' likha hai' });
      if (days > 0 && !card && !(measure ? has(c.payRate) : (has(c.billRate) && has(c.payRate)))) warnings.push({ kind: 'rate', id: c.id, msg: c.name + ' (' + c.trade + ', ' + party.name + '): rate card me rate nahi hai' });
      if (days > 31) warnings.push({ kind: 'days', id: c.id, msg: c.name + ': ' + days + ' din, 31 se zyada' });
      if (days > 0 && !measure && !partyPaid && payRate > billRate) warnings.push({ kind: 'loss', id: c.id, msg: c.name + ': wage company rate se zyada hai' });
      lines.push({
        id: c.id, name: c.name, trade: c.trade, partyId: c.partyId, partyName: party.name, staffId: c.staffId || null,
        staffName: st ? st.name : '', active: active, days: days, basis: basis, billRate: billRate, payRate: payRate,
        bill: bill, pay: pay, margin: margin, billPct: billPct, bonus: bonus, pool: pool,
        model: party.model || '', partyPaid: partyPaid, partyWage: partyPaid ? partyWage : 0, commMode: mode, fixedRate: fixedRate, pct: pct, commission: comm, gst: gst, net: net, commBlocked: blocked
      });
    });

    /* ---- by party ---- */
    var byParty = parties.map(function (p) {
      var pl = lines.filter(function (l) { return l.partyId === p.id; });
      var trades = {};
      pl.forEach(function (l) {
        if (!l.active) return;
        var k = norm(l.trade) || '-';
        var t = trades[k] || (trades[k] = { trade: l.trade || '-', count: 0, days: 0, bill: 0, pay: 0 });
        t.count++; t.days += l.days; t.bill = r2(t.bill + l.bill); t.pay = r2(t.pay + l.pay);
      });
      var tl = Object.keys(trades).map(function (k) { return trades[k]; }).sort(function (a, b) { return b.count - a.count; });
      var bill = sum(pl, function (l) { return l.bill; }), bonus = sum(pl, function (l) { return l.bonus; });
      var receivable = r2(bill + bonus), wv = p.model === 'measure' ? r2(nn(workValue[p.id], 0)) : 0;
      if (p.model === 'measure' && bill > 0 && sum(pl, function (l) { return l.pay; }) > bill + 0.004) warnings.push({ kind: 'mloss', id: p.id, msg: p.name + ': is mahine kaam ki keemat ' + bill + ' hai par labour ki payment ' + sum(pl, function (l) { return l.pay; }) + ' hai (ghata)' });
      var received = sum(receipts.filter(function (r) { return r.partyId === p.id && r.month === month; }), function (r) { return nn(r.amount); });
      var due = r2(receivable - received);
      var payDays = has(p.payDays) ? Math.floor(nn(p.payDays)) : S.payDays;
      var dueDate = addDays(monthEnd(month), payDays);
      var overdueDays = (asOf && due > 0 && daysBetween(dueDate, asOf) > 0) ? daysBetween(dueDate, asOf) : 0;
      return {
        id: p.id, name: p.name, phone: p.phone || '', model: p.model || '', workValue: wv, headcount: pl.filter(function (l) { return l.active; }).length,
        trades: tl, days: sum(pl, function (l) { return l.days; }), bill: bill, pay: sum(pl, function (l) { return l.pay; }),
        margin: sum(pl, function (l) { return l.margin; }), bonus: bonus, pool: sum(pl, function (l) { return l.pool; }),
        receivable: receivable, received: received, due: due, dueDate: dueDate, overdueDays: overdueDays
      };
    });

    /* staff ke candidate kin kin party me hain, party-wise commission ke saath */
    function partiesOf(sl) {
      var m = {}, order = [];
      sl.forEach(function (l) {
        var q = m[l.partyId] || (m[l.partyId] = { partyId: l.partyId, partyName: l.partyName, candidates: 0, days: 0, pay: 0, pool: 0, commission: 0, gst: 0, net: 0 }); if (order.indexOf(l.partyId) < 0) order.push(l.partyId);
        if (l.active) q.candidates++;
        q.days = r2(q.days + l.days); q.pay = r2(q.pay + l.pay); q.pool = r2(q.pool + l.pool); q.commission = r2(q.commission + l.commission); q.gst = r2(q.gst + l.gst); q.net = r2(q.net + l.net);
      });
      return order.map(function (k) { return m[k]; });
    }

    /* ---- by staff ---- */
    var byStaff = staff.map(function (s) {
      var sl = lines.filter(function (l) { return l.staffId === s.id; });
      var fixedFull = fixedPayFor(s, month), dutyBased = s.payBasis === 'duty', dd = dutyDays[s.id] || 0, perDay = S.basisDays > 0 ? r2(fixedFull / S.basisDays) : 0;
      var fixed = dutyBased ? r2(Math.min(fixedFull, perDay * dd)) : fixedFull;
      return {
        id: s.id, name: s.name, type: s.type || 'agent',
        commMode: modeOf(s), pct: modeOf(s) === 'percent' ? (has(s.commissionPct) ? Math.min(nn(s.commissionPct), 100) : S.commissionPct) : 0,
        fixedRates: modeOf(s) === 'fixed' ? (s.fixedRates || []).map(function (x) { return { trade: x.trade, rate: nn(x.rate) }; }) : [],
        parties: partiesOf(sl),
        candidates: sl.filter(function (l) { return l.active; }).length, days: sum(sl, function (l) { return l.days; }),
        pay: sum(sl, function (l) { return l.pay; }), bill: sum(sl, function (l) { return l.bill; }),
        margin: sum(sl, function (l) { return l.margin; }), bonus: sum(sl, function (l) { return l.bonus; }),
        pool: sum(sl, function (l) { return l.pool; }),
        commission: sum(sl, function (l) { return l.commission; }), gst: sum(sl, function (l) { return l.gst; }),
        net: sum(sl, function (l) { return l.net; }), fixed: fixed, fixedFull: fixedFull, fixedBasis: dutyBased ? 'duty' : 'full', dutyDays: dutyBased ? dd : null, perDay: dutyBased ? perDay : null
      };
    });

    /* ---- firm and owners ---- */
    var pool = sum(lines, function (l) { return l.pool; });
    var staffComm = sum(lines, function (l) { return l.commission; });
    var gstStaff = sum(lines, function (l) { return l.gst; });
    var firmShare = r2(pool - staffComm);
    var gstFirm = r2(Math.max(firmShare, 0) * S.gstFirmPct / 100);
    var fixedPay = sum(byStaff, function (s) { return s.fixed; });
    var mex = expenses.filter(function (e) { return e.month === month; });
    var office = sum(mex.filter(function (e) { return e.category === 'office'; }), function (e) { return nn(e.amount); });
    var other = sum(mex.filter(function (e) { return e.category !== 'office'; }), function (e) { return nn(e.amount); });
    var distributable = r2(firmShare - gstFirm - fixedPay - office - other);
    var shares = splitByWeight(distributable, partners.map(function (p) { return has(p.share) ? p.share : 1; }));
    var firm = {
      bill: sum(lines, function (l) { return l.bill; }), pay: sum(lines, function (l) { return l.pay; }),
      margin: sum(lines, function (l) { return l.margin; }), bonus: sum(lines, function (l) { return l.bonus; }),
      pool: pool, staffCommission: staffComm, gstOnStaff: gstStaff, staffNet: sum(lines, function (l) { return l.net; }),
      firmShare: firmShare, gstOnFirm: gstFirm, gstTotal: r2(gstStaff + gstFirm),
      fixedPay: fixedPay, officeSalaries: office, otherExpenses: other, distributable: distributable
    };
    var owners = partners.map(function (p, i) {
      return { id: p.id, name: p.name, role: p.role || '', phone: p.phone || '', share: has(p.share) ? nn(p.share) : 1, amount: shares[i] };
    });
    return { month: month, settings: S, lines: lines, byParty: byParty, byStaff: byStaff, firm: firm, owners: owners, warnings: warnings };
  }

  function fixedPayFor(s, month) {
    if (s.type === 'supplier') return 0;   // manpower supplier ko payment/salary nahi, sirf commission
    var f = nn(s.fixedPay, 0);
    if (!f || s.active === false) return 0;
    if (s.fixedFrom && /^\d{4}-\d{2}$/.test(s.fixedFrom) && s.fixedFrom > month) return 0;
    if (s.fixedTo && /^\d{4}-\d{2}$/.test(s.fixedTo) && s.fixedTo < month) return 0;
    return f;
  }

  return { DEFAULTS: DEFAULTS, compute: compute, r2: r2, sum: sum, norm: norm, splitByWeight: splitByWeight, validMonth: validMonth, monthEnd: monthEnd, addDays: addDays, findRate: findRate, modeOf: modeOf, findFixed: findFixed, fixedPayFor: fixedPayFor };
});

