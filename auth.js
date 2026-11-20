'use strict';
/* Password hashing (scrypt), random tokens and small crypto helpers. No packages. */
const crypto = require('crypto');

const N = 16384, R = 8, P = 1, KEYLEN = 64;

function hashPassword(pass) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(String(pass), salt, KEYLEN, { N, r: R, p: P });
  return ['scrypt', N, salt.toString('hex'), h.toString('hex')].join('$');
}
function verifyPassword(pass, stored) {
  try {
    const [alg, n, saltHex, hashHex] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const expected = Buffer.from(hashHex, 'hex');
    const h = crypto.scryptSync(String(pass), Buffer.from(saltHex, 'hex'), expected.length, { N: +n, r: R, p: P });
    return crypto.timingSafeEqual(h, expected);
  } catch (e) { return false; }
}
/* used when the username does not exist, so the answer takes the same time */
const DUMMY = hashPassword('not-a-real-password');

function token(bytes) { return crypto.randomBytes(bytes || 16).toString('hex'); }
function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function hmac(key, s) { return crypto.createHmac('sha256', key).update(String(s)).digest('hex'); }
function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function otp6() { return String(crypto.randomInt(0, 1000000)).padStart(6, '0'); }

function passwordProblem(p) {
  p = String(p || '');
  if (p.length < 10) return 'Password kam se kam 10 akshar ka hona chahiye';
  if (p.length > 200) return 'Password bahut lamba hai';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Password me akshar aur ank dono hone chahiye';
  return '';
}

module.exports = { hashPassword, verifyPassword, DUMMY, token, sha256, hmac, safeEqual, otp6, passwordProblem };
