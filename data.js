/* FILE: data.js  (GitHub par isi naam se upload karein) */
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
  /* Mechanical rows the mechanical calculators depend on */
  var CORE_MECH = ['m_steel', 'm_pipe', 'm_elec', 'm_primer', 'm_blast', 'm_fablab', 'm_paintkg'];

  var MECH_MATS = [
    { id: 'm_steel', name: 'MS plate and sections (IS 2062)', unit: 'kg', rate: 62, div: 'mech' },
    { id: 'm_pipe', name: 'MS pipe (IS 1239 / 3589)', unit: 'kg', rate: 72, div: 'mech' },
    { id: 'm_elec', name: 'Welding electrode E6013 / E7018', unit: 'kg', rate: 130, div: 'mech' },
    { id: 'm_primer', name: 'Epoxy / zinc primer', unit: 'litre', rate: 380, div: 'mech' },
    { id: 'm_blast', name: 'Sand or shot blasting (labour)', unit: 'm²', rate: 85, div: 'mech' },
    { id: 'm_fablab', name: 'Fabrication labour', unit: 'kg', rate: 14, div: 'mech' },
    { id: 'm_paintkg', name: 'Blasting and painting per kg of steel', unit: 'kg', rate: 10, div: 'mech' },
    { id: 'm_round', name: 'MS round bar', unit: 'kg', rate: 60, div: 'mech' },
    { id: 'm_ss304', name: 'Stainless steel 304 sheet', unit: 'kg', rate: 260, div: 'mech' },
    { id: 'm_gi', name: 'GI sheet', unit: 'kg', rate: 85, div: 'mech' },
    { id: 'm_alu', name: 'Aluminium sheet', unit: 'kg', rate: 290, div: 'mech' },
    { id: 'm_bolt', name: 'HT bolt, nut and washer', unit: 'kg', rate: 130, div: 'mech' },
    { id: 'm_gasket', name: 'CAF gasket sheet', unit: 'kg', rate: 480, div: 'mech' },
    { id: 'm_gland', name: 'Gland packing', unit: 'kg', rate: 650, div: 'mech' },
    { id: 'm_cutdisc', name: 'Cutting disc 4 inch', unit: 'nos', rate: 32, div: 'mech' },
    { id: 'm_grdisc', name: 'Grinding disc 4 inch', unit: 'nos', rate: 38, div: 'mech' },
    { id: 'm_oxy', name: 'Oxygen gas', unit: 'cylinder', rate: 420, div: 'mech' },
    { id: 'm_lpg', name: 'LPG for gas cutting', unit: 'kg', rate: 110, div: 'mech' },
    { id: 'm_migwire', name: 'MIG wire ER70S-6', unit: 'kg', rate: 120, div: 'mech' },
    { id: 'm_tig', name: 'TIG filler rod', unit: 'kg', rate: 450, div: 'mech' },
    { id: 'm_argon', name: 'Argon gas', unit: 'cylinder', rate: 750, div: 'mech' },
    { id: 'm_grease', name: 'Lithium grease', unit: 'kg', rate: 260, div: 'mech' },
    { id: 'm_hyd', name: 'Hydraulic oil', unit: 'litre', rate: 190, div: 'mech' },
    { id: 'm_enamel', name: 'Synthetic enamel paint', unit: 'litre', rate: 320, div: 'mech' }
  ];
  var MECH_LABOUR = [
    { id: 'm_fitter', name: 'Fitter', rate: 850, div: 'mech' },
    { id: 'm_welder', name: 'Welder (arc)', rate: 900, div: 'mech' },
    { id: 'm_welder2', name: 'Welder (TIG / MIG, certified)', rate: 1200, div: 'mech' },
    { id: 'm_pipefit', name: 'Pipe fitter', rate: 900, div: 'mech' },
    { id: 'm_rigger', name: 'Rigger', rate: 800, div: 'mech' },
    { id: 'm_gascut', name: 'Gas cutter', rate: 850, div: 'mech' },
    { id: 'm_fabr', name: 'Fabricator', rate: 850, div: 'mech' },
    { id: 'm_turner', name: 'Turner / machinist', rate: 1000, div: 'mech' },
    { id: 'm_millw', name: 'Millwright / erection fitter', rate: 1000, div: 'mech' },
    { id: 'm_instr', name: 'Instrument technician', rate: 1000, div: 'mech' },
    { id: 'm_scaff', name: 'Scaffolder', rate: 750, div: 'mech' },
    { id: 'm_crane', name: 'Crane / hydra operator', rate: 1100, div: 'mech' },
    { id: 'm_boiler', name: 'Boilermaker', rate: 1000, div: 'mech' },
    { id: 'm_helper', name: 'Mechanical helper', rate: 560, div: 'mech' },
    { id: 'm_super', name: 'Mechanical supervisor', rate: 1200, div: 'mech' }
  ];
  function cl(list) { return list.map(function (o) { var r = {}; Object.keys(o).forEach(function (k) { r[k] = o[k]; }); return r; }); }

  function defaults() {
    return {
      settings: { phone: '', email: '', user: '', hash: '', fails: 0, lockUntil: 0 },
      mats: [
        { id: 'cement', name: 'Cement (50 kg bag)', unit: 'bag', rate: 390, div: 'civil' },
        { id: 'sand', name: 'Sand', unit: 'm³', rate: 1500, div: 'civil' },
        { id: 'agg', name: 'Aggregate 20 mm', unit: 'm³', rate: 1300, div: 'civil' },
        { id: 'brick', name: 'Brick, first class', unit: 'nos', rate: 8, div: 'civil' },
        { id: 'steel', name: 'TMT steel bar', unit: 'kg', rate: 65, div: 'civil' },
        { id: 'tile', name: 'Floor tile', unit: 'sq ft', rate: 45, div: 'civil' },
        { id: 'paint', name: 'Emulsion paint', unit: 'litre', rate: 380, div: 'civil' },
        { id: 'excav', name: 'Excavation (labour)', unit: 'm³', rate: 180, div: 'civil' }
      ].concat(cl(MECH_MATS)),
      labour: [
        { id: 'mason', name: 'Mason (Mistri)', rate: 800, div: 'civil' },
        { id: 'helper', name: 'Helper (Beldar)', rate: 550, div: 'civil' },
        { id: 'carp', name: 'Carpenter', rate: 800, div: 'civil' },
        { id: 'bender', name: 'Bar bender', rate: 800, div: 'civil' },
        { id: 'painter', name: 'Painter', rate: 750, div: 'civil' },
        { id: 'plumber', name: 'Plumber', rate: 800, div: 'civil' },
        { id: 'elec', name: 'Electrician', rate: 850, div: 'civil' },
        { id: 'super', name: 'Supervisor', rate: 1100, div: 'civil' }
      ].concat(cl(MECH_LABOUR)),
      workers: [], projects: [], ledger: [], enquiries: []
    };
  }

  /* ---- sanitiser ---- */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function str(x, max) { return String(x == null ? '' : x).slice(0, max || 300); }
  function num(x) { x = parseFloat(x); return (isFinite(x) && x >= 0) ? Math.min(x, 1e12) : 0; }

  var SCHEMA = {
    mats: { id: 's', name: 's', unit: 's', rate: 'n', div: 's' },
    labour: { id: 's', name: 's', rate: 'n', div: 's' },
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
      if (key === 'mats' || key === 'labour') r.div = r.div === 'mech' ? 'mech' : 'civil';
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
    CORE_MECH.forEach(function (id) {
      if (!d.mats.some(function (m) { return m.id === id; })) d.mats.push(base.mats.filter(function (m) { return m.id === id; })[0]);
    });
    if (!d.labour.length) d.labour = base.labour;
    /* data saved before the mechanical division existed: add the mechanical trades and materials once */
    if (!d.labour.some(function (l) { return l.div === 'mech'; })) d.labour = d.labour.concat(cl(MECH_LABOUR));
    if (!d.mats.some(function (m) { return m.div === 'mech' && CORE_MECH.indexOf(m.id) < 0; })) {
      cl(MECH_MATS).forEach(function (m) { if (!d.mats.some(function (x) { return x.id === m.id; })) d.mats.push(m); });
    }
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


  var METHODS_MECH = [
    { t: 'Structural fabrication & erection', hi: 'स्ट्रक्चरल फैब्रिकेशन व इरेक्शन', u: 'kg / tonne', s: ['Study the fabrication drawing and cutting list. Check the material test certificate and mark each piece with its mark number.', 'Cut plates and sections to size by gas cutting, plasma or saw. Grind the edges and fit-up the joints on a levelled fabrication bed with the specified root gap.', 'Tack, weld in the approved sequence to limit distortion, then clean and inspect every weld. Straighten if needed.', 'Blast, prime and paint as specified. Dispatch with a piece-wise packing list.', 'At site, set the foundation bolts or anchor plates to line and level, erect with crane or chain-pulley, plumb, bolt up and do the final welding. Touch up the paint.'], r: 'Billed per kg or tonne of finished steel (fabrication, erection and painting can be separate rates). Weight is taken from the drawing or from weighment.' },
    { t: 'Welding (arc, MIG, TIG)', hi: 'वेल्डिंग', u: 'metre of weld / inch-dia', s: ['Use a welder qualified for the process and position (3G, 6G for pipes). Check the welding procedure (WPS).', 'Keep electrodes dry (baking oven for low-hydrogen E7018). Clean the joint of rust, oil and paint.', 'Preheat thick or alloy material as the procedure requires. Weld in passes, chipping slag between passes.', 'Visual check of every weld; dye-penetrant, radiography or ultrasonic tests where the client specifies.', 'Record the welder ID against each joint for traceability.'], r: 'Structural welds are included in the fabrication rate. Pipe welds are billed per inch-diameter or per joint.' },
    { t: 'Pipe fitting & piping', hi: 'पाइप फिटिंग', u: 'metre / inch-dia', s: ['Check the isometric drawing and the pipe class (material, schedule, rating).', 'Cut, bevel and fit-up pipe, fittings and flanges. Use a level and square to keep the line true and the flange faces parallel.', 'Weld or thread the joints. Support the line on shoes and hangers at the spacing given.', 'Clean the line and do the hydro or pneumatic test with a calibrated gauge, then flush and record the result.', 'Insulate or paint as specified.'], r: 'Measured by running metre for each size, or by inch-diameter of the joints made.' },
    { t: 'Equipment erection & alignment', hi: 'मशीन इरेक्शन व एलाइनमेंट', u: 'job / nos', s: ['Check the foundation level, anchor bolts and the equipment against the drawing.', 'Place the machine on the foundation on shims or jack bolts and level it with a precision level.', 'Align pump, motor, gearbox and fan couplings with dial gauges or a laser tool within the maker tolerance (angular and parallel).', 'Grout the base plate, tighten the anchors to the specified torque and re-check the alignment.', 'Connect the piping without strain, fill the lubricant and do a no-load and load trial run.'], r: 'Billed per machine or per job, by capacity or weight of the equipment.' },
    { t: 'Rigging, lifting & shifting', hi: 'रिगिंग व शिफ्टिंग', u: 'tonne / job', s: ['Find the weight and the centre of gravity of the load and make a lifting plan.', 'Choose crane, hydra, chain block or jack and skates with a safe working load above the load plus rigging weight.', 'Inspect slings, shackles and hooks. Cordon off the area.', 'Lift in small steps with one signalman, keep the load low and steady, and place it on packing.', 'Never stand under the load. Stop in strong wind or poor visibility.'], r: 'Billed per lift or per tonne shifted; crane and hydra are hired by the hour or the shift.' },
    { t: 'Gas cutting, grinding & machining', hi: 'गैस कटिंग व मशीनिंग', u: 'metre / hour', s: ['Check the gas hoses, regulators and flashback arrestors before starting.', 'Set the oxygen and fuel pressure for the plate thickness and cut along the marked line at a steady speed.', 'Grind the cut edge and slag.', 'For turned or milled parts, hold the job true in the chuck or vice, take trial cuts and measure with vernier or micrometer before the final cut.'], r: 'Cutting by running metre and thickness; machining by hour or by job.' },
    { t: 'Sheet metal, ducting & GI work', hi: 'शीट मेटल व डक्टिंग', u: 'm² / kg', s: ['Mark out the development of the duct or chute from the drawing on GI, MS or SS sheet.', 'Shear and bend the sheet, form the joints (lock seam, spot weld or rivet) and fit the angle flanges.', 'Seal the joints, fix hangers and supports, and hang the duct in line and level.', 'Leak test where specified and insulate or paint.'], r: 'Duct work is measured in m² of sheet or in kg, by gauge.' },
    { t: 'Scaffolding & access', hi: 'स्कैफोल्डिंग', u: 'm² / m³ / day', s: ['Prepare a firm, level base with base plates or sole boards.', 'Erect standards, ledgers and transoms in plumb, with bracing every bay and ties to the structure.', 'Fix full-width planks, toe boards and handrails. Tag the scaffold as safe after inspection.', 'Inspect after rain or wind and before each shift. Dismantle from the top, lowering every piece.'], r: 'Billed per m² of face or per m³ erected, with a rent per day after the base period.' },
    { t: 'Blasting, painting & coating of steel', hi: 'ब्लास्टिंग व पेंटिंग', u: 'm² / kg', s: ['Remove oil and grease, then blast to the specified grade (Sa 2½ is common). Remove dust.', 'Apply the primer within 4 hours of blasting, before any rust blooms.', 'Check the wet film with a gauge. Apply the intermediate and finish coats after the recoat interval.', 'Check the dry film thickness (DFT) and record it.'], r: 'Billed per m² of surface by the system (blasting plus the coats), or per kg of steel.' },
    { t: 'Shutdown & preventive maintenance', hi: 'शटडाउन व मेंटेनेंस', u: 'man-day / job', s: ['Plan the job list with the plant and take the permit to work, lock-out and tag-out.', 'Dismantle, clean and inspect: bearings, seals, couplings, gears, valves and belts.', 'Replace the worn parts, grease or oil, re-assemble and re-align.', 'Test run, record the readings (vibration, temperature, current) and hand the machine back.'], r: 'Mostly billed as manpower per man-day, with spares and consumables extra.' },
    { t: 'Boiler, pressure parts & hydro test', hi: 'बॉयलर व हाइड्रो टेस्ट', u: 'job / inch-dia', s: ['Only certified boilermakers and welders (IBR where applicable) work on pressure parts.', 'Fit and weld tubes, headers and nozzles to the approved drawing and procedure.', 'Do the hydrostatic test at 1.5 times the design pressure, hold it for the specified time and check for leaks.', 'Get the inspector sign-off and keep the records.'], r: 'Billed per job, per tube or by inch-diameter of weld, with the test by lump sum.' },
    { t: 'Manpower supply (mechanical)', hi: 'मैकेनिकल मैनपावर सप्लाई', u: 'man-day', s: ['You tell us the trades (fitter, welder, pipe fitter, rigger, millwright, machinist) and the number of workers.', 'We send the crew with ID, PPE and a daily attendance sheet signed by your supervisor.', 'Certified welders and operators carry their test or licence copy on request.', 'Billing follows the signed attendance: wages plus our service charge plus GST, exactly like our civil supply.'], r: 'Billed per man-day or per month, per trade. The rate list is on the Manpower page.' }
  ];

  var FORMULAS_MECH = [
    ['Steel plate weight', 'L (m) × W (m) × t (mm) × 7.85', 'Result in kg. Density of mild steel is 7850 kg/m³.'],
    ['Round bar weight', 'D² ÷ 162 per metre', 'D in mm, result in kg/m (same as D² × 0.00617).'],
    ['Flat bar weight', 'Width (mm) × t (mm) × 0.00785', 'kg per metre.'],
    ['Angle (equal or unequal)', '(a + b − t) × t × 0.00785', 'kg per metre, a and b are the leg sizes in mm. Approximate: it ignores the root radius.'],
    ['Square or rectangular tube', '2 × (a + b − 2t) × t × 0.00785', 'kg per metre. Square tube: put b equal to a.'],
    ['Pipe weight', '(OD − t) × t × 0.02466', 'kg per metre, OD and t in mm. Add the weight of water for a filled line.'],
    ['Beam or channel', 'Weight per metre from the IS 808 table × length', 'Example: ISMB 200 is about 25.4 kg/m. Check with the mill test certificate.'],
    ['Density of other metals', 'Stainless 8000, aluminium 2700, copper 8960, brass 8500, cast iron 7200', 'kg/m³. Multiply the volume by the density.'],
    ['Pipe outer surface area', 'π × OD × length', 'Use OD in metres. Used for paint and insulation.'],
    ['Fillet weld metal', '0.5 × leg² × length (m) × 0.00785', 'kg, leg in mm. Example: 6 mm fillet gives about 0.14 kg per metre. Add 10% for reinforcement.'],
    ['Electrode needed', 'Weld metal weight ÷ deposition efficiency', 'Efficiency is about 60 to 65% for stick electrodes (the rest is stub end, spatter and slag).'],
    ['Paint quantity', 'Area × DFT (µm) ÷ (10 × volume solids %)', 'Litres. Add 25 to 35% for loss by brush, spray and shape.'],
    ['Pipe flow', 'Q (m³/h) = 0.002827 × ID² (mm) × velocity (m/s)', 'Usual velocity is 1 to 3 m/s for water.'],
    ['Pump shaft power', 'Q (m³/h) × H (m) × SG ÷ (367 × efficiency)', 'kW. Choose a motor 10 to 20% bigger, then the next standard size.'],
    ['Motor power (3 phase)', '√3 × V × I × cos φ × efficiency ÷ 1000', 'kW, with V in volts and I in amperes.'],
    ['Torque', 'T (N·m) = 9550 × kW ÷ rpm', 'Torque on the driven shaft = motor torque × speed ratio, less losses.'],
    ['Belt or gear speed', 'N2 = N1 × D1 ÷ D2', 'D1 is the driver pulley (or teeth), D2 the driven.'],
    ['Thermal expansion', 'ΔL = α × L × ΔT', 'For steel α = 0.000012 per °C. Example: 10 m pipe heated by 100 °C grows 12 mm.'],
    ['Bolt tightening torque', 'T = K × d × F', 'K about 0.2 for plain bolts, d diameter, F bolt load. Use the maker torque table where one is given.'],
    ['Hydro test pressure', '1.5 × design pressure', 'Hold for the time in the code or specification (often 30 minutes or more).'],
    ['Pressure conversion', '1 bar = 14.5 psi = 10.2 m of water = 100 kPa', 'Also 1 kg/cm² = 0.98 bar.'],
    ['Power conversion', '1 HP = 0.746 kW', 'And 1 kW = 1.341 HP.'],
    ['Fabrication job cost', 'Steel + fabrication labour + blasting and painting + erection', 'Steel is weight × (1 + scrap %) × rate. Then add overhead and profit.'],
    ['Manpower bill', '(Workers × days × day rate + overtime) × (1 + service %) + GST', 'Same as the civil manpower bill. See the Manpower page.']
  ];

  /* Materials and consumables used in mechanical work, in alphabetical order */
  var MATREF = [
    ['Aluminium sheet', 'IS 737 / 5052 grade', 'kg or sheet', 'Light cladding, covers, ducts. Density 2700 kg/m³.'],
    ['Argon gas', 'Industrial grade', 'cylinder', 'Shielding gas for TIG welding of stainless and aluminium.'],
    ['Bearings and seals', 'As per maker (for example 6205, 22216)', 'nos', 'Replaced in shutdowns; always fit with the right grease.'],
    ['Bolts, nuts and washers', 'IS 1363 (grade 4.6, 8.8) / HT 10.9', 'kg or nos', 'Joints in structures and flanges. Use the specified grade only.'],
    ['Cast iron', 'IS 210 FG200', 'kg', 'Pump casings, base frames, pulleys. Density 7200 kg/m³.'],
    ['Channel (ISMC)', 'IS 808', 'kg or metre', 'Frames, purlins, supports.'],
    ['Cutting and grinding discs', '4 inch / 7 inch', 'nos', 'Daily consumable for fabrication.'],
    ['Electrodes', 'E6013 (general), E7018 (low hydrogen), E308 (stainless)', 'kg', 'Stick welding. Keep E7018 dry in a baking oven.'],
    ['Flanges', 'ASA 150 / 300, IS 6392', 'nos', 'Pipe joints; match the pipe class and rating.'],
    ['Gaskets', 'CAF, spiral wound, rubber', 'nos or kg', 'Sealing flange joints; use the material suited to the fluid.'],
    ['GI sheet', 'IS 277', 'kg or m²', 'Ducts, roofing, cladding.'],
    ['Gland packing', 'Graphite or PTFE', 'kg', 'Pump and valve stuffing boxes.'],
    ['Grease and lubricants', 'Lithium grease, gear oil, hydraulic oil', 'kg or litre', 'Bearings, gearboxes, hydraulic units.'],
    ['I-beam (ISMB) and H-beam', 'IS 808', 'kg or metre', 'Main structural members. Weight per metre is in the standard table.'],
    ['MS angle (ISA)', 'IS 808 / IS 2062', 'kg or metre', 'Bracing, supports, trays.'],
    ['MS pipe', 'IS 1239 (light, medium, heavy) / IS 3589', 'kg or metre', 'Water, air and structural piping.'],
    ['MS plate', 'IS 2062 E250', 'kg or sheet', 'Base plates, tanks, chutes. Density 7850 kg/m³.'],
    ['MS round bar and flat', 'IS 2062', 'kg', 'Shafts, anchor bolts, stiffeners.'],
    ['MIG wire and TIG rod', 'ER70S-6 (MS), ER308 (SS)', 'kg', 'Semi-automatic and TIG welding.'],
    ['Oxygen, LPG and acetylene', 'Industrial grade', 'cylinder or kg', 'Gas cutting and heating. Use flashback arrestors.'],
    ['Paint and primer', 'Epoxy primer, PU or enamel finish', 'litre', 'Protection of steel. Match the system to the environment.'],
    ['Rubber and PTFE sheet', 'As specified', 'kg or m²', 'Liners, gaskets and seals.'],
    ['Stainless steel (304, 316)', 'IS 6911 / ASTM A240', 'kg', 'Food, chemical and clean areas. Density about 8000 kg/m³.'],
    ['Square and rectangular tube', 'IS 4923', 'kg or metre', 'Light frames, gates and machine guards.']
  ];
  MATREF.sort(function (x, y) { return x[0].localeCompare(y[0]); });

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

  return { CORE: CORE, CORE_MECH: CORE_MECH, METHODS_MECH: METHODS_MECH, FORMULAS_MECH: FORMULAS_MECH, MATREF: MATREF, defaults: defaults, sanitize: sanitize, num: num, uid: uid, METHODS: METHODS, FORMULAS: FORMULAS, TERMS: TERMS };
});
