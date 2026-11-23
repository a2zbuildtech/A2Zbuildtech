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
 *   staff commission  = pool x staff %                 (e.g. 40%)
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

    var warnings = [], lines = [];
    cands.forEach(function (c) {
      var party = pById[c.partyId];
      if (!party) { warnings.push({ kind: 'party', msg: c.name + ': party not found' }); return; }
      var st = c.staffId ? sById[c.staffId] : null;
      var card = findRate(party, c.trade);
      var billRate = has(c.billRate) ? nn(c.billRate) : (card ? nn(card.bill) : 0);
      var payRate = has(c.payRate) ? nn(c.payRate) : (card ? nn(card.pay) : 0);
      var active = c.status !== 'left';
      var rec = att[c.id] && att[c.id][month];
      var days = rec ? nn(rec.days, 0) : 0;
      var basis = S.perDay ? 1 : (has(party.basisDays) && nn(party.basisDays) > 0 ? nn(party.basisDays) : S.basisDays);   // perDay=1: rate seedha rupaye/din
      var f = days / basis;
      var bill = r2(billRate * f), pay = r2(payRate * f), margin = r2(bill - pay);
      var billPct = has(party.billPct) ? Math.min(nn(party.billPct), 100) : S.billPct;
      var bonus = r2(bill * billPct / 100), pool = r2(margin + bonus);
      var pct = st ? (has(st.commissionPct) ? Math.min(nn(st.commissionPct), 100) : S.commissionPct) : 0;
      var comm = r2(Math.max(pool, 0) * pct / 100), gst = r2(comm * S.gstPct / 100), net = r2(comm - gst);
      if (days > 0 && !card && !(has(c.billRate) && has(c.payRate))) warnings.push({ kind: 'rate', id: c.id, msg: c.name + ' (' + c.trade + ', ' + party.name + '): rate card me rate nahi hai' });
      if (days > 31) warnings.push({ kind: 'days', id: c.id, msg: c.name + ': ' + days + ' din, 31 se zyada' });
      if (days > 0 && payRate > billRate) warnings.push({ kind: 'loss', id: c.id, msg: c.name + ': wage company rate se zyada hai' });
      lines.push({
        id: c.id, name: c.name, trade: c.trade, partyId: c.partyId, partyName: party.name, staffId: c.staffId || null,
        staffName: st ? st.name : '', active: active, days: days, basis: basis, billRate: billRate, payRate: payRate,
        bill: bill, pay: pay, margin: margin, billPct: billPct, bonus: bonus, pool: pool,
        pct: pct, commission: comm, gst: gst, net: net
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
      var receivable = r2(bill + bonus);
      var received = sum(receipts.filter(function (r) { return r.partyId === p.id && r.month === month; }), function (r) { return nn(r.amount); });
      var due = r2(receivable - received);
      var payDays = has(p.payDays) ? Math.floor(nn(p.payDays)) : S.payDays;
      var dueDate = addDays(monthEnd(month), payDays);
      var overdueDays = (asOf && due > 0 && daysBetween(dueDate, asOf) > 0) ? daysBetween(dueDate, asOf) : 0;
      return {
        id: p.id, name: p.name, phone: p.phone || '', headcount: pl.filter(function (l) { return l.active; }).length,
        trades: tl, days: sum(pl, function (l) { return l.days; }), bill: bill, pay: sum(pl, function (l) { return l.pay; }),
        margin: sum(pl, function (l) { return l.margin; }), bonus: bonus, pool: sum(pl, function (l) { return l.pool; }),
        receivable: receivable, received: received, due: due, dueDate: dueDate, overdueDays: overdueDays
      };
    });

    /* ---- by staff ---- */
    var byStaff = staff.map(function (s) {
      var sl = lines.filter(function (l) { return l.staffId === s.id; });
      var fixed = fixedPayFor(s, month);
      return {
        id: s.id, name: s.name, type: s.type || 'agent',
        pct: has(s.commissionPct) ? Math.min(nn(s.commissionPct), 100) : S.commissionPct,
        candidates: sl.filter(function (l) { return l.active; }).length, days: sum(sl, function (l) { return l.days; }),
        pay: sum(sl, function (l) { return l.pay; }), bill: sum(sl, function (l) { return l.bill; }),
        margin: sum(sl, function (l) { return l.margin; }), bonus: sum(sl, function (l) { return l.bonus; }),
        pool: sum(sl, function (l) { return l.pool; }),
        commission: sum(sl, function (l) { return l.commission; }), gst: sum(sl, function (l) { return l.gst; }),
        net: sum(sl, function (l) { return l.net; }), fixed: fixed
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
    var f = nn(s.fixedPay, 0);
    if (!f || s.active === false) return 0;
    if (s.fixedFrom && /^\d{4}-\d{2}$/.test(s.fixedFrom) && s.fixedFrom > month) return 0;
    if (s.fixedTo && /^\d{4}-\d{2}$/.test(s.fixedTo) && s.fixedTo < month) return 0;
    return f;
  }

  return { DEFAULTS: DEFAULTS, compute: compute, r2: r2, sum: sum, norm: norm, splitByWeight: splitByWeight, validMonth: validMonth, monthEnd: monthEnd, addDays: addDays, findRate: findRate, fixedPayFor: fixedPayFor };
});

