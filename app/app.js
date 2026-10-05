(function () {
'use strict';

/* ---------- data ---------- */
var DATA = window.BISHUN_DATA;
var BUILD = '__BUILD__';
var CH = DATA.chars;
var BY = new Map(CH.map(function (c) { return [c.c, c]; }));

var LEVELS = [
  { id: 1, name: 'Starter', zh: '入門', note: '1–4 strokes' },
  { id: 2, name: 'Everyday', zh: '常用', note: '5–9 strokes' },
  { id: 3, name: 'Challenge', zh: '挑戰', note: '10–16 strokes' }
];

var TYPES = {
  '點': { py: 'diǎn', en: 'dot', basic: true, tip: 'A short press. Start at the top and push down to the right. Dots on the left side of a character slant down to the left.' },
  '橫': { py: 'héng', en: 'horizontal', basic: true, tip: 'Draw from left to right, rising very slightly.' },
  '豎': { py: 'shù', en: 'vertical', basic: true, tip: 'Draw straight down from the top.' },
  '撇': { py: 'piě', en: 'left-falling', basic: true, tip: 'Start at the top and sweep down to the left, thinning to a point.' },
  '捺': { py: 'nà', en: 'right-falling', basic: true, tip: 'Start thin at the upper left, sweep down to the right, and finish with a flat foot.' },
  '提': { py: 'tí', en: 'rising', basic: true, tip: 'Flick up and to the right, starting low and thinning as you rise.' },
  '橫折': { py: 'héngzhé', en: 'horizontal, turn down', tip: 'Go right, turn the corner, then go down in one movement.' },
  '橫鉤': { py: 'hénggōu', en: 'horizontal with hook', tip: 'Go right, then flick down to the left at the end.' },
  '橫撇': { py: 'héngpiě', en: 'horizontal, then left-falling', tip: 'Go right, then turn and sweep down to the left.' },
  '橫折鉤': { py: 'héngzhégōu', en: 'horizontal, turn, hook', tip: 'Go right, turn down, then flick a small hook to the left at the bottom.' },
  '豎折': { py: 'shùzhé', en: 'vertical, turn right', tip: 'Go down, turn the corner, then go right.' },
  '豎鉤': { py: 'shùgōu', en: 'vertical with hook', tip: 'Go down, then flick the hook up to the left.' },
  '豎彎鉤': { py: 'shùwāngōu', en: 'vertical, bend, hook', tip: 'Go down, curve to the right, then flick upward.' },
  '豎折折鉤': { py: 'shùzhézhégōu', en: 'vertical, two turns, hook', tip: 'Go down, turn right, turn down, then flick a small hook to the left.' },
  '斜鉤': { py: 'xiégōu', en: 'slanted hook', tip: 'Curve down to the right, then flick up at the end.' },
  '臥鉤': { py: 'wògōu', en: 'lying hook', tip: 'Curve down to the right like a shallow bowl, then hook upward.' },
  '撇折': { py: 'piězhé', en: 'left-falling, turn right', tip: 'Sweep down to the left, then turn and go right.' },
  '撇點': { py: 'piědiǎn', en: 'left-falling, then dot', tip: 'Sweep down to the left, then turn and press down to the right.' }
};

var CONFUSABLE = [
  ['橫折', '橫折鉤', '橫鉤', '橫撇'],
  ['豎', '豎鉤', '豎折', '豎彎鉤', '豎折折鉤'],
  ['點', '撇', '撇點', '捺'],
  ['橫', '提'],
  ['撇折', '撇點', '豎折'],
  ['斜鉤', '臥鉤', '豎彎鉤']
];

var RULES = [
  { t: 'Top before bottom', zh: '由上而下', c: '三', text: 'Write the higher stroke first. In 三 the three horizontals go in order from the top down.' },
  { t: 'Left before right', zh: '由左而右', c: '好', text: 'When parts sit side by side, write the left part first. In 好 the 女 comes before the 子.' },
  { t: 'Horizontal before vertical', zh: '先橫後豎', c: '十', text: 'When a horizontal stroke crosses a vertical one, write the horizontal first, as in 十.' },
  { t: 'Left-falling before right-falling', zh: '先撇後捺', c: '人', text: 'When a 撇 and a 捺 meet, write the 撇 first. 人 is the clearest case.' },
  { t: 'Outside before inside', zh: '先外後內', c: '月', text: 'Write the frame first, then what sits inside it. In 月 the outer 撇 and 橫折鉤 come before the two bars.' },
  { t: 'Middle before sides', zh: '先中間後兩邊', c: '小', text: 'In a symmetrical character, write the middle stroke first, then the left, then the right. 小 is the classic example.' },
  { t: 'Close the box last', zh: '封口最後', c: '田', text: 'Write the walls of a box and what is inside it first. The bottom line closes it last, as in 田.' },
  { t: 'Piercing stroke last', zh: '貫穿最後', c: '中', text: 'A stroke that runs straight through the middle of a character is written last. In 中 the box comes first and the vertical goes through it at the end.' },
  { t: 'Corner dot last', zh: '點在最後', c: '我', text: 'A dot tucked into a corner is usually written last. In 我 the dot is the seventh and final stroke.' }
];

/* ---------- helpers ---------- */
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
var zh = function (s) { return '<span lang="zh-Hant">' + s + '</span>'; };
var reduceMotion = function () { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
var rand = function () { return Math.random(); };
var randInt = function (a, b) { return a + Math.floor(rand() * (b - a + 1)); };
var pick = function (arr) { return arr[Math.floor(rand() * arr.length)]; };
function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

/* ---------- geometry ---------- */
var FLIP = 900;
function dpt(p) { return [p[0], FLIP - p[1]]; }
function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
function polyLen(pts) { var L = 0; for (var i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]); return L; }
function resample(pts, n) {
  var total = polyLen(pts);
  if (!(total > 0)) { var out0 = []; for (var q = 0; q < n; q++) out0.push(pts[0].slice()); return out0; }
  var out = [pts[0].slice()], step = total / (n - 1), seg = 0, segStart = 0;
  for (var k = 1; k < n - 1; k++) {
    var target = k * step;
    while (seg < pts.length - 2 && segStart + dist(pts[seg], pts[seg + 1]) < target) { segStart += dist(pts[seg], pts[seg + 1]); seg++; }
    var sl = dist(pts[seg], pts[seg + 1]) || 1;
    var t = Math.min(1, Math.max(0, (target - segStart) / sl));
    out.push([pts[seg][0] + (pts[seg + 1][0] - pts[seg][0]) * t, pts[seg][1] + (pts[seg + 1][1] - pts[seg][1]) * t]);
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}
function centroid(pts) { var x = 0, y = 0; pts.forEach(function (p) { x += p[0]; y += p[1]; }); return [x / pts.length, y / pts.length]; }

/* ---------- svg builders ---------- */
function gridHTML() {
  return '<g class="grid"><rect class="gb" x="6" y="6" width="1012" height="1012"/>' +
    '<line class="gl" x1="512" y1="6" x2="512" y2="1018"/><line class="gl" x1="6" y1="512" x2="1018" y2="512"/>' +
    '<g class="diag"><line class="gl" x1="6" y1="6" x2="1018" y2="1018"/><line class="gl" x1="1018" y1="6" x2="6" y2="1018"/></g></g>';
}
function badgePos(m) {
  var a = dpt(m[0]), b = a;
  for (var i = 1; i < m.length; i++) { if (dist(m[i], m[0]) > 25) { b = dpt(m[i]); break; } }
  var dx = a[0] - b[0], dy = a[1] - b[1], l = Math.hypot(dx, dy) || 1;
  var x = a[0] + dx / l * 54, y = a[1] + dy / l * 54;
  return [Math.min(984, Math.max(40, x)), Math.min(984, Math.max(40, y))];
}
function stageInner(ch, uid) {
  var defs = '', base = '', over = '', nums = '';
  ch.s.forEach(function (st, i) {
    var L = Math.ceil(polyLen(st.m)) + 8;
    var mp = 'M' + st.m.map(function (p) { return p[0] + ' ' + p[1]; }).join('L');
    defs += '<mask id="' + uid + 'm' + i + '" maskUnits="userSpaceOnUse" x="-200" y="-400" width="1500" height="1700">' +
      '<path class="mk" d="' + mp + '" data-len="' + L + '" fill="none" stroke="#fff" stroke-width="200" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="' + L + ' ' + L + '"/></mask>';
    base += '<path class="b" d="' + st.d + '"/>';
    over += '<path class="h" d="' + st.d + '" mask="url(#' + uid + 'm' + i + ')"/>';
    var bp = badgePos(st.m);
    nums += '<g class="nb" transform="translate(' + bp[0].toFixed(0) + ' ' + bp[1].toFixed(0) + ')"><circle r="36"/><text y="14">' + (i + 1) + '</text></g>';
  });
  return '<defs>' + defs + '</defs>' + gridHTML() +
    '<g class="glyph" transform="translate(0,900) scale(1,-1)">' + base + '<g class="ov">' + over + '</g></g><g class="nums">' + nums + '</g>';
}
function miniSVG(ch, o) {
  o = o || {};
  var done = o.done == null ? ch.s.length : o.done, cand = o.cand == null ? -1 : o.cand, hl = o.hl == null ? -1 : o.hl;
  var p = '';
  ch.s.forEach(function (st, j) {
    var c;
    if (j === hl || j === cand) c = 'h';
    else if (j < done) c = 'b';
    else if (o.ghost) c = 'g';
    else return;
    p += '<path class="' + c + '" d="' + st.d + '"/>';
  });
  return '<svg class="mini" viewBox="0 0 1024 1024" role="img" aria-label="' + esc(o.label || ch.c) + '">' + gridHTML() +
    '<g class="glyph" transform="translate(0,900) scale(1,-1)">' + p + '</g></svg>';
}
function iconSVG(ch, idx) {
  var st = ch.s[idx], m = st.m.map(dpt);
  var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  m.forEach(function (q) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
  var side = Math.max(x1 - x0, y1 - y0, 150) + 190, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  var vb = (cx - side / 2).toFixed(0) + ' ' + (cy - side / 2).toFixed(0) + ' ' + side.toFixed(0) + ' ' + side.toFixed(0);
  return '<svg class="sicon" viewBox="' + vb + '" role="img" aria-label="' + esc(st.t) + ' as written in ' + esc(ch.c) + '"><g class="glyph" transform="translate(0,900) scale(1,-1)"><path class="b" d="' + st.d + '"/></g>' +
    '<circle class="startdot" cx="' + m[0][0] + '" cy="' + m[0][1] + '" r="' + (side * 0.05).toFixed(0) + '"/></svg>';
}
function filmHTML(ch) {
  return ch.s.map(function (st, i) {
    return '<figure class="fcell">' + miniSVG(ch, { done: i + 1, hl: i, label: 'Stroke ' + (i + 1) + ' of ' + ch.c + ', ' + st.t }) +
      '<figcaption>' + (i + 1) + ' <span lang="zh-Hant">' + st.t + '</span></figcaption></figure>';
  }).join('');
}
function drawOn(mk, dur) {
  if (!mk || reduceMotion() || typeof mk.animate !== 'function') return;
  var L = +mk.getAttribute('data-len') || 400;
  try { mk.getAnimations().forEach(function (a) { a.cancel(); }); } catch (e) {}
  try {
    mk.animate([{ strokeDashoffset: L + 120 }, { strokeDashoffset: 0 }],
      { duration: dur || Math.min(900, 260 + L * 0.7), easing: 'cubic-bezier(.35,.1,.25,1)', fill: 'both' });
  } catch (e) {}
}

/* ---------- storage (per viewer convenience only) ---------- */
var KEY = 'bishun-workbook-v1';
var store = {
  data: null,
  load: function () {
    if (this.data) return this.data;
    try { this.data = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { this.data = {}; }
    if (!this.data.done) this.data.done = {};
    if (!this.data.best) this.data.best = {};
    return this.data;
  },
  save: function () { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) {} }
};

/* ---------- shared state ---------- */
var cur = '永';
var TABS = ['watch', 'write', 'quiz', 'strokes', 'rules'];
var tab = 'watch';

function headHTML(ch) {
  return '<span class="hz" lang="zh-Hant">' + ch.c + '</span><div><div class="hp">' + esc(ch.py) + '</div><div class="hm">' + esc(ch.en) + ' · ' + plural(ch.s.length, 'stroke') + '</div></div><button type="button" class="btn pickbtn" data-open-sheet="1" aria-haspopup="dialog">Characters</button>';
}

/* ---------- shelves ---------- */
function renderShelves() {
  var d = store.load().done;
  var total = CH.length, n = CH.filter(function (c) { return d[c.c]; }).length;
  ['watch', 'write', 'sheet'].forEach(function (k) {
    var el = $('#shelf-' + k);
    var h = '<div class="shelf-head"><h2>Characters</h2><p class="prog">Practiced ' + n + ' of ' + total + ' in Write</p></div>';
    LEVELS.forEach(function (lv) {
      h += '<div class="lvl"><h3><span class="zh" lang="zh-Hant">' + lv.zh + '</span>' + lv.name + '<small>' + lv.note + '</small></h3><div class="chips">';
      CH.filter(function (c) { return c.lv === lv.id; }).forEach(function (c) {
        var isDone = !!d[c.c];
        h += '<button type="button" class="chip' + (isDone ? ' done' : '') + '" data-c="' + c.c + '" aria-pressed="' + (c.c === cur) + '" aria-label="' +
          c.c + ', ' + esc(c.py) + ', ' + esc(c.en) + ', ' + plural(c.s.length, 'stroke') + (isDone ? ', practiced' : '') + '"><span lang="zh-Hant">' + c.c + '</span></button>';
      });
      h += '</div></div>';
    });
    el.innerHTML = h;
  });
}
document.addEventListener('click', function (e) {
  var t = e.target, chip = t.closest ? t.closest('.chip') : null;
  if (chip && chip.parentNode && chip.closest('.shelf')) { setChar(chip.getAttribute('data-c'), 0); closeSheet(); return; }
  var op = t.closest ? t.closest('[data-open-sheet]') : null;
  if (op) { openSheet(op.getAttribute('data-open-sheet')); return; }
  if (t.closest && (t.closest('[data-close]') || t.closest('#sheet-close'))) closeSheet();
});

/* ---------- bottom sheets: character picker and install steps ---------- */
function openSheet(id) {
  var el = $('#' + (id && id !== '1' ? id : 'sheet'));
  if (!el) return;
  el.hidden = false;
  document.body.style.overflow = 'hidden';
  var panel = $('.sheet-panel', el), on = $('.chip[aria-pressed="true"]', el);
  try { if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' }); panel.focus({ preventScroll: true }); } catch (e) {}
}
function openSheetEl() { return $$('.sheet').filter(function (s) { return !s.hidden; })[0] || null; }
function closeSheet() {
  var el = openSheetEl();
  if (!el) return;
  el.hidden = true;
  document.body.style.overflow = '';
  var again = $('#panel-' + tab + ' .pickbtn');
  try { if (again && el.id === 'sheet') again.focus({ preventScroll: true }); } catch (e) {}
}
document.addEventListener('keydown', function (e) {
  var el = openSheetEl();
  if (!el) return;
  if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
  if (e.key === 'Tab') {
    var panel = $('.sheet-panel', el);
    var f = $$('button', panel).filter(function (b) { return !b.disabled; }); if (!f.length) return;
    var first = f[0], last = f[f.length - 1], act = document.activeElement;
    if (e.shiftKey && (act === first || act === panel)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && act === last) { e.preventDefault(); first.focus(); }
  }
});

/* ---------- WATCH ---------- */
var W = { i: 0, base: [], over: [], mk: [], nb: [], playing: false, timer: 0, build: false };

function buildWatch(i) {
  var ch = BY.get(cur), svg = $('#w-stage');
  svg.innerHTML = stageInner(ch, 'w');
  W.base = $$('.glyph > .b', svg); W.over = $$('.ov .h', svg); W.mk = $$('.mk', svg); W.nb = $$('.nb', svg);
  W.i = i || 0;
  $('#w-head').innerHTML = headHTML(ch);
  var seq = $('#w-seq');
  seq.innerHTML = ch.s.map(function (st, j) {
    return '<li><button type="button" data-i="' + (j + 1) + '"><b>' + (j + 1) + '</b><span lang="zh-Hant">' + st.t + '</span></button></li>';
  }).join('');
  if ($('#w-film').open) $('#w-film-body').innerHTML = filmHTML(ch);
  renderWatch(false);
}
function renderWatch(animate) {
  var ch = BY.get(cur), n = ch.s.length, i = W.i, svg = $('#w-stage');
  W.over.forEach(function (p, j) { p.classList.toggle('on', j === i - 1); });
  W.base.forEach(function (p, j) { p.setAttribute('class', (W.build && j >= i) ? 'g' : 'b'); });
  W.nb.forEach(function (g, j) { g.classList.toggle('cur', j === i - 1); });
  svg.classList.toggle('shownums', $('#w-nums').checked);
  svg.setAttribute('aria-label', ch.c + (i ? ', stroke ' + i + ' of ' + n + ' highlighted' : ', no stroke highlighted'));
  if (i > 0 && animate) drawOn(W.mk[i - 1]);
  var ro = $('#w-readout'), h;
  ro.classList.toggle('on', i > 0);
  if (i === 0) {
    h = '<div class="rd-count"><b>0</b> of ' + n + '</div><p class="rd-main">' + zh(ch.c) + ' has ' + plural(n, 'stroke') + '.</p>' +
      '<p class="rd-tip">Press <b>Next Stroke</b> to highlight the first one.</p>';
  } else {
    var st = ch.s[i - 1], t = TYPES[st.t];
    h = '<div class="rd-count">Stroke <b>' + i + '</b> of ' + n + '</div>' +
      '<div class="rd-name"><span class="rd-zh" lang="zh-Hant">' + st.t + '</span><span class="rd-py">' + t.py + '</span></div>' +
      '<div class="rd-en">' + t.en + '</div><p class="rd-tip">' + esc(t.tip) + '</p>';
    if (i === n) h += '<p class="rd-end">That is the last stroke. Press Next Stroke to clear the highlight and start again.</p>';
  }
  ro.innerHTML = h;
  $$('#w-seq button').forEach(function (b, j) {
    b.className = (j + 1 === i) ? 'cur' : (j + 1 < i ? 'past' : 'future');
    if (j + 1 === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
  });
}
function wStep(d) {
  var n = BY.get(cur).s.length;
  W.i = (W.i + d + n + 1) % (n + 1);
  renderWatch(true);
}
function wStop() {
  W.playing = false; clearTimeout(W.timer);
  var b = $('#w-play'); b.textContent = 'Play'; b.setAttribute('aria-pressed', 'false');
}
function wPlay() {
  if (W.playing) { wStop(); return; }
  var n = BY.get(cur).s.length;
  W.playing = true;
  var b = $('#w-play'); b.textContent = 'Pause'; b.setAttribute('aria-pressed', 'true');
  if (W.i >= n) { W.i = 0; renderWatch(false); }
  (function tick() {
    if (!W.playing) return;
    var nn = BY.get(cur).s.length;
    if (W.i >= nn) { wStop(); return; }
    W.i++; renderWatch(true);
    if (W.i >= nn) { wStop(); return; }
    W.timer = setTimeout(tick, 1300);
  })();
}
$('#w-next').addEventListener('click', function () { wStop(); wStep(1); });
$('#w-back').addEventListener('click', function () { wStop(); wStep(-1); });
$('#w-play').addEventListener('click', wPlay);
$('#w-seq').addEventListener('click', function (e) {
  var b = e.target.closest('button'); if (!b) return;
  wStop(); W.i = +b.getAttribute('data-i'); renderWatch(true);
});
$('#w-nums').addEventListener('change', function () { renderWatch(false); });
$('#w-build').addEventListener('change', function () { W.build = this.checked; renderWatch(false); });
$('#w-film').addEventListener('toggle', function () { if (this.open) $('#w-film-body').innerHTML = filmHTML(BY.get(cur)); });
function bindGrid(panelSel, stageSel) {
  $$(panelSel + ' .seg [data-grid]').forEach(function (b) {
    b.addEventListener('click', function () {
      var g = b.getAttribute('data-grid');
      $$(panelSel + ' .seg [data-grid]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      $(stageSel).setAttribute('data-grid', g);
    });
  });
}
bindGrid('#panel-watch', '#w-stage');
bindGrid('#panel-write', '#p-stage');

document.addEventListener('keydown', function (e) {
  if (tab !== 'watch' || e.altKey || e.ctrlKey || e.metaKey) return;
  var t = e.target, tag = t && t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t.closest && t.closest('[role="tablist"]'))) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); wStop(); wStep(1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); wStop(); wStep(-1); }
});

/* ---------- WRITE ---------- */
var P = { i: 0, miss: 0, total: 0, done: false, drawing: false, pts: [], pid: null, guide: true, base: [], over: [], mk: [], nb: [], hintT: 0, liveT: 0 };

function fit(user, med) {
  var m = med.map(dpt), mLen = polyLen(m), uLen = polyLen(user);
  var N = 24, U = resample(user, N), M = resample(m, N), s = 0;
  for (var i = 0; i < N; i++) s += dist(U[i], M[i]);
  var avg = s / N, start = dist(U[0], M[0]), end = dist(U[N - 1], M[N - 1]), ratio = uLen / (mLen || 1);
  var tolS = startTol(mLen);
  var ok = start <= tolS && end <= tolS + 20 && avg <= Math.max(80, Math.min(140, mLen * 0.45)) && ratio >= 0.4 && ratio <= 2.2;
  return { ok: ok, avg: avg, start: start, end: end, ratio: ratio };
}
function startTol(mLen) { return Math.max(85, Math.min(190, mLen * 0.6)); }
function smooth(pts) {
  if (pts.length < 7) return pts;
  var out = [pts[0]];
  for (var i = 1; i < pts.length - 1; i++) {
    var a = Math.max(0, i - 3), b = Math.min(pts.length - 1, i + 3), x = 0, y = 0, c = 0;
    for (var j = a; j <= b; j++) { x += pts[j][0]; y += pts[j][1]; c++; }
    out.push([x / c, y / c]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
/* user points are in stage (display) coordinates. Returns {ok, why, k}. */
function judge(user, ch, idx) {
  user = smooth(user);
  var med = ch.s[idx].m, m = med.map(dpt), mLen = polyLen(m), uLen = polyLen(user);
  if (uLen < 25) {
    if (mLen < 230) {
      var c = centroid(m), p = user[0];
      return dist(p, c) <= 95 ? { ok: true } : { ok: false, why: 'start' };
    }
    return { ok: false, why: 'short' };
  }
  var f = fit(user, med);
  if (f.ok) return { ok: true };
  var rev = fit(user.slice().reverse(), med);
  if (rev.ok && mLen >= 230) return { ok: false, why: 'direction' };
  for (var k = 0; k < ch.s.length; k++) {
    if (k === idx) continue;
    if (fit(user, ch.s[k].m).ok) return { ok: false, why: k > idx ? 'later' : 'already', k: k };
  }
  if (f.start > startTol(mLen) && f.avg < 200) return { ok: false, why: 'start' };
  return { ok: false, why: 'shape' };
}

function buildWrite() {
  var ch = BY.get(cur), svg = $('#p-stage');
  svg.innerHTML = stageInner(ch, 'p') + '<path class="live" d=""/>';
  P.base = $$('.glyph > .b', svg); P.over = $$('.ov .h', svg); P.mk = $$('.mk', svg); P.nb = $$('.nb', svg);
  P.i = 0; P.miss = 0; P.total = 0; P.done = false; P.drawing = false; P.pts = [];
  clearTimeout(P.hintT); clearTimeout(P.liveT);
  $('#p-head').innerHTML = headHTML(ch);
  $('#p-msg').className = 'msg o4'; $('#p-msg').textContent = '';
  renderWrite();
}
function renderWrite() {
  var ch = BY.get(cur), n = ch.s.length, svg = $('#p-stage');
  P.base.forEach(function (p, j) { p.setAttribute('class', j < P.i ? 'b' : (P.guide ? 'g' : 'x')); });
  P.over.forEach(function (p) { p.classList.remove('on'); p.classList.remove('ok'); });
  P.nb.forEach(function (g, j) { g.classList.toggle('cur', j === P.i); g.style.display = (P.guide && j === P.i && !P.done) ? 'block' : 'none'; });
  svg.setAttribute('aria-label', 'Writing area for ' + ch.c + ', ' + P.i + ' of ' + n + ' strokes written');
  $('#p-prompt').innerHTML = P.done
    ? 'Done. You wrote ' + zh(ch.c) + ' in ' + plural(n, 'stroke') + '.'
    : 'Draw stroke ' + (P.i + 1) + ' of ' + n + '.' + (P.guide ? ' Start at the numbered dot.' : ' Write it from memory. Use Hint if you are stuck.');
  var dots = ''; for (var j = 0; j < n; j++) dots += '<i class="' + (j < P.i ? 'd' : '') + '"></i>';
  $('#p-dots').innerHTML = dots;
  $('#p-next').classList.toggle('primary', P.done);
  $('#p-hint').disabled = P.done;
}
function pMsg(text, cls) { var m = $('#p-msg'); m.className = 'msg o4' + (cls ? ' ' + cls : ''); m.textContent = text; }
function ptOf(e) {
  var r = $('#p-stage').getBoundingClientRect(), w = r.width || 1, h = r.height || 1;
  return [(e.clientX - r.left) * 1024 / w, (e.clientY - r.top) * 1024 / h];
}
function setLive() {
  var el = $('#p-stage .live'); if (!el) return;
  el.setAttribute('d', P.pts.length ? 'M' + P.pts.map(function (p) { return p[0].toFixed(0) + ' ' + p[1].toFixed(0); }).join('L') + (P.pts.length === 1 ? 'l0.1 0' : '') : '');
}
function clearHint() {
  clearTimeout(P.hintT);
  P.over.forEach(function (p) { p.classList.remove('on'); p.classList.remove('ok'); });
}
function showHint() {
  if (P.done) return;
  var ch = BY.get(cur), st = ch.s[P.i], t = TYPES[st.t];
  clearHint();
  P.over[P.i].classList.add('on'); drawOn(P.mk[P.i], 900);
  pMsg('Stroke ' + (P.i + 1) + ' is a ' + st.t + ' (' + t.py + '): ' + t.tip, '');
  P.hintT = setTimeout(function () { clearHint(); }, 2400);
}
function finishStroke() {
  var ch = BY.get(cur), n = ch.s.length, pts = P.pts; P.pts = [];
  if (!pts.length) return;
  var res = judge(pts, ch, P.i);
  if (res.ok) {
    var idx = P.i;
    P.i++; P.miss = 0;
    setLive(); $('#p-stage .live').setAttribute('d', '');
    P.base.forEach(function (p, j) { p.setAttribute('class', j < P.i ? 'b' : (P.guide ? 'g' : 'x')); });
    P.over[idx].classList.add('ok'); P.over[idx].classList.add('on'); drawOn(P.mk[idx], 320);
    setTimeout(function () { P.over[idx].classList.remove('on'); P.over[idx].classList.remove('ok'); }, 700);
    if (P.i >= n) {
      P.done = true;
      var d = store.load(); d.done[cur] = true; store.save(); renderShelves();
      renderWrite();
      pMsg(P.total === 0 ? 'Perfect run with no missed strokes.' : 'Finished with ' + plural(P.total, 'missed attempt') + '. Try it again without the guide.', 'fin');
    } else {
      renderWrite();
      pMsg('Good. ' + ch.s[idx].t + ' is done.', 'good');
    }
    return;
  }
  P.miss++; P.total++;
  var msgs = {
    direction: 'Right shape, wrong direction. Start from the other end.',
    later: 'That stroke comes later. Think about which one is written next.',
    already: 'That stroke is already written. Draw the next one.',
    start: 'Start closer to where this stroke begins.',
    shape: 'Not quite. Follow the outline more closely.',
    short: 'That line is too short. Draw the whole stroke.'
  };
  pMsg(msgs[res.why] || msgs.shape, 'bad');
  var card = $('#p-card'); card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
  clearTimeout(P.liveT);
  P.liveT = setTimeout(function () { var l = $('#p-stage .live'); if (l) l.setAttribute('d', ''); }, 380);
  if (P.miss >= 3) { P.miss = 0; showHint(); }
}
(function () {
  var svg = $('#p-stage');
  svg.addEventListener('pointerdown', function (e) {
    if (P.done || (e.button != null && e.button > 0) || e.isPrimary === false) return;
    e.preventDefault();
    P.drawing = true; P.pid = e.pointerId; P.pts = [ptOf(e)];
    try { svg.setPointerCapture(e.pointerId); } catch (x) {}
    clearHint(); clearTimeout(P.liveT); setLive();
  });
  svg.addEventListener('pointermove', function (e) {
    if (!P.drawing || e.pointerId !== P.pid) return;
    var p = ptOf(e), last = P.pts[P.pts.length - 1];
    if (dist(p, last) > 3) { P.pts.push(p); setLive(); }
  });
  function up(e) {
    if (!P.drawing || e.pointerId !== P.pid) return;
    P.drawing = false;
    try { svg.releasePointerCapture(e.pointerId); } catch (x) {}
    finishStroke();
  }
  svg.addEventListener('pointerup', up);
  svg.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  svg.addEventListener('pointercancel', function (e) {
    if (!P.drawing || e.pointerId !== P.pid) return;
    P.drawing = false; P.pts = []; setLive();
  });
})();
$('#p-guide').addEventListener('change', function () { P.guide = this.checked; renderWrite(); });
$('#p-hint').addEventListener('click', showHint);
$('#p-reset').addEventListener('click', function () { buildWrite(); });
$('#p-next').addEventListener('click', function () {
  var i = CH.findIndex(function (c) { return c.c === cur; });
  setChar(CH[(i + 1) % CH.length].c, 0);
});

/* ---------- QUIZ ---------- */
var Q = { mode: 'next', pool: 0, n: 0, total: 10, score: 0, streak: 0, used: new Set(), q: null, answered: false, missed: [], over: false };

function distractorNames(correct) {
  var bad = new Set([correct]);
  CONFUSABLE.forEach(function (g) { if (g.indexOf(correct) >= 0) g.forEach(function (x) { bad.add(x); }); });
  var all = Object.keys(TYPES).filter(function (t) { return !bad.has(t); });
  var s = shuffle(all).slice(0, 3);
  if (s.length < 3) s = s.concat(shuffle(Object.keys(TYPES).filter(function (t) { return t !== correct && s.indexOf(t) < 0; })).slice(0, 3 - s.length));
  return s;
}
function qMake() {
  var pool = CH.filter(function (c) { return (Q.pool === 0 || c.lv === Q.pool) && c.s.length >= 2; });
  var cands = pool.filter(function (c) { return !Q.used.has(c.c); });
  if (!cands.length) { Q.used.clear(); cands = pool; }
  var ch = pick(cands); Q.used.add(ch.c);
  var n = ch.s.length;
  if (Q.mode === 'next') {
    var k = randInt(0, n - 2), rest = [];
    for (var j = k; j < n; j++) rest.push(j);
    var dis = shuffle(rest.filter(function (j) { return j !== k; })).slice(0, Math.min(3, rest.length - 1));
    return { mode: 'next', ch: ch, k: k, correct: k, options: shuffle([k].concat(dis)) };
  }
  var idx = randInt(0, n - 1), t = ch.s[idx].t;
  return { mode: 'name', ch: ch, idx: idx, correct: t, options: shuffle([t].concat(distractorNames(t))) };
}
function qStat() {
  var best = store.load().best[Q.mode];
  $('#q-stat').innerHTML = '<span>Question <b>' + Math.min(Q.n + (Q.answered ? 0 : 1), Q.total) + '</b> of ' + Q.total + '</span><span>Score <b>' + Q.score + '</b></span><span>Streak <b>' + Q.streak + '</b></span>' +
    (best != null ? '<span>Best <b>' + best + '</b> / ' + Q.total + '</span>' : '');
}
function qRender() {
  Q.q = qMake(); Q.answered = false;
  var q = Q.q, ch = q.ch, n = ch.s.length;
  $('#q-main').hidden = false; $('#q-result').hidden = true;
  $('#q-main').classList.remove('revealed');
  var og = $('#q-options'), legend = $('#q-legend');
  if (q.mode === 'next') {
    $('#q-stage').innerHTML = miniSVG(ch, { done: q.k, ghost: true, label: ch.c + ' with ' + q.k + ' of ' + n + ' strokes written' }).replace('class="mini"', 'class="stage"');
    $('#q-prompt').textContent = q.k === 0 ? 'Which stroke is written first?' : 'Which stroke comes next?';
    $('#q-sub').innerHTML = zh(ch.c) + ' · ' + esc(ch.py) + ' · ' + q.k + ' of ' + n + ' strokes written';
    legend.innerHTML = '<span><i class="lg-ink"></i>Written</span><span><i class="lg-ghost"></i>Still to write</span><span><i class="lg-hl"></i>Option</span>';
    og.className = 'optgrid o6';
    og.innerHTML = q.options.map(function (j, a) {
      return '<button type="button" class="optcard" data-j="' + j + '" aria-label="Option ' + 'ABCD'[a] + '"><span class="ol">' + 'ABCD'[a] + '</span><span class="tag"></span>' +
        miniSVG(ch, { done: q.k, cand: j, ghost: true, label: 'Option ' + 'ABCD'[a] }) + '<div class="oc">Stroke ' + (j + 1) + ' · <span lang="zh-Hant">' + ch.s[j].t + '</span></div></button>';
    }).join('');
  } else {
    $('#q-stage').innerHTML = miniSVG(ch, { hl: q.idx, label: ch.c + ', one stroke highlighted' }).replace('class="mini"', 'class="stage"');
    $('#q-prompt').textContent = 'What is the highlighted stroke called?';
    $('#q-sub').innerHTML = zh(ch.c) + ' · ' + esc(ch.py) + ' · stroke ' + (q.idx + 1) + ' of ' + n;
    legend.innerHTML = '<span><i class="lg-ink"></i>Other strokes</span><span><i class="lg-hl"></i>Highlighted stroke</span>';
    og.className = 'optgrid names o6';
    og.innerHTML = q.options.map(function (t) {
      var T = TYPES[t];
      return '<button type="button" class="optcard nm" data-t="' + t + '"><span class="zh" lang="zh-Hant">' + t + '</span><span class="py">' + T.py + '</span><span class="en">' + T.en + '</span><span class="tag"></span></button>';
    }).join('');
  }
  $('#q-fb').innerHTML = '';
  qStat();
}
function orderTip(ch, correctIdx, chosenIdx) {
  var cc = centroid(ch.s[correctIdx].m.map(dpt)), cw = centroid(ch.s[chosenIdx].m.map(dpt));
  var dx = cw[0] - cc[0], dy = cw[1] - cc[1];
  if (dy > 170 && Math.abs(dx) < 260) return 'Tip: when strokes are stacked, the higher one is usually written first.';
  if (dx > 170 && Math.abs(dy) < 120) return 'Tip: when parts sit side by side, the left one is usually written first.';
  return '';
}
function qAnswer(btn) {
  if (Q.answered || Q.over) return;
  Q.answered = true;
  var q = Q.q, ch = q.ch, right, chosen, fbHTML;
  var cards = $$('#q-options .optcard');
  if (q.mode === 'next') { chosen = +btn.getAttribute('data-j'); right = chosen === q.correct; }
  else { chosen = btn.getAttribute('data-t'); right = chosen === q.correct; }
  cards.forEach(function (c) {
    c.disabled = true;
    var key = q.mode === 'next' ? +c.getAttribute('data-j') : c.getAttribute('data-t');
    if (key === q.correct) { c.classList.add('right'); c.querySelector('.tag').textContent = 'Correct'; }
    else if (c === btn) { c.classList.add('wrong'); c.querySelector('.tag').textContent = 'Not this'; }
  });
  $('#q-main').classList.add('revealed');
  Q.n++;
  if (right) { Q.score++; Q.streak++; } else { Q.streak = 0; Q.missed.push({ c: ch.c, i: q.mode === 'next' ? q.k + 1 : q.idx + 1 }); }
  var watchI;
  if (q.mode === 'next') {
    var st = ch.s[q.k], T = TYPES[st.t]; watchI = q.k + 1;
    fbHTML = '<div class="v ' + (right ? 'good' : 'bad') + '">' + (right ? 'Correct.' : 'Not quite.') + '</div><p>Stroke ' + (q.k + 1) + ' of ' + zh(ch.c) + ' is the ' + zh(st.t) + ' (' + T.py + ', ' + T.en + ').' +
      '</p>' + (!right && orderTip(ch, q.k, chosen) ? '<p>' + orderTip(ch, q.k, chosen) + '</p>' : '');
  } else {
    var T2 = TYPES[q.correct]; watchI = q.idx + 1;
    fbHTML = '<div class="v ' + (right ? 'good' : 'bad') + '">' + (right ? 'Correct.' : 'Not quite.') + '</div><p>Stroke ' + (q.idx + 1) + ' of ' + zh(ch.c) + ' is the ' + zh(q.correct) + ' (' + T2.py + ', ' + T2.en + '). ' + esc(T2.tip) + '</p>';
  }
  var last = Q.n >= Q.total;
  fbHTML += '<div class="row"><button type="button" class="btn primary" id="q-go">' + (last ? 'See results' : 'Next question') + '</button><button type="button" class="btn" id="q-see">Watch ' + zh(ch.c) + '</button></div>';
  $('#q-fb').innerHTML = fbHTML;
  $('#q-go').addEventListener('click', function () { if (last) qFinish(); else qRender(); toTop(); });
  $('#q-see').addEventListener('click', function () { goWatch(ch.c, watchI); });
  qStat();
  try { $('#q-go').focus({ preventScroll: true }); } catch (e) {}
  reveal($('#q-go'));
}
function qFinish() {
  Q.over = true;
  var d = store.load(); if (d.best[Q.mode] == null || Q.score > d.best[Q.mode]) { d.best[Q.mode] = Q.score; store.save(); }
  $('#q-main').hidden = true;
  var r = $('#q-result'); r.hidden = false;
  var seen = {}, miss = Q.missed.filter(function (m) { if (seen[m.c]) return false; seen[m.c] = 1; return true; });
  var verdict = Q.score === Q.total ? 'A perfect round.' : Q.score >= Q.total * 0.7 ? 'Solid. A little more practice will lock it in.' : 'Keep going. The Watch tab shows each stroke in order.';
  r.innerHTML = '<div class="result"><div class="lab">Round complete</div><div class="big">' + Q.score + '<small> / ' + Q.total + '</small></div><p style="margin-top:8px">' + verdict + '</p>' +
    (miss.length ? '<p style="margin-top:14px" class="lab">Review these</p><ul>' + miss.map(function (m) { return '<li><button type="button" class="lnk" data-c="' + m.c + '" data-i="' + m.i + '" aria-label="Watch ' + m.c + '">' + m.c + '</button></li>'; }).join('') + '</ul>' : '') +
    '<div class="ctl"><button type="button" class="btn primary" id="q-again">Play again</button></div></div>';
  $('#q-again').addEventListener('click', qReset);
  $$('#q-result .lnk').forEach(function (b) { b.addEventListener('click', function () { goWatch(b.getAttribute('data-c'), +b.getAttribute('data-i')); }); });
  try { $('#q-again').focus({ preventScroll: true }); } catch (e) {}
  toTop();
}
function qSummary() {
  $('#q-set-sum').innerHTML = '<span>Quiz settings · <b>' + (Q.mode === 'next' ? 'Next stroke' : 'Name the stroke') + '</b> · <b>' + ['All characters', 'Starter', 'Everyday', 'Challenge'][Q.pool] + '</b></span>';
}
function qReset() {
  Q.n = 0; Q.score = 0; Q.streak = 0; Q.used = new Set(); Q.missed = []; Q.over = false; Q.answered = false;
  qSummary();
  qRender();
}
function toTop() { try { window.scrollTo(0, 0); } catch (e) {} }
function reveal(el) { try { if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
$('#q-options').addEventListener('click', function (e) {
  var b = e.target.closest ? e.target.closest('.optcard') : null; if (b) qAnswer(b);
});
$$('#panel-quiz [data-mode]').forEach(function (b) {
  b.addEventListener('click', function () {
    Q.mode = b.getAttribute('data-mode');
    $$('#panel-quiz [data-mode]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    qReset();
  });
});
$$('#panel-quiz [data-pool]').forEach(function (b) {
  b.addEventListener('click', function () {
    Q.pool = +b.getAttribute('data-pool');
    $$('#panel-quiz [data-pool]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    qReset();
  });
});

/* ---------- STROKE LIBRARY ---------- */
function buildStrokes() {
  var occ = {};
  CH.forEach(function (ch) { ch.s.forEach(function (st, i) { (occ[st.t] = occ[st.t] || []).push({ ch: ch, i: i }); }); });
  function card(t) {
    var list = occ[t] || [], T = TYPES[t]; if (!list.length) return '';
    var ex = list[0], seen = [], used = {};
    if (t === '點') {
      var right = list.filter(function (o) { var mm = o.ch.s[o.i].m; return mm[mm.length - 1][0] > mm[0][0]; });
      if (right.length) ex = right[0];
    }
    list.forEach(function (o) { if (!used[o.ch.c] && seen.length < 8) { used[o.ch.c] = 1; seen.push(o); } });
    return '<article class="scard">' + iconSVG(ex.ch, ex.i) + '<div><h3><span class="zh" lang="zh-Hant">' + t + '</span><span class="py">' + T.py + '</span></h3><div class="en">' + T.en + '</div><p class="tip">' + esc(T.tip) + '</p>' +
      '<div class="seen"><span>Seen in</span>' + seen.map(function (o) { return '<button type="button" class="lnk" data-c="' + o.ch.c + '" data-i="' + (o.i + 1) + '" aria-label="Watch ' + o.ch.c + ', stroke ' + (o.i + 1) + '">' + o.ch.c + '</button>'; }).join('') + '</div></div></article>';
  }
  var basic = Object.keys(TYPES).filter(function (t) { return TYPES[t].basic; });
  var rest = Object.keys(TYPES).filter(function (t) { return !TYPES[t].basic; });
  $('#s-body').innerHTML =
    '<div class="sgroup"><h3 class="sec-h">The six basic strokes <span lang="zh-Hant">基本筆畫</span></h3><div class="sgrid">' + basic.map(card).join('') + '</div></div>' +
    '<div class="sgroup"><h3 class="sec-h">Turns and hooks <span lang="zh-Hant">折與鉤</span></h3><div class="sgrid">' + rest.map(card).join('') + '</div></div>';
}
$('#s-body').addEventListener('click', function (e) {
  var b = e.target.closest ? e.target.closest('.lnk') : null; if (b) goWatch(b.getAttribute('data-c'), +b.getAttribute('data-i'));
});
$('#s-yong').addEventListener('click', function () { goWatch('永', 0); });

/* ---------- RULES ---------- */
function buildRules() {
  $('#r-body').innerHTML = RULES.map(function (r) {
    var ch = BY.get(r.c);
    return '<article class="rcard"><h3>' + r.t + ' <span class="zh" lang="zh-Hant">' + r.zh + '</span></h3><p>' + r.text.replace(/([一-鿿]+)/g, '<span lang="zh-Hant">$1</span>') + '</p>' +
      '<div class="strip">' + filmHTML(ch) + '</div><button type="button" class="btn" data-c="' + r.c + '">Watch <span lang="zh-Hant">' + r.c + '</span></button></article>';
  }).join('');
}
$('#r-body').addEventListener('click', function (e) {
  var b = e.target.closest ? e.target.closest('.btn') : null; if (b) goWatch(b.getAttribute('data-c'), 0);
});

/* ---------- navigation ---------- */
function setChar(c, i) {
  if (!BY.has(c)) return;
  cur = c; wStop();
  var sd = store.load(); if (sd.last !== c) { sd.last = c; store.save(); }
  buildWatch(i || 0); buildWrite(); renderShelves();
}
function showTab(id, focus) {
  if (TABS.indexOf(id) < 0) return;
  TABS.forEach(function (t) {
    var on = t === id, b = $('#tab-' + t);
    b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
    $('#panel-' + t).hidden = !on;
  });
  var changed = tab !== id;
  tab = id;
  if (changed) toTop();
  if (id !== 'watch') wStop();
  if (focus) $('#tab-' + id).focus();
  try { history.replaceState(null, '', '#' + id); } catch (e) {}
}
function goWatch(c, i) { setChar(c, i || 0); showTab('watch'); if (i) renderWatch(true); }
$$('.tab').forEach(function (b) {
  b.addEventListener('click', function () { showTab(b.id.replace('tab-', '')); });
  b.addEventListener('keydown', function (e) {
    var k = TABS.indexOf(b.id.replace('tab-', '')), n = TABS.length, d = 0;
    if (e.key === 'ArrowRight') d = 1; else if (e.key === 'ArrowLeft') d = -1; else if (e.key === 'Home') k = -1, d = 1; else if (e.key === 'End') k = n, d = -1;
    if (d) { e.preventDefault(); showTab(TABS[(k + d + n) % n], true); }
  });
});

/* ---------- phone helpers: settings fold, license text, install, updates ---------- */
function isPhone() {
  try { return window.matchMedia('(max-width: 760px), (orientation: landscape) and (max-height: 520px)').matches; } catch (e) { return false; }
}
$('#q-set').open = !isPhone();
$('#app-version').textContent = BUILD.indexOf('__') === 0 ? 'dev' : BUILD;

(function () {
  var det = $('.foot details'), loaded = false;
  if (!det) return;
  det.addEventListener('toggle', function () {
    if (!det.open || loaded) return;
    var out = $('#license-text');
    if (typeof fetch !== 'function') { out.textContent = 'The full license text is in the file ARPHICPL.TXT next to this page.'; return; }
    fetch('ARPHICPL.TXT').then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (t) { out.textContent = t.trim(); loaded = true; })
      .catch(function () { out.textContent = 'Could not load the license text. It is in the file ARPHICPL.TXT next to this page.'; });
  });
})();

(function () {
  var go = $('#install-go'), deferred = null;
  function standalone() {
    try { if (window.matchMedia('(display-mode: standalone)').matches) return true; } catch (e) {}
    return !!window.navigator.standalone;
  }
  function hide() { go.hidden = true; }
  go.addEventListener('click', function () {
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.then(function () { deferred = null; hide(); }, function () { deferred = null; hide(); });
    } else {
      openSheet('sheet-install');
    }
  });
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    if (!standalone()) go.hidden = false;
  });
  window.addEventListener('appinstalled', hide);
  var ua = window.navigator.userAgent || '';
  var ios = /iPhone|iPad|iPod/.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  if (ios && !standalone()) go.hidden = false;
})();

(function () {
  var toast = $('#toast'), go = $('#toast-go'), waiting = null, updating = false;
  $('#toast-no').addEventListener('click', function () { toast.hidden = true; });
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  function offer(w) {
    waiting = w;
    $('#toast-text').textContent = 'A new version is ready.';
    toast.hidden = false;
  }
  go.addEventListener('click', function () {
    if (!waiting) { location.reload(); return; }
    updating = true; go.disabled = true;
    waiting.postMessage({ type: 'SKIP_WAITING' });
  });
  navigator.serviceWorker.addEventListener('controllerchange', function () { if (updating) location.reload(); });
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', function () {
        var w = reg.installing; if (!w) return;
        w.addEventListener('statechange', function () { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
      });
    }).catch(function () {});
  });
})();

/* ---------- init ---------- */
var savedChar = store.load().last;
if (savedChar && BY.has(savedChar)) cur = savedChar;
buildStrokes(); buildRules();
setChar(cur, 0);
qSummary();
qRender();
var h0 = ''; try { h0 = (location.hash || '').slice(1); } catch (e) {}
if (TABS.indexOf(h0) >= 0) showTab(h0);

window.__bishun = { judge: judge, fit: fit, resample: resample, polyLen: polyLen, dpt: dpt, BY: BY, CH: CH, TYPES: TYPES, Q: Q, W: W, P: P, setChar: setChar, showTab: showTab, qRender: qRender };
})();
