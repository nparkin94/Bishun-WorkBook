// Simulated-DOM checks for the page logic.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const path = require('path');
const APP = path.join(__dirname, '..', 'app');
// jsdom does not fetch <script src> synchronously, so inline the two scripts to get the same behaviour as a browser load
const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8')
  .replace('<script src="data.js"></script>', () => '<script>' + fs.readFileSync(path.join(APP, 'data.js'), 'utf8') + '</script>')
  .replace('<script src="app.js"></script>', () => '<script>' + fs.readFileSync(path.join(APP, 'app.js'), 'utf8') + '</script>');
const errors = [];
let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log('  ok  ', name);
  else { failures++; console.log('  FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

function seeded(seed) {
  let s = seed >>> 0;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function load(seed, opts) {
  opts = opts || {};
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e.detail || e.message)));
  vc.on('error', (e) => errors.push('console.error: ' + e));
  const cfg = {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.test/' + (opts.hash || ''), virtualConsole: vc,
    beforeParse(window) {
      window.Math.random = seeded(seed || 7);
      window.scrollTo = function () {};
      window.addEventListener('error', (e) => errors.push('window error: ' + e.message));
      if (opts.userAgent) Object.defineProperty(window.navigator, 'userAgent', { get: () => opts.userAgent });
      if (opts.storage) Object.keys(opts.storage).forEach((k) => window.localStorage.setItem(k, opts.storage[k]));
    },
  };
  return new JSDOM(html, cfg);
}

function click(win, el) { el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true })); }

// ---------- 1. load ----------
console.log('load');
let dom = load(1), win = dom.window, doc = win.document;
check('no script errors on load', errors.length === 0, errors);
const B = win.__bishun;
check('47 characters loaded', B.CH.length === 47, B.CH.length);
check('all chars are in the traditional-forms set (no simplified)', !['国', '爱', '学', '马', '书', '门', '车', '电', '东', '龙', '鸟', '们', '开', '说', '语', '乐', '来'].some((c) => B.BY.has(c)));
check('title', doc.querySelector('title').textContent === 'Bǐshùn Workbook');

// ---------- 2. Next Stroke cycling ----------
console.log('watch: Next Stroke cycling');
const next = doc.getElementById('w-next');
check('button text is Next Stroke', next.textContent.trim() === 'Next Stroke', next.textContent);
function highlighted() { return Array.from(doc.querySelectorAll('#w-stage .ov .h')).map((p, i) => p.classList.contains('on') ? i : -1).filter((i) => i >= 0); }
check('initially no stroke highlighted', highlighted().length === 0);
let allOk = true, detail = [];
for (const ch of B.CH) {
  B.setChar(ch.c, 0);
  const n = ch.s.length;
  if (highlighted().length !== 0) { allOk = false; detail.push(ch.c + ' start'); }
  for (let k = 1; k <= n; k++) {
    click(win, next);
    const h = highlighted();
    if (!(h.length === 1 && h[0] === k - 1)) { allOk = false; detail.push(ch.c + ' press ' + k + ' -> ' + JSON.stringify(h)); }
  }
  click(win, next); // wraps
  if (highlighted().length !== 0) { allOk = false; detail.push(ch.c + ' wrap -> ' + JSON.stringify(highlighted())); }
  click(win, next);
  if (!(highlighted().length === 1 && highlighted()[0] === 0)) { allOk = false; detail.push(ch.c + ' second lap'); }
}
check('every character: press k highlights only stroke k; press n+1 clears; next press restarts', allOk, detail.slice(0, 5));

B.setChar('永', 0);
click(win, next);
const rd = doc.getElementById('w-readout').textContent;
check('readout names stroke 1 of 永 as 點', /Stroke\s*1\s*of\s*5/.test(rd) && rd.includes('點'), rd);
for (let k = 2; k <= 5; k++) click(win, next);
check('last stroke readout says so', /last stroke/i.test(doc.getElementById('w-readout').textContent));
click(win, next);
check('after the last stroke readout resets', /Press\s*Next Stroke/.test(doc.getElementById('w-readout').textContent) && highlighted().length === 0);

// Back button wraps
click(win, doc.getElementById('w-back'));
check('Back from none goes to the last stroke', highlighted().length === 1 && highlighted()[0] === 4, highlighted());
click(win, doc.getElementById('w-back'));
check('Back moves one earlier', highlighted()[0] === 3);

// jump chip
click(win, doc.querySelector('#w-seq button[data-i="2"]'));
check('chip 2 highlights stroke 2', highlighted().length === 1 && highlighted()[0] === 1);

// options
const nums = doc.getElementById('w-nums'); nums.checked = true; nums.dispatchEvent(new win.Event('change', { bubbles: true }));
check('stroke numbers toggle', doc.getElementById('w-stage').classList.contains('shownums'));
const build = doc.getElementById('w-build'); build.checked = true; build.dispatchEvent(new win.Event('change', { bubbles: true }));
const ghosts = Array.from(doc.querySelectorAll('#w-stage .glyph > path')).map((p) => p.getAttribute('class'));
check('build-up shows strokes up to the current, ghosts the rest', ghosts.join() === 'b,b,g,g,g', ghosts);
build.checked = false; build.dispatchEvent(new win.Event('change', { bubbles: true }));
click(win, doc.querySelector('#panel-watch .seg [data-grid="tian"]'));
check('grid toggle sets data-grid', doc.getElementById('w-stage').getAttribute('data-grid') === 'tian');

// autoplay
console.log('watch: autoplay');
B.setChar('人', 0);
click(win, doc.getElementById('w-play'));
check('Play starts and shows stroke 1', B.W.i === 1 && doc.getElementById('w-play').textContent === 'Pause', B.W.i);
click(win, doc.getElementById('w-play'));
check('Pause stops autoplay', doc.getElementById('w-play').textContent === 'Play');

// shelf selection
const chip = doc.querySelector('#shelf-watch .chip[data-c="國"]');
click(win, chip);
check('choosing 國 on the shelf rebuilds the stage with 11 strokes', doc.querySelectorAll('#w-stage .glyph > path').length === 11 && doc.getElementById('w-head').textContent.includes('guó'));
check('Write stage is in sync', doc.querySelectorAll('#p-stage .glyph > path').length === 11);

// ---------- 3. tabs ----------
console.log('tabs');
const tabs = ['watch', 'write', 'quiz', 'strokes', 'rules'];
let tabsOk = true;
for (const t of tabs) {
  click(win, doc.getElementById('tab-' + t));
  for (const o of tabs) {
    const vis = !doc.getElementById('panel-' + o).hidden;
    if (vis !== (o === t)) tabsOk = false;
  }
  if (doc.getElementById('tab-' + t).getAttribute('aria-selected') !== 'true') tabsOk = false;
}
check('only the chosen panel is visible', tabsOk);
const tabEl = doc.getElementById('tab-watch');
click(win, tabEl);
tabEl.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
check('arrow key moves to next tab', !doc.getElementById('panel-write').hidden);

// ---------- 4. strokes + rules ----------
console.log('strokes and rules');
const cards = doc.querySelectorAll('#s-body .scard');
check('18 stroke-type cards', cards.length === 18, cards.length);
check('every card has an icon and at least one example link', Array.from(cards).every((c) => c.querySelector('svg.sicon') && c.querySelector('.lnk')));
const lnk = doc.querySelector('#s-body .scard .lnk');
click(win, doc.getElementById('tab-strokes'));
click(win, lnk);
check('clicking an example opens Watch at that stroke', !doc.getElementById('panel-watch').hidden && B.W.i === +lnk.getAttribute('data-i'), B.W.i);
click(win, doc.getElementById('tab-rules'));
const rcards = doc.querySelectorAll('#r-body .rcard');
check('9 rule cards', rcards.length === 9);
let filmOk = true;
rcards.forEach((rc, i) => {
  const rule = [['三'], ['好'], ['十'], ['人'], ['月'], ['小'], ['田'], ['中'], ['我']][i][0];
  if (rc.querySelectorAll('.fcell').length !== B.BY.get(rule).s.length) filmOk = false;
});
check('each rule diagram has one cell per stroke', filmOk);

// rule claims against the data
function ys(ch, i) { return B.dpt(B.BY.get(ch).s[i].m[0])[1]; }
function xs(ch, i) { const m = B.BY.get(ch).s[i].m; return m.map(B.dpt).reduce((a, p) => a + p[0], 0) / m.length; }
const C = (c) => B.BY.get(c).s.map((s) => s.t).join(' ');
check('rule: 三 top to bottom', ys('三', 0) < ys('三', 1) && ys('三', 1) < ys('三', 2));
check('rule: 好 left part (strokes 1-3) before right part (4-6)', [0, 1, 2].every((i) => xs('好', i) < xs('好', 3)) , null);
check('rule: 十 horizontal first', C('十') === '橫 豎');
check('rule: 人 撇 first', C('人') === '撇 捺');
check('rule: 月 frame before bars', C('月') === '撇 橫折鉤 橫 橫');
check('rule: 小 middle first', C('小').startsWith('豎鉤') && xs('小', 1) < xs('小', 2));
check('rule: 田 last stroke is the bottom 橫', C('田').endsWith('橫') && ys('田', 4) > ys('田', 2));
check('rule: 中 last stroke is the through 豎', C('中') === '豎 橫折 橫 豎');
check('rule: 我 last stroke is a 點', C('我').endsWith('點'));

// ---------- 5. quiz ----------
console.log('quiz');
click(win, doc.getElementById('tab-quiz'));
let qOk = true, qDetail = [];
for (const mode of ['next', 'name']) {
  click(win, doc.querySelector('#panel-quiz [data-mode="' + mode + '"]'));
  for (let r = 0; r < 120; r++) {
    B.qRender();
    const q = B.Q.q;
    const opts = q.options;
    if (new Set(opts).size !== opts.length) { qOk = false; qDetail.push(mode + ' duplicate options'); }
    if (opts.length < 2 || opts.length > 4) { qOk = false; qDetail.push(mode + ' option count ' + opts.length); }
    if (opts.filter((o) => o === q.correct).length !== 1) { qOk = false; qDetail.push(mode + ' correct count'); }
    const cards = doc.querySelectorAll('#q-options .optcard');
    if (cards.length !== opts.length) { qOk = false; qDetail.push(mode + ' card count'); }
    if (mode === 'next') {
      if (!opts.every((j) => j >= q.k && j < q.ch.s.length)) { qOk = false; qDetail.push('next: option before k'); }
      if (q.correct !== q.k) { qOk = false; qDetail.push('next: wrong correct'); }
    } else {
      if (q.ch.s[q.idx].t !== q.correct) { qOk = false; qDetail.push('name: wrong correct'); }
    }
  }
}
check('240 generated questions are well-formed (2-4 distinct options, exactly one correct)', qOk, qDetail.slice(0, 5));

// answer flow in 'next' mode
click(win, doc.querySelector('#panel-quiz [data-mode="next"]'));
let score = 0;
for (let i = 0; i < 10; i++) {
  const q = B.Q.q;
  const rightCard = Array.from(doc.querySelectorAll('#q-options .optcard')).find((c) => +c.getAttribute('data-j') === q.correct);
  const wrongCard = Array.from(doc.querySelectorAll('#q-options .optcard')).find((c) => +c.getAttribute('data-j') !== q.correct);
  const pickRight = i % 2 === 0;
  click(win, pickRight ? rightCard : wrongCard);
  if (pickRight) score++;
  const marked = doc.querySelector('#q-options .optcard.right');
  if (!marked || +marked.getAttribute('data-j') !== q.correct) { check('correct card is marked after answering (q' + i + ')', false); }
  if (!pickRight && !doc.querySelector('#q-options .optcard.wrong')) check('wrong card is marked', false);
  const go = doc.getElementById('q-go');
  click(win, go);
}
check('after 10 answers the results card shows', !doc.getElementById('q-result').hidden && doc.getElementById('q-main').hidden);
check('score matches the answers given', doc.querySelector('#q-result .big').textContent.replace(/\s/g, '').startsWith(String(score) + '/'), doc.querySelector('#q-result .big').textContent);
check('missed characters are listed for review', doc.querySelectorAll('#q-result .lnk').length >= 1);
click(win, doc.getElementById('q-again'));
check('Play again restarts at question 1', !doc.getElementById('q-main').hidden && /Question\s*1\s*of\s*10/.test(doc.getElementById('q-stat').textContent), doc.getElementById('q-stat').textContent);

// answer flow in 'name' mode
click(win, doc.querySelector('#panel-quiz [data-mode="name"]'));
{
  const q = B.Q.q;
  const card = Array.from(doc.querySelectorAll('#q-options .optcard')).find((c) => c.getAttribute('data-t') === q.correct);
  click(win, card);
  check('name mode: correct answer scores', B.Q.score === 1 && card.classList.contains('right'));
  check('name mode: feedback explains the stroke', doc.getElementById('q-fb').textContent.includes(q.correct));
}
// pool filter
click(win, doc.querySelector('#panel-quiz [data-pool="3"]'));
let poolOk = true;
for (let i = 0; i < 40; i++) { B.qRender(); if (B.Q.q.ch.lv !== 3) poolOk = false; }
check('Challenge pool only asks level-3 characters', poolOk);

// ---------- 6. write: stroke judging ----------
console.log('write: judging');
const rng = seeded(99);
function noisyStroke(ch, i, amp, jit, rev) {
  // smooth, hand-like error: a constant offset plus a slow wobble and a hint of sensor noise
  const m = ch.s[i].m.map(B.dpt);
  let pts = B.resample(m, 48);
  const ox = (rng() * 2 - 1) * amp, oy = (rng() * 2 - 1) * amp;
  const f1 = 0.6 + rng() * 1.2, f2 = 0.6 + rng() * 1.2, p1 = rng() * 6.28, p2 = rng() * 6.28;
  pts = pts.map(([x, y], k) => {
    const t = k / 47;
    return [x + ox + jit * Math.sin(6.28 * f1 * t + p1) + (rng() * 2 - 1) * 2, y + oy + jit * Math.sin(6.28 * f2 * t + p2) + (rng() * 2 - 1) * 2];
  });
  return rev ? pts.reverse() : pts;
}
let tot = 0, acc = 0, accTight = 0, revLong = 0, revDetected = 0, wrongTot = 0, wrongAcc = 0;
const falseAcc = [];
for (const ch of B.CH) {
  for (let i = 0; i < ch.s.length; i++) {
    tot++;
    if (B.judge(noisyStroke(ch, i, 35, 12, false), ch, i).ok) acc++;
    if (B.judge(noisyStroke(ch, i, 55, 18, false), ch, i).ok) accTight++;
    const mLen = B.polyLen(ch.s[i].m);
    if (mLen >= 230) {
      revLong++;
      const r = B.judge(noisyStroke(ch, i, 20, 8, true), ch, i);
      if (!r.ok && r.why === 'direction') revDetected++;
    }
    // drawing some other stroke while expecting stroke i
    for (let k = 0; k < ch.s.length; k++) {
      if (k === i) continue;
      wrongTot++;
      const r = B.judge(noisyStroke(ch, k, 20, 8, false), ch, i);
      if (r.ok) { wrongAcc++; if (falseAcc.length < 12) falseAcc.push(ch.c + ' expected ' + (i + 1) + ' drew ' + (k + 1)); }
    }
  }
}
console.log('   strokes:', tot, ' accepted at +-35 offset:', acc, ' at +-55 offset:', accTight, ' reversed long strokes detected:', revDetected + '/' + revLong, ' wrong-stroke false accepts:', wrongAcc + '/' + wrongTot);
check('noisy but correct strokes are accepted (>= 97% at +-35)', acc / tot >= 0.97, acc / tot);
check('and still mostly accepted at +-55 (>= 85%)', accTight / tot >= 0.85, accTight / tot);
check('reversed long strokes are flagged as wrong direction (>= 85%)', revDetected / revLong >= 0.85, revDetected / revLong);
check('drawing a different stroke is rarely accepted (< 4%)', wrongAcc / wrongTot < 0.04, { rate: wrongAcc / wrongTot, falseAcc });

// a tap on a dot
{
  const ch = B.BY.get('心');
  const c = ch.s[2].m.map(B.dpt); const mid = c[Math.floor(c.length / 2)];
  check('a tap on a dot is accepted', B.judge([[mid[0] + 10, mid[1] - 8]], ch, 2).ok);
  check('a tap far away is rejected', !B.judge([[mid[0] + 300, mid[1]]], ch, 2).ok);
  check('a tap cannot stand in for a long stroke', B.judge([[500, 500]], B.BY.get('一'), 0).why === 'short');
}

// ---------- 7. write: full run through pointer events ----------
console.log('write: full run');
click(win, doc.getElementById('tab-write'));
B.setChar('永', 0);
const stage = doc.getElementById('p-stage');
stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1024, height: 1024, right: 1024, bottom: 1024 });
function fire(type, x, y) {
  const e = new win.Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, { clientX: x, clientY: y, pointerId: 1, button: 0 });
  stage.dispatchEvent(e);
}
function drawStroke(pts) {
  fire('pointerdown', pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) fire('pointermove', pts[i][0], pts[i][1]);
  fire('pointerup', pts[pts.length - 1][0], pts[pts.length - 1][1]);
}
const yong = B.BY.get('永');
check('write starts at stroke 1', B.P.i === 0 && /Draw stroke 1 of 5/.test(doc.getElementById('p-prompt').textContent));
// wrong stroke first (stroke 3 drawn when stroke 1 expected)
drawStroke(noisyStroke(yong, 2, 5, 3, false));
check('drawing a later stroke is refused with an explanation', B.P.i === 0 && /later/i.test(doc.getElementById('p-msg').textContent), doc.getElementById('p-msg').textContent);
for (let i = 0; i < 5; i++) {
  drawStroke(noisyStroke(yong, i, 25, 8, false));
  check('stroke ' + (i + 1) + ' accepted', B.P.i === i + 1, B.P.i);
}
check('finished state', B.P.done === true && /Done/.test(doc.getElementById('p-prompt').textContent));
check('practiced character is marked on the shelf', !!doc.querySelector('#shelf-write .chip[data-c="永"].done'));
check('practiced character is stored', JSON.parse(win.localStorage.getItem('bishun-workbook-v1')).done['永'] === true);
click(win, doc.getElementById('p-reset'));
check('Start over resets', B.P.i === 0 && !B.P.done);
// three misses trigger a hint
for (let i = 0; i < 3; i++) drawStroke(noisyStroke(yong, 0, 300, 5, false));
check('three misses show the hint', /Stroke 1 is a 點/.test(doc.getElementById('p-msg').textContent), doc.getElementById('p-msg').textContent);
click(win, doc.getElementById('p-next'));
check('Next character moves on', B.P.i === 0 && doc.getElementById('p-head').textContent.includes('白'), doc.getElementById('p-head').textContent);
const guide = doc.getElementById('p-guide'); guide.checked = false; guide.dispatchEvent(new win.Event('change', { bubbles: true }));
check('guide off hides the ghost', Array.from(doc.querySelectorAll('#p-stage .glyph > path')).every((p) => p.getAttribute('class') === 'x'));


// ---------- phone app behaviour ----------
console.log('phone: character sheet, resume, quiz settings, install hint');
{
  const d1 = load(11), w1 = d1.window, c1 = w1.document;
  const sheet = c1.getElementById('sheet');
  check('sheet starts closed', sheet.hidden === true);
  check('Watch header has a Characters button', !!c1.querySelector('#w-head .pickbtn'));
  check('Write header has a Characters button', !!c1.querySelector('#p-head .pickbtn'));
  check('the sheet shelf lists all 47 characters', c1.querySelectorAll('#shelf-sheet .chip').length === 47);
  click(w1, c1.querySelector('#w-head .pickbtn'));
  check('Characters button opens the sheet', sheet.hidden === false);
  check('page scroll is locked while the sheet is open', c1.body.style.overflow === 'hidden');
  click(w1, c1.querySelector('#shelf-sheet .chip[data-c="國"]'));
  check('choosing a character closes the sheet', sheet.hidden === true && c1.body.style.overflow === '');
  check('and switches Watch to it (11 strokes)', c1.querySelectorAll('#w-stage .glyph > path').length === 11 && c1.getElementById('w-head').textContent.includes('guó'));
  check('and Write follows too', c1.getElementById('p-head').textContent.includes('guó'));
  check('the last character is remembered', JSON.parse(w1.localStorage.getItem('bishun-workbook-v1')).last === '國');
  click(w1, c1.querySelector('#w-head .pickbtn'));
  c1.dispatchEvent(new w1.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('Escape closes the sheet', sheet.hidden === true);
  click(w1, c1.querySelector('#w-head .pickbtn'));
  click(w1, c1.getElementById('sheet-close'));
  check('Done closes the sheet', sheet.hidden === true);
  click(w1, c1.querySelector('#w-head .pickbtn'));
  click(w1, c1.querySelector('.sheet-back'));
  check('tapping outside closes the sheet', sheet.hidden === true);
  check('no errors from the sheet', errors.length === 0, errors.slice(0, 3));

  // a second launch resumes on the saved character, and #quiz opens the Quiz tab (home screen shortcut)
  const d2 = load(12, { storage: { 'bishun-workbook-v1': JSON.stringify({ last: '龍', done: {}, best: {} }) }, hash: '#quiz' }), c2 = d2.window.document;
  check('relaunch resumes on the last character', c2.getElementById('w-head').textContent.includes('lóng'));
  check('#quiz shortcut opens the Quiz tab', c2.getElementById('panel-quiz').hidden === false && c2.getElementById('panel-watch').hidden === true);
  const d2b = load(12, { storage: { 'bishun-workbook-v1': JSON.stringify({ last: '国' }) } });
  check('a simplified character in storage is ignored', d2b.window.document.getElementById('w-head').textContent.includes('yǒng'));

  // quiz settings summary follows the choices
  const sum = c1.getElementById('q-set-sum');
  check('quiz summary starts as Next stroke / All', /Next stroke/.test(sum.textContent) && /All characters/.test(sum.textContent), sum.textContent);
  click(w1, c1.querySelector('#panel-quiz [data-mode="name"]'));
  click(w1, c1.querySelector('#panel-quiz [data-pool="3"]'));
  check('quiz summary updates', /Name the stroke/.test(sum.textContent) && /Challenge/.test(sum.textContent), sum.textContent);
  check('settings fold is open when no phone media query matches', c1.getElementById('q-set').open === true);

  // install button
  check('no Install button in an ordinary desktop browser', c1.getElementById('install-go').hidden === true);
  const d3 = load(13, { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const w3 = d3.window, c3 = w3.document;
  check('iPhone gets an Install button', c3.getElementById('install-go').hidden === false);
  check('install steps sheet starts closed', c3.getElementById('sheet-install').hidden === true);
  click(w3, c3.getElementById('install-go'));
  check('on iPhone it opens the Add to Home Screen steps', c3.getElementById('sheet-install').hidden === false && /Add to Home Screen/.test(c3.getElementById('sheet-install').textContent));
  check('only one sheet is open at a time', c3.getElementById('sheet').hidden === true);
  c3.dispatchEvent(new w3.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('Escape closes the install steps', c3.getElementById('sheet-install').hidden === true && c3.body.style.overflow === '');
  click(w3, c3.getElementById('install-go'));
  click(w3, c3.querySelector('#sheet-install .btn[data-close]'));
  check('Done closes the install steps', c3.getElementById('sheet-install').hidden === true);
  // Chrome/Android style install prompt
  const w1p = c1.defaultView; let prompted = 0;
  const ev = new w1p.Event('beforeinstallprompt', { cancelable: true });
  ev.prompt = () => { prompted++; }; ev.userChoice = { then: (ok) => ok({ outcome: 'accepted' }) };
  w1p.dispatchEvent(ev);
  check('beforeinstallprompt shows the Install button', c1.getElementById('install-go').hidden === false);
  check('and the default mini-infobar is suppressed', ev.defaultPrevented === true);
  click(w1p, c1.getElementById('install-go'));
  check('Install calls the browser prompt (and no sheet)', prompted === 1 && c1.getElementById('sheet-install').hidden === true);
  check('after the choice the button goes away', c1.getElementById('install-go').hidden === true);
  // update toast can be dismissed
  const toast = c1.getElementById('toast'); toast.hidden = false;
  click(w1p, c1.getElementById('toast-no'));
  check('the update toast can be dismissed', toast.hidden === true);
}
check('no script errors in the phone section', errors.length === 0, errors.slice(0, 5));

// ---------- result ----------
check('no script errors during the whole run', errors.length === 0, errors.slice(0, 5));
console.log(failures ? '\n' + failures + ' check(s) failed' : '\nall checks passed');
process.exit(failures ? 1 : 0);
