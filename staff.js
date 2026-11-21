/* FILE: staff.js  (GitHub par isi naam se upload karein) */
/* A2Z Build Tech - staff page: Excel-like entry sheet and own statement.
   The link is  /staff#<token>. The token stays in the address fragment, which browsers never send to servers. */
(function () {
  'use strict';
  var $ = P.$, $$ = P.$$, esc = P.esc, inr = P.inr, nf = P.nf;
  var TOKEN = (location.hash || '').slice(1);
  var S = { month: P.thisMonth(), tab: 'entry', view: null, rows: [], lastParty: '' };
  var TYPE = { agent: 'Staff', supplier: 'Manpower supplier', supervisor: 'Site supervisor' };

  function api(method, url, body) { return P.api(method, url, body, { 'x-staff-token': TOKEN }); }
  function parties() { return S.view.parties; }
  function newRow() { return { id: '', name: '', mobile: '', trade: '', partyId: parties().length === 1 ? parties()[0].id : S.lastParty, joinDate: '', days: '', left: false, err: '', isNew: true }; }
  function rowsFromView() {
    var rows = S.view.candidates.map(function (c) { return { id: c.id, name: c.name, mobile: c.mobile, trade: c.trade, partyId: c.partyId, joinDate: c.joinDate || '', days: String(c.days), left: c.status === 'left', err: '', info: c, isNew: false }; });
    for (var i = 0; i < 5; i++) rows.push(newRow());
    return rows;
  }

  async function load() {
    try {
      S.view = await api('GET', '/api/staff/me?month=' + S.month);
    } catch (e) {
      $('#tabs').classList.add('hide'); $('#monthBox').classList.add('hide');
      $('#app').innerHTML = '<div class="note warn"><b>Ye link kaam nahi kar raha.</b><br>' + esc(e.message) + '</div>';
      return;
    }
    $('#who').textContent = S.view.staff.name; $('#whoSub').textContent = TYPE[S.view.staff.type] || 'Staff';
    $('#monthBox').classList.remove('hide'); $('#tabs').classList.remove('hide');
    $('#month').value = S.month;
    S.rows = rowsFromView();
    render();
  }

  /* ---------- views ---------- */
  function summary() {
    var t = S.view.totals, st = S.view.staff;
    function k(l, v) { return '<div class="card"><span class="lbl">' + esc(l) + '</span><span class="kpi">' + v + '</span></div>'; }
    return '<div class="cards">' + k('Aapka commission %', st.pct + '%') + k('Candidates', t.candidates) + k('Kul din', nf(t.days)) + k('Aapka commission', inr(t.commission)) + k('GST kata (' + S.view.gstPct + '%)', inr(t.gst)) + k('Aapko milega', inr(t.net)) + (t.fixed ? k('Fixed payment', inr(t.fixed)) : '') + '</div>';
  }

  function gridRow(r, i) {
    var pOpts = '<option value="">— party —</option>' + parties().map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === r.partyId ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('');
    function inp(k, type, extra) { return '<td><input data-i="' + i + '" data-k="' + k + '" type="' + type + '" value="' + esc(r[k]) + '" ' + (extra || '') + ' aria-label="' + k + '"></td>'; }
    return '<tr' + (r.err ? ' class="err"' : '') + '><td class="mu xs">' + (i + 1) + '</td>' + inp('name', 'text', 'maxlength="80" autocomplete="off"') + inp('mobile', 'tel', 'inputmode="numeric" maxlength="14" autocomplete="off"') + inp('trade', 'text', 'list="trades" maxlength="40" autocomplete="off"') +
      '<td><select data-i="' + i + '" data-k="partyId" aria-label="party">' + pOpts + '</select></td>' + inp('joinDate', 'date') + inp('days', 'number', 'min="0" max="31" step="0.5" class="w-days"') +
      '<td><input data-i="' + i + '" data-k="left" type="checkbox"' + (r.left ? ' checked' : '') + ' aria-label="kaam chhod diya"></td>' +
      '<td class="sm">' + (r.err ? '<span class="bad">' + esc(r.err) + '</span>' : (r.info ? '<span class="mu">' + esc(P.dt(r.info.createdAt)) + '</span> ' + (r.info.verified ? '<span class="pill good">dekh liya</span>' : '<span class="pill warn">admin dekhega</span>') : (r.isNew && r.name ? '<span class="pill">naya</span>' : ''))) + '</td></tr>';
  }
  function entryView() {
    var trades = {}; parties().forEach(function (p) { p.trades.forEach(function (t) { trades[t] = 1; }); });
    var dirty = S.rows.filter(rowHasData).length;
    return summary() +
      '<div class="note">Neeche Excel jaisi sheet hai. Naam, trade, party aur is mahine ke din bharein, phir <b>Save</b> dabayein. Excel file ya copy-paste se bhi bhar sakte hain. Jo naam pehle se hain unme sirf din badalna ho to badal kar Save karein.</div>' +
      '<div class="row noprint"><button class="btn" data-act="save">Save sab</button><button class="btn sec" data-act="addrows">+ 5 rows</button><label class="btn sec file-btn">Excel / CSV file chunein<input type="file" id="file" accept=".xlsx,.csv,.txt" class="hide"></label><button class="btn sec" data-act="paste">Excel se copy-paste</button><button class="btn sec" data-act="template">Excel template download</button></div>' +
      '<div id="pastePanel" class="panel hide"><label>Excel se cells copy karke yaha paste karein (pehli line me heading ho to achha)<textarea id="pasteBox" placeholder="Naam&#9;Mobile&#9;Trade&#9;Party&#9;Joining&#9;Din"></textarea></label><div class="row"><button class="btn" data-act="pasteadd">Rows jodein</button><button class="btn sec" data-act="pastecancel">Band karein</button></div></div>' +
      '<div class="msg" id="msg" role="alert"></div>' +
      '<datalist id="trades">' + Object.keys(trades).map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist>' +
      '<div class="card scroll"><table id="grid"><thead><tr><th>#</th><th>Naam</th><th>Mobile</th><th>Trade</th><th>Party</th><th>Joining</th><th>Din (' + P.monthName(S.month) + ')</th><th>Chhod diya</th><th>Halat</th></tr></thead><tbody>' + S.rows.map(gridRow).join('') + '</tbody></table></div>' +
      '<p class="xs mu">Entry ka samay server khud likhta hai. ' + (dirty ? dirty + ' rows sheet me hain.' : '') + '</p>';
  }
  function hisaabView() {
    var v = S.view, t = v.totals;
    return summary() + '<div class="row between noprint"><h2>Mera hisaab (' + P.monthName(S.month) + ')</h2><button class="btn sec" data-act="print">Print</button></div>' +
      '<div class="card scroll"><table><thead><tr><th>Naam</th><th>Party</th><th>Trade</th><th class="n">Din</th><th class="n">Candidate ka wage</th><th class="n">Commission</th><th class="n">GST</th><th class="n">Net</th></tr></thead><tbody>' +
      (v.candidates.map(function (c) { return '<tr><td>' + esc(c.name) + (c.status === 'left' ? ' <span class="pill">chhod diya</span>' : '') + '</td><td>' + esc(c.partyName) + '</td><td>' + esc(c.trade) + '</td><td class="n">' + nf(c.days) + '</td><td class="n">' + inr(c.pay) + '</td><td class="n">' + inr(c.commission) + '</td><td class="n">' + inr(c.gst) + '</td><td class="n">' + inr(c.net) + '</td></tr>'; }).join('') || '<tr><td colspan="8" class="mu">Abhi koi candidate nahi. "Entry" me jodein.</td></tr>') +
      '<tr class="tot"><td colspan="3">Kul</td><td class="n">' + nf(t.days) + '</td><td class="n">' + inr(t.pay) + '</td><td class="n">' + inr(t.commission) + '</td><td class="n">' + inr(t.gst) + '</td><td class="n">' + inr(t.net) + '</td></tr></tbody></table></div>' +
      '<div class="note">Commission = candidate ke kaam se bane munafe ka ' + v.staff.pct + '%. Isme se GST ' + v.gstPct + '% kat kar "Net" milta hai. Din admin ke verify karne par final hote hain.</div>';
  }
  function render() {
    $('#tabs').innerHTML = [['entry', 'Entry sheet'], ['hisaab', 'Mera hisaab']].map(function (t) { return '<button data-act="tab" data-id="' + t[0] + '" aria-current="' + (t[0] === S.tab) + '">' + t[1] + '</button>'; }).join('');
    $('#app').innerHTML = S.tab === 'entry' ? entryView() : hisaabView();
  }

  /* ---------- import ---------- */
  var KEYS = { name: ['name', 'naam', 'नाम', 'candidate'], mobile: ['mobile', 'phone', 'mob', 'मोबाइल', 'number', 'फोन'], trade: ['trade', 'ट्रेड', 'skill', 'काम'], party: ['party', 'company', 'पार्टी', 'कंपनी', 'site'], joinDate: ['join', 'date', 'tarikh', 'जॉइन', 'तारीख'], days: ['day', 'din', 'दिन', 'present', 'attendance', 'हाज'] };
  var ORDER = ['name', 'mobile', 'trade', 'party', 'joinDate', 'days'];
  function fieldOf(h) { h = String(h).toLowerCase(); for (var i = 0; i < ORDER.length; i++) if (KEYS[ORDER[i]].some(function (w) { return h.indexOf(w) >= 0; })) return ORDER[i]; return ''; }
  function normDate(v) {
    v = String(v || '').trim(); if (!v) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    var m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/.exec(v);
    if (m) { var y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); }
    return A2ZXlsx.excelDate(v) || '';
  }
  function partyId(name) {
    var n = String(name || '').trim().toLowerCase();
    if (!n) return parties().length === 1 ? parties()[0].id : '';
    var p = parties().filter(function (x) { return x.name.toLowerCase() === n; })[0];
    return p ? p.id : '';
  }
  function importMatrix(mx) {
    if (!mx.length) return 0;
    var map = null, start = 0;
    var hdr = mx[0].map(fieldOf);
    if (hdr.filter(Boolean).length >= 2) { map = hdr; start = 1; } else map = ORDER.slice();
    var added = 0, blanks = S.rows.filter(function (r) { return r.isNew && !rowHasData(r); });
    for (var i = start; i < mx.length; i++) {
      var o = {}; mx[i].forEach(function (cell, c) { if (map[c]) o[map[c]] = String(cell == null ? '' : cell).trim(); });
      if (!o.name || /^(उदाहरण|example)/i.test(o.name)) continue;
      var d = parseFloat(o.days);
      var r = { id: '', name: o.name, mobile: String(o.mobile || '').replace(/\.0$/, '').replace(/\s/g, ''), trade: o.trade || '', partyId: partyId(o.party), joinDate: normDate(o.joinDate), days: isFinite(d) ? String(d) : '', left: false, err: '', isNew: true };
      if (!r.partyId) r.err = o.party ? 'Party "' + o.party + '" system me nahi hai' : 'Party chuniye';
      var slot = blanks.shift();
      if (slot) { var idx = S.rows.indexOf(slot); S.rows[idx] = r; } else S.rows.push(r);
      added++;
    }
    return added;
  }
  function rowHasData(r) { return !!(r.id || r.name.trim() || r.mobile.trim() || r.trade.trim()); }

  /* ---------- actions ---------- */
  var A = {
    tab: function (b) { S.tab = b.dataset.id; render(); },
    addrows: function () { for (var i = 0; i < 5; i++) S.rows.push(newRow()); render(); },
    paste: function () { $('#pastePanel').classList.remove('hide'); $('#pasteBox').focus(); },
    pastecancel: function () { $('#pastePanel').classList.add('hide'); },
    pasteadd: function () {
      var n = importMatrix(A2ZXlsx.parseDelimited($('#pasteBox').value));
      if (!n) { $('#msg').textContent = 'Koi row nahi mili. Naam wali column zaroor ho.'; return; }
      render(); P.toast(n + ' rows jud gayi. Check karke Save karein.');
    },
    template: function () {
      var p = parties()[0] ? parties()[0].name : 'Party 1';
      P.xlsxDownload([['Name', 'Mobile', 'Trade', 'Party', 'Joining date (YYYY-MM-DD)', 'Days present'], ['उदाहरण - Ramesh Kumar', '9876543210', 'Fitter', p, S.month + '-01', '26']], 'a2z-entry-template.xlsx', 'Entry', [26, 14, 14, 22, 26, 14]);
    },
    print: function () { window.print(); },
    save: async function (b) {
      var send = [], idx = [];
      S.rows.forEach(function (r, i) { if (rowHasData(r)) { send.push({ id: r.id || undefined, name: r.name, mobile: r.mobile, trade: r.trade, partyId: r.partyId, joinDate: r.joinDate, days: r.days, left: r.left }); idx.push(i); } });
      S.rows.forEach(function (r) { r.err = ''; });
      if (!send.length) { $('#msg').textContent = 'Sheet me koi entry nahi hai.'; return; }
      b.disabled = true; $('#msg').textContent = '';
      try {
        var r = await api('POST', '/api/staff/save', { month: S.month, rows: send });
        S.view = r.view; S.rows = rowsFromView(); render(); P.toast(r.created + ' naye, ' + r.updated + ' update. Admin ko dikh gaya.');
      } catch (e) {
        b.disabled = false;
        if (e.errors) { e.errors.forEach(function (x) { if (idx[x.row] != null) S.rows[idx[x.row]].err = x.msg; }); render(); $('#msg').textContent = 'Peele rows me galti hai. Sudharkar dobara Save karein. Kuch bhi save nahi hua.'; var first = $('tr.err'); if (first) first.scrollIntoView({ block: 'center' }); }
        else $('#msg').textContent = e.message;
      }
    }
  };

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || !A[b.dataset.act]) return;
    Promise.resolve(A[b.dataset.act](b)).catch(function (x) { P.toast(x.message || String(x)); });
  });
  document.addEventListener('input', function (e) {
    var t = e.target, i = t.dataset && t.dataset.i; if (i == null) return;
    var r = S.rows[+i]; if (!r) return;
    r[t.dataset.k] = t.type === 'checkbox' ? t.checked : t.value;
  });
  document.addEventListener('change', async function (e) {
    var t = e.target;
    if (t.id === 'file' && t.files && t.files[0]) {
      var f = t.files[0]; t.value = '';
      try {
        var mx = /\.xlsx$/i.test(f.name) ? await A2ZXlsx.read(await f.arrayBuffer()) : A2ZXlsx.parseDelimited(await f.text());
        var n = importMatrix(mx);
        if (!n) throw new Error('File me koi row nahi mili. "Name" wali column zaroor ho.');
        render(); P.toast(n + ' rows file se jud gayi. Check karke Save karein.');
      } catch (x) { var m = $('#msg'); if (m) m.textContent = x.message; }
    } else if (t.dataset && t.dataset.k === 'partyId') S.lastParty = t.value;
  });
  $('#month').addEventListener('change', function (e) {
    if (!/^\d{4}-\d{2}$/.test(e.target.value)) return;
    if (S.rows.some(function (r) { return r.isNew && rowHasData(r); }) && !window.confirm('Sheet me bina save ki entries hain. Mahina badalne par ye hat jayengi. Aage badhein?')) { e.target.value = S.month; return; }
    S.month = e.target.value; load();
  });
  window.addEventListener('hashchange', function () { location.reload(); });

  if (!/^[0-9a-f]{32}$/.test(TOKEN)) {
    $('#app').innerHTML = '<div class="note warn"><b>Ye link poora nahi hai.</b><br>Admin se apna pura link maangein (link ke ant me # ke baad lamba code hota hai).</div>';
  } else load();
})();
