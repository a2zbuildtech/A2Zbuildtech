'use strict';
/* One JSON file, written safely (temp file then rename) with a daily backup copy. */
const fs = require('fs');
const path = require('path');

function empty() {
  return {
    v: 1, admin: null,
    settings: { commissionPct: 40, gstPct: 18, billPct: 5, basisDays: 26, gstFirmPct: 18, payDays: 15 },
    partners: [
      { id: 'own1', name: 'Anak Patel', role: 'Owner', phone: '9766284669', share: 1 },
      { id: 'own2', name: 'Shukhendra Mishra', role: 'Owner', phone: '7974451543', share: 1 },
      { id: 'vp1', name: 'Ram Gopal Patel', role: 'VP', phone: '8448601661', share: 1 }
    ],
    parties: [], staff: [], candidates: [], attendance: {}, expenses: [], receipts: [], reminders: [], log: []
  };
}

function openStore(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, 'db.json');
  let db = empty();
  if (fs.existsSync(file)) {
    try { db = Object.assign(empty(), JSON.parse(fs.readFileSync(file, 'utf8'))); }
    catch (e) {
      const keep = file + '.damaged-' + Date.now();
      fs.copyFileSync(file, keep);
      throw new Error('data/db.json kharab hai. Uski copy ' + keep + ' me rakh di gayi hai. Backup se wapas rakhein.');
    }
  }
  let lastBackup = '';
  function save() {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db), { mode: 0o600 });
    fs.renameSync(tmp, file);
    const day = new Date().toISOString().slice(0, 10);
    if (day !== lastBackup) {
      lastBackup = day;
      try {
        const bdir = path.join(dir, 'backups'); fs.mkdirSync(bdir, { recursive: true, mode: 0o700 });
        fs.copyFileSync(file, path.join(bdir, 'db-' + day + '.json'));
        fs.readdirSync(bdir).filter(f => /^db-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().slice(0, -30).forEach(f => fs.unlinkSync(path.join(bdir, f)));
      } catch (e) { /* backup is best effort */ }
    }
  }
  return { db, save, file, dir };
}
module.exports = { openStore, empty };
