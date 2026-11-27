/* FILE: duty.js  (GitHub par isi naam se upload karein) */
/* A2Z Build Tech - STAFF KI DUTY: IN / OUT + selfie + location. Staff panel aur admin panel dono isse chalte hain.
   Attendance tabhi judti hai jab staff OUT kare. Jab tak OUT nahi, app khula ho to location aati rehti hai aur admin dekh sakta hai.
   Selfie Google Drive ke private folder me rehti hai, sirf admin dekh sakta hai. */
(function () {
  'use strict';
  var P = window.P, esc = P.esc, D = {};
  var inr = function (n) { return P.inr ? P.inr(n) : '₹' + (Number(n) || 0).toLocaleString('en-IN'); };
  var lab = function (d) { var s = STATUS[d.status] || ['', '']; if (d.status === 'done') { var c = Number(d.credit); if (c === 0.5) return ['Aadhi duty (0.5 din)', 'warn']; if (c === 0) return ['Kam ghante (ginti 0)', 'bad']; } return s; };
  var STATUS = { on: ['Duty par', 'good'], done: ['Poori', 'good'], forgot: ['OUT nahi hua (nahi gini)', 'bad'] };

  /* ---------- chhote helpers ---------- */
  function ist(iso) { var t = Date.parse(iso); return isFinite(t) ? new Date(t + 330 * 60000) : null; }
  D.hm = function (iso) { var d = ist(iso); return d ? d.toISOString().slice(11, 16) : '-'; };
  D.dt = function (iso) { var d = ist(iso); return d ? d.toISOString().slice(8, 10) + '-' + d.toISOString().slice(5, 7) + ' ' + d.toISOString().slice(11, 16) : '-'; };
  D.hrs = function (min) { return Math.round((Number(min) || 0) / 6) / 10; };
  D.ago = function (iso) { var t = Date.parse(iso); if (!isFinite(t)) return '-'; var m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'abhi' : m < 60 ? m + ' min pehle' : m < 1440 ? Math.floor(m / 60) + ' ghante ' + (m % 60) + ' min pehle' : Math.floor(m / 1440) + ' din pehle'; };
  D.mapUrl = function (lat, lng) { return 'https://www.google.com/maps?q=' + encodeURIComponent(lat + ',' + lng); };
  function mapLink(lat, lng, label) { return lat == null || lng == null ? '<span class="xs mu">Location nahi mili</span>' : '<a href="' + esc(D.mapUrl(lat, lng)) + '" target="_blank" rel="noopener noreferrer">' + esc(label || 'Map dekhein') + '</a>'; }
  D.meters = function (a, b, c, d) {
    if ([a, b, c, d].some(function (x) { return x == null; })) return null;
    var R = 6371000, r = Math.PI / 180, dLat = (c - a) * r, dLng = (d - b) * r, h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
  };

  /* ---------- selfie: chhoti JPEG (100 KB ke andar) ---------- */
  D.selfie = function (file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('Sirf photo (selfie) chunein')); return; }
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('Photo padh nahi pai')); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('Ye photo khul nahi rahi. Dobara selfie lein.')); };
        img.onload = function () {
          try {
            var k = 560 / Math.max(img.width, img.height); if (k > 1) k = 1;
            var c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            var q = 0.8, u = c.toDataURL('image/jpeg', q);
            while (u.length > 130000 && q > 0.3) { q -= 0.1; u = c.toDataURL('image/jpeg', q); }
            if (u.length > 135000) { reject(new Error('Selfie badi hai. Dobara lein.')); return; }
            resolve(u);
          } catch (e) { reject(new Error('Selfie save nahi ho pai. Dobara lein.')); }
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  };

  /* ---------- location ---------- */
  D.pos = function (quick) {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) { reject(new Error('Is phone / browser me location nahi hai.')); return; }
      navigator.geolocation.getCurrentPosition(function (p) { resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy || 0) }); }, function (e) {
        reject(new Error(e && e.code === 1 ? 'Location ki ijazat band hai. Browser / phone ki settings me is website ke liye Location "Allow" karein, phir dobara dabayein.' : e && e.code === 3 ? 'Location mili nahi (samay khatam). Khule aasman ke neeche GPS chalu karke dobara dabayein.' : 'Location nahi mili. GPS chalu karke dobara dabayein.'));
      }, { enableHighAccuracy: true, timeout: quick ? 15000 : 25000, maximumAge: quick ? 60000 : 0 });
    });
  };

  /* ---------- STAFF ka screen ---------- */
  D.staffHtml = function (v, st) {
    st = st || {};
    var h = '<div class="row between"><h2>Duty (IN / OUT)</h2></div>';
    h += '<div class="note">Duty par aate hi <b>IN</b> karein aur jaate samay <b>OUT</b>. Attendance tabhi lagti hai jab aap OUT karte hain. IN / OUT dono me abhi ki <b>selfie</b> zaruri hai. <b>Location</b> mil jaye to achha hai, par site mobile range ke bahar ho to <b>bina location ke bhi IN ho jata hai</b>. Poori duty tab gini jati hai jab aap <b>9 ghante</b> baad OUT karte hain (4.5 ghante se upar = aadhi duty). Jab tak OUT nahi karte, app khula rehne par aapki location admin ko dikhti hai; OUT karte hi location band ho jati hai.</div>';
    if (st.mode) {
      var out = st.mode === 'out';
      h += '<div class="card" id="dform"><h3>' + (out ? 'OUT karein (duty khatam)' : 'IN karein (duty shuru)') + '</h3>' +
        '<div class="grid"><div><div class="photo-box" id="dprev">' + (st.photo ? '<img alt="selfie" src="' + esc(st.photo) + '">' : 'Selfie') + '</div>' +
        '<label class="btn sec sm file-btn mt6">Selfie lein<input type="file" id="dutyFile" accept="image/*" capture="user" hidden></label></div>' +
        '<div><div class="note ' + (st.pos ? '' : 'warn') + '" id="dpos">' + (st.pos ? '✓ Location mil gayi (sahi-pan ±' + esc(st.pos.acc) + ' m)' : st.gps ? 'Location le raha hoon...' : esc((st.err || 'Location abhi nahi mili.') + ' Bina location ke bhi aap selfie se ' + (out ? 'OUT' : 'IN') + ' kar sakte hain.')) + '</div>' +
        '<button type="button" class="btn sec sm" data-act="dgps">Location dobara lein</button></div></div>' +
        (st.err && st.pos ? '<div class="note warn">' + esc(st.err) + '</div>' : '') +
        '<div class="msg" id="dmsg" role="alert"></div><div class="row"><button class="btn" data-act="dconfirm"' + (st.photo && !st.gps && !st.busy ? '' : ' disabled') + '>' + (st.busy ? 'Ho raha hai...' : (out ? 'OUT pakka karein' : 'IN pakka karein')) + '</button><button class="btn sec" data-act="dcancel">Band karein</button></div></div>';
    } else if (v.open) {
      h += '<div class="card"><span class="pill good">Aap duty par hain</span><div class="mt6">IN: <b>' + D.dt(v.open.inAt) + '</b> (' + D.ago(v.open.inAt) + ')</div><div class="xs mu">Aakhri location bheji: ' + D.ago(v.open.lastAt) + '. Location bhejte rehne ke liye duty me ye app khula rakhein.</div>' +
        '<div class="row mt6"><button class="btn" data-act="dstart" data-mode="out">OUT karein (duty khatam)</button></div></div>';
    } else {
      h += '<div class="card"><span class="pill warn">Aap abhi duty par nahi hain</span><div class="row mt6"><button class="btn" data-act="dstart" data-mode="in">IN karein (duty shuru)</button></div></div>';
    }
    if (v.office) h += '<div class="note">Aap <b>Office staff</b> hain: office ka samay subah 09:00 se shaam 06:00 tak. Aapko commission nahi milta, sirf mahine ki salary.</div>';
    var py = v.pay || {};
    if (py.full > 0) h += '<div class="card"><h3>Meri salary (is mahine)</h3>' + (py.basis === 'duty' ?
      '<div class="cards"><div class="card"><span class="lbl">Poore mahine ki salary</span><span class="kpi">' + inr(py.full) + '</span></div><div class="card"><span class="lbl">Ek din ke</span><span class="kpi">' + inr(py.perDay) + '</span></div><div class="card"><span class="lbl">Duty ke din</span><span class="kpi">' + py.days + '</span></div><div class="card"><span class="lbl">Ab tak ki salary</span><span class="kpi">' + inr(py.earned) + '</span></div></div><div class="xs mu">Salary duty ke dino ke hisaab se judti hai: poore mahine ki salary ÷ 26 din × aapke duty ke din (poore mahine ki salary se zyada nahi).</div>' :
      '<div class="cards"><div class="card"><span class="lbl">Is mahine ki salary</span><span class="kpi">' + inr(py.earned) + '</span></div></div>') + '</div>';
    h += '<div class="cards"><div class="card"><span class="lbl">Is mahine ki attendance</span><span class="kpi">' + v.days + ' din</span></div><div class="card"><span class="lbl">Kul duty ke ghante</span><span class="kpi">' + D.hrs(v.minutes) + '</span></div></div>';
    h += '<h3>Meri duty (is mahine)</h3><div class="card scroll"><table><thead><tr><th>Tarikh</th><th>IN</th><th>OUT</th><th class="n">Ghante</th><th>Halat</th></tr></thead><tbody>' +
      (v.recent.length ? v.recent.map(function (d) { var s = lab(d); return '<tr><td>' + P.dd(d.date) + '</td><td>' + D.hm(d.inAt) + '</td><td>' + (d.outAt ? D.hm(d.outAt) : '-') + '</td><td class="n">' + (d.status === 'on' ? '-' : D.hrs(d.minutes)) + '</td><td><span class="pill ' + s[1] + '">' + s[0] + '</span></td></tr>'; }).join('') : '<tr><td colspan="5" class="mu">Is mahine koi duty nahi.</td></tr>') + '</tbody></table></div>';
    return h;
  };

  /* ---------- ADMIN ka screen ---------- */
  D.adminHtml = function (duty, staff, st) {
    st = st || {}; var payBy = {}; (st.pay || []).forEach(function (x) { payBy[x.id] = x; });
    var kindOf = function (s) { return s.type === 'office' ? 'Office staff' : s.type === 'supplier' ? 'Manpower supplier' : 'Site / Jagah ka staff'; };
    var openBy = {}; duty.open.forEach(function (d) { openBy[d.staffId] = d; });
    var recBy = {}; duty.records.forEach(function (d) { (recBy[d.staffId] = recBy[d.staffId] || []).push(d); });
    var name = function (id) { var s = staff.filter(function (x) { return x.id === id; })[0]; return s ? s.name + (s.serial ? ' (' + s.serial + ')' : '') : '?'; };
    var today = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
    var h = '<div class="row between"><h2>Duty / Location</h2><div class="row"><button class="btn sec" data-act="dduty">Abhi ki sthiti lein</button><button class="btn sec" data-act="xduty">Excel</button></div></div>';
    h += '<div class="note">Yahan dikhta hai ki kaun staff abhi duty par hai aur uski aakhri location kahan thi. Location tabhi aati hai jab staff ka app khula ho; app band ho to aakhri mili location dikhti hai (kitni purani hai ye saath me likha hai). OUT hote hi location dikhna band.</div>';
    if (st.view) h += '<div class="card" id="dview"><div class="row between"><b>' + esc(st.view.title) + '</b><button class="link" data-act="dviewx">Band karein</button></div>' + (st.view.photo ? '<img alt="selfie" class="selfie" src="' + esc(st.view.photo) + '">' : '<div class="mu">' + (st.view.loading ? 'Selfie la raha hoon...' : 'Selfie nahi mili.') + '</div>') + '</div>';
    if (st.close) h += '<div class="card" id="dclosebox"><b>Is staff ki khuli duty band karein</b><div class="note">Staff OUT karna bhool gaya ho to yahan band kar sakte hain. Chunein ki is din ki attendance ginni hai ya nahi.</div><div class="row"><button class="btn" data-act="dclosego" data-c="1">Band karein aur attendance ginein</button><button class="btn sec" data-act="dclosego" data-c="0">Band karein, attendance na ginein</button><button class="btn sec" data-act="dclosex">Rehne dein</button></div></div>';
    var active = staff.filter(function (s) { return s.active !== false; });
    h += '<h3>Abhi ki sthiti</h3><div class="card scroll"><table><thead><tr><th>Staff</th><th>Halat</th><th>IN</th><th>Aakhri location</th><th>Map</th><th></th></tr></thead><tbody>' + active.map(function (s) {
      var o = openBy[s.id], dn = (recBy[s.id] || []).filter(function (d) { return d.date === today && d.status === 'done'; });
      if (!o) return '<tr><td>' + esc(name(s.id)) + '<div class="xs mu">' + kindOf(s) + '</div></td><td>' + (dn.length ? '<span class="pill good">Aaj ki duty poori</span>' : '<span class="pill warn">Aaj duty par nahi</span>') + '</td><td>' + (dn.length ? D.hm(dn[0].inAt) + ' - ' + D.hm(dn[0].outAt) : '-') + '</td><td>-</td><td>' + (dn.length && dn[0].outLat != null ? mapLink(dn[0].outLat, dn[0].outLng, 'OUT ki jagah') : '-') + '</td><td></td></tr>';
      var stale = (Date.now() - Date.parse(o.lastAt)) > 20 * 60000;
      return '<tr><td><b>' + esc(name(s.id)) + '</b><div class="xs mu">' + kindOf(s) + '</div></td><td><span class="pill good">Duty par</span>' + (o.date !== today ? '<div class="xs bad">' + P.dd(o.date) + ' se OUT nahi hua</div>' : '') + '</td><td>' + D.dt(o.inAt) + '</td><td>' + D.ago(o.lastAt) + (stale ? '<div class="xs bad">Location purani hai (app band ho sakta hai)</div>' : '') + (o.lastAcc != null ? '<div class="xs mu">±' + esc(o.lastAcc) + ' m</div>' : '') + '</td><td>' + mapLink(o.lastLat, o.lastLng) + '</td><td><button class="btn sm sec" data-act="dphoto" data-id="' + esc(o.id) + '" data-w="in">IN selfie</button> <button class="btn sm sec" data-act="dclose" data-id="' + esc(o.id) + '">Duty band karein</button></td></tr>';
    }).join('') + '</tbody></table></div>';
    var sum = active.map(function (s) { var r = recBy[s.id] || [], days = {}, min = 0, forgot = 0; r.forEach(function (d) { if (d.status === 'done') { days[d.date] = Math.min(1, (days[d.date] || 0) + (d.credit == null ? 1 : Number(d.credit))); min += Number(d.minutes) || 0; } else if (d.status === 'forgot') forgot++; }); var dd = 0; Object.keys(days).forEach(function (k) { dd += days[k]; }); return { s: s, id: s.id, days: Math.round(dd * 10) / 10, min: min, forgot: forgot, py: payBy[s.id] || null }; });
    h += '<h3>Staff-wise attendance aur salary (' + P.monthName(st.month) + ')</h3><div class="note">Salary ka hisaab: poore mahine ki salary ÷ 26 din × duty ke din. Jinki salary "Poore mahine ki" chuni hai unhe poori milti hai. Duty ki ginti: 9 ghante (15 min chhoot ke saath) = 1 din, 4.5 ghante se upar = aadha din; admin kisi din ki ginti neeche list me badal sakta hai.</div><div class="card scroll"><table><thead><tr><th>Staff</th><th>Prakar</th><th class="n">Attendance (din)</th><th class="n">Duty ke ghante</th><th class="n">OUT nahi kiya (din)</th><th class="n">Poore mahine ki salary</th><th class="n">Ek din ke</th><th class="n">Is mahine ki salary</th></tr></thead><tbody>' +
      sum.map(function (x) { var py = x.py || {}; return '<tr><td>' + esc(name(x.id)) + '</td><td>' + kindOf(x.s) + '</td><td class="n">' + x.days + '</td><td class="n">' + D.hrs(x.min) + '</td><td class="n">' + x.forgot + '</td><td class="n">' + (py.fixedFull ? inr(py.fixedFull) : '-') + '</td><td class="n">' + (py.fixedBasis === 'duty' ? inr(py.perDay) : '-') + '</td><td class="n">' + (py.fixedFull ? '<b>' + inr(py.fixed) + '</b>' + (py.fixedBasis === 'duty' ? '' : '<div class="xs mu">poora mahina</div>') : '-') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    var recs = duty.records.slice().sort(function (a, b) { return String(b.inAt).localeCompare(String(a.inAt)); });
    h += '<h3>Poori duty list (' + recs.length + ')</h3><div class="card scroll"><table><thead><tr><th>Tarikh</th><th>Staff</th><th>IN</th><th>OUT</th><th class="n">Ghante</th><th>IN / OUT ki doori</th><th>Halat</th><th>Map</th><th></th></tr></thead><tbody>' +
      (recs.map(function (d) {
        var s = lab(d), dist = D.meters(d.inLat, d.inLng, d.outLat, d.outLng);
        return '<tr><td>' + P.dd(d.date) + '</td><td>' + esc(name(d.staffId)) + '</td><td>' + D.hm(d.inAt) + '</td><td>' + (d.outAt ? D.hm(d.outAt) : '-') + '</td><td class="n">' + (d.status === 'on' ? '-' : D.hrs(d.minutes)) + '</td><td>' + (dist == null ? '-' : (dist >= 1000 ? (dist / 1000).toFixed(1) + ' km' : dist + ' m')) + '</td><td><span class="pill ' + s[1] + '">' + s[0] + '</span>' + (d.closedBy === 'admin' ? '<div class="xs mu">Admin ne band ki</div>' : '') + (d.status === 'on' ? '' : '<label class="xs">Ginti <select data-dset="' + esc(d.id) + '"><option value="1"' + (d.status === 'done' && Number(d.credit) === 1 ? ' selected' : '') + '>1 din</option><option value="0.5"' + (d.status === 'done' && Number(d.credit) === 0.5 ? ' selected' : '') + '>Aadha din</option><option value="0"' + (d.status !== 'done' || Number(d.credit) === 0 ? ' selected' : '') + '>Nahi ginni</option></select></label>') + '</td><td>' + mapLink(d.inLat, d.inLng, 'IN') + (d.outLat != null ? ' · ' + mapLink(d.outLat, d.outLng, 'OUT') : '') + '</td><td>' +
          (d.hasInPhoto ? '<button class="link" data-act="dphoto" data-id="' + esc(d.id) + '" data-w="in">IN selfie</button> ' : '') + (d.hasOutPhoto ? '<button class="link" data-act="dphoto" data-id="' + esc(d.id) + '" data-w="out">OUT selfie</button> ' : '') + '<button class="link danger" data-act="ddel" data-id="' + esc(d.id) + '">Hatayein</button></td></tr>';
      }).join('') || '<tr><td colspan="9" class="mu">Is mahine koi duty nahi.</td></tr>') + '</tbody></table></div>';
    return h;
  };

  D.sheets = function (duty, staff, month, pay) {
    var name = function (id) { var s = staff.filter(function (x) { return x.id === id; })[0]; return s ? s.name : '?'; };
    var kindOf = function (s) { return s.type === 'office' ? 'Office staff' : s.type === 'supplier' ? 'Manpower supplier' : 'Site / Jagah ka staff'; };
    var recs = duty.records.slice().sort(function (a, b) { return String(a.inAt).localeCompare(String(b.inAt)); });
    var loc = function (a, b) { return a != null && b != null ? a + ', ' + b : 'Location nahi mili'; };
    var rows = [['Tarikh', 'Staff', 'IN', 'OUT', 'Ghante', 'Ginti (din)', 'Halat', 'IN location', 'OUT location']];
    recs.forEach(function (d) { rows.push([d.date, name(d.staffId), D.hm(d.inAt), d.outAt ? D.hm(d.outAt) : '', d.status === 'on' ? 0 : D.hrs(d.minutes), d.status === 'done' ? (d.credit == null ? 1 : Number(d.credit)) : 0, lab(d)[0], loc(d.inLat, d.inLng), d.outAt ? loc(d.outLat, d.outLng) : '']); });
    /* tarikh-wise: har staff ke har din ki ginti (month me kaun kis din aaya) */
    var days = {}; recs.forEach(function (d) { if (d.status === 'done') { var b = days[d.staffId] = days[d.staffId] || {}; b[d.date] = Math.min(1, (b[d.date] || 0) + (d.credit == null ? 1 : Number(d.credit))); } });
    var m = /^\d{4}-\d{2}$/.test(month || '') ? month : (recs[0] ? String(recs[0].date).slice(0, 7) : ''), n = m ? new Date(+m.slice(0, 4), +m.slice(5), 0).getDate() : 31, hd = ['Staff', 'Prakar'], i;
    for (i = 1; i <= n; i++) hd.push(String(i)); hd.push('Kul din');
    var pb = {}; (pay || []).forEach(function (x) { pb[x.id] = x; });
    var sal = [['Staff', 'Prakar', 'Poore mahine ki salary', 'Salary kaise banti hai', 'Duty ke din', 'Ek din ke', 'Is mahine ki salary']], mat = [hd];
    staff.filter(function (s) { return s.active !== false; }).forEach(function (s) {
      var p = pb[s.id] || {}, dd = days[s.id] || {}, tot = 0, row = [s.name, kindOf(s)];
      for (i = 1; i <= n; i++) { var k = m + '-' + (i < 10 ? '0' : '') + i, v = dd[k] || 0; tot += v; row.push(v || ''); }
      row.push(Math.round(tot * 10) / 10); mat.push(row);
      sal.push([s.name, kindOf(s), p.fixedFull || 0, p.fixedBasis === 'duty' ? 'Duty ke din ke hisaab se (÷26)' : 'Poore mahine ki', p.fixedBasis === 'duty' ? p.dutyDays : '', p.fixedBasis === 'duty' ? p.perDay : '', p.fixed || 0]);
    });
    var r2 = [['Staff', 'Prakar', 'Attendance (din)', 'Duty ke ghante']]; staff.filter(function (s) { return s.active !== false; }).forEach(function (s) { var b = days[s.id] || {}, t = 0, mn = 0; Object.keys(b).forEach(function (k) { t += b[k]; }); recs.forEach(function (d) { if (d.staffId === s.id && d.status === 'done') mn += Number(d.minutes) || 0; }); r2.push([s.name, kindOf(s), Math.round(t * 10) / 10, D.hrs(mn)]); });
    return [{ name: 'Staff salary', rows: sal, widths: [26, 22, 20, 30, 14, 14, 20], title: 'Staff Salary (' + m + ')', totalHeaders: ['Poore mahine ki salary', 'Is mahine ki salary'] },
      { name: 'Din-wise ginti', rows: mat, widths: [24, 20].concat(hd.slice(2).map(function () { return 5; })), title: 'Staff Day-wise Duty (' + m + ')', totalHeaders: ['Kul din'] },
      { name: 'Duty', rows: rows, widths: [12, 22, 9, 9, 10, 12, 24, 24, 24], title: 'Staff Duty (IN / OUT) Register', totalHeaders: ['Ghante', 'Ginti (din)'] },
      { name: 'Staff-wise', rows: r2, widths: [26, 22, 18, 16], title: 'Staff-wise Attendance (Duty)' }];
  };
  window.A2ZDuty = D;
})();
