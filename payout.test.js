/* node --test tests/payout.test.js
 * The first test is the worked example given by the owner (Ram, 10 candidates). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const P = require('./payout.js');

const MONTH = '2026-11';
const near = (a, b, e = 0.001) => assert.ok(Math.abs(a - b) <= e, `expected ${b}, got ${a}`);

/* rate card of "Party 1": what the company pays (bill) and what the candidate gets (pay), per month */
const party1 = {
  id: 'p1', name: 'Party 1', billPct: 5, basisDays: 26, payDays: 15,
  rates: [{ trade: 'Fitter', bill: 22000, pay: 20000 }, { trade: 'Welder', bill: 16000, pay: 15000 },
          { trade: 'Cutter', bill: 13000, pay: 12000 }, { trade: 'Helper', bill: 11000, pay: 10000 }]
};
const ram = { id: 's_ram', name: 'Ram', type: 'supplier', commissionPct: 40 };
const mk = (trade, n, staffId, start) => Array.from({ length: n }, (_, i) => ({ id: staffId + trade + (start || 0) + i, name: trade + ' ' + (i + 1), trade, partyId: 'p1', staffId }));
function ramCandidates() { return [].concat(mk('Fitter', 2, 's_ram'), mk('Welder', 2, 's_ram'), mk('Cutter', 3, 's_ram'), mk('Helper', 3, 's_ram')); }
function fullMonth(cands, days) { const a = {}; cands.forEach(c => { a[c.id] = { [MONTH]: { days: days == null ? 26 : days } }; }); return a; }
const partners3 = [{ id: 'a', name: 'Anak Patel', role: 'Owner', share: 1 }, { id: 'b', name: 'Shukhendra Mishra', role: 'Owner', share: 1 }, { id: 'c', name: 'Ram Gopal Patel', role: 'VP', share: 1 }];

test("owner's example: Ram supplies 10 candidates", () => {
  const c = ramCandidates();
  const r = P.compute({ month: MONTH, parties: [party1], staff: [ram], candidates: c, attendance: fullMonth(c), partners: partners3 });
  const f = r.firm;
  near(f.bill, 148000);             // 44000 + 32000 + 39000 + 33000
  near(f.pay, 136000);              // 40000 + 30000 + 36000 + 30000
  near(f.margin, 12000);            // 4000 + 2000 + 3000 + 3000
  near(f.bonus, 7400);              // 5% of the total bill
  near(f.pool, 19400);
  const s = r.byStaff[0];
  near(s.commission, 7760);         // 40% of 19400
  near(s.gst, 1396.8);              // 18% taken off Ram's commission
  near(s.net, 6363.2);
  // by trade, as in the owner's note
  const t = r.byParty[0].trades.reduce((m, x) => { m[x.trade] = x; return m; }, {});
  near(t.Fitter.bill, 44000); near(t.Fitter.pay, 40000);
  near(t.Welder.bill, 32000); near(t.Welder.pay, 30000);
  near(t.Cutter.bill, 39000); near(t.Cutter.pay, 36000);
  near(t.Helper.bill, 33000); near(t.Helper.pay, 30000);
  assert.strictEqual(r.byParty[0].headcount, 10);
});

test('firm waterfall and equal split among three owners', () => {
  const c = ramCandidates();
  const r = P.compute({ month: MONTH, parties: [party1], staff: [ram], candidates: c, attendance: fullMonth(c), partners: partners3 });
  const f = r.firm;
  near(f.firmShare, 11640);         // 19400 - 7760
  near(f.gstOnFirm, 2095.2);        // 18% of 11640
  near(f.gstTotal, 3492);           // 18% of the whole pool 19400
  near(f.distributable, 9544.8);
  near(r.owners.reduce((a, o) => a + o.amount, 0), 9544.8);
  r.owners.forEach(o => near(o.amount, 3181.6));
});

test('office salary, other expenses and supervisor fixed pay come off before the split', () => {
  const c = ramCandidates();
  const sup = { id: 's_sup', name: 'Supervisor', type: 'supervisor', fixedPay: 1000, commissionPct: 40 };
  const r = P.compute({
    month: MONTH, parties: [party1], staff: [ram, sup], candidates: c, attendance: fullMonth(c), partners: partners3,
    expenses: [{ month: MONTH, category: 'office', amount: 2000 }, { month: MONTH, category: 'other', amount: 500 }, { month: '2026-10', category: 'other', amount: 9999 }]
  });
  near(r.firm.fixedPay, 1000); near(r.firm.officeSalaries, 2000); near(r.firm.otherExpenses, 500);
  near(r.firm.distributable, 9544.8 - 3500);
  near(r.owners.reduce((a, o) => a + o.amount, 0), r.firm.distributable);
});

test('supervisor who also brings his own candidates earns 40% on them with GST taken off', () => {
  const sup = { id: 's_sup', name: 'Supervisor', type: 'supervisor', fixedPay: 15000, commissionPct: 40 };
  const own = [{ id: 'x1', name: 'Own Helper', trade: 'Helper', partyId: 'p1', staffId: 's_sup' }];
  const r = P.compute({ month: MONTH, parties: [party1], staff: [sup], candidates: own, attendance: fullMonth(own) });
  const s = r.byStaff[0];
  near(s.pool, 1000 + 550);         // margin 1000 + 5% of 11000
  near(s.commission, 620);
  near(s.gst, 111.6);
  near(s.net, 508.4);
  near(s.fixed, 15000);
});

test('part-month attendance prorates wage, bill and commission', () => {
  const c = [{ id: 'h1', name: 'Helper', trade: 'Helper', partyId: 'p1', staffId: 's_ram' }];
  const r = P.compute({ month: MONTH, parties: [party1], staff: [ram], candidates: c, attendance: fullMonth(c, 13) });
  const l = r.lines[0];
  near(l.bill, 5500); near(l.pay, 5000); near(l.margin, 500); near(l.bonus, 275); near(l.pool, 775); near(l.commission, 310);
});

test('zero attendance gives zero everything', () => {
  const c = ramCandidates();
  const r = P.compute({ month: MONTH, parties: [party1], staff: [ram], candidates: c, attendance: {}, partners: partners3 });
  near(r.firm.pool, 0); near(r.firm.distributable, 0);
  r.owners.forEach(o => near(o.amount, 0));
});

test('candidate without a staff member earns no commission (direct candidate)', () => {
  const c = [{ id: 'd1', name: 'Direct', trade: 'Fitter', partyId: 'p1', staffId: null }];
  const r = P.compute({ month: MONTH, parties: [party1], staff: [], candidates: c, attendance: fullMonth(c) });
  near(r.lines[0].commission, 0);
  near(r.firm.firmShare, r.firm.pool);
});

test('per-candidate rate override beats the rate card', () => {
  const c = [{ id: 'o1', name: 'Special', trade: 'Fitter', partyId: 'p1', staffId: 's_ram', billRate: 30000, payRate: 25000 }];
  const r = P.compute({ month: MONTH, parties: [party1], staff: [ram], candidates: c, attendance: fullMonth(c) });
  near(r.lines[0].bill, 30000); near(r.lines[0].pay, 25000);
});

test('trade name matching ignores case and spaces', () => {
  const c = [{ id: 't1', name: 'T', trade: '  fitter ', partyId: 'p1', staffId: null }];
  const r = P.compute({ month: MONTH, parties: [party1], staff: [], candidates: c, attendance: fullMonth(c) });
  near(r.lines[0].bill, 22000);
  assert.strictEqual(r.warnings.length, 0);
});

test('missing rate card is reported, not hidden', () => {
  const c = [{ id: 'm1', name: 'Mason', trade: 'Mason', partyId: 'p1', staffId: null }];
  const r = P.compute({ month: MONTH, parties: [party1], staff: [], candidates: c, attendance: fullMonth(c) });
  assert.ok(r.warnings.some(w => w.kind === 'rate'));
  near(r.lines[0].bill, 0);
});

test('warnings for more than 31 days and for wage above company rate', () => {
  const c = [{ id: 'w1', name: 'W', trade: 'Fitter', partyId: 'p1', staffId: null, payRate: 30000 }];
  const r = P.compute({ month: MONTH, parties: [party1], staff: [], candidates: c, attendance: fullMonth(c, 40) });
  assert.ok(r.warnings.some(w => w.kind === 'days'));
  assert.ok(r.warnings.some(w => w.kind === 'loss'));
});

test('a loss never creates a negative commission', () => {
  const c = [{ id: 'l1', name: 'L', trade: 'Fitter', partyId: 'p1', staffId: 's_ram', payRate: 30000 }];
  const r = P.compute({ month: MONTH, parties: [party1], staff: [ram], candidates: c, attendance: fullMonth(c) });
  assert.ok(r.lines[0].pool < 0);
  near(r.lines[0].commission, 0);
});

test('left candidates are not counted in headcount but old days still pay', () => {
  const c = [{ id: 'a1', name: 'A', trade: 'Helper', partyId: 'p1', staffId: null }, { id: 'a2', name: 'B', trade: 'Helper', partyId: 'p1', staffId: null, status: 'left' }];
  const r = P.compute({ month: MONTH, parties: [party1], staff: [], candidates: c, attendance: fullMonth(c) });
  assert.strictEqual(r.byParty[0].headcount, 1);
  near(r.byParty[0].bill, 22000);
});

test('totals always equal the sum of the displayed lines (no paise drift)', () => {
  const c = Array.from({ length: 37 }, (_, i) => ({ id: 'z' + i, name: 'Z' + i, trade: 'Helper', partyId: 'p1', staffId: 's_ram' }));
  const att = {}; c.forEach((x, i) => { att[x.id] = { [MONTH]: { days: 17 + (i % 7) + 0.5 } }; });
  const r = P.compute({ month: MONTH, parties: [party1], staff: [ram], candidates: c, attendance: att, partners: partners3 });
  const s = (k) => P.sum(r.lines, l => l[k]);
  near(r.firm.bill, s('bill'), 1e-9); near(r.firm.pay, s('pay'), 1e-9); near(r.byStaff[0].commission, s('commission'), 1e-9);
  near(r.firm.staffNet + r.firm.gstOnStaff, r.firm.staffCommission, 1e-9);
  near(r.owners.reduce((a, o) => a + o.amount, 0), r.firm.distributable, 1e-9);
  r.lines.forEach(l => { near(l.commission, l.net + l.gst, 1e-9); assert.strictEqual(Math.round(l.bill * 100), l.bill * 100 + 0 * 0 || Math.round(l.bill * 100)); });
});

test('splitByWeight is exact, handles unequal shares and zero weights', () => {
  assert.deepStrictEqual(P.splitByWeight(100, [1, 1, 1]), [33.34, 33.33, 33.33]);
  near(P.splitByWeight(100, [2, 1, 1]).reduce((a, b) => a + b, 0), 100, 1e-9);
  assert.deepStrictEqual(P.splitByWeight(90, [2, 1]), [60, 30]);
  assert.deepStrictEqual(P.splitByWeight(10, [0, 0]), [5, 5]);
  assert.deepStrictEqual(P.splitByWeight(-100, [1, 1, 1]).reduce((a, b) => Math.round((a + b) * 100) / 100, 0), -100);
  assert.deepStrictEqual(P.splitByWeight(0, [1, 1]), [0, 0]);
});

test('company receivable, receipts, due date and overdue days', () => {
  const c = ramCandidates();
  const input = { month: MONTH, parties: [party1], staff: [ram], candidates: c, attendance: fullMonth(c), receipts: [{ partyId: 'p1', month: MONTH, amount: 50000 }, { partyId: 'p1', month: '2026-10', amount: 1 }], asOf: '2026-12-10' };
  let r = P.compute(input).byParty[0];
  near(r.receivable, 155400);       // 148000 + 7400
  near(r.received, 50000); near(r.due, 105400);
  assert.strictEqual(r.dueDate, '2026-12-15');   // month end + 15 days
  assert.strictEqual(r.overdueDays, 0);
  input.asOf = '2026-12-20';
  r = P.compute(input).byParty[0];
  assert.strictEqual(r.overdueDays, 5);
  input.receipts = [{ partyId: 'p1', month: MONTH, amount: 155400 }];
  r = P.compute(input).byParty[0];
  near(r.due, 0); assert.strictEqual(r.overdueDays, 0);
});

test('settings change the result (commission 30%, GST 12%, bill 4%)', () => {
  const c = ramCandidates(); const p = Object.assign({}, party1, { billPct: null });
  const r = P.compute({ month: MONTH, settings: { billPct: 4 }, parties: [p], staff: [Object.assign({}, ram, { commissionPct: null })], candidates: c, attendance: fullMonth(c) });
  near(r.firm.bonus, 5920);
  const r2 = P.compute({ month: MONTH, settings: { commissionPct: 30, gstPct: 12 }, parties: [party1], staff: [Object.assign({}, ram, { commissionPct: null })], candidates: c, attendance: fullMonth(c) });
  near(r2.byStaff[0].commission, 5820); near(r2.byStaff[0].gst, 698.4);
});

test('supervisor fixed pay obeys start and end month and inactive flag', () => {
  const f = P.fixedPayFor;
  assert.strictEqual(f({ fixedPay: 100, fixedFrom: '2026-12' }, '2026-11'), 0);
  assert.strictEqual(f({ fixedPay: 100, fixedFrom: '2026-11' }, '2026-11'), 100);
  assert.strictEqual(f({ fixedPay: 100, fixedTo: '2026-10' }, '2026-11'), 0);
  assert.strictEqual(f({ fixedPay: 100, active: false }, '2026-11'), 0);
});

test('bad input never throws or gives NaN', () => {
  const r = P.compute({ month: MONTH, parties: [{ id: 'p', name: 'P', rates: [{ trade: 'x', bill: 'abc', pay: -5 }] }], staff: [{ id: 's', commissionPct: 'zz' }], candidates: [{ id: 'c', name: 'C', trade: 'x', partyId: 'p', staffId: 's' }, { id: 'd', name: 'D', trade: 'x', partyId: 'nope' }], attendance: { c: { [MONTH]: { days: 'many' } } }, partners: [{ id: 'q', share: 'x' }] });
  JSON.stringify(r, (k, v) => { if (typeof v === 'number') assert.ok(Number.isFinite(v), k); return v; });
  assert.throws(() => P.compute({ month: '2026-13' }));
  assert.throws(() => P.compute({}));
});
