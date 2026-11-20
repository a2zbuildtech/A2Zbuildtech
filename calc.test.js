/* Run with:  node --test tests/
 * Every expected number below was worked out by hand (see Book, chapter 5 and 6). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const C = require('./calc.js');
const D = require('./data.js');

const base = D.defaults();
const rate = id => (base.mats.find(m => m.id === id) || { rate: 0 }).rate;
const calc = id => C.CALCS.find(c => c.id === id);
const defaultsOf = c => { const v = {}; c.f.forEach(f => { v[f.k] = f.d; }); return v; };
const run = (id, over) => calc(id).run(Object.assign(defaultsOf(calc(id)), over || {}), rate);
const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `expected ${b}, got ${a}`);

test('concrete 5 x 3 x 0.15 m, M20', () => {
  const r = run('concrete');
  near(r[0].qty, 2.25);
  assert.strictEqual(r[1].qty, 19);            // 18.15 bags rounded up
  near(r[2].qty, 0.945, 0.001);                // sand m3
  near(r[3].qty, 1.89, 0.001);                 // aggregate m3
  assert.strictEqual(r[1].amt, 19 * 390);
});

test('concrete M20 needs about 8 bags per m3', () => {
  const r = run('concrete', { l: 1, b: 1, h: 1 });
  near(r[1].qty, 9, 0);                        // 8.07 rounds up to 9
  near(1.54 * (1 / 5.5) / C.BAG, 8.07, 0.01);
});

test('brickwork 10 x 3 m, 230 mm, 4 m2 openings, 1:6', () => {
  const r = run('brick');
  near(r[0].qty, 26);
  near(r[1].qty, 5.98);
  assert.strictEqual(r[2].qty, 3140);          // 3139.5 rounded up
  assert.strictEqual(r[3].qty, 8);             // 7.19 bags rounded up
  near(r[4].qty, 1.4975, 0.001);
});

test('plaster 60 m2, 12 mm, 1:4', () => {
  const r = run('plaster');
  near(r[1].qty, 0.9144, 0.0001);
  assert.strictEqual(r[2].qty, 6);             // 5.27 bags
  near(r[3].qty, 0.7315, 0.001);
});

test('steel 12 mm x 6 m x 50 bars, 5% wastage', () => {
  const r = run('steel');
  near(r[0].qty, 0.8889, 0.0001);
  near(r[1].qty, 300);
  near(r[2].qty, 280.0, 0.01);
  near(r[2].amt, 280 * 65, 1);
});

test('tiles 4 x 3.5 m, 600 x 600, 10% wastage', () => {
  const r = run('tile');
  near(r[0].qty, 14);
  near(r[1].qty, 165.7656, 0.001);
  assert.strictEqual(r[2].qty, 43);
});

test('paint 150 m2, 2 coats, 11 m2 per litre', () => {
  const r = run('paint');
  assert.strictEqual(r[1].qty, 28);            // 27.27 litres
});

test('excavation 12 x 8 x 1.5 m', () => {
  const r = run('excav');
  near(r[0].qty, 144);
  near(r[1].qty, 180);
  near(r[0].amt, 144 * 180);
});

test('totals add labour and margin on material', () => {
  const t = C.totals(run('concrete'), 30);
  near(t.lab, t.mat * 0.3, 0.001);
  near(t.total, t.mat * 1.3, 0.001);
});

test('BOQ sample: 208400 work value', () => {
  const t = C.boqTotals([{ q: 40, r: 180 }, { q: 6, r: 5200 }, { q: 25, r: 6800 }], { oh: 10, pr: 10, gst: 18 });
  near(t.sub, 208400);
  near(t.oh, 20840);
  near(t.pr, 22924);
  near(t.taxable, 252164);
  near(t.gst, 45389.52);
  near(t.total, 297553.52);
});

test('manpower sample: 2 masons + 4 helpers, 26 days', () => {
  const t = C.mpTotals([{ t: 'mason', n: 2, d: 26, ot: 0 }, { t: 'helper', n: 4, d: 26, ot: 0 }], base.labour, { ot: 2, svc: 10, gst: 18 });
  near(t.wages, 98800);
  near(t.svc, 9880);
  near(t.gst, 19562.4);
  near(t.total, 128242.4);
  near(t.manDays, 156);
  near(t.perManDay, 822.07);
});

test('manpower overtime: 1 mason, 10 OT hours, double rate', () => {
  const t = C.mpTotals([{ t: 'mason', n: 1, d: 1, ot: 10 }], base.labour, { ot: 2, svc: 0, gst: 0 });
  near(t.ot, 10 * (800 / 8) * 2);              // 2000
});

test('bill: 5 lakh gross', () => {
  const b = C.billNet({ g: 500000, gst: 18, tds: 2, ret: 5, adv: 0, oth: 0 });
  near(b.gst, 90000); near(b.tds, 10000); near(b.ret, 25000); near(b.net, 555000);
  assert.strictEqual(b.short, false);
});

test('bill: deductions larger than the bill are flagged', () => {
  const b = C.billNet({ g: 1000, gst: 0, tds: 0, ret: 0, adv: 5000, oth: 0 });
  assert.strictEqual(b.short, true);
});

/* ---------- hostile and broken input ---------- */
test('negative, text and empty inputs become zero and never throw', () => {
  const junk = { l: -5, b: 'abc', h: '', g: 'DROP', t: 'x', o: -1, r: 'z', d: NaN, a: Infinity, len: null, n: undefined, w: -10, tl: 0, tw: 0, c: -2, cv: 0 };
  C.CALCS.forEach(c => {
    const rows = c.run(junk, rate);
    rows.forEach(r => {
      assert.ok(Number.isFinite(r.qty), c.id + ' qty finite');
      if (r.amt != null) assert.ok(Number.isFinite(r.amt), c.id + ' amt finite');
    });
  });
});

test('openings larger than the wall give zero, not negative', () => {
  const r = run('brick', { o: 999 });
  assert.strictEqual(r[0].qty, 0);
  assert.strictEqual(r[2].qty, 0);
});

test('zero tile size does not divide by zero', () => {
  const r = run('tile', { tl: 0, tw: 0 });
  assert.ok(Number.isFinite(r[2].qty));
});

test('floating point noise does not add an extra bag', () => {
  assert.strictEqual(C.ceilSafe(8.0000000001), 8);
  assert.strictEqual(C.ceilSafe(8.001), 9);
});

test('percent inputs are capped', () => {
  const t = C.boqTotals([{ q: 1, r: 100 }], { oh: 5000, pr: -5, gst: 'x' });
  near(t.oh, 100);                              // capped at 100 percent
  near(t.pr, 0);
  near(t.gst, 0);
});

test('huge numbers stay finite', () => {
  const t = C.boqTotals([{ q: 1e30, r: 1e30 }], { oh: 10, pr: 10, gst: 18 });
  assert.ok(Number.isFinite(t.total));
});

test('esc blocks HTML injection', () => {
  assert.strictEqual(C.esc('<img src=x onerror=alert(1)>"\''), '&lt;img src=x onerror=alert(1)&gt;&quot;&#39;');
  assert.strictEqual(C.esc(null), '');
});

/* ---------- agreement ---------- */
test('agreement fills in company details and omits zero clauses', () => {
  const v = { type: 'manpower', party: 'Test Cement Ltd', addr: 'Satna', gstin: '23ABCDE1234F1Z5', site: 'Maihar plant', start: '2026-12-01', months: 6, cycle: 15, adv: 0, ret: 0, gst: 18, tds: 2, otm: 2, notice: 15, court: 'Maihar, Madhya Pradesh', rates: 'Mason: Rs 800 per day' };
  const t = C.agreementText(v);
  assert.ok(t.includes('Test Cement Ltd'));
  assert.ok(t.includes('1 December 2026'));
  assert.ok(t.includes('Maihar, Madhya Pradesh'));
  assert.ok(!t.includes('Retention of'));
  assert.ok(!t.includes('mobilisation advance'));
  assert.ok(!/undefined|NaN|null/.test(t));
});

test('agreement with empty form still has no undefined or NaN', () => {
  const t = C.agreementText({});
  assert.ok(!/undefined|NaN|null/.test(t));
  assert.ok(t.includes('MANPOWER SUPPLY AGREEMENT'));
});

test('dateText rejects bad dates', () => {
  assert.strictEqual(C.dateText('2026-13-40'), '____________');
  assert.strictEqual(C.dateText(''), '____________');
  assert.strictEqual(C.dateText('2026-11-19'), '19 November 2026');
});

/* ---------- stored data ---------- */
test('defaults contain every material the calculators use', () => {
  const ids = base.mats.map(m => m.id);
  D.CORE.forEach(id => assert.ok(ids.includes(id), id));
  assert.strictEqual(new Set(ids).size, ids.length);
  assert.strictEqual(new Set(base.labour.map(l => l.id)).size, base.labour.length);
});

test('sanitise repairs tampered storage', () => {
  const evil = JSON.parse('{"__proto__":{"polluted":1},"mats":[{"id":"cement","name":"<script>","unit":5,"rate":"-9"},"x",null],"labour":"nope","workers":[{"name":"A","wage":"abc","extra":"drop"}],"settings":{"hash":"zzz","user":"u"},"ledger":[{"type":"hack","amount":"12"}]}');
  const s = D.sanitize(evil);
  assert.strictEqual(({}).polluted, undefined);
  D.CORE.forEach(id => assert.ok(s.mats.some(m => m.id === id), 'core ' + id + ' restored'));
  assert.strictEqual(s.mats.find(m => m.id === 'cement').rate, 0);
  assert.ok(s.labour.length > 0);
  assert.strictEqual(s.workers[0].wage, 0);
  assert.strictEqual(s.workers[0].extra, undefined);
  assert.strictEqual(s.settings.hash, '');
  assert.strictEqual(s.ledger[0].type, 'Paid');
  assert.strictEqual(s.ledger[0].amount, 12);
});

test('sanitise keeps good data unchanged', () => {
  const d = D.defaults();
  d.workers.push({ id: 'w1', name: 'Ram', trade: 'Mason (Mistri)', phone: '9999999999', wage: 800, site: 'Maihar', status: 'Active' });
  d.settings.hash = 'a'.repeat(64);
  const s = D.sanitize(JSON.parse(JSON.stringify(d)));
  assert.deepStrictEqual(s.workers, d.workers);
  assert.deepStrictEqual(s.mats, d.mats);
  assert.strictEqual(s.settings.hash, d.settings.hash);
});

test('sanitise fixes duplicate ids', () => {
  const s = D.sanitize({ workers: [{ id: 'x', name: 'A' }, { id: 'x', name: 'B' }] });
  assert.notStrictEqual(s.workers[0].id, s.workers[1].id);
});

test('site content is complete', () => {
  assert.strictEqual(D.METHODS.length, 9);
  D.METHODS.forEach(m => { assert.ok(m.t && m.hi && m.u && m.s.length >= 3 && m.r); });
  assert.ok(D.FORMULAS.length >= 15);
  assert.strictEqual(D.TERMS.length, 9);
});
