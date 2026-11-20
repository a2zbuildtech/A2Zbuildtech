#!/usr/bin/env python3
"""Build a single-file copy of the site (everything inlined) for easy sharing.

    python3 tools/build.py                      -> dist/a2z-build-tech-single.html
    python3 tools/build.py --artifact out.html  -> body-only page for Claude Artifacts

No packages needed. Run it from the project folder after changing any file.
"""
import re, sys, pathlib

root = pathlib.Path(__file__).resolve().parent
html = (root / 'index.html').read_text(encoding='utf8')

# the single file keeps scripts inline, so the strict script-src rule is dropped
html = re.sub(r'<!-- CSP-START -->.*?<!-- CSP-END -->', '', html, flags=re.S)

css = (root / 'style.css').read_text(encoding='utf8')
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '</style>')

def inline(m):
    code = (root / m.group(1)).read_text(encoding='utf8')
    assert '</script' not in code.lower(), 'script contains a closing script tag'
    return '<script>\n' + code + '\n</script>'

html = re.sub(r'<script src="([^"]+\.js)"></script>', inline, html)

if len(sys.argv) > 2 and sys.argv[1] == '--artifact':
    # Artifacts add their own doctype, html, head and body
    title = re.search(r'<title>.*?</title>', html).group(0)
    meta = '<meta name="claude:viewport-fit-sides" content="cover">'
    fonts = re.search(r'<link rel="stylesheet" href="https://fonts[^>]+>', html).group(0)
    style = re.search(r'<style>.*?</style>', html, re.S).group(0)
    body = re.search(r'<body>(.*)</body>', html, re.S).group(1)
    out = title + '\n' + meta + '\n' + fonts + '\n' + style + '\n' + body
    pathlib.Path(sys.argv[2]).write_text(out, encoding='utf8')
    print('artifact page written:', sys.argv[2], len(out), 'bytes')
else:
    dist = root
    dist.mkdir(exist_ok=True)
    target = dist / 'a2z-build-tech-single.html'
    target.write_text(html, encoding='utf8')
    print('written:', target, len(html), 'bytes')
