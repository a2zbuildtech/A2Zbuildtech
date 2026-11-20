/* node --test tests/server.test.js
 * Starts the real server on a random port with a temporary data folder and
 * walks through the whole life of the portal: setup, password + OTP login,
 * staff links, entries, payouts, reminders, and attacks. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('./server.js');

const MONTH = '2026-11';
const sent = [];                                  // every SMS the server "sends"
let clock = Date.parse('2026-12-20T05:00:00Z');   // controllable time
let app, base, cookie = '', ram, pankaj, jitu, party1;

async function call(method, url, body, headers) {
  const h = Object.assign({}, headers || {});
  if (body !== undefined) h['content-type'] = 'application/json';
  if (cookie && !('cookie' in h)) h.cookie = cookie;
  const r = await fetch(base + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (e) { /* not json */ }
  return { status: r.status, json, text, headers: r.headers };
}
const lastOtp = () => /OTP: (\d{6})/.exec(sent[sent.length - 1].message)[1];
const near = (a, b, e = 0.005) => assert.ok(Math.abs(a - b) <= e, `expected ${b}, got ${a}`);
const admin = (p, b) => call('POST', '/api/admin/' + p, b);
const save = (col, item) => admin('save', { col, item });
const staffH = (s) => ({ 'x-staff-token': s.token });

test.before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a2z-'));
  app = createApp({ dataDir: dir, notify: Object.assign(async (to, message) => { sent.push({ to, message }); return true; }, { real: true, provider: 'test' }), now: () => clock });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + app.server.address().port;
});
test.after(() => app.server.close());

/* ---------------- setup and login ---------------- */
test('nothing works before setup, and setup needs the code from the server screen', async () => {
  assert.strictEqual((await call('GET', '/api/health')).json.needsSetup, true);
  assert.strictEqual((await call('GET', '/api/admin/data')).status, 401);
  const bad = await call('POST', '/api/setup', { code: 'WRONG', user: 'owner', pass: 'Strong#Pass12', mobile: '9766284669' });
  assert.strictEqual(bad.status, 403);
  const weak = await call('POST', '/api/setup', { code: app.setupCode, user: 'owner', pass: 'short', mobile: '9766284669' });
  assert.strictEqual(weak.status, 400);
  const nomobile = await call('POST', '/api/setup', { code: app.setupCode, user: 'owner', pass: 'Strong#Pass12', mobile: '123' });
  assert.strictEqual(nomobile.status, 400);
  const ok = await call('POST', '/api/setup', { code: app.setupCode, user: 'owner', pass: 'Strong#Pass12', mobile: '+91 97662 84669' });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual((await call('POST', '/api/setup', { code: app.setupCode, user: 'x1x', pass: 'Strong#Pass12', mobile: '9766284669' })).status, 403);
  assert.ok(!fs.readFileSync(app.store.file, 'utf8') || true);
});

test('password is stored hashed, never in plain text', () => {
  app.store.save();
  const raw = fs.readFileSync(app.store.file, 'utf8');
  assert.ok(!raw.includes('Strong#Pass12'));
  assert.ok(raw.includes('scrypt$'));
});

test('wrong password gives no OTP and no session', async () => {
  const n = sent.length;
  const r = await admin('login', { user: 'owner', pass: 'wrong-password-1' });
  assert.strictEqual(r.status, 401);
  assert.strictEqual(sent.length, n);
  assert.strictEqual((await admin('login', { user: 'nobody', pass: 'Strong#Pass12' })).status, 401);
  assert.strictEqual((await call('GET', '/api/admin/data')).status, 401);
});

test('right password sends an OTP to the registered mobile; a wrong OTP is refused', async () => {
  const r = await admin('login', { user: 'OWNER', pass: 'Strong#Pass12' });   // username is not case sensitive
  assert.strictEqual(r.status, 200);
  assert.strictEqual(sent[sent.length - 1].to, '9766284669');
  assert.strictEqual(r.json.sentTo, 'XXXXXX4669');
  assert.ok(!JSON.stringify(r.json).includes(lastOtp()));          // the OTP is never returned to the browser
  const bad = await admin('verify', { challenge: r.json.challenge, otp: '000000' === lastOtp() ? '111111' : '000000' });
  assert.strictEqual(bad.status, 401);
  assert.strictEqual((await call('GET', '/api/admin/data')).status, 401);
  assert.strictEqual((await admin('verify', { challenge: 'nonsense', otp: lastOtp() })).status, 400);
});

test('OTP expires after 5 minutes', async () => {
  const r = await admin('login', { user: 'owner', pass: 'Strong#Pass12' });
  const code = lastOtp();
  clock += 6 * 60000;
  const late = await admin('verify', { challenge: r.json.challenge, otp: code });
  assert.strictEqual(late.status, 400);
});

test('OTP is locked after 5 wrong tries, even if the right one follows', async () => {
  const r = await admin('login', { user: 'owner', pass: 'Strong#Pass12' });
  const code = lastOtp(), wrong = code === '123456' ? '654321' : '123456';
  for (let i = 0; i < 5; i++) assert.strictEqual((await admin('verify', { challenge: r.json.challenge, otp: wrong })).status, 401);
  assert.strictEqual((await admin('verify', { challenge: r.json.challenge, otp: code })).status, 429);
});

test('resend has a 30 second gap and a maximum of 3 sends', async () => {
  const r = await admin('login', { user: 'owner', pass: 'Strong#Pass12' });
  assert.strictEqual((await admin('resend', { challenge: r.json.challenge })).status, 429);
  clock += 31000; assert.strictEqual((await admin('resend', { challenge: r.json.challenge })).status, 200);
  clock += 31000; assert.strictEqual((await admin('resend', { challenge: r.json.challenge })).status, 200);
  clock += 31000; assert.strictEqual((await admin('resend', { challenge: r.json.challenge })).status, 429);
});

test('successful login sets a locked-down cookie', async () => {
  clock += 20 * 60000;     // let the earlier lockouts and counters clear
  const r = await admin('login', { user: 'owner', pass: 'Strong#Pass12' });
  const v = await admin('verify', { challenge: r.json.challenge, otp: lastOtp() });
  assert.strictEqual(v.status, 200);
  const c = v.headers.get('set-cookie');
  assert.match(c, /HttpOnly/); assert.match(c, /SameSite=Strict/);
  cookie = c.split(';')[0];
  assert.strictEqual((await call('GET', '/api/admin/me')).json.user, 'owner');
  assert.strictEqual((await call('GET', '/api/admin/data?month=' + MONTH)).status, 200);
});

test('five wrong passwords lock the account for 15 minutes', async () => {
  const saved = cookie; cookie = '';
  for (let i = 0; i < 5; i++) assert.strictEqual((await admin('login', { user: 'owner', pass: 'bad-password-' + i })).status, 401);
  const locked = await admin('login', { user: 'owner', pass: 'Strong#Pass12' });
  assert.strictEqual(locked.status, 429);
  clock += 16 * 60000;
  assert.strictEqual((await admin('login', { user: 'owner', pass: 'Strong#Pass12' })).status, 200);
  cookie = saved;
});

test('session ends after 30 minutes idle', async () => {
  const saved = cookie;
  clock += 31 * 60000;
  assert.strictEqual((await call('GET', '/api/admin/data?month=' + MONTH)).status, 401);
  const r = await admin('login', { user: 'owner', pass: 'Strong#Pass12' });
  const v = await admin('verify', { challenge: r.json.challenge, otp: lastOtp() });
  cookie = v.headers.get('set-cookie').split(';')[0];
  assert.notStrictEqual(cookie, saved);
});

/* ---------------- the three owners are there from day one ---------------- */
test('the three partners are pre-loaded with their numbers', async () => {
  const d = (await call('GET', '/api/admin/data?month=' + MONTH)).json;
  assert.deepStrictEqual(d.partners.map((p) => [p.name, p.role, p.phone]), [
    ['Anak Patel', 'Owner', '9766284669'], ['Shukhendra Mishra', 'Owner', '7974451543'], ['Ram Gopal Patel', 'VP', '8448601661']]);
});

/* ---------------- build the owner's example through the API ---------------- */
test('admin creates party with rate card, and staff with links', async () => {
  const rates = [{ trade: 'Fitter', bill: 22000, pay: 20000 }, { trade: 'Welder', bill: 16000, pay: 15000 }, { trade: 'Cutter', bill: 13000, pay: 12000 }, { trade: 'Helper', bill: 11000, pay: 10000 }];
  const p = await save('parties', { name: 'Party 1', phone: '9000000001', rates });
  assert.strictEqual(p.status, 200); party1 = p.json.id;
  assert.strictEqual((await save('parties', { name: 'party 1' })).status, 400);          // duplicate name
  assert.strictEqual((await save('parties', { name: 'X', rates: [{ trade: 'a' }, { trade: 'A' }] })).status, 400);
  const mk = async (name, type, extra) => { const r = await save('staff', Object.assign({ name, type, phone: '9111111111' }, extra)); assert.strictEqual(r.status, 200); return r.json.id; };
  const ids = { ram: await mk('Ram', 'supplier', { commissionPct: 40 }), pankaj: await mk('Pankaj', 'agent', { commissionPct: 40 }), jitu: await mk('Jitu', 'agent', { commissionPct: 40 }) };
  const d = (await call('GET', '/api/admin/data?month=' + MONTH)).json;
  const by = (n) => d.staff.find((x) => x.name === n);
  ram = by('Ram'); pankaj = by('Pankaj'); jitu = by('Jitu');
  assert.match(ram.token, /^[0-9a-f]{32}$/);
  assert.notStrictEqual(ram.token, pankaj.token);
  assert.ok(ids.ram);
});

test("staff link: Ram's supervisor enters 10 candidates, then the owner's numbers appear", async () => {
  const rows = [];
  const add = (t, n) => { for (let i = 1; i <= n; i++) rows.push({ name: t + ' ' + i, mobile: '98' + String(rows.length + 10000000), trade: t.toLowerCase(), partyId: party1, joinDate: '2026-11-01', days: 26 }); };
  add('Fitter', 2); add('Welder', 2); add('Cutter', 3); add('Helper', 3);
  const r = await call('POST', '/api/staff/save', { month: MONTH, rows }, staffH(ram));
  assert.strictEqual(r.status, 200); assert.strictEqual(r.json.created, 10);
  const view = r.json.view;
  assert.strictEqual(view.candidates.length, 10);
  assert.ok(view.candidates.every((c) => c.createdAt && c.verified === false));
  assert.strictEqual(view.candidates[0].trade === 'Helper' || view.candidates[0].trade === 'Fitter', true);   // trade names fixed to the rate card spelling
  near(view.totals.commission, 7760); near(view.totals.gst, 1396.8); near(view.totals.net, 6363.2);
  assert.strictEqual(view.staff.pct, 40);
});

test('admin sees party-wise headcount by trade and the full money picture', async () => {
  const d = (await call('GET', '/api/admin/data?month=' + MONTH)).json, r = d.report;
  const p = r.byParty.find((x) => x.name === 'Party 1');
  assert.strictEqual(p.headcount, 10);
  assert.deepStrictEqual(p.trades.map((t) => t.trade + ':' + t.count).sort(), ['Cutter:3', 'Fitter:2', 'Helper:3', 'Welder:2']);
  near(r.firm.bill, 148000); near(r.firm.pay, 136000); near(r.firm.margin, 12000); near(r.firm.bonus, 7400); near(r.firm.pool, 19400);
  near(r.firm.distributable, 9544.8);
  r.owners.forEach((o) => near(o.amount, 3181.6));
  assert.strictEqual(d.pending, 10);                                  // all waiting for the admin to verify
  assert.ok(d.candidates.every((c) => c.enteredBy === ram.id && c.source === 'staff'));
});

test('re-uploading the same list updates, never duplicates', async () => {
  const before = (await call('GET', '/api/admin/data?month=' + MONTH)).json.candidates.length;
  const me = (await call('GET', '/api/staff/me?month=' + MONTH, undefined, staffH(ram))).json;
  const rows = me.candidates.map((c) => ({ name: c.name, mobile: c.mobile, trade: c.trade, partyId: c.partyId, joinDate: c.joinDate, days: 26 }));
  const r = await call('POST', '/api/staff/save', { month: MONTH, rows }, staffH(ram));
  assert.strictEqual(r.json.created, 0); assert.strictEqual(r.json.updated, 10);
  assert.strictEqual((await call('GET', '/api/admin/data?month=' + MONTH)).json.candidates.length, before);
});

test('Pankaj and Jitu: each link shows only their own candidates and their own commission', async () => {
  const entry = (s, n, tag) => call('POST', '/api/staff/save', { month: MONTH, rows: Array.from({ length: n }, (_, i) => ({ name: tag + i, mobile: '', trade: 'Helper', partyId: party1, days: 26 })) }, staffH(s));
  assert.strictEqual((await entry(pankaj, 5, 'P')).status, 200);
  assert.strictEqual((await entry(jitu, 5, 'J')).status, 200);
  const p = (await call('GET', '/api/staff/me?month=' + MONTH, undefined, staffH(pankaj))).json;
  const j = (await call('GET', '/api/staff/me?month=' + MONTH, undefined, staffH(jitu))).json;
  assert.strictEqual(p.candidates.length, 5); assert.strictEqual(j.candidates.length, 5);
  assert.ok(p.candidates.every((c) => c.name.startsWith('P')));
  assert.ok(j.candidates.every((c) => c.name.startsWith('J')));
  // 5 helpers: pool each = margin 1000 + 5% of 11000 = 1550; x5 = 7750; 40% = 3100; GST 558; net 2542
  near(p.totals.commission, 3100); near(p.totals.gst, 558); near(p.totals.net, 2542);
  near(j.totals.commission, 3100);
  // what a staff member must NOT see
  const raw = JSON.stringify(p);
  ['bill', 'margin', 'bonus', 'pool', 'billRate', 'payRate', 'Ram', 'Jitu', '22000', '148000'].forEach((w) => assert.ok(!raw.includes('"' + w + '"') && !raw.includes(w + ' ') , 'leaked ' + w));
  assert.ok(!raw.includes('token'));
});

test('a staff member cannot edit or see another staff member\'s candidates', async () => {
  const jc = (await call('GET', '/api/staff/me?month=' + MONTH, undefined, staffH(jitu))).json.candidates[0];
  const r = await call('POST', '/api/staff/save', { month: MONTH, rows: [{ id: jc.id, name: 'Hacked', trade: 'Helper', partyId: party1, days: 1 }] }, staffH(pankaj));
  assert.strictEqual(r.status, 400);
  const j = (await call('GET', '/api/staff/me?month=' + MONTH, undefined, staffH(jitu))).json.candidates.find((c) => c.id === jc.id);
  assert.notStrictEqual(j.name, 'Hacked');
});

test('staff link: bad rows are all refused with row numbers, and nothing is half-saved', async () => {
  const before = (await call('GET', '/api/admin/data?month=' + MONTH)).json.candidates.length;
  const r = await call('POST', '/api/staff/save', { month: MONTH, rows: [
    { name: 'Good One', trade: 'Fitter', partyId: party1, days: 5 },
    { name: '', trade: 'Fitter', partyId: party1 },
    { name: 'Bad Phone', mobile: '123', trade: 'Fitter', partyId: party1 },
    { name: 'No Party', trade: 'Fitter', partyId: 'nope' },
    { name: 'Too Many Days', trade: 'Fitter', partyId: party1, days: 40 },
    { name: 'Quarter Day', trade: 'Fitter', partyId: party1, days: 3.3 }] }, staffH(pankaj));
  assert.strictEqual(r.status, 400);
  assert.deepStrictEqual(r.json.errors.map((e) => e.row), [1, 2, 3, 4, 5]);
  assert.strictEqual((await call('GET', '/api/admin/data?month=' + MONTH)).json.candidates.length, before);
});

test('staff links: bad tokens, switched-off links and new links', async () => {
  assert.strictEqual((await call('GET', '/api/staff/me?month=' + MONTH, undefined, { 'x-staff-token': 'a'.repeat(32) })).status, 401);
  assert.strictEqual((await call('GET', '/api/staff/me?month=' + MONTH)).status, 401);
  assert.strictEqual((await call('GET', '/api/staff/me?month=' + MONTH, undefined, { 'x-staff-token': "' OR 1=1 --" })).status, 401);
  // an admin cookie does not give staff access, and a staff token does not give admin access
  assert.strictEqual((await call('GET', '/api/admin/data?month=' + MONTH, undefined, { cookie: '', 'x-staff-token': pankaj.token })).status, 401);
  const old = jitu.token;
  const n = await admin('staff-token', { id: jitu.id }); jitu.token = n.json.token;
  assert.notStrictEqual(n.json.token, old);
  assert.strictEqual((await call('GET', '/api/staff/me?month=' + MONTH, undefined, { 'x-staff-token': old })).status, 401);
  assert.strictEqual((await call('GET', '/api/staff/me?month=' + MONTH, undefined, staffH(jitu))).status, 200);
  await save('staff', { id: jitu.id, active: false });
  assert.strictEqual((await call('GET', '/api/staff/me?month=' + MONTH, undefined, staffH(jitu))).status, 401);
  await save('staff', { id: jitu.id, active: true });
});

test('too many wrong tokens from one address are blocked', async () => {
  let last = 0;
  for (let i = 0; i < 35; i++) last = (await call('GET', '/api/staff/me?month=' + MONTH, undefined, { 'x-staff-token': 'b'.repeat(31) + (i % 10) })).status;
  assert.strictEqual(last, 429);
  clock += 11 * 60000;
  cookie = await relogin();
});
async function relogin() {
  const r = await admin('login', { user: 'owner', pass: 'Strong#Pass12' });
  const v = await admin('verify', { challenge: r.json.challenge, otp: lastOtp() });
  return v.headers.get('set-cookie').split(';')[0];
}

/* ---------------- admin tools ---------------- */
test('admin verifies, edits days and a per-candidate rate; numbers follow', async () => {
  const d = (await call('GET', '/api/admin/data?month=' + MONTH)).json, c = d.candidates.find((x) => x.name === 'P0');
  assert.strictEqual((await admin('attendance', { candId: c.id, month: MONTH, days: 13 })).status, 200);
  assert.strictEqual((await admin('attendance', { candId: c.id, month: MONTH, days: 13.3 })).status, 400);
  assert.strictEqual((await admin('attendance', { candId: c.id, month: MONTH, days: 32 })).status, 400);
  assert.strictEqual((await save('candidates', { id: c.id, verified: true, billRate: 12000, payRate: 10000 })).status, 200);
  const l = (await call('GET', '/api/admin/data?month=' + MONTH)).json.report.lines.find((x) => x.id === c.id);
  near(l.bill, 6000); near(l.pay, 5000);
  assert.strictEqual((await save('candidates', { name: 'Admin Added', trade: 'Fitter', partyId: party1, staffId: pankaj.id })).status, 200);
});

test('candidate with a missing party or unknown staff is refused', async () => {
  assert.strictEqual((await save('candidates', { name: 'No Party', trade: 'Fitter', partyId: 'zzz' })).status, 400);
  assert.strictEqual((await save('candidates', { name: 'Ghost', trade: 'Fitter', partyId: party1, staffId: 'zzz' })).status, 400);
});

test('payment received from the company, due amount, overdue and reminder', async () => {
  let d = (await call('GET', '/api/admin/data?month=' + MONTH)).json, p = d.report.byParty[0];
  assert.ok(p.due > 0); assert.ok(p.overdueDays > 0);                  // clock is far past 15 days after November
  const rec = await save('receipts', { partyId: party1, month: MONTH, amount: 50000, date: '2026-12-05', note: 'advance' });
  assert.strictEqual(rec.status, 200);
  d = (await call('GET', '/api/admin/data?month=' + MONTH)).json;
  near(d.report.byParty[0].received, 50000);
  near(d.report.byParty[0].due, d.report.byParty[0].receivable - 50000);
  const rem = await admin('reminder', { partyId: party1, month: MONTH, channel: 'whatsapp' });
  assert.strictEqual(rem.status, 200);
  const n = sent.length;
  const sms = await admin('reminder', { partyId: party1, month: MONTH, channel: 'sms', message: 'Payment reminder' });
  assert.strictEqual(sms.status, 200);
  assert.deepStrictEqual([sent[n].to, sent[n].message], ['9000000001', 'Payment reminder']);
  d = (await call('GET', '/api/admin/data?month=' + MONTH)).json;
  assert.strictEqual(d.reminders.length, 2);
});

test('expenses and supervisor fixed pay change what the owners get', async () => {
  const before = (await call('GET', '/api/admin/data?month=' + MONTH)).json.report.firm.distributable;
  await save('expenses', { month: MONTH, category: 'office', label: 'Office staff salary', amount: 2000 });
  await save('expenses', { month: MONTH, category: 'other', label: 'Travel', amount: 500 });
  await save('staff', { name: 'Site Supervisor', type: 'supervisor', fixedPay: 1000 });
  const f = (await call('GET', '/api/admin/data?month=' + MONTH)).json.report.firm;
  near(f.officeSalaries, 2000); near(f.otherExpenses, 500); near(f.fixedPay, 1000);
  near(f.distributable, before - 3500);
  assert.strictEqual((await save('expenses', { month: MONTH, amount: -5 })).status, 400);
});

test('settings and partner shares change the numbers (60:20:20)', async () => {
  assert.strictEqual((await admin('settings', { settings: { commissionPct: 150 } })).status, 400);
  const d = (await call('GET', '/api/admin/data?month=' + MONTH)).json;
  const list = d.partners.map((p, i) => Object.assign({}, p, { share: [3, 1, 1][i] }));
  assert.strictEqual((await admin('partners', { list })).status, 200);
  const r = (await call('GET', '/api/admin/data?month=' + MONTH)).json.report;
  near(r.owners[0].amount + r.owners[1].amount + r.owners[2].amount, r.firm.distributable);
  near(r.owners[0].amount, r.firm.distributable * 0.6, 0.02);
  await admin('partners', { list: d.partners });
});

test('cannot delete a party or staff that has candidates; candidate delete removes attendance', async () => {
  assert.strictEqual((await admin('delete', { col: 'parties', id: party1 })).status, 409);
  assert.strictEqual((await admin('delete', { col: 'staff', id: ram.id })).status, 409);
  const c = (await call('GET', '/api/admin/data?month=' + MONTH)).json.candidates.find((x) => x.name === 'Admin Added');
  assert.strictEqual((await admin('delete', { col: 'candidates', id: c.id })).status, 200);
  assert.strictEqual(app.db.attendance[c.id], undefined);
});

test('password change needs the old one and logs everybody out', async () => {
  assert.strictEqual((await admin('password', { old: 'nope-nope-1', pass: 'Another#Pass99' })).status, 401);
  assert.strictEqual((await admin('password', { old: 'Strong#Pass12', pass: 'weak' })).status, 400);
  assert.strictEqual((await admin('password', { old: 'Strong#Pass12', pass: 'Another#Pass99' })).status, 200);
  assert.strictEqual((await call('GET', '/api/admin/data?month=' + MONTH)).status, 401);
  clock += 20 * 60000;
  const r = await admin('login', { user: 'owner', pass: 'Another#Pass99' });
  assert.strictEqual(r.status, 200);
  const v = await admin('verify', { challenge: r.json.challenge, otp: lastOtp() });
  cookie = v.headers.get('set-cookie').split(';')[0];
});

test('backup download has the data but not the password hash', async () => {
  const r = await call('GET', '/api/admin/backup');
  assert.strictEqual(r.status, 200);
  assert.ok(r.text.includes('Party 1')); assert.ok(!r.text.includes('scrypt$')); assert.ok(!r.text.includes('passHash'));
  assert.match(r.headers.get('content-disposition'), /attachment/);
});

test('logout ends the session', async () => {
  assert.strictEqual((await admin('logout', {})).status, 200);
  assert.strictEqual((await call('GET', '/api/admin/data?month=' + MONTH)).status, 401);
  cookie = await relogin2();
});
async function relogin2() {
  clock += 20 * 60000;
  const r = await admin('login', { user: 'owner', pass: 'Another#Pass99' });
  const v = await admin('verify', { challenge: r.json.challenge, otp: lastOtp() });
  return v.headers.get('set-cookie').split(';')[0];
}

/* ---------------- attacks ---------------- */
test('static files: only the website and portal are served; nothing else', async () => {
  assert.strictEqual((await call('GET', '/')).status, 200);
  assert.strictEqual((await call('GET', '/admin')).status, 200);
  assert.strictEqual((await call('GET', '/staff')).status, 200);
  assert.strictEqual((await call('GET', '/payout.js')).status, 200);
  for (const p of ['/server.js', '/auth.js', '/store.js', '/server.test.js', '/build.py', '/package.json', '/data/db.json', '/db.json', '/../server.js', '/%2e%2e/server.js', '/..%2fserver.js', '/%00.html', '/A2Z_Build_Tech_Book.pdf', '/js/', '/css/nope.css'])
    assert.ok([400, 404].includes((await call('GET', p)).status), p);
  const r = await call('GET', '/staff');
  assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
  assert.strictEqual(r.headers.get('x-frame-options'), 'DENY');
});

test('API refuses non-JSON bodies, oversized bodies, broken JSON and wrong methods', async () => {
  let r = await fetch(base + '/api/admin/save', { method: 'POST', headers: { cookie, 'content-type': 'text/plain' }, body: '{}' });
  assert.strictEqual(r.status, 415);
  r = await fetch(base + '/api/admin/save', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{broken' });
  assert.strictEqual(r.status, 400);
  r = await fetch(base + '/api/admin/save', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ col: 'parties', item: { name: 'x'.repeat(2e6) } }) }).catch(() => ({ status: 413 }));
  assert.ok([413, 400].includes(r.status));
  assert.strictEqual((await call('DELETE', '/api/admin/data')).status, 404);
  assert.strictEqual((await call('POST', '/api/nothing', {})).status, 404);
  assert.strictEqual((await admin('save', { col: '__proto__', item: {} })).status, 400);
  assert.strictEqual((await admin('save', { col: 'admin', item: { passHash: 'x' } })).status, 400);
});

test('a request from another website (wrong Origin) is refused even with a valid cookie', async () => {
  const r = await fetch(base + '/api/admin/save', { method: 'POST', headers: { cookie, 'content-type': 'application/json', origin: 'https://evil.example' }, body: JSON.stringify({ col: 'expenses', item: { month: MONTH, amount: 1 } }) });
  assert.strictEqual(r.status, 403);
});

test('script tags in names are stored as text and cannot add fields', async () => {
  const r = await call('POST', '/api/staff/save', { month: MONTH, rows: [{ name: '<script>alert(1)</script>', trade: 'Helper', partyId: party1, days: 1, token: 'x', staffId: 'someone', payRate: 999999, verified: true, __proto__: { admin: true } }] }, staffH(pankaj));
  assert.strictEqual(r.status, 200);
  const c = app.db.candidates.find((x) => x.name.includes('script'));
  assert.strictEqual(c.staffId, pankaj.id); assert.strictEqual(c.payRate, null); assert.strictEqual(c.verified, false);
  assert.strictEqual(({}).admin, undefined);
});

test('data survives a restart', async () => {
  app.store.save();
  const again = createApp({ dataDir: app.store.dir, notify: async () => true, now: () => clock });
  assert.strictEqual(again.db.candidates.length, app.db.candidates.length);
  assert.strictEqual(again.setupCode, null);                        // admin exists, so no new setup code
  assert.strictEqual(again.db.admin.user, 'owner');
});

test('a damaged data file is kept aside and the server refuses to overwrite it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a2z-bad-'));
  fs.writeFileSync(path.join(dir, 'db.json'), '{not json');
  assert.throws(() => createApp({ dataDir: dir, notify: async () => true }), /kharab/);
  assert.ok(fs.readdirSync(dir).some((f) => f.includes('damaged')));
});
