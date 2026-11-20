/* node --test tests/xlsx.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const X = require('./xlsx-lite.js');

test('reads a real Excel file saved by openpyxl (shared strings, dates, numbers, Hindi)', async () => {
  const rows = await X.read(fs.readFileSync(path.join(__dirname, 'real_excel.xlsx')));
  assert.deepStrictEqual(rows[0], ['Name', 'Mobile', 'Trade', 'Party', 'Joining date', 'Days']);
  assert.strictEqual(rows[1][0], 'Ramesh Kumar & Sons');
  assert.strictEqual(rows[1][1], '9876543210');
  assert.strictEqual(rows[1][5], '26');
  assert.strictEqual(rows[2][0], 'सुरेश यादव');
  assert.strictEqual(rows[2][5], '13.5');
  assert.strictEqual(rows[4][0], '<b>Hack</b>');
  assert.strictEqual(rows[4][3], 'Party "2"');
  // the date cell is a serial number in a real file; excelDate turns it into an ISO date
  assert.strictEqual(X.excelDate(rows[1][4]), '2026-11-03');
  assert.strictEqual(rows[2][4], '2026-11-05');
  assert.strictEqual(rows.length, 5);                 // trailing blank rows trimmed, the blank middle row kept
});

test('write then read gives the same cells back', async () => {
  const rows = [['Name', 'Mobile'], ['Ravi & <Sons>', '9000000000'], ['', 'x'], ['नाम', '"quoted"']];
  const bytes = X.write(rows, 'Entry', [20, 14]);
  assert.strictEqual(bytes[0], 0x50); assert.strictEqual(bytes[1], 0x4b);   // zip header PK
  const back = await X.read(bytes);
  assert.deepStrictEqual(back, rows);
});

test('a file written here opens in a real library (openpyxl)', () => {
  const { execFileSync } = require('child_process');
  const f = '/tmp/lite_out.xlsx';
  fs.writeFileSync(f, X.write([['Name', 'Trade'], ['Ram', 'Fitter']], 'Entry'));
  const out = execFileSync('python3', ['-c', "import openpyxl,sys;ws=openpyxl.load_workbook('" + f + "').active;print(ws.title,ws['A2'].value,ws['B2'].value,ws['A1'].font.b)"]).toString().trim();
  assert.strictEqual(out, 'Entry Ram Fitter True');
});

test('rejects things that are not Excel files', async () => {
  await assert.rejects(() => X.read(new TextEncoder().encode('hello world, not a zip file at all, long enough....')), /Excel/);
  await assert.rejects(() => X.read(new Uint8Array(10)), /Excel/);
  await assert.rejects(() => X.read(new Uint8Array(6 * 1024 * 1024)), /5 MB/);
});

test('rejects a zip with no sheet', async () => {
  const bytes = X.write([['a']]);
  // damage: rename the sheet entry so no worksheet is found
  const s = Buffer.from(bytes).toString('latin1').split('xl/worksheets/sheet1.xml').join('xl/worksheets/sheetX.xml');
  await assert.rejects(() => X.read(Buffer.from(s, 'latin1')), /sheet|Excel/);
});

test('paste from Excel (tabs), CSV with quotes, semicolons and BOM', () => {
  assert.deepStrictEqual(X.parseDelimited('Name\tMobile\nRam\t9000000000\n\nSham\t'), [['Name', 'Mobile'], ['Ram', '9000000000'], ['Sham', '']]);
  assert.deepStrictEqual(X.parseDelimited('﻿Name,Note\r\n"Rao, A","say ""hi"""\r\n'), [['Name', 'Note'], ['Rao, A', 'say "hi"']]);
  assert.deepStrictEqual(X.parseDelimited('a;b;c\n1;2;3'), [['a', 'b', 'c'], ['1', '2', '3']]);
  assert.deepStrictEqual(X.parseDelimited(''), []);
});

test('excelDate only accepts believable serials', () => {
  assert.strictEqual(X.excelDate('46000'), '2025-12-09');
  assert.strictEqual(X.excelDate('5'), null);
  assert.strictEqual(X.excelDate('abc'), null);
  assert.strictEqual(X.excelDate(''), null);
});

test('crc32 matches the known value', () => {
  assert.strictEqual(X.crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
});
