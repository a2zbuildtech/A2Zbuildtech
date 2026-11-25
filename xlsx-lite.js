/* FILE: xlsx-lite.js  (GitHub par isi naam se upload karein) */
/*
 * A2Z Build Tech - tiny Excel reader/writer (no libraries)
 *   A2ZXlsx.read(arrayBuffer)  -> Promise of rows (array of arrays of strings), first sheet
 *   A2ZXlsx.write(rows, name)  -> Uint8Array of a .xlsx file (first row is made bold)
 *   A2ZXlsx.parseDelimited(text) -> rows from pasted Excel cells (tabs) or CSV
 *   A2ZXlsx.excelDate(serial)  -> 'YYYY-MM-DD'
 * Works in modern browsers and in Node 18+ (uses DecompressionStream).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.A2ZXlsx = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_BYTES = 5 * 1024 * 1024, MAX_UNZIPPED = 20 * 1024 * 1024;

  /* ---------- helpers ---------- */
  function enc(s) { return new TextEncoder().encode(s); }
  function dec(b) { return new TextDecoder('utf-8').decode(b); }
  function xmlEsc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''); }
  function xmlUnesc(s) {
    return s.replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, function (m, e) {
      if (e === 'lt') return '<'; if (e === 'gt') return '>'; if (e === 'amp') return '&'; if (e === 'quot') return '"'; if (e === 'apos') return "'";
      var n = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(n); } catch (x) { return ''; }
    });
  }
  function colIndex(ref) {
    var m = /^([A-Z]+)/.exec(ref); if (!m) return 0;
    var n = 0; for (var i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64);
    return n - 1;
  }
  function colName(i) { var s = ''; i++; while (i > 0) { var r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; }

  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

  /* ---------- write ---------- */
  function zipStore(files) {   // files: [{name, data(Uint8Array)}]
    var parts = [], central = [], offset = 0;
    files.forEach(function (f) {
      var name = enc(f.name), crc = crc32(f.data), size = f.data.length;
      var lh = new Uint8Array(30 + name.length), v = new DataView(lh.buffer);
      v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(8, 0, true);
      v.setUint16(10, 0, true); v.setUint16(12, 0x21, true); v.setUint32(14, crc, true); v.setUint32(18, size, true); v.setUint32(22, size, true);
      v.setUint16(26, name.length, true); v.setUint16(28, 0, true); lh.set(name, 30);
      parts.push(lh, f.data);
      var ch = new Uint8Array(46 + name.length), c = new DataView(ch.buffer);
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, size, true); c.setUint32(24, size, true);
      c.setUint16(28, name.length, true); c.setUint32(42, offset, true); ch.set(name, 46);
      central.push(ch);
      offset += lh.length + size;
    });
    var cdSize = central.reduce(function (a, b) { return a + b.length; }, 0);
    var end = new Uint8Array(22), e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
    var all = parts.concat(central, [end]), total = all.reduce(function (a, b) { return a + b.length; }, 0), out = new Uint8Array(total), p = 0;
    all.forEach(function (b) { out.set(b, p); p += b.length; });
    return out;
  }

  function sheetName(n, i, used) {
    var base = String(n || 'Sheet' + (i + 1)).replace(/[\[\]:*?\/\\]/g, ' ').trim().slice(0, 31) || 'Sheet' + (i + 1), k = base, c = 2;
    while (used[k.toLowerCase()]) { k = base.slice(0, 28) + ' ' + c++; }
    used[k.toLowerCase()] = 1; return k;
  }
  function sheetXml(rows, widths) {
    var cols = '';
    if (widths && widths.length) cols = '<cols>' + widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>';
    var data = rows.map(function (r, ri) {
      return '<row r="' + (ri + 1) + '">' + r.map(function (v, ci) {
        if (v === null || v === undefined || v === '') return '';
        var ref = colName(ci) + (ri + 1);
        if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + (ri === 0 ? ' s="1"' : '') + '><v>' + v + '</v></c>';
        return '<c r="' + ref + '" t="inlineStr"' + (ri === 0 ? ' s="1"' : '') + '><is><t xml:space="preserve">' + xmlEsc(v) + '</t></is></c>';
      }).join('') + '</row>';
    }).join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + cols + '<sheetData>' + data + '</sheetData></worksheet>';
  }

  /* ---------- STANDARD (company) FORMAT ----------
   * writeBook(sheets, meta): meta dene par har sheet ko company letterhead, styled header, border, total (SUM formula), freeze, filter,
   * print setup (landscape, 1 page chaudai, header har page par) aur signature lines ke saath banata hai. meta na ho to purana saada format. */
  var FIRM = { name: 'A2Z BUILD TECH', line: 'All Type Manpower Supplier  |  Vivek Nagar, Ward 19, Maihar (M.P.) - 485771  |  Email: a2zbuildtech@gmail.com', line1: 'All Type Manpower Supplier', line2: 'Vivek Nagar, Ward 19, Maihar (M.P.) - 485771  |  Email: a2zbuildtech@gmail.com' };
  var NOTOT = /%|rate|code|mobile|phone|serial|pin\b|pincode|year|kram|aadhaar|account|ifsc|\bid\b/i;
  var PLAIN = /mobile|phone|code|serial|pin\b|pincode|year|aadhaar|account|ifsc|\bid\b/i;
  var HDR = { 'Naam': 'Name', 'Din': 'Days', 'Wage': 'Wage (Rs.)', 'Company bill': 'Company Bill (Rs.)', 'Pool': 'Pool (Rs.)', 'Commission': 'Commission (Rs.)', 'GST': 'GST (Rs.)', 'Net': 'Net Payable (Rs.)', 'Prakar': 'Type',
    'Kul din': 'Total Days', 'Bill': 'Bill (Rs.)', 'Margin': 'Margin (Rs.)', 'Rakam': 'Amount (Rs.)', 'Hisaab': 'Particulars', 'Tarikh': 'Date', 'Kisko': 'Paid To', 'Tareeka': 'Mode', 'Vivaran': 'Description',
    'Kram': 'Sr. No.', 'Baaki': 'Balance (Rs.)', 'Baaki dena': 'Balance Due (Rs.)', 'Mil chuka': 'Received (Rs.)', 'Milna chahiye': 'Receivable (Rs.)', 'Chukaya': 'Paid (Rs.)', 'Dena tha': 'Payable (Rs.)',
    'Halat': 'Status', 'Candidates': 'Candidates', 'Candidates ka wage': 'Candidates Wage (Rs.)', 'Company commission': 'Company Commission (Rs.)', 'Company %': 'Company Commission (Rs.)', 'Firm ka hissa': 'Firm Share (Rs.)',
    'Staff commission': 'Staff Commission (Rs.)', 'Net milega': 'Net Payable (Rs.)', 'Fixed payment': 'Fixed Payment (Rs.)', 'Commission ka tareeka': 'Commission Method', 'Candidates ka wage ': 'Candidates Wage (Rs.)',
    'Advance': 'Advance (Rs.)', 'GST kata': 'GST Deducted (Rs.)', 'Aana': 'Receivable (Rs.)', 'Aaya': 'Received (Rs.)', 'Net (fixed sahit)': 'Net incl. Fixed (Rs.)', 'Kul din (man-days)': 'Total Man-days' };
  function fmtNow() { var d = new Date(), z = function (n) { return (n < 10 ? '0' : '') + n; }; return z(d.getDate()) + '-' + z(d.getMonth() + 1) + '-' + d.getFullYear() + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()); }
  function q1(n) { return "'" + String(n).replace(/'/g, "''") + "'"; }
  function r2(n) { return Math.round(n * 100) / 100; }
  var XF = { banner: 2, sub: 3, gold: 4, title: 5, meta: 6, head: 7, txt: 8, int: 10, dec: 12, gen: 14, tlab: 16, tnum: 17, tblank: 18, note: 19, sign: 20 };

  function formalSheet(sh, meta, name) {
    var rows = sh.rows || [], nc = 0;
    rows.forEach(function (r) { if (r.length > nc) nc = r.length; });
    if (nc < 1) nc = 1;
    var head = (rows[0] || []).slice(), body = rows.slice(1);
    for (var i = 0; i < nc; i++) { if (HDR[head[i]]) head[i] = HDR[head[i]]; }
    var last = colName(nc - 1), out = [], merges = [], rn = 0, hts = {};
    function row(cells, ht) { rn++; if (ht) hts[rn] = ht; out.push({ r: rn, cells: cells }); return rn; }
    function fill(xf, text) { var c = []; for (var k = 0; k < nc; k++) c.push(k === 0 && text !== undefined ? { t: text, s: xf } : { e: 1, s: xf }); return c; }
    function band(xf, text, ht) { var n = row(fill(xf, text), ht); merges.push('A' + n + ':' + last + n); return n; }
    band(XF.banner, meta.company || FIRM.name, 32);
    var tw = (sh.widths || []).slice(0, nc).reduce(function (a, b) { return a + b; }, 0) || nc * 10;
    function hgt(t, base) { return base * Math.max(1, Math.ceil(String(t).length / Math.max(20, tw * 1.05))); }
    band(XF.sub, meta.line1 || FIRM.line1, 16);
    band(XF.sub, meta.line2 || FIRM.line2, hgt(meta.line2 || FIRM.line2, 16));
    band(XF.gold, '', 4);
    band(XF.title, (sh.title || sh.name || 'Report'), 26);
    band(XF.meta, (meta.period ? 'Period: ' + meta.period + '      ' : '') + 'Generated on: ' + (meta.generated || fmtNow()) + (meta.by ? '      By: ' + meta.by : ''), 16);
    row([], 6);
    var hr = row(head.concat([]).slice(0, nc).map(function (h) { return { t: h === undefined || h === null ? '' : String(h), s: XF.head }; }), 30);
    var plain = [], totalable = [];
    for (var c = 0; c < nc; c++) {
      var hv = String(head[c] || ''), nums = 0, other = 0;
      body.forEach(function (r) { var v = r[c]; if (v === '' || v === null || v === undefined) return; if (typeof v === 'number' && isFinite(v)) nums++; else other++; });
      plain[c] = PLAIN.test(hv);
      totalable[c] = c > 0 && nums > 0 && other === 0 && !NOTOT.test(hv);
    }
    var wantTotal = sh.total === true || (sh.total !== false && nc > 2 && body.length > 1);
    var first = hr + 1;
    body.forEach(function (r, bi) {
      var z = bi % 2 === 1, cells = [];
      for (var k = 0; k < nc; k++) {
        var v = r[k];
        if (v === '' || v === null || v === undefined) { cells.push({ e: 1, s: XF.txt + (z ? 1 : 0) }); continue; }
        if (typeof v === 'number' && isFinite(v)) {
          var base = plain[k] ? XF.gen : (v % 1 === 0 ? XF.int : XF.dec);
          cells.push({ n: v, s: base + (z ? 1 : 0) });
        } else cells.push({ t: String(v), s: XF.txt + (z ? 1 : 0) });
      }
      row(cells, 0);
    });
    var lastData = rn, hasTotal = false;
    if (wantTotal && body.length) {
      var tc = [], any = false;
      for (var k2 = 0; k2 < nc; k2++) {
        if (k2 === 0) { tc.push({ t: 'TOTAL', s: XF.tlab }); continue; }
        if (totalable[k2]) {
          var sum = 0; body.forEach(function (r) { if (typeof r[k2] === 'number') sum += r[k2]; });
          tc.push({ f: 'SUM(' + colName(k2) + first + ':' + colName(k2) + lastData + ')', n: r2(sum), s: XF.tnum }); any = true;
        } else tc.push({ e: 1, s: XF.tblank });
      }
      if (any) { row(tc, 20); hasTotal = true; }
    }
    row([], 8);
    var nt = 'Note: Computer generated statement of ' + (meta.company || FIRM.name) + '. Amounts in Indian Rupees (Rs.). Report any difference within 7 days.';
    band(XF.note, nt, hgt(nt, 13));
    row([], 34);
    var groups = nc >= 3 ? ['Prepared by', 'Checked by', 'Authorised Signatory'] : ['Authorised Signatory'], sc = [], g = groups.length, per = Math.floor(nc / g), srow = rn + 1;
    for (var gi = 0; gi < g; gi++) {
      var from = gi * per, to = gi === g - 1 ? nc - 1 : from + per - 1;
      for (var k3 = from; k3 <= to; k3++) sc.push(k3 === from ? { t: groups[gi], s: XF.sign } : { e: 1, s: XF.sign });
      if (to > from) merges.push(colName(from) + srow + ':' + colName(to) + srow);
    }
    row(sc, 18);
    if (g > 0) { /* company naam sabse neeche, haste-akshar ke niche */ }
    var cols = sh.widths && sh.widths.length ? '<cols>' + sh.widths.slice(0, nc).map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>' : '';
    var data = out.map(function (R) {
      var cx = R.cells.map(function (c, ci) {
        var ref = colName(ci) + R.r, s = ' s="' + c.s + '"';
        if (c.e) return '<c r="' + ref + '"' + s + '/>';
        if (c.f) return '<c r="' + ref + '"' + s + '><f>' + xmlEsc(c.f) + '</f><v>' + c.n + '</v></c>';
        if (c.n !== undefined) return '<c r="' + ref + '"' + s + '><v>' + c.n + '</v></c>';
        if (c.t === '') return '<c r="' + ref + '"' + s + '/>';
        return '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(c.t) + '</t></is></c>';
      }).join('');
      return '<row r="' + R.r + '"' + (hts[R.r] ? ' ht="' + hts[R.r] + '" customHeight="1"' : '') + '>' + cx + '</row>';
    }).join('');
    var filterEnd = hasTotal ? lastData : lastData;
    var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetPr><tabColor rgb="FF1F3864"/><pageSetUpPr fitToPage="1"/></sheetPr>' +
      '<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="' + hr + '" topLeftCell="A' + (hr + 1) + '" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A' + (hr + 1) + '" sqref="A' + (hr + 1) + '"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/>' + cols + '<sheetData>' + data + '</sheetData>' +
      (body.length ? '<autoFilter ref="A' + hr + ':' + last + filterEnd + '"/>' : '') +
      '<mergeCells count="' + merges.length + '">' + merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>' +
      '<printOptions horizontalCentered="1"/><pageMargins left="0.4" right="0.4" top="0.5" bottom="0.6" header="0.3" footer="0.3"/>' +
      '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>' +
      '<headerFooter><oddFooter>' + xmlEsc('&L&8' + (meta.company || FIRM.name) + '&C&8Page &P of &N&R&8Printed &D') + '</oddFooter></headerFooter></worksheet>';
    return { xml: xml, header: hr, lastCol: last, lastData: lastData, hasBody: body.length > 0, name: name };
  }

  function stylesXml(formal) {
    var X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    if (!formal) return X + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>';
    function f(o) { return '<font>' + (o.b ? '<b/>' : '') + (o.i ? '<i/>' : '') + '<sz val="' + (o.sz || 11) + '"/><color rgb="FF' + (o.c || '000000') + '"/><name val="Calibri"/></font>'; }
    var fonts = [f({}), f({ b: 1 }), f({ b: 1, sz: 20, c: 'FFFFFF' }), f({ sz: 10, c: '595959' }), f({ b: 1, sz: 14, c: '1F3864' }), f({ i: 1, sz: 9, c: '595959' }), f({ b: 1, c: 'FFFFFF' }), f({ b: 1, c: '1F3864' }), f({ sz: 9, c: '595959' }), f({ sz: 10, c: 'D9E1F2' })];
    function fl(c) { return '<fill><patternFill patternType="solid"><fgColor rgb="FF' + c + '"/><bgColor indexed="64"/></patternFill></fill>'; }
    var fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>', fl('1F3864'), fl('C9A227'), fl('F3F6FB'), fl('DCE6F4')];
    function bd(c) { return '<border><left style="thin"><color rgb="FF' + c + '"/></left><right style="thin"><color rgb="FF' + c + '"/></right><top style="thin"><color rgb="FF' + c + '"/></top><bottom style="thin"><color rgb="FF' + c + '"/></bottom><diagonal/></border>'; }
    var borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>', bd('BFBFBF'),
      '<border><left style="thin"><color rgb="FF1F3864"/></left><right style="thin"><color rgb="FF1F3864"/></right><top style="thin"><color rgb="FF1F3864"/></top><bottom style="double"><color rgb="FF1F3864"/></bottom><diagonal/></border>',
      '<border><left/><right/><top style="thin"><color rgb="FF000000"/></top><bottom/><diagonal/></border>'];
    function xf(nf, fo, fi, bo, al) { return '<xf numFmtId="' + nf + '" fontId="' + fo + '" fillId="' + fi + '" borderId="' + bo + '" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"' + (al ? ' applyAlignment="1"><alignment ' + al + '/></xf>' : '/>'); }
    var C = 'horizontal="center" vertical="center"', L = 'horizontal="left" vertical="center"', R = 'horizontal="right" vertical="center"';
    var xfs = [xf(0, 0, 0, 0), xf(0, 1, 0, 0),
      xf(0, 2, 2, 0, C), xf(0, 9, 2, 0, C + ' wrapText="1"'), xf(0, 0, 3, 0), xf(0, 4, 0, 0, C), xf(0, 5, 0, 0, L),
      xf(0, 6, 2, 1, C + ' wrapText="1"'),
      xf(0, 0, 0, 1, L), xf(0, 0, 4, 1, L),
      xf(3, 0, 0, 1, R), xf(3, 0, 4, 1, R), xf(4, 0, 0, 1, R), xf(4, 0, 4, 1, R), xf(0, 0, 0, 1, R), xf(0, 0, 4, 1, R),
      xf(0, 7, 5, 2, L), xf(4, 7, 5, 2, R), xf(0, 7, 5, 2),
      xf(0, 8, 0, 0, L + ' wrapText="1"'), xf(0, 1, 0, 3, C)];
    return X + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="' + fonts.length + '">' + fonts.join('') + '</fonts><fills count="' + fills.length + '">' + fills.join('') + '</fills><borders count="' + borders.length + '">' + borders.join('') + '</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="' + xfs.length + '">' + xfs.join('') + '</cellXfs></styleSheet>';
  }

  /* sheets: [{ name, rows, widths, title?, total? }] -> ek workbook, kai sheet. meta (optional) -> standard company format. */
  function writeBook(sheets, meta) {
    var X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n', used = {}, names = sheets.map(function (sh, i) { return sheetName(sh.name, i, used); });
    var ct = '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
    var wbSheets = '', rels = '', dn = '', built = [];
    sheets.forEach(function (sh, i) {
      ct += '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
      wbSheets += '<sheet name="' + xmlEsc(names[i]) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
      rels += '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
      if (meta) {
        var fs = formalSheet(sh, meta, names[i]); built[i] = fs;
        dn += '<definedName name="_xlnm.Print_Titles" localSheetId="' + i + '">' + xmlEsc(q1(names[i]) + '!$' + fs.header + ':$' + fs.header) + '</definedName>';
        if (fs.hasBody) dn += '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">' + xmlEsc(q1(names[i]) + '!$A$' + fs.header + ':$' + fs.lastCol + '$' + fs.lastData) + '</definedName>';
      }
    });
    rels += '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
    var files = [
      { name: '[Content_Types].xml', data: enc(X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' + ct + '</Types>') },
      { name: '_rels/.rels', data: enc(X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
      { name: 'xl/workbook.xml', data: enc(X + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + wbSheets + '</sheets>' + (dn ? '<definedNames>' + dn + '</definedNames>' : '') + '</workbook>') },
      { name: 'xl/_rels/workbook.xml.rels', data: enc(X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + '</Relationships>') },
      { name: 'xl/styles.xml', data: enc(stylesXml(!!meta)) }
    ];
    sheets.forEach(function (sh, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: enc(meta ? built[i].xml : sheetXml(sh.rows, sh.widths)) }); });
    return zipStore(files);
  }
  function write(rows, name, widths) { return writeBook([{ name: name, rows: rows, widths: widths }]); }

  /* ---------- read ---------- */
  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('Is browser me Excel file padhna possible nahi. Copy-paste ya CSV use karein.');
    var ds = new DecompressionStream('deflate-raw');
    var w = ds.writable.getWriter(); w.write(bytes); w.close();
    var reader = ds.readable.getReader(), chunks = [], total = 0;
    for (;;) {
      var r = await reader.read();
      if (r.done) break;
      total += r.value.length;
      if (total > MAX_UNZIPPED) throw new Error('Excel file bahut badi hai.');
      chunks.push(r.value);
    }
    var out = new Uint8Array(total), p = 0;
    chunks.forEach(function (c) { out.set(c, p); p += c.length; });
    return out;
  }

  function listZip(b) {
    var v = new DataView(b.buffer, b.byteOffset, b.byteLength), i = b.length - 22, found = -1;
    for (; i >= Math.max(0, b.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { found = i; break; }
    if (found < 0) throw new Error('Ye Excel (.xlsx) file nahi lag rahi.');
    var n = v.getUint16(found + 10, true), off = v.getUint32(found + 16, true), out = {};
    if (n > 2000) throw new Error('File me bahut zyada parts hain.');
    for (var k = 0; k < n; k++) {
      if (v.getUint32(off, true) !== 0x02014b50) throw new Error('Excel file kharab hai.');
      var method = v.getUint16(off + 10, true), csize = v.getUint32(off + 20, true), usize = v.getUint32(off + 24, true);
      var nl = v.getUint16(off + 28, true), el = v.getUint16(off + 30, true), cl = v.getUint16(off + 32, true), lho = v.getUint32(off + 42, true);
      var name = dec(b.subarray(off + 46, off + 46 + nl));
      out[name] = { method: method, csize: csize, usize: usize, lho: lho };
      off += 46 + nl + el + cl;
    }
    return out;
  }
  async function entryData(b, e) {
    var v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (e.usize > MAX_UNZIPPED) throw new Error('Excel file bahut badi hai.');
    var nl = v.getUint16(e.lho + 26, true), el = v.getUint16(e.lho + 28, true), start = e.lho + 30 + nl + el;
    var raw = b.subarray(start, start + e.csize);
    if (e.method === 0) return raw;
    if (e.method === 8) return inflateRaw(raw);
    throw new Error('Is Excel file ka compression support nahi hai.');
  }

  function sharedStrings(xml) {
    var out = [], re = /<si\b[^>]*>([\s\S]*?)<\/si>/g, m;
    while ((m = re.exec(xml))) {
      var t = '', tr = /<t\b[^>]*>([\s\S]*?)<\/t>/g, x;
      while ((x = tr.exec(m[1]))) t += x[1];
      out.push(xmlUnesc(t));
    }
    return out;
  }

  async function read(buf) {
    var b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    if (b.length > MAX_BYTES) throw new Error('Excel file 5 MB se badi hai.');
    var z = listZip(b), sheetName = null;
    var names = Object.keys(z).filter(function (n) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(n); })
      .sort(function (a, c) { return parseInt(a.replace(/\D/g, ''), 10) - parseInt(c.replace(/\D/g, ''), 10); });
    if (!names.length) throw new Error('Excel file me koi sheet nahi mili.');
    sheetName = names[0];
    var shared = [];
    if (z['xl/sharedStrings.xml']) shared = sharedStrings(dec(await entryData(b, z['xl/sharedStrings.xml'])));
    var xml = dec(await entryData(b, z[sheetName])), rows = [], rr = /<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g, m, rowNo = 0;
    while ((m = rr.exec(xml))) {
      var row = [], body = m[1] || '', cr = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, c;
      if (++rowNo > 5000) throw new Error('Excel me 5000 se zyada rows hain.');
      while ((c = cr.exec(body))) {
        var attrs = c[1], inner = c[2] || '', ref = /\br="([A-Z]+\d+)"/.exec(attrs), type = /\bt="(\w+)"/.exec(attrs), val = '';
        var idx = ref ? colIndex(ref[1]) : row.length;
        if (idx > 60) continue;
        var t = type ? type[1] : 'n';
        if (t === 'inlineStr') { var ts = /<t\b[^>]*>([\s\S]*?)<\/t>/g, q; while ((q = ts.exec(inner))) val += xmlUnesc(q[1]); }
        else { var vm = /<v>([\s\S]*?)<\/v>/.exec(inner); val = vm ? xmlUnesc(vm[1]) : ''; if (t === 's') val = shared[parseInt(val, 10)] || ''; if (t === 'b') val = val === '1' ? 'TRUE' : 'FALSE'; }
        while (row.length < idx) row.push('');
        row[idx] = String(val).trim();
      }
      rows.push(row);
    }
    while (rows.length && rows[rows.length - 1].every(function (x) { return x === ''; })) rows.pop();
    return rows;
  }

  /* pasted cells from Excel are tab separated; CSV files use commas or semicolons */
  function parseDelimited(text) {
    text = String(text).replace(/^﻿/, '');
    if (text.length > 2 * 1024 * 1024) throw new Error('Text bahut bada hai.');
    var first = text.split(/\r?\n/)[0] || '';
    var d = first.indexOf('\t') >= 0 ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
    var rows = [], row = [], cur = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"' && cur === '') q = true;
      else if (ch === d) { row.push(cur.trim()); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur.trim()); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur.trim()); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x !== ''; }); });
  }

  function excelDate(serial) {
    var n = parseFloat(serial);
    if (!isFinite(n) || n < 20000 || n > 80000) return null;
    return new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10);
  }

  return { read: read, write: write, writeBook: writeBook, parseDelimited: parseDelimited, excelDate: excelDate, crc32: crc32 };
});
