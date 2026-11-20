/*
 * A2Z Build Tech - content and stored data
 * Default rates, methods, formulas, terms, and the sanitiser that cleans
 * anything read from browser storage or a pasted backup.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.A2ZData = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Material ids the calculators depend on. These cannot be deleted in Admin. */
  var CORE = ['cement', 'sand', 'agg', 'brick', 'steel', 'tile', 'paint', 'excav'];

  function defaults() {
    return {
      settings: { phone: '', email: '', user: '', hash: '', fails: 0, lockUntil: 0 },
      mats: [
        { id: 'cement', name: 'Cement (50 kg bag)', unit: 'bag', rate: 390 },
        { id: 'sand', name: 'Sand', unit: 'm³', rate: 1500 },
        { id: 'agg', name: 'Aggregate 20 mm', unit: 'm³', rate: 1300 },
        { id: 'brick', name: 'Brick, first class', unit: 'nos', rate: 8 },
        { id: 'steel', name: 'TMT steel bar', unit: 'kg', rate: 65 },
        { id: 'tile', name: 'Floor tile', unit: 'sq ft', rate: 45 },
        { id: 'paint', name: 'Emulsion paint', unit: 'litre', rate: 380 },
        { id: 'excav', name: 'Excavation (labour)', unit: 'm³', rate: 180 }
      ],
      labour: [
        { id: 'mason', name: 'Mason (Mistri)', rate: 800 },
        { id: 'helper', name: 'Helper (Beldar)', rate: 550 },
        { id: 'carp', name: 'Carpenter', rate: 800 },
        { id: 'bender', name: 'Bar bender', rate: 800 },
        { id: 'painter', name: 'Painter', rate: 750 },
        { id: 'plumber', name: 'Plumber', rate: 800 },
        { id: 'elec', name: 'Electrician', rate: 850 },
        { id: 'super', name: 'Supervisor', rate: 1100 }
      ],
      workers: [], projects: [], ledger: [], enquiries: []
    };
  }

  /* ---- sanitiser ---- */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function str(x, max) { return String(x == null ? '' : x).slice(0, max || 300); }
  function num(x) { x = parseFloat(x); return (isFinite(x) && x >= 0) ? Math.min(x, 1e12) : 0; }

  var SCHEMA = {
    mats: { id: 's', name: 's', unit: 's', rate: 'n' },
    labour: { id: 's', name: 's', rate: 'n' },
    workers: { id: 's', name: 's', trade: 's', phone: 's', wage: 'n', site: 's', status: 's' },
    projects: { id: 's', name: 's', client: 's', site: 's', value: 'n', start: 's', status: 's' },
    ledger: { id: 's', date: 's', type: 's', party: 's', project: 's', amount: 'n', mode: 's', note: 's' },
    enquiries: { id: 's', date: 's', name: 's', phone: 's', work: 's', msg: 's' }
  };

  function cleanList(list, key) {
    if (!Array.isArray(list)) return [];
    var schema = SCHEMA[key], seen = {};
    return list.slice(0, 5000).filter(function (o) { return o && typeof o === 'object' && !Array.isArray(o); }).map(function (o) {
      var r = {};
      Object.keys(schema).forEach(function (k) { r[k] = schema[k] === 'n' ? num(o[k]) : str(o[k], key === 'enquiries' && k === 'msg' ? 2000 : 300); });
      if (!r.id || seen[r.id]) r.id = uid() + Object.keys(seen).length;
      seen[r.id] = 1;
      if (key === 'ledger' && r.type !== 'Received') r.type = 'Paid';
      return r;
    });
  }

  function sanitize(raw) {
    var d = defaults();
    if (!raw || typeof raw !== 'object') return d;
    var s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    d.settings = {
      phone: str(s.phone, 40), email: str(s.email, 120), user: str(s.user, 60),
      hash: /^[0-9a-f]{64}$/.test(String(s.hash)) ? String(s.hash) : '',
      fails: Math.min(Math.floor(num(s.fails)), 100), lockUntil: num(s.lockUntil)
    };
    Object.keys(SCHEMA).forEach(function (k) { if (raw[k] !== undefined) d[k] = cleanList(raw[k], k); });
    /* calculators need these rows, so put back any that are missing */
    var base = defaults();
    CORE.forEach(function (id) {
      if (!d.mats.some(function (m) { return m.id === id; })) d.mats.push(base.mats.filter(function (m) { return m.id === id; })[0]);
    });
    if (!d.labour.length) d.labour = base.labour;
    return d;
  }

  /* ---- site content ---- */
  var METHODS = [
    { t: 'Excavation & earthwork', hi: 'खुदाई व मिट्टी का कार्य', u: 'm³', s: ['Mark the layout with lime and string from the approved drawing and fix benchmark levels.', 'Excavate in layers to the required depth. Shore or slope the sides when the trench is deeper than 1.5 m.', 'Remove water, trim the bed to level and compact it.', 'Stack or carry away surplus soil, keeping it clear of the trench edge.'], r: 'Measured as length × width × depth. Rate depends on soil type and lead distance.' },
    { t: 'Concrete: PCC & RCC', hi: 'कंक्रीट कार्य', u: 'm³', s: ['Clean and wet the bed. Fix side shuttering for PCC (1:4:8 or 1:3:6).', 'For RCC, fix reinforcement with the specified cover, then check shuttering line and level.', 'Mix to the grade (M20 is 1:1.5:3 nominal). Place and compact promptly, within about 30 minutes of mixing, using a vibrator.', 'Cure continuously: at least 7 days with ordinary cement, 10 days with blended cement. Remove shuttering only as the engineer allows.'], r: 'Measured in m³. Steel and shuttering are measured separately.' },
    { t: 'Shuttering & centering', hi: 'शटरिंग', u: 'm²', s: ['Prepare plywood or steel sheets and apply shuttering oil.', 'Erect props at a fixed spacing, level the soffit and add camber where specified.', 'Seal joints so that cement slurry does not leak.', 'Strike after the stripping time set by the engineer, keeping slab props where required.'], r: 'Measured as contact area in m².' },
    { t: 'Bar bending & steel fixing', hi: 'सरिया बंधाई', u: 'kg', s: ['Read the bar bending schedule: diameter, shape, length and count.', 'Cut and bend on the bending table. Hooks and laps follow the drawing.', 'Place cover blocks. Typical cover is footing 50 mm, column 40 mm, beam 25 mm and slab 20 mm; the drawing decides.', 'Tie with binding wire and get the steel checked before concreting.'], r: 'Weight is D² ÷ 162 kg per metre, with D in mm. Paid per kg.' },
    { t: 'Brick & block masonry', hi: 'ईंट की चिनाई', u: 'm³ / m²', s: ['Soak bricks for a few hours. Mark the wall line and corners.', 'Lay in a bond with staggered vertical joints and 10 mm mortar joints. Keep courses level with a thread.', 'Raise the wall in lifts and check plumb often. Leave the joints raked for plaster.', 'Cure for 7 days.'], r: '230 mm walls are measured in m³, 115 mm walls in m². Openings are deducted.' },
    { t: 'Plastering', hi: 'प्लास्टर', u: 'm²', s: ['Rake joints, clean and wet the wall.', 'Fix dots and screeds for a true surface.', 'Apply a 12 mm internal or 15–20 mm external coat in 1:4 or 1:6 cement mortar. Finish with a float.', 'Cure for 7 days.'], r: 'Measured as plastered area in m².' },
    { t: 'Flooring & tiling', hi: 'फर्श व टाइल', u: 'm² / sq ft', s: ['Level the base and check slope toward drains.', 'Spread 20 mm bedding mortar (1:4) or adhesive, and press tiles with 2–3 mm joints.', 'Check level and alignment with a straight edge.', 'Grout after 24 hours, then clean and polish.'], r: 'Add 5–10% wastage for tile quantity.' },
    { t: 'Painting & waterproofing', hi: 'पेंट व वाटरप्रूफिंग', u: 'm²', s: ['Scrape, fill cracks and sand the surface.', 'Apply 2 coats of wall putty, 1 coat of primer, then 2 coats of paint.', 'For roofs and toilets, clean the surface, apply the waterproofing coat and test by ponding water for 48–72 hours.'], r: 'Measured as net area in m². Coverage is about 10–12 m² per litre per coat.' },
    { t: 'Manpower supply', hi: 'मैनपावर सप्लाई', u: 'man-day', s: ['You tell us the trades and the number of workers.', 'We send the crew with ID, PPE and a daily attendance sheet signed by your supervisor.', 'Billing is on man-days (or monthly) as per the agreed rate card.', 'Replacement of any worker is arranged on request.'], r: 'Rates for each trade are on the Manpower page.' }
  ];

  var FORMULAS = [
    ['Volume', 'L × B × H', 'All dimensions in metres give m³.'],
    ['Dry volume of concrete', 'Wet volume × 1.54', 'Allows for voids and shrinkage.'],
    ['Dry volume of mortar', 'Wet volume × 1.27', 'Used for brickwork and plaster mortar.'],
    ['Cement quantity', '(Dry volume × cement part ÷ total parts) ÷ 0.0347', 'One 50 kg bag is 0.0347 m³.'],
    ['Sand and aggregate', 'Dry volume × part ÷ total parts', 'M20 (1:1.5:3) has 5.5 parts.'],
    ['Bricks in masonry', 'Volume × 500', 'For 190×90×90 mm bricks with mortar. Add 5% wastage.'],
    ['Mortar in brickwork', 'Volume × 0.23 (wet)', 'Then multiply by 1.27 for dry volume.'],
    ['Plaster mortar', 'Area × thickness (m) × 1.27', 'Add 10–20% for uneven walls.'],
    ['Steel weight', 'D² ÷ 162 × length (m)', 'D in mm, result in kg.'],
    ['Tiles needed', 'Area × (1 + wastage) ÷ tile area', 'Wastage 5–10%.'],
    ['Paint', 'Area × coats ÷ coverage per litre', 'Coverage 10–12 m² per litre per coat.'],
    ['Area conversion', 'm² × 10.764 = sq ft', 'Also 1 sq ft = 0.0929 m².'],
    ['Labour cost', 'Workers × days × day rate', 'Overtime = hours × (day rate ÷ 8) × OT multiple.'],
    ['Supplier charge', '(Wages + overtime) × service %', 'Then GST on the total.'],
    ['Item rate', 'Material + labour + overhead + profit', 'Overhead and profit are usually 8–15% each.'],
    ['Bill net payable', 'Gross + GST − TDS − retention − advance − other', 'TDS and retention are calculated on the amount before GST.']
  ];

  var TERMS = [
    ['Payment cycle', 'Fortnightly or monthly bill, paid within 7–15 days of the signed attendance or measurement.'],
    ['Advance', 'Optional mobilisation advance, recovered from running bills.'],
    ['Retention', '5% of each running bill held until the defect liability period ends, if the client requires it.'],
    ['GST and TDS', 'GST is added at the applicable rate. TDS is deducted by the client as per law and a certificate is issued.'],
    ['Overtime', 'Beyond 8 hours a day, at the agreed multiple of the hourly rate.'],
    ['Safety', 'Helmet, shoes and gloves for every worker. Site rules of the client apply.'],
    ['Compliance', 'Wages, PF/ESI and labour law requirements are handled as applicable to the contract.'],
    ['Termination', 'Either side can end the contract with written notice, after clearing dues up to that date.'],
    ['Disputes', 'Resolved by discussion first. If not, as per the jurisdiction set in the signed agreement.']
  ];

  return { CORE: CORE, defaults: defaults, sanitize: sanitize, num: num, uid: uid, METHODS: METHODS, FORMULAS: FORMULAS, TERMS: TERMS };
});
