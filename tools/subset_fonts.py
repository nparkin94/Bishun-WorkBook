"""Regenerates the self-hosted font subsets in app/fonts.

  pip install fonttools brotli
  python3 subset_fonts.py [/path/to/noto/otc/folder]

Noto Serif CJK TC (Medium, Bold, Black) is cut down to the Chinese characters this app can show, which takes the
three weights from about 27 MB each to about 100 KB each. Schibsted Grotesk has no pinyin letters with a caron on
i, o and u (ǐ ǒ ǔ ǚ), so those few glyphs come from Noto Sans CJK TC in two weights. Both Noto families are SIL OFL 1.1.
"""
import json
import os
import re
import sys

from fontTools import subset
from fontTools.ttLib import TTCollection, TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'app')
OUT = os.path.join(APP, 'fonts')
NOTO = sys.argv[1] if len(sys.argv) > 1 else '/usr/share/fonts/opentype/noto'

cjk = re.compile(r'[　-〿一-鿿＀-￯]')
text = ''
for fn in ('index.html', 'app.js', 'styles.css', 'data.js'):
    with open(os.path.join(APP, fn), encoding='utf-8') as f:
        text += f.read()
chars = ''.join(sorted(set(cjk.findall(text)))) + ''.join(chr(c) for c in range(0x20, 0x7F))
print(len(set(cjk.findall(text))), 'Chinese characters in use')


def tc_face(path):
    coll = TTCollection(path)
    for f in coll.fonts:
        if ' TC' in (f['name'].getDebugName(16) or f['name'].getDebugName(1)):
            return f
    raise SystemExit('no TC face in ' + path)


def cut(font, unicodes=None, text=None, dst=None):
    tmp = dst + '.tmp.otf'
    font.save(tmp)
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    opts.notdef_outline = True
    ft = subset.load_font(tmp, opts)
    s = subset.Subsetter(opts)
    s.populate(unicodes=unicodes or [], text=text or '')
    s.subset(ft)
    subset.save_font(ft, dst, opts)
    os.remove(tmp)
    print('  %-28s %5.1f KB' % (os.path.basename(dst), os.path.getsize(dst) / 1024))


for name, weight in (('Medium', 500), ('Bold', 700), ('Black', 900)):
    cut(tc_face(os.path.join(NOTO, 'NotoSerifCJK-%s.ttc' % name)), text=chars, dst=os.path.join(OUT, 'noto-serif-tc-%d.woff2' % weight))

# the pinyin letters Schibsted Grotesk lacks
sch = set()
for fn in ('schibsted-grotesk-latin.woff2', 'schibsted-grotesk-latin-ext.woff2'):
    sch |= set(TTFont(os.path.join(OUT, fn)).getBestCmap())
missing = [c for c in range(0x01CD, 0x01DD) if c not in sch]
print('pinyin glyphs taken from Noto Sans CJK TC:', ' '.join(chr(c) for c in missing))
for name, weight in (('Regular', 400), ('Bold', 700)):
    cut(tc_face(os.path.join(NOTO, 'NotoSansCJK-%s.ttc' % name)), unicodes=missing, dst=os.path.join(OUT, 'pinyin-%d.woff2' % weight))
print('unicode-range for styles.css:', ','.join('U+%04X' % c for c in missing))
