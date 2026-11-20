'use strict';
/* Input checks. Everything that comes from a browser passes through here. */
class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const bad = (m) => new HttpError(400, m);

const clean = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
const str = (label, max, req) => (v) => {
  const s = clean(v);
  if (req && !s) throw bad(label + ' zaruri hai');
  if (s.length > max) throw bad(label + ' bahut lamba hai');
  return s;
};
const phone = (label, req) => (v) => {
  let d = String(v == null ? '' : v).replace(/\D/g, '');
  if (!d) { if (req) throw bad(label + ' zaruri hai'); return ''; }
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d[0] === '0') d = d.slice(1);
  if (!/^[6-9]\d{9}$/.test(d)) throw bad(label + ': 10 ankon ka sahi mobile number likhein');
  return d;
};
const num = (label, o) => (v) => {
  o = o || {};
  if (v === null || v === undefined || v === '') { if (o.req) throw bad(label + ' zaruri hai'); return o.nullable ? null : 0; }
  const x = Number(v);
  if (!Number.isFinite(x)) throw bad(label + ': sahi number likhein');
  const min = o.min == null ? 0 : o.min, max = o.max == null ? 1e9 : o.max;
  if (x < min || x > max) throw bad(label + ' ' + min + ' se ' + max + ' ke beech hona chahiye');
  return Math.round(x * 100) / 100;
};
const month = (label, req) => (v) => {
  const s = String(v == null ? '' : v);
  if (!s) { if (req) throw bad(label + ' zaruri hai'); return ''; }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) throw bad(label + ' galat hai');
  return s;
};
const date = (label, req) => (v) => {
  const s = String(v == null ? '' : v);
  if (!s) { if (req) throw bad(label + ' zaruri hai'); return ''; }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (!m || d.getUTCMonth() !== +m[2] - 1 || +m[1] < 2000 || +m[1] > 2100) throw bad(label + ' ki tarikh galat hai');
  return s;
};
const oneOf = (label, list) => (v) => { if (!list.includes(v)) throw bad(label + ' galat hai'); return v; };
const bool = () => (v) => v === true || v === 'true' || v === 1;

const rates = () => (v) => {
  if (v == null) return [];
  if (!Array.isArray(v) || v.length > 60) throw bad('Rate card galat hai');
  const seen = new Set();
  return v.map((r) => {
    const trade = str('Trade', 40, true)(r && r.trade), key = trade.toLowerCase();
    if (seen.has(key)) throw bad('Rate card me "' + trade + '" do baar hai');
    seen.add(key);
    return { trade, bill: num('Company rate', { max: 1e7 })(r.bill), pay: num('Candidate rate', { max: 1e7 })(r.pay) };
  });
};

const SPEC = {
  parties: {
    name: str('Party ka naam', 80, true), phone: phone('Party ka mobile'), contact: str('Contact person', 80), address: str('Pata', 200),
    gstin: str('GSTIN', 20), billPct: num('Company commission %', { nullable: true, max: 100 }), basisDays: num('Mahine ke din', { nullable: true, min: 1, max: 31 }),
    payDays: num('Payment ke din', { nullable: true, max: 180 }), active: bool(), rates: rates()
  },
  staff: {
    name: str('Staff ka naam', 80, true), phone: phone('Staff ka mobile'), type: oneOf('Prakar', ['agent', 'supplier', 'supervisor']),
    commissionPct: num('Commission %', { nullable: true, max: 100 }), fixedPay: num('Fixed payment', { max: 1e7 }),
    fixedFrom: month('Fixed payment shuru'), fixedTo: month('Fixed payment ant'), active: bool()
  },
  candidates: {
    name: str('Candidate ka naam', 80, true), mobile: phone('Candidate ka mobile'), trade: str('Trade', 40, true),
    joinDate: date('Joining date'), payRate: num('Candidate rate', { nullable: true, max: 1e7 }), billRate: num('Company rate', { nullable: true, max: 1e7 }),
    status: oneOf('Status', ['active', 'left']), verified: bool()
  },
  expenses: { month: month('Mahina', true), category: oneOf('Prakar', ['office', 'other']), label: str('Vivaran', 100), amount: num('Rakam', { req: true, max: 1e9 }) },
  receipts: { partyId: str('Party', 40, true), month: month('Mahina', true), amount: num('Rakam', { req: true, max: 1e9 }), date: date('Tarikh'), note: str('Note', 100) }
};

function apply(spec, input, existing) {
  const out = existing ? Object.assign({}, existing) : {};
  Object.keys(spec).forEach((k) => {
    if (input && Object.prototype.hasOwnProperty.call(input, k)) out[k] = spec[k](input[k]);
    else if (!existing) out[k] = spec[k](undefined);
  });
  return out;
}

module.exports = { HttpError, bad, clean, str, phone, num, month, date, oneOf, bool, SPEC, apply };
