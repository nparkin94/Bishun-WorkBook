"""Static checks on the shipped app folder (no browser needed).

  pip install fonttools brotli opencc-python-reimplemented
  python3 check_static.py

Checks: manifest and icons, the service worker precache list covers every shipped file, every local URL resolves,
every character the page can show is in the self-hosted fonts, and no simplified-only Chinese characters appear anywhere.
"""
import json
import os
import re
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'app')
fails = 0


def check(name, ok, extra=None):
    global fails
    if ok:
        print('  ok  ', name)
    else:
        fails += 1
        print('  FAIL', name, '' if extra is None else extra)


def read(rel):
    with open(os.path.join(APP, rel), encoding='utf-8') as f:
        return f.read()


def png_size(rel):
    with open(os.path.join(APP, rel), 'rb') as f:
        head = f.read(24)
    if head[:8] != b'\x89PNG\r\n\x1a\n':
        return None
    return struct.unpack('>II', head[16:24])


# ---------- manifest and icons ----------
print('manifest')
man = json.loads(read('manifest.webmanifest'))
check('standalone display with relative start_url and scope', man['display'] == 'standalone' and man['start_url'] == './' and man['scope'] == './')
check('has name, short_name, colours', all(man.get(k) for k in ('name', 'short_name', 'background_color', 'theme_color')))
sizes = {i['purpose']: i for i in man['icons']}
check('has any and maskable icons', 'any' in sizes and 'maskable' in sizes)
for i in man['icons']:
    w, h = png_size(i['src']) or (0, 0)
    check('icon ' + i['src'] + ' is ' + i['sizes'], '%dx%d' % (w, h) == i['sizes'], (w, h))
check('192 and 512 any-icons present', {'192x192', '512x512'} <= {i['sizes'] for i in man['icons'] if i['purpose'] == 'any'})
check('apple-touch-icon is 180x180', png_size('icons/apple-touch-icon.png') == (180, 180))
check('shortcut targets are valid tabs', all(re.fullmatch(r'\./#(watch|write|quiz|strokes|rules)', s['url']) for s in man.get('shortcuts', [])))

# ---------- service worker precache ----------
print('service worker')
sw = read('sw.js')
pre = re.findall(r"'([^']+)'", re.search(r'const PRECACHE = \[(.*?)\];', sw, re.S).group(1))
shipped = []
for root, _, files in os.walk(APP):
    for fn in files:
        shipped.append(os.path.relpath(os.path.join(root, fn), APP).replace(os.sep, '/'))
need = sorted(f for f in shipped if f != 'sw.js')
listed = sorted(p for p in pre if p != './')
check('every precache entry exists', all(os.path.exists(os.path.join(APP, p)) for p in listed), [p for p in listed if not os.path.exists(os.path.join(APP, p))])
check('every shipped file (except sw.js) is precached', need == listed, {'missing': sorted(set(need) - set(listed)), 'extra': sorted(set(listed) - set(need))})
check('the shell root ./ is precached', './' in pre)
check('cache name is stamped from __BUILD__', "const BUILD = '__BUILD__'" in sw)
total = sum(os.path.getsize(os.path.join(APP, p)) for p in listed)
print('       precache total: %.0f KB over %d files' % (total / 1024, len(listed)))
check('precache stays under 1.5 MB', total < 1.5 * 1024 * 1024, total)

# ---------- local URLs ----------
print('urls')
html, css, js, appjs = read('index.html'), read('styles.css'), read('sw.js'), read('app.js')
urls = re.findall(r'(?:href|src)="([^"#]+)"', html) + re.findall(r'url\(([^)]+)\)', css) + [i['src'] for i in man['icons']]
urls = [u.strip('\'"') for u in urls]
check('no absolute-path or external URLs in html/css/manifest', not [u for u in urls if u.startswith('/') or re.match(r'https?:', u)], [u for u in urls if u.startswith('/') or re.match(r'https?:', u)])
check('every local URL resolves to a shipped file', all(os.path.exists(os.path.join(APP, u)) for u in urls), [u for u in urls if not os.path.exists(os.path.join(APP, u))])
check('app.js has no hard-coded origins', not re.search(r'https?://', appjs))
check('no Google Fonts or CDN requests', 'googleapis' not in html + css and 'cdn' not in (html + css).lower())
check('viewport allows pinch zoom and covers the notch', 'viewport-fit=cover' in html and 'user-scalable=no' not in html and 'maximum-scale' not in html)

# ---------- ids used by the script exist in the page ----------
ids = set(re.findall(r'id="([^"]+)"', html))
used = set(re.findall(r"\$\('#([A-Za-z0-9_-]+)'", appjs))
built_later = {'q-go', 'q-again', 'q-see'}          # buttons the quiz creates when it needs them
prefixes = ('panel-', 'tab-', 'shelf-')              # ids assembled from a name at run time
static_used = {u for u in used if u not in built_later and not u.endswith('-') }
check('every $("#id") in app.js exists in index.html', static_used <= ids, sorted(static_used - ids))
for pre_ in prefixes:
    names = set(re.findall(r"'" + pre_ + r"([a-z]+)'", appjs)) | {'watch', 'write', 'quiz', 'strokes', 'rules'} if pre_ != 'shelf-' else {'watch', 'write', 'sheet'}
    check('all ' + pre_ + '* ids exist (' + ', '.join(sorted(names)) + ')', all(pre_ + n in ids for n in names), [pre_ + n for n in names if pre_ + n not in ids])

# ---------- fonts ----------
print('fonts')
from fontTools.ttLib import TTFont

cjk_re = re.compile(r'[　-〿一-鿿＀-￯]')
shown = set()
for text in (html, appjs, css):
    shown |= set(cjk_re.findall(text))
data = read('data.js')
payload = json.loads(re.search(r'window\.BISHUN_DATA=(.*);\s*$', data, re.S).group(1).replace('<\\/', '</'))
for ch in payload['chars']:
    shown.add(ch['c'])
    for st in ch['s']:
        shown |= set(cjk_re.findall(st['t']))
for wt in (500, 700, 900):
    cm = TTFont(os.path.join(APP, 'fonts', 'noto-serif-tc-%d.woff2' % wt)).getBestCmap()
    miss = sorted(c for c in shown if ord(c) not in cm)
    check('Noto Serif TC %d covers all %d Chinese characters used' % (wt, len(shown)), not miss, miss)
latin = set()
for fn in ('schibsted-grotesk-latin.woff2', 'schibsted-grotesk-latin-ext.woff2', 'pinyin-400.woff2', 'pinyin-700.woff2'):
    latin |= set(TTFont(os.path.join(APP, 'fonts', fn)).getBestCmap())
ui_text = re.sub(r'<style.*?</style>|<script.*?</script>', '', html, flags=re.S) + appjs
non_ascii = {c for c in ui_text if ord(c) > 127 and not cjk_re.match(c)}
check('Schibsted Grotesk plus the pinyin faces cover every other non-ASCII character in the UI', all(ord(c) in latin for c in non_ascii), sorted(c for c in non_ascii if ord(c) not in latin))
pinyin = {c for ch in payload['chars'] for c in ch['py'] + ch['en']}
check('and every pinyin letter in the data', all(ord(c) in latin for c in pinyin), sorted(c for c in pinyin if ord(c) not in latin))

# ---------- traditional only ----------
print('traditional characters only')
import opencc
s2t = opencc.OpenCC('s2t')
everything = ''.join(read(p) for p in ('index.html', 'app.js', 'styles.css', 'manifest.webmanifest')) + ''.join(shown)
simplified = sorted({c for c in set(cjk_re.findall(everything)) if s2t.convert(c) != c})
check('no simplified-only characters in the page, script, manifest or data', not simplified, simplified)

print('\n%d check(s) failed' % fails if fails else '\nall static checks passed')
sys.exit(1 if fails else 0)
