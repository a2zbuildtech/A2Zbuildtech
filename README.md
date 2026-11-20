# A2Z Build Tech: website + Admin portal

A2Z Build Tech (All Type Manpower Supplier), Vivek Nagar, Ward No. 19, Maihar, MP - 485771

All files are in ONE folder (no sub-folders).

## Files
| File | What it is |
|---|---|
| index.html, style.css, data.js, calc.js, app.js | Public website |
| a2z-build-tech-single.html | Public website as one single file (easy to share / upload to Netlify) |
| admin.html, admin.js, staff.html, staff.js, common.js, portal.css | Admin and staff pages |
| server.js, auth.js, store.js, schema.js, notify.js, cli.js | Node server (login, OTP, data, API) |
| payout.js, xlsx-lite.js | Commission / GST / owners' split engine; Excel reader-writer |
| *.test.js, portal_ui.js, ui_smoke.py, real_excel.xlsx | Tests |
| build.py, make_book.js, make_agreements.js | Helper tools |

## Run the portal
```
node server.js        # Node 20+; prints the first-time SETUP CODE on screen
```
Open `http://127.0.0.1:8080/admin`, enter the setup code, a strong password (10+ chars, letters + digits) and your mobile. Staff open their own link `/staff#<code>` (made in Admin > Staff aur links).

| Environment variable | Meaning |
|---|---|
| PORT, HOST | default 8080 and 127.0.0.1. For the internet use HOST=0.0.0.0 behind an HTTPS proxy |
| DATA_DIR | where data (db.json) and daily backups live. Never upload it to GitHub |
| OTP_PROVIDER=webhook, SMS_WEBHOOK_URL, SMS_WEBHOOK_TOKEN | real SMS through your gateway |
| COOKIE_SECURE=1, TRUST_PROXY=1, NODE_ENV=production | set when running behind HTTPS |

Forgot admin password? Stop the server, then `node cli.js reset-admin` (data stays).

## Tests
```
node --test calc.test.js payout.test.js xlsx.test.js server.test.js
```
(portal_ui.js and ui_smoke.py need Playwright and Chrome.)

## Important limits
- Real SMS needs a gateway with DLT registration. The webhook route could not be tested with a real gateway.
- Payout assumptions (change in Settings after your CA confirms): 40% commission on (margin + company's 5% of bill); 18% GST on staff commission and on the firm's share; three partners split equally.
- Agreements and the handbook are in the separate Google Drive folder, not here.
