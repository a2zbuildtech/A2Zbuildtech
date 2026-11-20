/* Admin ka password / mobile bhoolne par (server band karke chalayein):
 *   DATA_DIR=./data node server/cli.js reset-admin
 * Admin login hat jata hai, baaki sab data (party, staff, candidates, hisaab) jyon ka tyon rehta hai.
 * Server dobara chalane par naya setup code console par dikhega. */
'use strict';
const path = require('path');
const { openStore } = require('./store.js');
const dir = process.env.DATA_DIR || path.join(__dirname, 'data');
const cmd = process.argv[2];
if (cmd !== 'reset-admin') { console.log('Use: node server/cli.js reset-admin   (DATA_DIR=' + dir + ')'); process.exit(cmd ? 1 : 0); }
const store = openStore(dir);
if (!store.db.admin) { console.log('Koi admin pehle se nahi hai. Server chalaiye aur /admin par setup kijiye.'); process.exit(0); }
const old = store.db.admin.user;
delete store.db.admin; store.save();
console.log('Admin "' + old + '" hata diya gaya. Ab server chalaiye aur /admin par naya setup kijiye.');
