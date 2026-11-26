/* FILE: duty.js  (GitHub par isi naam se upload karein) */
/* A2Z Build Tech - STAFF KI DUTY: IN / OUT + selfie + location. Staff panel aur admin panel dono isse chalte hain.
   Attendance tabhi judti hai jab staff OUT kare. Jab tak OUT nahi, app khula ho to location aati rehti hai aur admin dekh sakta hai.
   Selfie Google Drive ke private folder me rehti hai, sirf admin dekh sakta hai. */
(function () {
  'use strict';
  var P = window.P, esc = P.esc, D = {};
  var STATUS = { on: ['Duty par', 'good'], done: ['Poori', 'good'], forgot: ['OUT nahi hua (nahi gini)', 'bad'] };

  /* ---------- chhote helpers ---------- */
  function ist(iso) { var t = Date.parse(iso); return isFinite(t) ? new Date(t + 330 * 60000) : null; }
  D.hm = function (iso) { var d = ist(iso); return d ? d.toISOString().slice(11, 16) : '-'; };
  D.dt = function (iso) { var d = ist(iso); return d ? d.toISOString().slice(8, 10) + '-' + d.toISOString().slice(5, 7) + ' ' + d.toISOString().slice(11, 16) : '-'; };
  D.hrs = function (min) { return Math.round((Number(min) || 0) / 6) / 10; };
  D.ago = function (iso) { var t = Date.parse(iso); if (!isFinite(t)) return '-'; var m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'abhi' : m < 60 ? m + ' min pehle' : m < 1440 ? Math.floor(m / 60) + ' ghante ' + (m % 60) + ' min pehle' : Math.floor(m / 1440) + ' din pehle'; };
  D.mapUrl = function (lat, lng) { return 'https://www.google.com/maps?q=' + encodeURIComponent(lat + ',' + lng); };
  function mapLink(lat, lng, label) { return lat == null || lng == null ? '-' : '<a href="' + esc(D.mapUrl(lat, lng)) + '" target="_blank" rel="noopener noreferrer">' + esc(label || 'Map dekhein') + '</a>'; }
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
    h += '<div class="note">Duty par aate hi <b>IN</b> karein aur jaate samay <b>OUT</b>. Attendance tabhi lagti hai jab aap OUT karte hain. IN / OUT dono me abhi ki <b>selfie</b> aur <b>location</b> lagti hai. Jab tak OUT nahi karte, app khula rehne par aapki location admin ko dikhti hai; OUT karte hi location band ho jati hai.</div>';
    if (st.mode) {
      var out = st.mode === 'out';
      h += '<div class="card" id="dform"><h3>' + (out ? 'OUT karein (duty khatam)' : 'IN karein (duty shuru)') + '</h3>' +
        '<div class="grid"><div><div class="photo-box" id="dprev">' + (st.photo ? '<img alt="selfie" src="' + esc(st.photo) + '">' : 'Selfie') + '</div>' +
        '<label class="btn sec sm file-btn mt6">Selfie lein<input type="file" id="dutyFile" accept="image/*" capture="user" hidden></label></div>' +
        '<div><div class="note ' + (st.pos ? '' : 'warn') + '" id="dpos">' + (st.pos ? '✓ Location mil gayi (sahi-pan ±' + esc(st.pos.acc) + ' m)' : st.gps ? 'Location le raha hoon...' : esc(st.err || 'Location abhi nahi mili.')) + '</div>' +
        '<button type="button" class="btn sec sm" data-act="dgps">Location dobara lein</button></div></div>' +
        (st.err && st.pos ? '<div class="note warn">' + esc(st.err) + '</div>' : '') +
        '<div class="msg" id="dmsg" role="alert"></div><div class="row"><button class="btn" data-act="dconfirm"' + (st.photo && st.pos && !st.busy ? '' : ' disabled') + '>' + (st.busy ? 'Ho raha hai...' : (out ? 'OUT pakka karein' : 'IN pakka karein')) + '</button><button class="btn sec" data-act="dcancel">Band karein</button></div></div>';
    } else if (v.open) {
      h += '<div class="card"><span class="pill good">Aap duty par hain</span><div class="mt6">IN: <b>' + D.dt(v.open.inAt) + '</b> (' + D.ago(v.open.inAt) + ')</div><div class="xs mu">Aakhri location bheji: ' + D.ago(v.open.lastAt) + '. Location bhejte rehne ke liye duty me ye app khula rakhein.</div>' +
        '<div class="row mt6"><button class="btn" data-act="dstart" data-mode="out">OUT karein (duty khatam)</button></div></div>';
    } else {
      h += '<div class="card"><span class="pill warn">Aap abhi duty par nahi hain</span><div class="row mt6"><button class="btn" data-act="dstart" data-mode="in">IN karein (duty shuru)</button></div></div>';
    }
    h += '<div class="cards"><div class="card"><span class="lbl">Is mahine ki attendance</span><span class="kpi">' + v.days + ' din</span></div><div class="card"><span class="lbl">Kul duty ke ghante</span><span class="kpi">' + D.hrs(v.minutes) + '</span></div></div>';
    h += '<h3>Meri duty (is mahine)</h3><div class="card scroll"><table><thead><tr><th>Tarikh</th><th>IN</th><th>OUT</th><th class="n">Ghante</th><th>Halat</th></tr></thead><tbody>' +
      (v.recent.length ? v.recent.map(function (d) { var s = STATUS[d.status] || ['', '']; return '<tr><td>' + P.dd(d.date) + '</td><td>' + D.hm(d.inAt) + '</td><td>' + (d.outAt ? D.hm(d.outAt) : '-') + '</td><td class="n">' + (d.status === 'on' ? '-' : D.hrs(d.minutes)) + '</td><td><span class="pill ' + s[1] + '">' + s[0] + '</span></td></tr>'; }).join('') : '<tr><td colspan="5" class="mu">Is mahine koi duty nahi.</td></tr>') + '</tbody></table></div>';
    return h;
  };

  /* ---------- ADMIN ka screen ---------- */
  D.adminHtml = function (duty, staff, st) {
    st = st || {};
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
      if (!o) return '<tr><td>' + esc(name(s.id)) + '</td><td>' + (dn.length ? '<span class="pill good">Aaj ki duty poori</span>' : '<span class="pill warn">Aaj duty par nahi</span>') + '</td><td>' + (dn.length ? D.hm(dn[0].inAt) + ' - ' + D.hm(dn[0].outAt) : '-') + '</td><td>-</td><td>' + (dn.length && dn[0].outLat != null ? mapLink(dn[0].outLat, dn[0].outLng, 'OUT ki jagah') : '-') + '</td><td></td></tr>';
      var stale = (Date.now() - Date.parse(o.lastAt)) > 20 * 60000;
      return '<tr><td><b>' + esc(name(s.id)) + '</b></td><td><span class="pill good">Duty par</span>' + (o.date !== today ? '<div class="xs bad">' + P.dd(o.date) + ' se OUT nahi hua</div>' : '') + '</td><td>' + D.dt(o.inAt) + '</td><td>' + D.ago(o.lastAt) + (stale ? '<div class="xs bad">Location purani hai (app band ho sakta hai)</div>' : '') + (o.lastAcc != null ? '<div class="xs mu">±' + esc(o.lastAcc) + ' m</div>' : '') + '</td><td>' + mapLink(o.lastLat, o.lastLng) + '</td><td><button class="btn sm sec" data-act="dphoto" data-id="' + esc(o.id) + '" data-w="in">IN selfie</button> <button class="btn sm sec" data-act="dclose" data-id="' + esc(o.id) + '">Duty band karein</button></td></tr>';
    }).join('') + '</tbody></table></div>';
    var sum = active.map(function (s) { var r = recBy[s.id] || [], days = {}, min = 0, forgot = 0; r.forEach(function (d) { if (d.status === 'done') { days[d.date] = 1; min += Number(d.minutes) || 0; } else if (d.status === 'forgot') forgot++; }); return { id: s.id, days: Object.keys(days).length, min: min, forgot: forgot }; });
    h += '<h3>Staff-wise attendance (' + P.monthName(st.month) + ')</h3><div class="card scroll"><table><thead><tr><th>Staff</th><th class="n">Attendance (din)</th><th class="n">Duty ke ghante</th><th class="n">OUT nahi kiya (din)</th></tr></thead><tbody>' +
      sum.map(function (x) { return '<tr><td>' + esc(name(x.id)) + '</td><td class="n">' + x.days + '</td><td class="n">' + D.hrs(x.min) + '</td><td class="n">' + x.forgot + '</td></tr>'; }).join('') + '</tbody></table></div>';
    var recs = duty.records.slice().sort(function (a, b) { return String(b.inAt).localeCompare(String(a.inAt)); });
    h += '<h3>Poori duty list (' + recs.length + ')</h3><div class="card scroll"><table><thead><tr><th>Tarikh</th><th>Staff</th><th>IN</th><th>OUT</th><th class="n">Ghante</th><th>IN / OUT ki doori</th><th>Halat</th><th>Map</th><th></th></tr></thead><tbody>' +
      (recs.map(function (d) {
        var s = STATUS[d.status] || ['', ''], dist = D.meters(d.inLat, d.inLng, d.outLat, d.outLng);
        return '<tr><td>' + P.dd(d.date) + '</td><td>' + esc(name(d.staffId)) + '</td><td>' + D.hm(d.inAt) + '</td><td>' + (d.outAt ? D.hm(d.outAt) : '-') + '</td><td class="n">' + (d.status === 'on' ? '-' : D.hrs(d.minutes)) + '</td><td>' + (dist == null ? '-' : (dist >= 1000 ? (dist / 1000).toFixed(1) + ' km' : dist + ' m')) + '</td><td><span class="pill ' + s[1] + '">' + s[0] + '</span>' + (d.closedBy === 'admin' ? '<div class="xs mu">Admin ne band ki</div>' : '') + '</td><td>' + mapLink(d.inLat, d.inLng, 'IN') + (d.outLat != null ? ' · ' + mapLink(d.outLat, d.outLng, 'OUT') : '') + '</td><td>' +
          (d.hasInPhoto ? '<button class="link" data-act="dphoto" data-id="' + esc(d.id) + '" data-w="in">IN selfie</button> ' : '') + (d.hasOutPhoto ? '<button class="link" data-act="dphoto" data-id="' + esc(d.id) + '" data-w="out">OUT selfie</button> ' : '') + '<button class="link danger" data-act="ddel" data-id="' + esc(d.id) + '">Hatayein</button></td></tr>';
      }).join('') || '<tr><td colspan="9" class="mu">Is mahine koi duty nahi.</td></tr>') + '</tbody></table></div>';
    return h;
  };

  D.sheets = function (duty, staff, month) {
    var name = function (id) { var s = staff.filter(function (x) { return x.id === id; })[0]; return s ? s.name : '?'; };
    var recs = duty.records.slice().sort(function (a, b) { return String(a.inAt).localeCompare(String(b.inAt)); });
    var rows = [['Tarikh', 'Staff', 'IN', 'OUT', 'Ghante', 'Halat', 'IN location', 'OUT location']];
    recs.forEach(function (d) { rows.push([d.date, name(d.staffId), D.hm(d.inAt), d.outAt ? D.hm(d.outAt) : '', d.status === 'on' ? 0 : D.hrs(d.minutes), (STATUS[d.status] || [''])[0], d.inLat + ', ' + d.inLng, d.outLat != null ? d.outLat + ', ' + d.outLng : '']); });
    var by = {}; recs.forEach(function (d) { var b = by[d.staffId] = by[d.staffId] || { days: {}, min: 0 }; if (d.status === 'done') { b.days[d.date] = 1; b.min += Number(d.minutes) || 0; } });
    var r2 = [['Staff', 'Attendance (din)', 'Duty ke ghante']]; Object.keys(by).forEach(function (id) { r2.push([name(id), Object.keys(by[id].days).length, D.hrs(by[id].min)]); });
    return [{ name: 'Duty', rows: rows, widths: [12, 22, 9, 9, 10, 24, 24, 24], title: 'Staff Duty (IN / OUT) Register', totalHeaders: ['Ghante'] },
      { name: 'Staff-wise', rows: r2, widths: [26, 18, 16], title: 'Staff-wise Attendance (Duty)' }];
  };
  window.A2ZDuty = D;
})();
