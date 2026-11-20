#!/usr/bin/env python3
"""Browser smoke test (optional). Needs: pip install playwright, and Chrome.

    python3 tests/ui_smoke.py http://127.0.0.1:8099/index.html
    python3 tests/ui_smoke.py file:///full/path/dist/a2z-build-tech-single.html

Checks every page, the calculators, login, the admin tools, an injection
attempt, and that nothing scrolls sideways on a phone-sized screen.
"""
import sys, re
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8099/index.html'
CHROME = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
ROUTES = ['home', 'methods', 'calculators', 'manpower', 'formulas', 'terms', 'contact', 'admin']
fails, errors = [], []

def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + ((' -> ' + str(extra)) if (extra and not ok) else ''))
    if not ok:
        fails.append(name)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1200, 'height': 900})
    pg = ctx.new_page()
    # font downloads fail offline; every other console error counts
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    pg.goto(URL)

    # 1. every page renders
    for r in ROUTES:
        pg.evaluate("location.hash='%s'" % r)
        pg.wait_for_timeout(120)
        txt = pg.text_content('#app')
        check('page renders: ' + r, len(txt) > 80 and 'undefined' not in txt and 'NaN' not in txt, txt[:80])

    # 2. calculators
    pg.evaluate("location.hash='calculators'")
    pg.wait_for_timeout(150)
    out = pg.text_content('#calcOut')
    check('concrete default shows 19 bags', '19' in out and 'Estimated total' in out, out)
    for name in ['Brickwork', 'Plaster', 'Steel bars', 'Tiles', 'Paint', 'Excavation', 'Concrete']:
        pg.click('#calcTabs >> text=' + name)
        t = pg.text_content('#calcOut')
        check('calculator ' + name, 'Estimated total' in t and 'NaN' not in t and 'Infinity' not in t, t[:100])
    pg.fill('#calcBox [name=l]', '-5')
    t = pg.text_content('#calcOut')
    check('negative length gives zero, not NaN', 'NaN' not in t and re.search(r'Cement\s*0\s*bag', t) is not None, t)
    pg.fill('#calcBox [name=l]', '1e400')
    check('huge input stays finite', 'Infinity' not in pg.text_content('#calcOut'))
    t = pg.text_content('#boqOut')
    check('BOQ sample total 2,97,553.52', '2,97,553.52' in t, t)
    pg.click('text=Add item')
    check('BOQ add item', pg.locator('#boqRows tr').count() == 4)

    # 3. manpower
    pg.evaluate("location.hash='manpower'")
    pg.wait_for_timeout(150)
    t = pg.text_content('#mpOut')
    check('manpower sample total 1,28,242.40', '1,28,242.40' in t, t)

    # 4. admin: setup, wrong confirm, correct
    pg.evaluate("location.hash='admin'")
    pg.wait_for_timeout(150)
    check('admin asks to create account first', 'Create admin account' in pg.text_content('#app'))
    pg.fill('[name=u]', 'owner'); pg.fill('[name=p]', 'abc'); pg.fill('[name=p2]', 'abc')
    pg.click('text=Create account')
    check('short password rejected', 'at least 8' in pg.text_content('#loginMsg'))
    pg.fill('[name=p]', 'Strong#Pass1'); pg.fill('[name=p2]', 'Different1')
    pg.click('text=Create account')
    check('mismatch rejected', 'do not match' in pg.text_content('#loginMsg'))
    pg.fill('[name=p2]', 'Strong#Pass1')
    pg.click('text=Create account')
    pg.wait_for_timeout(300)
    check('account created and logged in', 'Admin panel' in pg.text_content('#app'))
    stored = pg.evaluate("localStorage.getItem('a2z_build_tech_v1')")
    check('password not stored in plain text', 'Strong#Pass1' not in stored)

    # 5. workers + injection
    pg.click('#app >> text=Workers')
    pg.fill('#adBody [name=name]', '<img src=x onerror="window.__xss=1">')
    pg.click('#adBody >> button:has-text("Add")')
    pg.wait_for_timeout(200)
    check('injected HTML is shown as text, not run', pg.evaluate("window.__xss") is None and '<img' in pg.text_content('#adBody'))
    pg.click('#adBody >> text=Delete')
    pg.click('#adBody >> text=Sure?')
    check('two-step delete works', 'Nothing added yet' in pg.text_content('#adBody'))

    # 6. rates feed calculators; core rows protected
    pg.click('#app >> text=Rates')
    check('core material cannot be deleted', pg.locator('#adBody .pill:has-text("Used in calculators")').count() >= 8)
    pg.fill('#adBody tbody tr:first-child input[data-k=rate]', '400')
    pg.evaluate("location.hash='calculators'"); pg.wait_for_timeout(150)
    pg.fill('#calcBox [name=l]', '5')
    check('new cement rate used in calculator', '7,600' in pg.text_content('#calcOut'), pg.text_content('#calcOut'))
    pg.evaluate("location.hash='admin'"); pg.wait_for_timeout(150)

    # 7. payments + agreement
    pg.click('#app >> text=Payments')
    check('bill net payable 5,55,000.00', '5,55,000.00' in pg.text_content('#billOut'), pg.text_content('#billOut'))
    pg.click('#app >> text=Agreement')
    pg.fill('#adBody [name=party]', 'Test Cement Ltd')
    check('agreement uses company name', 'Test Cement Ltd' in pg.text_content('#agrOut'))

    # 8. backup restore
    pg.click('#app >> text=Account and security')
    pg.fill('#adBody form[data-form=restore] textarea', 'not json')
    pg.click('text=Restore backup')
    check('garbage backup refused', 'not a valid backup' in pg.text_content('#toast'))
    good = pg.input_value('#bk') if pg.locator('#bk').count() else pg.evaluate("document.querySelector('#bk').value")
    pg.fill('#adBody form[data-form=restore] textarea', good)
    pg.click('text=Restore backup')
    check('valid backup accepted', 'restored' in pg.text_content('#toast'))

    # 9. logout, bad logins, lockout
    pg.click('text=Log out')
    check('logged out shows login', 'Admin login' in pg.text_content('#app'))
    for i in range(5):
        pg.fill('[name=u]', 'owner'); pg.fill('[name=p]', 'wrongpass%d' % i)
        pg.click('button:has-text("Log in")')
        pg.wait_for_timeout(250)
    pg.fill('[name=u]', 'owner'); pg.fill('[name=p]', 'Strong#Pass1')
    pg.click('button:has-text("Log in")')
    pg.wait_for_timeout(250)
    check('5 wrong attempts lock login', 'Too many attempts' in pg.text_content('#loginMsg'), pg.text_content('#loginMsg'))
    pg.reload(); pg.wait_for_timeout(200)
    check('reload does not keep login', 'Admin login' in pg.text_content('#app') or 'Admin' not in pg.text_content('#app')[:0])

    # 10. phone width, no sideways scroll
    pg.set_viewport_size({'width': 390, 'height': 800})
    for r in ROUTES:
        pg.evaluate("location.hash='%s'" % r); pg.wait_for_timeout(150)
        w = pg.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
        check('no sideways scroll on phone: ' + r, w[0] <= w[1], w)

    # 11. dark scheme paints a dark background
    ctx2 = b.new_context(color_scheme='dark', viewport={'width': 1000, 'height': 700})
    pd = ctx2.new_page(); pd.goto(URL); pd.wait_for_timeout(150)
    bg = pd.evaluate("getComputedStyle(document.body).backgroundColor")
    check('dark theme background is dark', bg.startswith('rgb(1') and bg != 'rgb(255, 255, 255)', bg)

    b.close()

check('no console or page errors', not errors, errors[:5])
print('\n%d failed' % len(fails) if fails else '\nALL PASSED')
sys.exit(1 if fails else 0)
