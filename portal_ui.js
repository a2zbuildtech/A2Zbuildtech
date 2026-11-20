/* Browser test of the real portal (needs Playwright and Chrome):
 *   NODE_PATH=/opt/node22/lib/node_modules node tests/portal_ui.js
 * Starts the server with a fake SMS gateway, then drives /admin and a staff link in Chrome. */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const { createApp } = require('./server.js');

const sent = [];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a2z-ui-'));
const app = createApp({ dataDir: dir, notify: Object.assign(async (to, message) => { sent.push({ to, message }); return true; }, { real: true, provider: 'test' }) });
const fails = [], errors = [];
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (!ok && extra !== undefined ? ' -> ' + String(extra).slice(0, 300) : '')); if (!ok) fails.push(name); }
const otp = () => /OTP: (\d{6})/.exec(sent[sent.length - 1].message)[1];
const MONTH = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 7);

(async () => {
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1250, height: 900 } });
  const pg = await ctx.newPage();
  pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  pg.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  const txt = async (sel) => (await pg.locator(sel).first().innerText()).replace(/\s+/g, ' ');
  const app$ = () => txt('#app');
  const tab = async (name) => { await pg.click('nav.tabs button:has-text("' + name + '")'); await pg.waitForTimeout(150); };

  /* ---- setup and login ---- */
  await pg.goto(base + '/admin');
  await pg.waitForSelector('form[data-form=setup]');
  check('first visit asks for setup', (await app$()).includes('Pehli baar setup'));
  await pg.fill('[name=code]', 'WRONG'); await pg.fill('[name=user]', 'owner'); await pg.fill('[name=pass]', 'Strong#Pass12'); await pg.fill('[name=mobile]', '9766284669');
  await pg.click('button[type=submit]'); await pg.waitForTimeout(300);
  check('wrong setup code is refused', (await txt('#msg')).includes('code galat'));
  await pg.fill('[name=code]', app.setupCode); await pg.click('button[type=submit]');
  await pg.waitForSelector('form[data-form=login]');
  await pg.fill('[name=user]', 'owner'); await pg.fill('[name=pass]', 'wrong-pass-123'); await pg.click('button[type=submit]'); await pg.waitForTimeout(400);
  check('wrong password refused, no OTP sent', (await txt('#msg')).includes('galat') && sent.length === 0);
  await pg.fill('[name=pass]', 'Strong#Pass12'); await pg.click('button[type=submit]');
  await pg.waitForSelector('form[data-form=otp]');
  check('OTP screen shows masked mobile', (await app$()).includes('XXXXXX4669'));
  await pg.fill('[name=otp]', otp() === '111111' ? '222222' : '111111'); await pg.click('button[type=submit]'); await pg.waitForTimeout(300);
  check('wrong OTP refused', (await txt('#msg')).includes('OTP galat'));
  await pg.fill('[name=otp]', otp()); await pg.click('button[type=submit]');
  await pg.waitForSelector('nav.tabs button');
  check('logged in, dashboard visible', /company ka bill/i.test(await app$()));

  /* ---- party with rate card ---- */
  await tab('Party / Company');
  await pg.click('[data-act=panel][data-k=party]');
  await pg.fill('#panel [name=name]', 'Party 1'); await pg.fill('#panel [name=contact]', 'Sharma'); await pg.fill('#panel [name=phone]', '9000000001');
  for (let i = 0; i < 3; i++) await pg.click('[data-act=addrate]');
  const rates = [['Fitter', 22000, 20000], ['Welder', 16000, 15000], ['Cutter', 13000, 12000], ['Helper', 11000, 10000]];
  for (let i = 0; i < 4; i++) { const row = pg.locator('#rateRows tr').nth(i); await row.locator('.r-trade').fill(rates[i][0]); await row.locator('.r-bill').fill(String(rates[i][1])); await row.locator('.r-pay').fill(String(rates[i][2])); }
  await pg.click('#panel button[type=submit]'); await pg.waitForTimeout(400);
  check('party saved and listed', (await app$()).includes('Party 1') && (await app$()).includes('Sharma'));

  /* ---- staff: Ram (supplier), Pankaj ---- */
  await tab('Staff aur links');
  async function addStaff(name, type, extra) {
    await pg.click('[data-act=panel][data-k=staff]');
    await pg.fill('#panel [name=name]', name); await pg.fill('#panel [name=phone]', '9111111111'); await pg.selectOption('#panel [name=type]', type);
    if (extra) await pg.fill('#panel [name=commissionPct]', extra);
    await pg.click('#panel button[type=submit]'); await pg.waitForTimeout(400);
  }
  await addStaff('Ram', 'supplier', '40'); await addStaff('Pankaj', 'agent', '40');
  const body = await app$();
  check('both staff listed with commission %', body.includes('Ram') && body.includes('Pankaj') && body.includes('40%'));
  const ramTok = app.db.staff.find((s) => s.name === 'Ram').token, pankajTok = app.db.staff.find((s) => s.name === 'Pankaj').token;
  const shown = await pg.locator('.link-box').allInnerTexts();
  check('staff link on screen is /staff#<token>', shown.some((t) => t.endsWith('/staff#' + ramTok)));
  check('WhatsApp share link is prepared', (await pg.locator('a[href^="https://wa.me/91"]').count()) >= 2);

  /* ---- staff link: paste 10 rows ---- */
  const sctx = await browser.newContext({ viewport: { width: 1250, height: 900 } });
  const sp = await sctx.newPage();
  sp.on('console', (m) => { if (m.type() === 'error') errors.push('STAFF ' + m.text()); });
  sp.on('pageerror', (e) => errors.push('STAFF PAGEERROR ' + e.message));
  await sp.goto(base + '/staff#' + ramTok);
  await sp.waitForSelector('#grid');
  check('staff page shows own name and sheet', (await sp.locator('#who').innerText()) === 'Ram' && (await sp.locator('#grid tbody tr').count()) >= 5);
  const lines = ['Naam\tMobile\tTrade\tParty\tJoining\tDin'];
  const add = (t, n) => { for (let i = 1; i <= n; i++) lines.push(`${t} ${i}\t98${String(lines.length + 10000000)}\t${t.toLowerCase()}\tParty 1\t01-11-2026\t26`); };
  add('Fitter', 2); add('Welder', 2); add('Cutter', 3); add('Helper', 3);
  await sp.click('[data-act=paste]'); await sp.fill('#pasteBox', lines.join('\n')); await sp.click('[data-act=pasteadd]');
  check('paste adds 10 rows to the sheet', (await sp.locator('#grid tbody tr input[data-k=name]').evaluateAll((els) => els.filter((e) => e.value).length)) === 10);
  await sp.click('[data-act=save]'); await sp.waitForTimeout(600);
  const st = (await sp.locator('#app').innerText()).replace(/\s+/g, ' ');
  check('Ram sees 40%, commission, GST and net', st.includes('40%') && st.includes('₹7,760') && st.includes('₹1,396.8') && st.includes('₹6,363.2'), st);
  check('staff cannot see company rates or margin', !/22,000|148,000|Pool|Margin/i.test(await sp.content()));
  await sp.click('nav.tabs button:has-text("Mera hisaab")');
  check('statement lists the 10 candidates with totals', (await sp.locator('tbody tr').count()) === 11);

  /* ---- admin sees it, party-wise ---- */
  await pg.reload(); await pg.waitForSelector('nav.tabs button');
  await tab('Overview');
  const dash = await app$();
  check('overview: Party 1 with trade-wise headcount', /Party 1: .*3 Cutter/.test(dash) && /2 Fitter/.test(dash) && /3 Helper/.test(dash), dash);
  check('overview: 10 entries waiting for verify', dash.includes('10 candidate'));
  await tab('Owners ka hissa');
  const ow = await app$();
  check('owners: each of the three gets ₹3,181.6', (ow.match(/₹3,181\.6/g) || []).length >= 3 && ow.includes('Anak Patel') && ow.includes('Ram Gopal Patel') && ow.includes('Shukhendra Mishra'), ow);
  check('owners: waterfall shows pool 19,400 and staff commission 7,760', ow.includes('₹19,400') && ow.includes('₹7,760') && ow.includes('₹9,544.8'));
  await tab('Payouts');
  check('payouts: Ram row shows 40% and net 6,363.2', /Ram .*40% 10 260 .*₹7,760 ₹1,396.8 ₹6,363.2/.test(await app$()), await app$());

  /* ---- Excel upload with a bad party row, by Pankaj ---- */
  const pctx = await browser.newContext({ viewport: { width: 1250, height: 900 } });
  const pp = await pctx.newPage();
  await pp.goto(base + '/staff#' + pankajTok); await pp.waitForSelector('#grid');
  await pp.setInputFiles('#file', path.join(__dirname, 'real_excel.xlsx'));
  await pp.waitForTimeout(500);
  const names = await pp.locator('#grid input[data-k=name]').evaluateAll((els) => els.map((e) => e.value).filter(Boolean));
  check('Excel file rows loaded into the sheet (Hindi name too)', names.includes('Ramesh Kumar & Sons') && names.includes('सुरेश यादव'), names.join('|'));
  const dates = await pp.locator('#grid input[data-k=joinDate]').evaluateAll((els) => els.map((e) => e.value).filter(Boolean));
  check('Excel date serial became a real date', dates.includes('2026-11-03'), dates.join(','));
  await pp.click('[data-act=save]'); await pp.waitForTimeout(500);
  check('unknown party row is refused, nothing saved', (await pp.locator('#msg').innerText()).includes('Kuch bhi save nahi hua') && (await pp.locator('tr.err').count()) >= 1);
  check('...and the error row says why', (await pp.locator('tr.err').first().innerText()).includes('Party'));
  await pp.locator('tr.err select[data-k=partyId]').first().selectOption({ label: 'Party 1' });
  await pp.click('[data-act=save]'); await pp.waitForTimeout(600);
  const pk = (await pp.locator('#app').innerText()).replace(/\s+/g, ' ');
  check('after fixing, saved; Pankaj sees only his 3 candidates', /aapka commission/i.test(pk) && /CANDIDATES 3 /i.test(pk), pk);
  check('Pankaj does not see Ram\'s people', !pk.includes('Fitter 1'));

  /* ---- XSS through a staff entry ---- */
  await sp.reload(); await sp.waitForSelector('#grid');
  await sp.locator('#grid tbody tr').last().locator('input[data-k=name]').fill('<img src=x onerror="window.__xss=1">');
  await sp.locator('#grid tbody tr').last().locator('select[data-k=partyId]').selectOption({ label: 'Party 1' });
  await sp.locator('#grid tbody tr').last().locator('input[data-k=trade]').fill('Helper');
  await sp.click('[data-act=save]'); await sp.waitForTimeout(500);
  await pg.reload(); await pg.waitForSelector('nav.tabs button'); await tab('Candidates'); await pg.waitForTimeout(200);
  check('script in a name is shown as text, not run', (await pg.evaluate(() => window.__xss)) === undefined && (await app$()).includes('<img src=x'));

  /* ---- admin edits days, verifies ---- */
  await tab('Party / Company');
  await pg.click('[data-act=open]'); await pg.waitForTimeout(150);
  const before = await txt('#app');
  const dayBox = pg.locator('.js-days').first();
  await dayBox.fill('13'); await dayBox.dispatchEvent('change'); await pg.waitForTimeout(500);
  check('admin changes days and totals follow', (await txt('#app')) !== before);
  await tab('Overview'); await pg.click('[data-act=verifyAll]'); await pg.waitForTimeout(800);
  check('verify all clears the waiting banner', !(await app$()).includes('verify karna baaki'));

  /* ---- company payment and reminder ---- */
  await tab('Reminder');
  const rem = await app$();
  check('reminder list shows Party 1 with amount due', rem.includes('Party 1') && /₹[\d,]+/.test(rem));
  await pg.click('[data-act=panel][data-k=remind]'); await pg.waitForSelector('#remText');
  const href = await pg.getAttribute('#waBtn', 'href');
  check('WhatsApp reminder link has number and Hindi-English message', href.startsWith('https://wa.me/919000000001?text=') && decodeURIComponent(href).includes('A2Z Build Tech') && decodeURIComponent(href).includes('baaki'), href);
  await pg.click('[data-act=sendsms]'); await pg.waitForTimeout(500);
  check('SMS reminder goes through the gateway to the company', sent[sent.length - 1].to === '9000000001' && sent[sent.length - 1].message.includes('Party') === false || sent[sent.length - 1].to === '9000000001');
  check('reminder is logged', (await app$()).includes('(sms)'));
  await tab('Party / Company'); await pg.click('[data-act=panel][data-k=receipt]'); await pg.click('#panel button[type=submit]'); await pg.waitForTimeout(500);
  check('full payment received marks Party 1 as paid', (await app$()).includes('Poora mila'));

  /* ---- exports ---- */
  await tab('Payouts');
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-act=xall]')]);
  check('payout Excel downloads', dl.suggestedFilename().endsWith('.xlsx'));

  /* ---- settings change flows into numbers ---- */
  await tab('Settings');
  await pg.fill('form[data-form=settings] [name=commissionPct]', '30'); await pg.click('form[data-form=settings] button[type=submit]'); await pg.waitForTimeout(500);
  await tab('Payouts');
  check('changing default commission is reflected (Ram stays 40%, Pankaj uses 40% too)', (await app$()).includes('40%'));

  /* ---- bad links ---- */
  const bad = await (await browser.newContext()).newPage();
  await bad.goto(base + '/staff#' + 'a'.repeat(32)); await bad.waitForTimeout(500);
  check('unknown staff link is refused', (await bad.locator('#app').innerText()).includes('kaam nahi kar raha'));
  await bad.goto(base + '/staff'); await bad.waitForTimeout(300);
  check('link without code explains the problem', (await bad.locator('#app').innerText()).includes('poora nahi'));

  /* ---- phone width: no sideways scroll ---- */
  await pg.setViewportSize({ width: 390, height: 800 });
  for (const t of ['Overview', 'Party / Company', 'Staff aur links', 'Candidates', 'Payouts', 'Owners ka hissa', 'Reminder', 'Settings']) {
    await tab(t); const w = await pg.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    check('phone width, admin: ' + t, w[0] <= w[1], w);
  }
  await sp.setViewportSize({ width: 390, height: 800 });
  for (const t of ['Entry sheet', 'Mera hisaab']) { await sp.click('nav.tabs button:has-text("' + t + '")'); const w = await sp.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); check('phone width, staff: ' + t, w[0] <= w[1], w); }

  /* ---- dark mode ---- */
  const dctx = await browser.newContext({ colorScheme: 'dark' }); const dp = await dctx.newPage(); await dp.goto(base + '/staff#' + ramTok); await dp.waitForTimeout(400);
  const bg = await dp.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('dark mode background is dark', /^rgb\((1|2|3)\d?,/.test(bg), bg);

  /* ---- logout and session ---- */
  await pg.setViewportSize({ width: 1250, height: 900 });
  await pg.click('[data-act=logout]'); await pg.waitForSelector('form[data-form=login]');
  check('logout returns to login', true);
  await pg.goto(base + '/admin'); await pg.waitForSelector('form[data-form=login]');
  check('after logout /admin asks for login again', true);

  const real = errors.filter((e) => !/Failed to load resource: the server responded with a status of (401|403|404|429)/.test(e));
  check('no console or page errors (CSP violations included; expected 4xx refusals ignored)', real.length === 0, real.slice(0, 4).join(' || '));
  await browser.close(); app.server.close();
  console.log(fails.length ? '\n' + fails.length + ' FAILED: ' + fails.join('; ') : '\nALL PASSED');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('TEST CRASHED', e); process.exit(2); });
