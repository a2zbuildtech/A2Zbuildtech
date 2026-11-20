/*
 * A2Z Build Tech - calculation engine
 * Pure functions only: no page access, so every number can be tested in Node.
 * Works in the browser (window.A2ZCalc) and in Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.A2ZCalc = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---- constants (see Formulas page and Book chapter 5) ---- */
  var BAG = 0.0347;            // m3 of cement in one 50 kg bag
  var DRY_CONCRETE = 1.54;     // dry volume factor for concrete
  var DRY_MORTAR = 1.27;       // dry volume factor for mortar
  var BRICKS_PER_M3 = 500;     // modular bricks with mortar, per m3 of brickwork
  var MORTAR_PER_M3 = 0.23;    // wet mortar per m3 of brickwork
  var BRICK_WASTAGE = 1.05;    // 5 percent
  var SQFT_PER_M2 = 10.764;
  var SWELL = 1.25;            // loose soil volume after excavation
  var MIX = { 'M5': [1, 5, 10], 'M7.5': [1, 4, 8], 'M10': [1, 3, 6], 'M15': [1, 2, 4], 'M20': [1, 1.5, 3], 'M25': [1, 1, 2] };
  var MORT = [['4', '1:4'], ['5', '1:5'], ['6', '1:6']];
  var BARS = [8, 10, 12, 16, 20, 25, 32];

  /* ---- input safety: every number from the page passes through n() ---- */
  function n(x) { x = parseFloat(x); return (isFinite(x) && x > 0) ? Math.min(x, 1e9) : 0; }
  function pct(x, max) { return Math.min(n(x), max == null ? 100 : max); }
  function ceilSafe(x) { return Math.ceil(Math.round(x * 1e6) / 1e6); }
  function pick(v, allowed, fallback) { v = String(v); return allowed.indexOf(v) >= 0 ? v : fallback; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* one result row; rate is a function id -> rupees */
  function L(rate, label, qty, unit, rid, ceil) {
    var q = ceil ? ceilSafe(qty) : qty, r = rid ? rate(rid) : null;
    return { label: label, qty: q, unit: unit, rate: r, amt: rid ? q * r : null };
  }

  /* ---- the seven calculators ---- */
  var CALCS = [
    { id: 'concrete', n: 'Concrete', hi: 'कंक्रीट', f: [
        { k: 'l', l: 'Length', u: 'm', d: 5 }, { k: 'b', l: 'Width', u: 'm', d: 3 }, { k: 'h', l: 'Thickness or depth', u: 'm', d: 0.15 },
        { k: 'g', l: 'Grade', o: Object.keys(MIX).map(function (k) { return [k, k + ' (' + MIX[k].join(':') + ')']; }), d: 'M20' }],
      run: function (v, rate) {
        var vol = n(v.l) * n(v.b) * n(v.h), g = pick(v.g, Object.keys(MIX), 'M20'), m = MIX[g];
        var dry = vol * DRY_CONCRETE, t = m[0] + m[1] + m[2];
        return [L(rate, 'Concrete volume', vol, 'm³'),
          L(rate, 'Cement', dry * m[0] / t / BAG, 'bag', 'cement', true),
          L(rate, 'Sand', dry * m[1] / t, 'm³', 'sand'),
          L(rate, 'Aggregate', dry * m[2] / t, 'm³', 'agg')];
      } },
    { id: 'brick', n: 'Brickwork', hi: 'ईंट चिनाई', f: [
        { k: 'l', l: 'Wall length', u: 'm', d: 10 }, { k: 'h', l: 'Wall height', u: 'm', d: 3 },
        { k: 't', l: 'Thickness', o: [['0.115', '115 mm'], ['0.23', '230 mm']], d: '0.23' },
        { k: 'o', l: 'Openings (doors, windows)', u: 'm²', d: 4 }, { k: 'r', l: 'Mortar', o: MORT, d: '6' }],
      run: function (v, rate) {
        var area = Math.max(0, n(v.l) * n(v.h) - n(v.o)), t = +pick(v.t, ['0.115', '0.23'], '0.23');
        var vol = area * t, dry = vol * MORTAR_PER_M3 * DRY_MORTAR, r = +pick(v.r, ['4', '5', '6'], '6');
        return [L(rate, 'Net wall area', area, 'm²'), L(rate, 'Brickwork volume', vol, 'm³'),
          L(rate, 'Bricks (with 5% wastage)', vol * BRICKS_PER_M3 * BRICK_WASTAGE, 'nos', 'brick', true),
          L(rate, 'Cement', dry / (1 + r) / BAG, 'bag', 'cement', true),
          L(rate, 'Sand', dry * r / (1 + r), 'm³', 'sand')];
      } },
    { id: 'plaster', n: 'Plaster', hi: 'प्लास्टर', f: [
        { k: 'a', l: 'Plaster area', u: 'm²', d: 60 }, { k: 't', l: 'Thickness', u: 'mm', d: 12 }, { k: 'r', l: 'Mortar', o: MORT, d: '4' }],
      run: function (v, rate) {
        var dry = n(v.a) * Math.min(n(v.t), 200) / 1000 * DRY_MORTAR, r = +pick(v.r, ['4', '5', '6'], '4');
        return [L(rate, 'Plaster area', n(v.a), 'm²'), L(rate, 'Mortar (dry volume)', dry, 'm³'),
          L(rate, 'Cement', dry / (1 + r) / BAG, 'bag', 'cement', true),
          L(rate, 'Sand', dry * r / (1 + r), 'm³', 'sand')];
      } },
    { id: 'steel', n: 'Steel bars', hi: 'सरिया', f: [
        { k: 'd', l: 'Bar diameter', o: BARS.map(function (b) { return [String(b), b + ' mm']; }), d: '12' },
        { k: 'len', l: 'Length of one bar', u: 'm', d: 6 }, { k: 'n', l: 'Number of bars', d: 50 }, { k: 'w', l: 'Wastage', u: '%', d: 5 }],
      run: function (v, rate) {
        var d = +pick(v.d, BARS.map(String), '12'), upm = d * d / 162, tl = n(v.len) * n(v.n);
        return [L(rate, 'Weight per metre', upm, 'kg/m'), L(rate, 'Total length', tl, 'm'),
          L(rate, 'Steel with wastage', upm * tl * (1 + pct(v.w) / 100), 'kg', 'steel')];
      } },
    { id: 'tile', n: 'Tiles', hi: 'टाइल', f: [
        { k: 'l', l: 'Room length', u: 'm', d: 4 }, { k: 'b', l: 'Room width', u: 'm', d: 3.5 },
        { k: 'tl', l: 'Tile length', u: 'mm', d: 600 }, { k: 'tw', l: 'Tile width', u: 'mm', d: 600 }, { k: 'w', l: 'Wastage', u: '%', d: 10 }],
      run: function (v, rate) {
        var a = n(v.l) * n(v.b), ta = Math.max(1, n(v.tl)) * Math.max(1, n(v.tw)) / 1e6, w = 1 + pct(v.w) / 100;
        return [L(rate, 'Floor area', a, 'm²'), L(rate, 'Tile area with wastage', a * SQFT_PER_M2 * w, 'sq ft', 'tile'),
          L(rate, 'Tiles required', a * w / ta, 'nos', null, true)];
      } },
    { id: 'paint', n: 'Paint', hi: 'पेंट', f: [
        { k: 'a', l: 'Wall area', u: 'm²', d: 150 }, { k: 'c', l: 'Coats', d: 2 }, { k: 'cv', l: 'Coverage per coat', u: 'm² per litre', d: 11 }],
      run: function (v, rate) {
        return [L(rate, 'Area', n(v.a), 'm²'), L(rate, 'Paint needed', n(v.a) * n(v.c) / Math.max(1, n(v.cv)), 'litre', 'paint', true)];
      } },
    { id: 'excav', n: 'Excavation', hi: 'खुदाई', f: [
        { k: 'l', l: 'Length', u: 'm', d: 12 }, { k: 'b', l: 'Width', u: 'm', d: 8 }, { k: 'd', l: 'Depth', u: 'm', d: 1.5 }],
      run: function (v, rate) {
        var vol = n(v.l) * n(v.b) * n(v.d);
        return [L(rate, 'Excavated volume', vol, 'm³', 'excav'), L(rate, 'Loose soil after excavation (+25%)', vol * SWELL, 'm³')];
      } }
  ];

  /* material cost + labour and margin */
  function totals(rows, labPct) {
    var mat = 0;
    rows.forEach(function (r) { if (r.amt != null) mat += r.amt; });
    var lab = mat * pct(labPct, 500) / 100;
    return { mat: mat, lab: lab, total: mat + lab };
  }

  /* BOQ: items [{q, r}], P {oh, pr, gst} in percent */
  function boqTotals(items, P) {
    var sub = 0;
    items.forEach(function (i) { sub += n(i.q) * n(i.r); });
    var oh = sub * pct(P.oh) / 100, pr = (sub + oh) * pct(P.pr) / 100, taxable = sub + oh + pr, gst = taxable * pct(P.gst) / 100;
    return { sub: sub, oh: oh, pr: pr, taxable: taxable, gst: gst, total: taxable + gst };
  }

  /* Manpower: rows [{t, n, d, ot}], labour [{id, rate}], P {ot, svc, gst} */
  function mpTotals(rows, labour, P) {
    var wages = 0, ot = 0, md = 0;
    rows.forEach(function (r) {
      var lb = labour.filter(function (x) { return x.id === r.t; })[0], rate = lb ? n(lb.rate) : 0;
      wages += n(r.n) * n(r.d) * rate;
      ot += n(r.n) * n(r.ot) * (rate / 8) * Math.min(n(P.ot), 10);
      md += n(r.n) * n(r.d);
    });
    var svc = (wages + ot) * pct(P.svc, 100) / 100, gst = (wages + ot + svc) * pct(P.gst) / 100, total = wages + ot + svc + gst;
    return { wages: wages, ot: ot, svc: svc, gst: gst, total: total, manDays: md, perManDay: md ? total / md : 0 };
  }

  /* Bill: TDS and retention are taken on the amount before GST */
  function billNet(b) {
    var gross = n(b.g), gst = gross * pct(b.gst) / 100, tds = gross * pct(b.tds) / 100, ret = gross * pct(b.ret) / 100;
    var adv = n(b.adv), oth = n(b.oth), net = gross + gst - tds - ret - adv - oth;
    return { gross: gross, gst: gst, tds: tds, ret: ret, adv: adv, oth: oth, net: net, short: net < 0 };
  }

  /* ---- agreement text ---- */
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function dateText(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
    if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) return '____________';
    return (+m[3]) + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1];
  }
  function agreementText(v) {
    var blank = '__________________';
    var P = String(v.party || '').trim() || blank, ds = dateText(v.start);
    var type = pick(v.type, ['manpower', 'works', 'sub'], 'manpower');
    var scope = {
      manpower: 'The Contractor shall supply skilled and unskilled workers to the Company at the Site, in the trades and numbers requested by the Company in writing.',
      works: 'The Contractor shall carry out the civil works described in the work order and Bill of Quantities at the Site, with the materials and workmanship specified.',
      sub: 'The Contractor shall carry out the part of the civil works assigned by the Company under its main contract, at the Site, to the specification of that contract.'
    }[type];
    var title = { manpower: 'MANPOWER SUPPLY AGREEMENT', works: 'CIVIL WORKS CONTRACT', sub: 'SUB-CONTRACT AGREEMENT' }[type];
    var months = n(v.months), cycle = n(v.cycle), notice = n(v.notice), adv = pct(v.adv), ret = pct(v.ret);
    var court = String(v.court || '').trim() || blank;
    var t = [
      title, '',
      'This agreement is made on ' + ds + ' between:', '',
      '1. A2Z Build Tech (All Type Manpower Supplier), Vivek Nagar, Ward No. 19, Maihar, Madhya Pradesh - 485771 ("the Contractor"); and',
      '2. ' + P + ', ' + (String(v.addr || '').trim() || blank) + (String(v.gstin || '').trim() ? ', GSTIN ' + String(v.gstin).trim() : '') + ' ("the Company").', '',
      '1. SCOPE OF WORK', scope + ' Site: ' + (String(v.site || '').trim() || blank) + '.', '',
      '2. TERM', 'The agreement starts on ' + ds + ' and runs for ' + months + ' month(s), unless ended earlier under clause 12 or extended in writing.', '',
      '3. RATES', 'Rates are as below and are exclusive of GST.', String(v.rates || '').trim() || blank, '',
      '4. WORKING HOURS AND OVERTIME', 'A normal working day is 8 hours. Work beyond this is paid at ' + Math.min(n(v.otm), 10) + ' times the hourly rate, and must be approved by the Company\'s supervisor.', '',
      '5. ATTENDANCE AND MEASUREMENT', 'Attendance sheets or measurement sheets are signed by the Company\'s representative every day or at every measurement. These sheets are the basis of billing.', '',
      '6. BILLING AND PAYMENT', 'The Contractor raises a bill every fortnight or month. The Company pays within ' + cycle + ' days of receiving the bill with signed sheets.' + (adv > 0 ? ' A mobilisation advance of ' + adv + '% is paid at the start and recovered from running bills.' : ''), '',
      '7. TAXES AND DEDUCTIONS', 'GST at ' + pct(v.gst) + '% is added to each bill. The Company deducts TDS at ' + pct(v.tds) + '% as per law and gives a certificate.' + (ret > 0 ? ' Retention of ' + ret + '% is held from each bill and released after the defect liability period.' : ''), '',
      '8. COMPLIANCE', 'The Contractor pays wages to its workers and meets the labour law, PF and ESI requirements that apply to it. The Company gives site access and the details needed for compliance.', '',
      '9. SAFETY', 'The Contractor provides basic safety gear for its workers. The Company\'s site safety rules apply to everyone on site. Work may be stopped by either side for an unsafe condition.', '',
      '10. MATERIALS AND EQUIPMENT', 'Unless stated otherwise in writing, materials and heavy equipment are supplied by the Company, and hand tools by the Contractor.', '',
      '11. QUALITY AND REPLACEMENT', 'The Contractor corrects defective work at its own cost. The Company may ask for a worker to be replaced, and the Contractor arranges a replacement as soon as possible.', '',
      '12. TERMINATION', 'Either side may end this agreement by giving ' + notice + ' days\' written notice. All dues up to the date of ending are cleared within the payment period.', '',
      '13. NON-SOLICITATION', 'During this agreement and for six months after, the Company shall not directly hire the Contractor\'s workers without the Contractor\'s written consent.', '',
      '14. DISPUTES', 'The parties first try to settle any dispute by discussion. If that fails, the courts at ' + court + ' have jurisdiction.', '',
      'Signed by the Contractor: ____________________    Name: ____________________',
      'Signed by the Company:    ____________________    Name: ____________________',
      'Witness 1: ____________________    Witness 2: ____________________'
    ];
    return t.join('\n');
  }

  return {
    BAG: BAG, MIX: MIX, MORT: MORT, BARS: BARS, CALCS: CALCS,
    n: n, pct: pct, ceilSafe: ceilSafe, esc: esc,
    totals: totals, boqTotals: boqTotals, mpTotals: mpTotals, billNet: billNet,
    agreementText: agreementText, dateText: dateText
  };
});
