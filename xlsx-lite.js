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

  function write(rows, sheetName, widths) {
    var name = xmlEsc(String(sheetName || 'Sheet1').replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31) || 'Sheet1');
    var cols = '';
    if (widths && widths.length) cols = '<cols>' + widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>';
    var data = rows.map(function (r, ri) {
      return '<row r="' + (ri + 1) + '">' + r.map(function (v, ci) {
        if (v === null || v === undefined || v === '') return '';
        return '<c r="' + colName(ci) + (ri + 1) + '" t="inlineStr"' + (ri === 0 ? ' s="1"' : '') + '><is><t xml:space="preserve">' + xmlEsc(v) + '</t></is></c>';
      }).join('') + '</row>';
    }).join('');
    var X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    var files = [
      { name: '[Content_Types].xml', data: enc(X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>') },
      { name: '_rels/.rels', data: enc(X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
      { name: 'xl/workbook.xml', data: enc(X + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + name + '" sheetId="1" r:id="rId1"/></sheets></workbook>') },
      { name: 'xl/_rels/workbook.xml.rels', data: enc(X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>') },
      { name: 'xl/styles.xml', data: enc(X + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>') },
      { name: 'xl/worksheets/sheet1.xml', data: enc(X + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + cols + '<sheetData>' + data + '</sheetData></worksheet>') }
    ];
    return zipStore(files);
  }

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

  return { read: read, write: write, parseDelimited: parseDelimited, excelDate: excelDate, crc32: crc32 };
});
