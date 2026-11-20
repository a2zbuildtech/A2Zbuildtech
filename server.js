'use strict';
/*
 * A2Z Build Tech - portal server (Node 18+, no packages).
 *   node server/server.js
 * Serves the website, the admin console (/admin) and the staff links (/staff#<token>).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Payout = require('./payout.js');
const { openStore } = require('./store');
const A = require('./auth');
const { makeNotifier } = require('./notify');
const S = require('./schema');
const { HttpError, bad } = S;

const ROOT = __dirname;
const PUBLIC_FILES = new Set(['/index.html', '/style.css', '/data.js', '/calc.js', '/app.js', '/payout.js', '/xlsx-lite.js', '/admin.html', '/admin.js', '/common.js', '/portal.css', '/staff.html', '/staff.js']);
const PORTAL_FILES = new Set(['/admin.html', '/admin.js', '/common.js', '/portal.css', '/staff.html', '/staff.js']);
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
const PORTAL_CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'";
const SESSION_IDLE = 30 * 60 * 1000, SESSION_MAX = 12 * 3600 * 1000, OTP_TTL = 5 * 60 * 1000;

function createApp(opts) {
  opts = opts || {};
  const env = opts.env || process.env;
  const store = openStore(opts.dataDir || env.DATA_DIR || path.join(__dirname, 'data'));
  const db = store.db;
  const notify = opts.notify || makeNotifier(env);
  const now = opts.now || (() => Date.now());
  const trustProxy = opts.trustProxy != null ? opts.trustProxy : env.TRUST_PROXY === '1';
  const secure = opts.secure != null ? opts.secure : env.COOKIE_SECURE === '1';

  const keyFile = path.join(store.dir, 'secret.key');
  if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, A.token(32), { mode: 0o600 });
  const SECRET = fs.readFileSync(keyFile, 'utf8').trim();

  const sessions = new Map();     // sha256(sid) -> {adminId, created, last}
  const challenges = new Map();   // id -> {adminId, otpHash, exp, tries, sends, last}
  const buckets = new Map();      // rate limiter
  const locks = new Map();        // username -> {fails, until}
  const setupCode = db.admin ? null : A.token(4).toUpperCase();

  /* ---------- helpers ---------- */
  function hit(key, max, windowMs) {
    const t = now(), arr = (buckets.get(key) || []).filter((x) => t - x < windowMs);
    if (arr.length >= max) { buckets.set(key, arr); return false; }
    arr.push(t); buckets.set(key, arr); return true;
  }
  function limit(key, max, windowMs) { if (!hit(key, max, windowMs)) throw new HttpError(429, 'Bahut zyada koshish. Thodi der baad dobara karein.'); }
  function ipOf(req) {
    if (trustProxy) { const f = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim(); if (f) return f; }
    return req.socket.remoteAddress || 'x';
  }
  function istDate(ms) { return new Date((ms == null ? now() : ms) + 330 * 60000).toISOString().slice(0, 10); }
  function id() { return A.token(6); }
  function stamp() { return new Date(now()).toISOString(); }
  function audit(who, action, detail) {
    db.log.unshift({ at: stamp(), who: who, action: action, detail: String(detail || '').slice(0, 200) });
    if (db.log.length > 500) db.log.length = 500;
  }
  function mask(m) { return m ? 'XXXXXX' + String(m).slice(-4) : ''; }
  function cookies(req) {
    const o = {};
    String(req.headers.cookie || '').split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
    return o;
  }
  function sessionCookie(value, maxAge) {
    return 'sid=' + value + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + maxAge + (secure ? '; Secure' : '');
  }
  function baseHeaders(extra) {
    return Object.assign({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' }, secure ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}, extra || {});
  }
  function json(res, code, obj, extra) {
    const body = JSON.stringify(obj);
    res.writeHead(code, baseHeaders(Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) }, extra || {})));
    res.end(body);
  }
  function readJson(req, max) {
    return new Promise((resolve, reject) => {
      if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) return reject(new HttpError(415, 'JSON chahiye'));
      let size = 0; const chunks = [];
      req.on('data', (c) => { size += c.length; if (size > (max || 1048576)) { reject(new HttpError(413, 'Data bahut bada hai')); req.destroy(); } else chunks.push(c); });
      req.on('end', () => { try { const o = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); resolve(o && typeof o === 'object' && !Array.isArray(o) ? o : {}); } catch (e) { reject(bad('JSON galat hai')); } });
      req.on('error', reject);
    });
  }

  /* ---------- sessions ---------- */
  function getAdmin(req) {
    const sid = cookies(req).sid;
    if (!sid || !/^[0-9a-f]{64}$/.test(sid)) return null;
    const key = A.sha256(sid), s = sessions.get(key), t = now();
    if (!s || t - s.last > SESSION_IDLE || t - s.created > SESSION_MAX || !db.admin || db.admin.id !== s.adminId) { sessions.delete(key); return null; }
    s.last = t;
    return db.admin;
  }
  function requireAdmin(req) {
    const a = getAdmin(req);
    if (!a) throw new HttpError(401, 'Login karein');
    const origin = req.headers.origin;
    if (origin && req.method !== 'GET') { try { if (new URL(origin).host !== req.headers.host) throw 0; } catch (e) { throw new HttpError(403, 'Anuchit request'); } }
    return a;
  }
  function staffFrom(req) {
    const tok = String(req.headers['x-staff-token'] || '');
    const ip = ipOf(req);
    if (!/^[0-9a-f]{32}$/.test(tok)) { limit('staffbad|' + ip, 30, 600000); throw new HttpError(401, 'Link galat hai'); }
    const s = db.staff.find((x) => x.token && A.safeEqual(x.token, tok));
    if (!s || s.active === false) { limit('staffbad|' + ip, 30, 600000); throw new HttpError(401, 'Ye link band ya galat hai. Admin se naya link maangein.'); }
    return s;
  }

  /* ---------- computed report ---------- */
  function report(monthStr) {
    const att = {};
    Object.keys(db.attendance).forEach((cid) => { if (db.attendance[cid][monthStr]) att[cid] = { [monthStr]: db.attendance[cid][monthStr] }; });
    return Payout.compute({
      month: monthStr, settings: db.settings, parties: db.parties, staff: db.staff, candidates: db.candidates,
      attendance: att, expenses: db.expenses, partners: db.partners, receipts: db.receipts, asOf: istDate()
    });
  }
  function monthOf(url) {
    const m = url.searchParams.get('month') || istDate().slice(0, 7);
    if (!Payout.validMonth(m)) throw bad('Mahina galat hai');
    return m;
  }

  /* ---------- routes: setup and login ---------- */
  const routes = {};
  const route = (method, p, fn) => { routes[method + ' ' + p] = fn; };

  route('GET', '/api/health', async (req, res) => json(res, 200, { ok: true, needsSetup: !db.admin, otpProvider: notify.provider || 'custom' }));

  route('POST', '/api/setup', async (req, res) => {
    limit('setup|' + ipOf(req), 10, 900000);
    if (db.admin) throw new HttpError(403, 'Setup ho chuka hai');
    const b = await readJson(req);
    if (!A.safeEqual(String(b.code || '').toUpperCase(), setupCode)) throw new HttpError(403, 'Setup code galat hai (server ki screen par likha hai)');
    const user = S.str('Username', 40, true)(b.user);
    if (!/^[A-Za-z0-9_.-]{3,40}$/.test(user)) throw bad('Username me sirf akshar, ank, . _ - ho sakte hain (kam se kam 3)');
    const prob = A.passwordProblem(b.pass); if (prob) throw bad(prob);
    const mobile = S.phone('OTP ka mobile number', true)(b.mobile);
    db.admin = { id: id(), user: user, passHash: A.hashPassword(b.pass), mobile: mobile, email: S.str('Email', 120)(b.email), created: stamp() };
    audit(user, 'setup', 'admin account bana');
    store.save();
    json(res, 200, { ok: true });
  });

  async function sendOtp(admin, ch) {
    const code = A.otp6();
    ch.otpHash = A.hmac(SECRET, code + '|' + ch.id); ch.exp = now() + OTP_TTL; ch.tries = 0; ch.sends++; ch.last = now();
    const ok = await notify(admin.mobile, 'A2Z Build Tech login OTP: ' + code + '. 5 minute me expire hoga. Kisi ko na batayein.');
    return ok;
  }

  route('POST', '/api/admin/login', async (req, res) => {
    const ip = ipOf(req);
    challenges.forEach((c, k) => { if (now() > c.exp + 600000) challenges.delete(k); });
    sessions.forEach((v, k) => { if (now() - v.last > SESSION_IDLE) sessions.delete(k); });
    limit('login|' + ip, 15, 900000);
    const b = await readJson(req);
    const user = String(b.user || '').slice(0, 60), a = db.admin;
    const lk = locks.get(user.toLowerCase());
    if (lk && lk.until > now()) throw new HttpError(429, 'Bahut galat koshish. ' + Math.ceil((lk.until - now()) / 60000) + ' minute baad dobara karein.');
    const match = a && user.toLowerCase() === a.user.toLowerCase();
    const okPass = A.verifyPassword(String(b.pass || '').slice(0, 200), match ? a.passHash : A.DUMMY) && match;
    if (!okPass) {
      const rec = locks.get(user.toLowerCase()) || { fails: 0, until: 0 };
      rec.fails++; if (rec.fails >= 5) { rec.until = now() + 15 * 60000; rec.fails = 0; }
      locks.set(user.toLowerCase(), rec);
      audit(user || '?', 'login-fail', ip);
      throw new HttpError(401, 'Username ya password galat hai');
    }
    locks.delete(user.toLowerCase());
    const ch = { id: A.token(16), adminId: a.id, otpHash: '', exp: 0, tries: 0, sends: 0, last: 0 };
    if (!(await sendOtp(a, ch))) throw new HttpError(502, 'OTP bhej nahi paye. SMS setting jaanchein.');
    challenges.set(ch.id, ch);
    json(res, 200, { challenge: ch.id, sentTo: mask(a.mobile) });
  });

  route('POST', '/api/admin/resend', async (req, res) => {
    limit('resend|' + ipOf(req), 10, 900000);
    const b = await readJson(req), ch = challenges.get(String(b.challenge || ''));
    if (!ch) throw new HttpError(400, 'Login dobara shuru karein');
    if (now() - ch.last < 30000) throw new HttpError(429, '30 second baad dobara bhejein');
    if (ch.sends >= 3) { challenges.delete(ch.id); throw new HttpError(429, 'OTP 3 baar bhej chuke. Login dobara shuru karein.'); }
    if (!(await sendOtp(db.admin, ch))) throw new HttpError(502, 'OTP bhej nahi paye');
    json(res, 200, { ok: true });
  });

  route('POST', '/api/admin/verify', async (req, res) => {
    limit('verify|' + ipOf(req), 15, 900000);
    const b = await readJson(req), ch = challenges.get(String(b.challenge || ''));
    if (!ch || now() > ch.exp) { if (ch) challenges.delete(ch.id); throw new HttpError(400, 'OTP expire ho gaya. Login dobara karein.'); }
    ch.tries++;
    if (ch.tries > 5) { challenges.delete(ch.id); throw new HttpError(429, 'Bahut galat OTP. Login dobara karein.'); }
    if (!A.safeEqual(A.hmac(SECRET, String(b.otp || '').trim() + '|' + ch.id), ch.otpHash)) throw new HttpError(401, 'OTP galat hai');
    challenges.delete(ch.id);
    const sid = A.token(32);
    sessions.set(A.sha256(sid), { adminId: ch.adminId, created: now(), last: now() });
    audit(db.admin.user, 'login', ipOf(req)); store.save();
    json(res, 200, { ok: true, user: db.admin.user }, { 'Set-Cookie': sessionCookie(sid, 43200) });
  });

  route('POST', '/api/admin/logout', async (req, res) => {
    const sid = cookies(req).sid;
    if (sid) sessions.delete(A.sha256(sid));
    json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
  });

  route('GET', '/api/admin/me', async (req, res) => {
    const a = getAdmin(req);
    json(res, 200, a ? { user: a.user, mobile: mask(a.mobile) } : { user: null });
  });

  /* ---------- routes: admin data ---------- */
  route('GET', '/api/admin/data', async (req, res, url) => {
    requireAdmin(req);
    const m = monthOf(url), att = {};
    Object.keys(db.attendance).forEach((cid) => { if (db.attendance[cid][m]) att[cid] = db.attendance[cid][m]; });
    json(res, 200, {
      month: m, today: istDate(), settings: db.settings, partners: db.partners, parties: db.parties, staff: db.staff,
      candidates: db.candidates, attendance: att, expenses: db.expenses.filter((e) => e.month === m), receipts: db.receipts.filter((r) => r.month === m),
      reminders: db.reminders.filter((r) => r.month === m), report: report(m), pending: db.candidates.filter((c) => !c.verified && c.status !== 'left').length,
      log: db.log.slice(0, 60), otpProvider: notify.provider || 'custom'
    });
  });

  const COLS = ['parties', 'staff', 'candidates', 'expenses', 'receipts'];
  function checkRefs(col, item) {
    if (col === 'candidates') {
      if (!db.parties.some((p) => p.id === item.partyId)) throw bad('Party chuniye');
      if (item.staffId && !db.staff.some((s) => s.id === item.staffId)) throw bad('Staff galat hai');
    }
    if (col === 'receipts' && !db.parties.some((p) => p.id === item.partyId)) throw bad('Party galat hai');
    if (col === 'parties' || col === 'staff') {
      const same = db[col].filter((x) => x.id !== item.id && x.name.toLowerCase() === item.name.toLowerCase());
      if (same.length) throw bad('Is naam ki entry pehle se hai');
    }
  }
  route('POST', '/api/admin/save', async (req, res, url) => {
    const a = requireAdmin(req), b = await readJson(req), col = String(b.col || '');
    if (!COLS.includes(col)) throw bad('Galat table');
    const input = Object.assign({}, b.item || {}), spec = S.SPEC[col];
    let cur = input.id ? db[col].find((x) => x.id === input.id) : null;
    if (input.id && !cur) throw new HttpError(404, 'Entry nahi mili');
    if (!cur) {   // sensible defaults for a new entry
      const dflt = { parties: { active: true }, staff: { type: 'agent', active: true }, candidates: { status: 'active' }, expenses: { category: 'other' } }[col] || {};
      Object.keys(dflt).forEach((k) => { if (input[k] === undefined) input[k] = dflt[k]; });
    }
    const item = S.apply(spec, input, cur);
    if (col === 'candidates') { if (!cur) { item.staffId = input.staffId || null; } else if (Object.prototype.hasOwnProperty.call(input, 'staffId')) item.staffId = input.staffId || null; if (Object.prototype.hasOwnProperty.call(input, 'partyId') || !cur) item.partyId = String(input.partyId || ''); }
    if (col === 'receipts' && !cur) item.partyId = String(input.partyId || '');
    if (col === 'candidates' && !cur) { item.status = item.status || 'active'; item.verified = true; item.source = 'admin'; item.enteredBy = 'admin'; }
    checkRefs(col, item);
    if (!cur) {
      item.id = id(); item.createdAt = stamp();
      if (col === 'staff') item.token = A.token(16);
      db[col].unshift(item);
    } else Object.assign(cur, item);
    (cur || item).updatedAt = stamp();
    if (col === 'staff' && !(cur || item).type) (cur || item).type = 'agent';
    audit(a.user, 'save ' + col, (cur || item).name || (cur || item).label || '');
    store.save();
    json(res, 200, { ok: true, id: (cur || item).id });
  });

  route('POST', '/api/admin/delete', async (req, res) => {
    const a = requireAdmin(req), b = await readJson(req), col = String(b.col || ''), key = String(b.id || '');
    if (!COLS.includes(col)) throw bad('Galat table');
    const i = db[col].findIndex((x) => x.id === key);
    if (i < 0) throw new HttpError(404, 'Entry nahi mili');
    if (col === 'parties' && (db.candidates.some((c) => c.partyId === key) || db.receipts.some((r) => r.partyId === key))) throw new HttpError(409, 'Is party me candidates ya receipts hain. Party ko "active" band kar dein.');
    if (col === 'staff' && db.candidates.some((c) => c.staffId === key)) throw new HttpError(409, 'Is staff ke candidates hain. Staff ko "active" band kar dein.');
    const gone = db[col].splice(i, 1)[0];
    if (col === 'candidates') delete db.attendance[key];
    audit(a.user, 'delete ' + col, gone.name || gone.label || '');
    store.save();
    json(res, 200, { ok: true });
  });

  route('POST', '/api/admin/staff-token', async (req, res) => {
    const a = requireAdmin(req), b = await readJson(req), s = db.staff.find((x) => x.id === String(b.id || ''));
    if (!s) throw new HttpError(404, 'Staff nahi mila');
    s.token = A.token(16); audit(a.user, 'new staff link', s.name); store.save();
    json(res, 200, { ok: true, token: s.token });
  });

  route('POST', '/api/admin/attendance', async (req, res) => {
    const a = requireAdmin(req), b = await readJson(req);
    const m = S.month('Mahina', true)(b.month), days = S.num('Din', { max: 31 })(b.days);
    if (Math.round(days * 2) !== days * 2) throw bad('Din poore ya aadhe (0.5) hone chahiye');
    const c = db.candidates.find((x) => x.id === String(b.candId || ''));
    if (!c) throw new HttpError(404, 'Candidate nahi mila');
    (db.attendance[c.id] = db.attendance[c.id] || {})[m] = { days: days, by: 'admin', at: stamp() };
    audit(a.user, 'attendance', c.name + ' ' + m + ' ' + days); store.save();
    json(res, 200, { ok: true });
  });

  route('POST', '/api/admin/settings', async (req, res) => {
    const a = requireAdmin(req), b = (await readJson(req)).settings || {};
    const spec = { commissionPct: S.num('Commission %', { max: 100 }), gstPct: S.num('Staff GST %', { max: 100 }), billPct: S.num('Company commission %', { max: 100 }), basisDays: S.num('Mahine ke din', { min: 1, max: 31 }), gstFirmPct: S.num('Firm GST %', { max: 100 }), payDays: S.num('Payment ke din', { max: 180 }) };
    db.settings = Object.assign({}, db.settings, S.apply(spec, b, db.settings));
    audit(a.user, 'settings', JSON.stringify(db.settings)); store.save();
    json(res, 200, { ok: true });
  });

  route('POST', '/api/admin/partners', async (req, res) => {
    const a = requireAdmin(req), b = await readJson(req), list = b.list;
    if (!Array.isArray(list) || list.length < 1 || list.length > 10) throw bad('1 se 10 partners hone chahiye');
    db.partners = list.map((p, i) => ({
      id: /^[0-9a-z]{3,16}$/.test(String(p.id || '')) ? p.id : id(), name: S.str('Naam', 80, true)(p.name), role: S.str('Pad', 30)(p.role),
      phone: S.phone('Mobile')(p.phone), share: S.num('Hissa', { min: 0, max: 1000 })(p.share == null || p.share === '' ? 1 : p.share)
    }));
    audit(a.user, 'partners', db.partners.map((p) => p.name + ':' + p.share).join(', ')); store.save();
    json(res, 200, { ok: true });
  });

  route('POST', '/api/admin/password', async (req, res) => {
    const a = requireAdmin(req); limit('pw|' + a.id, 8, 900000);
    const b = await readJson(req);
    if (!A.verifyPassword(String(b.old || ''), a.passHash)) throw new HttpError(401, 'Purana password galat hai');
    const prob = A.passwordProblem(b.pass); if (prob) throw bad(prob);
    a.passHash = A.hashPassword(b.pass);
    sessions.clear();      // everybody must log in again
    audit(a.user, 'password badla', ''); store.save();
    json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
  });

  route('POST', '/api/admin/contact', async (req, res) => {
    const a = requireAdmin(req); limit('pw|' + a.id, 8, 900000);
    const b = await readJson(req);
    if (!A.verifyPassword(String(b.pass || ''), a.passHash)) throw new HttpError(401, 'Password galat hai');
    a.mobile = S.phone('OTP ka mobile', true)(b.mobile); a.email = S.str('Email', 120)(b.email);
    audit(a.user, 'OTP mobile badla', mask(a.mobile)); store.save();
    json(res, 200, { ok: true });
  });

  route('POST', '/api/admin/reminder', async (req, res) => {
    const a = requireAdmin(req), b = await readJson(req);
    const party = db.parties.find((p) => p.id === String(b.partyId || ''));
    if (!party) throw new HttpError(404, 'Party nahi mili');
    const m = S.month('Mahina', true)(b.month), channel = S.oneOf('Madhyam', ['whatsapp', 'sms', 'call', 'other'])(b.channel);
    let sent = null;
    if (channel === 'sms') {
      if (!party.phone) throw bad('Party ka mobile number daalein');
      if (!notify.real) throw bad('SMS provider set nahi hai. WhatsApp ya copy ka upyog karein.');
      sent = await notify(party.phone, S.str('Sandesh', 500, true)(b.message));
      if (!sent) throw new HttpError(502, 'SMS nahi ja paya');
    }
    db.reminders.unshift({ id: id(), partyId: party.id, month: m, channel: channel, at: stamp(), by: a.user });
    if (db.reminders.length > 1000) db.reminders.length = 1000;
    audit(a.user, 'reminder ' + channel, party.name + ' ' + m); store.save();
    json(res, 200, { ok: true, sent: sent });
  });

  route('GET', '/api/admin/backup', async (req, res) => {
    const a = requireAdmin(req);
    const copy = JSON.parse(JSON.stringify(db)); copy.admin = null;
    audit(a.user, 'backup download', '');
    res.writeHead(200, baseHeaders({ 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="a2z-backup-' + istDate() + '.json"' }));
    res.end(JSON.stringify(copy, null, 1));
  });

  /* ---------- routes: staff link ---------- */
  function normKey(c) { return (c.mobile || c.name.toLowerCase()) + '|' + c.partyId; }
  function staffView(s, m) {
    const r = report(m), mine = r.lines.filter((l) => l.staffId === s.id), me = r.byStaff.find((x) => x.id === s.id);
    const byId = {}; db.candidates.forEach((c) => { byId[c.id] = c; });
    const list = mine.map((l) => {
      const c = byId[l.id];
      return { id: l.id, name: l.name, mobile: c.mobile, trade: l.trade, partyId: l.partyId, partyName: l.partyName, joinDate: c.joinDate, status: c.status, verified: !!c.verified, createdAt: c.createdAt, updatedAt: c.updatedAt, days: l.days, pay: l.pay, commission: l.commission, gst: l.gst, net: l.net };
    });
    return {
      month: m, staff: { name: s.name, type: s.type, pct: me.pct, fixed: me.fixed },
      parties: db.parties.filter((p) => p.active !== false).map((p) => ({ id: p.id, name: p.name, trades: (p.rates || []).map((x) => x.trade) })),
      candidates: list,
      totals: { candidates: me.candidates, days: me.days, pay: me.pay, commission: me.commission, gst: me.gst, net: me.net, fixed: me.fixed },
      gstPct: db.settings.gstPct
    };
  }
  route('GET', '/api/staff/me', async (req, res, url) => {
    const s = staffFrom(req); json(res, 200, staffView(s, monthOf(url)));
  });

  route('POST', '/api/staff/save', async (req, res) => {
    const s = staffFrom(req), b = await readJson(req, 2097152);
    limit('staffsave|' + s.id, 60, 600000);
    const m = S.month('Mahina', true)(b.month), rows = b.rows;
    if (!Array.isArray(rows) || !rows.length) throw bad('Koi row nahi hai');
    if (rows.length > 500) throw bad('Ek baar me 500 se zyada rows nahi');
    const errors = [], planned = [];
    rows.forEach((r, i) => {
      try {
        if (!r || typeof r !== 'object') throw bad('Row galat hai');
        const party = db.parties.find((p) => p.id === String(r.partyId || '') && p.active !== false);
        if (!party) throw bad('Party chuniye');
        const days = r.days === '' || r.days == null ? null : S.num('Din', { max: 31 })(r.days);
        if (days != null && Math.round(days * 2) !== days * 2) throw bad('Din poore ya aadhe (0.5) hone chahiye');
        const card = Payout.findRate(party, r.trade);
        const item = { name: S.str('Naam', 80, true)(r.name), mobile: S.phone('Mobile')(r.mobile), trade: card ? card.trade : S.str('Trade', 40, true)(r.trade), partyId: party.id, joinDate: S.date('Joining date')(r.joinDate) };
        planned.push({ i: i, item: item, days: days, left: S.bool()(r.left), id: r.id ? String(r.id) : '' });
      } catch (e) { if (e instanceof HttpError) errors.push({ row: i, msg: e.message }); else throw e; }
    });
    if (errors.length) return json(res, 400, { error: 'Kuch rows me galti hai', errors: errors });
    const mine = db.candidates.filter((c) => c.staffId === s.id);
    const created = [], updated = [];
    planned.forEach((p) => {
      let c = p.id ? mine.find((x) => x.id === p.id) : mine.find((x) => normKey(x) === normKey(p.item));
      if (p.id && !c) { errors.push({ row: p.i, msg: 'Ye candidate aapka nahi hai' }); return; }
      if (!c) {
        if (mine.length >= 3000) { errors.push({ row: p.i, msg: 'Candidates ki seema poori' }); return; }
        c = Object.assign({ id: id(), staffId: s.id, status: 'active', verified: false, source: 'staff', enteredBy: s.id, payRate: null, billRate: null, createdAt: stamp() }, p.item);
        db.candidates.unshift(c); mine.push(c); created.push(c.id);
      } else { Object.assign(c, p.item); updated.push(c.id); }
      if (p.left) c.status = 'left'; else if (c.status === 'left') c.status = 'active';
      c.updatedAt = stamp();
      if (p.days != null) { (db.attendance[c.id] = db.attendance[c.id] || {})[m] = { days: p.days, by: s.id, at: stamp() }; c.verified = false; }
    });
    if (errors.length) return json(res, 400, { error: 'Kuch rows save nahi hue', errors: errors });
    audit('staff:' + s.name, 'entry', created.length + ' naye, ' + updated.length + ' badle (' + m + ')');
    store.save();
    json(res, 200, { ok: true, created: created.length, updated: updated.length, view: staffView(s, m) });
  });

  /* ---------- static files ---------- */
  function serveStatic(req, res, pathname) {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
    let rel = pathname;
    if (rel === '/' ) rel = '/index.html';
    if (rel === '/admin') rel = '/admin.html';
    if (rel === '/staff') rel = '/staff.html';
    let dec; try { dec = decodeURIComponent(rel); } catch (e) { throw new HttpError(400, 'Bad path'); }
    if (dec.includes('\0') || dec.includes('..') || dec.includes('\\')) throw new HttpError(400, 'Bad path');
    if (!PUBLIC_FILES.has(dec)) throw new HttpError(404, 'Not found');
    const file = path.join(ROOT, dec), ext = path.extname(file).toLowerCase();
    if (!MIME[ext] || !file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) throw new HttpError(404, 'Not found');
    const h = baseHeaders({ 'Content-Type': MIME[ext], 'Cache-Control': 'no-cache' });
    if (PORTAL_FILES.has(dec)) h['Content-Security-Policy'] = PORTAL_CSP;
    res.writeHead(200, h);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  }

  /* ---------- dispatcher ---------- */
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      if (url.pathname.startsWith('/api/')) {
        const fn = routes[req.method + ' ' + url.pathname];
        if (!fn) throw new HttpError(404, 'Not found');
        await fn(req, res, url);
      } else serveStatic(req, res, url.pathname);
    } catch (e) {
      if (res.headersSent) { try { res.end(); } catch (x) { /* ignore */ } return; }
      if (e instanceof HttpError) {
        if (String(req.url).startsWith('/api/')) json(res, e.code, { error: e.message });
        else { res.writeHead(e.code, baseHeaders({ 'Content-Type': 'text/plain; charset=utf-8' })); res.end(e.message); }
      } else { console.error('Server error:', e); json(res, 500, { error: 'Server me gadbad hui' }); }
    }
  });
  server.requestTimeout = 30000; server.headersTimeout = 15000;

  return { server, store, db, setupCode, sessions, report, notify };
}

module.exports = { createApp };

if (require.main === module) {
  const env = process.env;
  const prod = env.NODE_ENV === 'production';
  let app;
  try {
    const notifier = makeNotifier(env);
    if (prod && !notifier.real && env.ALLOW_CONSOLE_OTP !== '1') {
      console.error('\nRUKIYE: production me OTP sirf server ki screen par chhapega, kisi ke phone par nahi.\nSMS_WEBHOOK_URL set karke OTP_PROVIDER=webhook karein (README dekhein).\n');
      process.exit(1);
    }
    app = createApp({ notify: notifier });
  } catch (e) { console.error('\nServer shuru nahi hua: ' + e.message + '\n'); process.exit(1); }
  const port = +env.PORT || 8080, host = env.HOST || '127.0.0.1';
  app.server.listen(port, host, () => {
    console.log('\nA2Z Build Tech portal chal raha hai: http://' + host + ':' + port);
    console.log('  Website : /\n  Admin   : /admin\n  OTP via : ' + (app.notify.provider || 'custom'));
    if (app.setupCode) console.log('\n  PEHLI BAAR SETUP: /admin kholiye aur ye code daaliye: ' + app.setupCode + '\n');
  });
  process.on('SIGINT', () => { app.store.save(); process.exit(0); });
  process.on('SIGTERM', () => { app.store.save(); process.exit(0); });
}
