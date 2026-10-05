// Real-browser checks at phone sizes: layout, touch writing, character sheet, installability and offline use.
// Needs a Chromium. Set CHROME_PATH, or it falls back to Playwright's copy or @sparticuz/chromium if installed.
//   npm install && CHROME_PATH=/path/to/chrome node test_browser.js [screenshot-dir]
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer-core');

const APP = path.join(__dirname, '..', 'app');
const SHOTS = process.argv[2] || null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };

function serve() {
  return new Promise((resolve) => {
    const hits = [], state = { build: 'testA' };
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(APP, p);
      hits.push(p);
      if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
      const type = MIME[path.extname(f)] || 'application/octet-stream';
      if (p === '/sw.js' || p === '/app.js') {   // the deploy workflow stamps the commit into these two files
        const body = Buffer.from(fs.readFileSync(f, 'utf8').split('__BUILD__').join(state.build));
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'max-age=0', 'Content-Length': body.length });
        res.end(body);
        return;
      }
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'max-age=0' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port, hits, state }));
  });
}

async function chromePath() {
  const cands = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  for (const c of cands) if (c && fs.existsSync(c)) return { exe: c, args: [] };
  const chromium = require('@sparticuz/chromium').default;
  return { exe: await chromium.executablePath(), args: chromium.args };
}

let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log('  ok  ', name);
  else { failures++; console.log('  FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PHONES = {
  'iphone-15':  { w: 393, h: 852, dpr: 3 },
  'iphone-se':  { w: 375, h: 667, dpr: 2 },
  'small-android': { w: 360, h: 640, dpr: 3 },
  'pixel-8':    { w: 412, h: 915, dpr: 2.6 },
};

(async () => {
  const { srv, port, hits, state } = await serve();
  const base = `http://127.0.0.1:${port}/`;
  const { exe, args } = await chromePath();
  const browser = await puppeteer.launch({ executablePath: exe, headless: 'shell', args: [...args, '--no-sandbox', '--disable-gpu'] });
  const problems = [];

  async function open(size, opts = {}) {
    const page = await browser.newPage();
    page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
    page.on('requestfailed', (r) => { if (!opts.offline) problems.push('requestfailed: ' + r.url()); });
    await page.setViewport({ width: size.w, height: size.h, deviceScaleFactor: size.dpr || 2, isMobile: !opts.desktop, hasTouch: !opts.desktop });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: opts.dark ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(base + (opts.hash || ''), { waitUntil: 'networkidle0' });
    return page;
  }
  const rectOf = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom, r: r.right }; }, sel);
  const covered = [];
  const tap = async (page, sel) => {
    const r = await rectOf(page, sel);
    const x = r.x + r.w / 2, y = r.y + r.h / 2;
    // a control that something else sits on top of is a real usability bug, so record it
    const hit = await page.evaluate((s, px, py) => { const t = document.querySelector(s), e = document.elementFromPoint(px, py); return !!e && (t === e || t.contains(e)); }, sel, x, y);
    if (!hit) covered.push(sel + ' @' + Math.round(x) + ',' + Math.round(y));
    await page.touchscreen.tap(x, y); await sleep(60);
  };
  const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
  const overflow = (page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));

  // ---------- portrait phones ----------
  for (const [name, size] of Object.entries(PHONES)) {
    console.log('portrait', name, size.w + 'x' + size.h);
    const page = await open(size);
    const vh = size.h;
    const tabs = await rectOf(page, '.tabs');
    check('tab bar is pinned to the bottom edge', Math.abs(tabs.b - vh) < 1.5 && tabs.w >= size.w - 1, tabs);
    check('tab bar buttons are at least 56px tall', tabs.h >= 56, tabs.h);
    const next = await rectOf(page, '#w-next'), stage = await rectOf(page, '#w-stage');
    check('Next Stroke is visible without scrolling', next.b <= tabs.y - 4, { nextBottom: next.b, tabsTop: tabs.y });
    check('Next Stroke is a big touch target', next.h >= 50 && next.w >= 120, next);
    check('the whole stage is visible', stage.b <= tabs.y - 4 && stage.w >= 240, stage);
    const bk = await rectOf(page, '#w-back'), pl = await rectOf(page, '#w-play');
    check('Back and Play are at least 44px square', bk.h >= 44 && pl.h >= 44 && bk.w >= 44 && pl.w >= 44, { bk, pl });
    check('no horizontal scrolling (Watch)', (await overflow(page)).sw <= size.w, await overflow(page));
    const top = await rectOf(page, '.top'), inst = await rectOf(page, '#install-go');
    check('header stays one slim row (with the Install button if Chrome offers it)', top.h <= 64, top);
    if (inst && inst.w > 0) check('Install button is inside the header and a 40px target', inst.r <= size.w - 8 && inst.h >= 40, inst);
    const fontsOk = await page.evaluate(() => document.fonts.ready.then(() => document.fonts.check('900 20px "Noto Serif TC"', '永') && document.fonts.check('600 16px "Schibsted Grotesk"')));
    check('self-hosted fonts loaded', fontsOk);

    // Next Stroke by touch cycles through 永's five strokes and wraps
    const seen = [];
    for (let i = 0; i < 7; i++) {
      await tap(page, '#w-next');
      seen.push(await page.evaluate(() => window.__bishun.W.i));
    }
    check('touch on Next Stroke steps 1..5, then clears, then restarts', JSON.stringify(seen) === JSON.stringify([1, 2, 3, 4, 5, 0, 1]), seen);
    if (name === 'iphone-15') await shot(page, 'p-watch-light');

    // other tabs fit
    for (const t of ['write', 'quiz', 'strokes', 'rules']) {
      await tap(page, '#tab-' + t);
      const o = await overflow(page);
      check(t + ' tab has no horizontal scrolling', o.sw <= size.w, o);
      const bar = await rectOf(page, '.tabs');
      check(t + ' tab bar still pinned after switching', Math.abs(bar.b - vh) < 1.5);
    }
    await page.close();
  }

  // ---------- Write by finger on a phone ----------
  console.log('write by touch');
  {
    const page = await open(PHONES['iphone-15'], { hash: '#write' });
    const ok = await page.evaluate(() => document.getElementById('panel-write').hidden === false);
    check('#write opens the Write tab', ok);
    const tabs = await rectOf(page, '.tabs'), st = await rectOf(page, '#p-stage');
    const ctl = await rectOf(page, '#panel-write .ctl');
    check('stage and controls are visible together', st.b <= tabs.y && ctl.b <= tabs.y - 2, { st: st.b, ctl: ctl.b, tabs: tabs.y });
    const ptsFor = async (idx) => page.evaluate((i) => {
      const B = window.__bishun, ch = B.BY.get('永'), r = document.getElementById('p-stage').getBoundingClientRect();
      return ch.s[i].m.map((p) => { const d = B.dpt(p); return [r.left + d[0] * r.width / 1024, r.top + d[1] * r.height / 1024]; });
    }, idx);
    async function swipe(pts) {
      await page.touchscreen.touchStart(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) { await page.touchscreen.touchMove(pts[i][0], pts[i][1]); await sleep(8); }
      await page.touchscreen.touchEnd();
      await sleep(40);
    }
    const scrollBefore = await page.evaluate(() => window.scrollY);
    for (let i = 0; i < 5; i++) await swipe(await ptsFor(i));
    const state = await page.evaluate(() => ({ i: window.__bishun.P.i, done: window.__bishun.P.done, msg: document.getElementById('p-msg').textContent }));
    check('five finger strokes along 永 are accepted', state.i === 5 && state.done === true, state);
    check('drawing did not scroll the page', (await page.evaluate(() => window.scrollY)) === scrollBefore);
    await shot(page, 'p-write-done');
    await page.close();
  }

  // ---------- character sheet ----------
  console.log('character sheet');
  {
    const page = await open(PHONES['iphone-15']);
    const inline = await page.evaluate(() => getComputedStyle(document.querySelector('#panel-watch > .shelf')).display);
    check('inline shelf is hidden on phones', inline === 'none', inline);
    const pick = await rectOf(page, '#w-head .pickbtn');
    check('Characters button is visible and at least 44px tall', pick && pick.h >= 44 && pick.r <= 393, pick);
    await tap(page, '#w-head .pickbtn');
    const sh = await rectOf(page, '.sheet-panel');
    check('sheet slides up from the bottom edge', sh && Math.abs(sh.b - 852) < 1.5 && sh.w >= 380, sh);
    const chip = await rectOf(page, '#shelf-sheet .chip[data-c="馬"]');
    check('chips are at least 52px', chip.w >= 52 && chip.h >= 52, chip);
    await shot(page, 'p-sheet-light');
    await page.evaluate(() => document.querySelector('#shelf-sheet .chip[data-c="馬"]').scrollIntoView({ block: 'center' }));
    await sleep(60);
    await tap(page, '#shelf-sheet .chip[data-c="馬"]');
    const after = await page.evaluate(() => ({ hidden: document.getElementById('sheet').hidden, head: document.getElementById('w-head').textContent, ov: document.body.style.overflow }));
    check('tapping 馬 closes the sheet and loads it', after.hidden && after.head.includes('mǎ') && after.ov === '', after);
    await page.close();
  }

  // ---------- quiz ----------
  console.log('quiz on a phone');
  {
    const page = await open(PHONES['iphone-15'], { hash: '#quiz' });
    const open0 = await page.evaluate(() => document.getElementById('q-set').open);
    check('quiz settings are folded away on phones', open0 === false);
    const tabs = await rectOf(page, '.tabs');
    const grid = await rectOf(page, '#q-options');
    check('all four stroke options fit above the tab bar', grid.b <= tabs.y - 4, { grid: grid.b, tabs: tabs.y });
    await tap(page, '#q-options .optcard');
    await shot(page, 'p-quiz-answered-light');
    const go = await rectOf(page, '#q-go');
    check('Next question can be reached', !!go && go.h >= 50);
    await page.evaluate(() => window.scrollTo(0, 0));
    await tap(page, '#q-set-sum');
    check('tapping the settings line opens it', await page.evaluate(() => document.getElementById('q-set').open));
    await tap(page, '#panel-quiz [data-mode="name"]');
    const nm = await rectOf(page, '#q-options');
    await shot(page, 'p-quiz-name-light');
    check('name-the-stroke options fit the page width', nm.r <= 393 && (await overflow(page)).sw <= 393);
    await page.close();
  }

  // ---------- dark theme and shots ----------
  console.log('dark theme');
  {
    const page = await open(PHONES['iphone-15'], { dark: true });
    await tap(page, '#w-next'); await tap(page, '#w-next');
    await shot(page, 'p-watch-dark');
    for (const t of ['write', 'quiz', 'strokes', 'rules']) { await tap(page, '#tab-' + t); await shot(page, 'p-' + t + '-dark'); }
    await page.close();
  }

  // ---------- landscape phone ----------
  console.log('landscape 852x393');
  {
    const page = await open({ w: 852, h: 393, dpr: 3 });
    const tabs = await rectOf(page, '.tabs'), stage = await rectOf(page, '#w-stage'), next = await rectOf(page, '#w-next');
    check('tab bar becomes a left rail', tabs.x <= 1 && tabs.w < 120 && tabs.h >= 390, tabs);
    check('stage fits the viewport height', stage.y >= 0 && stage.b <= 393, stage);
    check('Next Stroke is visible without scrolling', next.b <= 393 && next.y >= 0, next);
    check('stage is not covered by the rail', stage.x >= tabs.r - 1, { stage: stage.x, rail: tabs.r });
    check('no horizontal scrolling', (await overflow(page)).sw <= 852);
    await shot(page, 'l-watch-light');
    await tap(page, '#tab-write'); await shot(page, 'l-write-light');
    await tap(page, '#tab-quiz'); await shot(page, 'l-quiz-light');
    const q = await overflow(page);
    check('quiz in landscape has no horizontal scrolling', q.sw <= 852, q);
    await page.close();
  }

  // ---------- desktop is unchanged ----------
  console.log('desktop 1100x900');
  {
    const page = await open({ w: 1100, h: 900, dpr: 1 }, { desktop: true });
    const tabs = await page.evaluate(() => getComputedStyle(document.querySelector('.tabs')).position);
    const shelf = await page.evaluate(() => getComputedStyle(document.querySelector('#panel-watch > .shelf')).display);
    const pickbtn = await page.evaluate(() => getComputedStyle(document.querySelector('#w-head .pickbtn')).display);
    check('desktop keeps top tabs, inline shelf, no Characters button', tabs !== 'fixed' && shelf !== 'none' && pickbtn === 'none', { tabs, shelf, pickbtn });
    check('quiz settings are open on desktop', await page.evaluate(() => document.getElementById('q-set').open));
    await shot(page, 'd-watch-light');
    await page.close();
  }

  // ---------- installability and offline ----------
  console.log('install + offline');
  {
    const page = await open(PHONES['iphone-15']);
    const swState = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return { scope: reg.scope, active: !!reg.active, state: reg.active && reg.active.state };
    });
    check('service worker is active with a scope covering the app', swState.active && swState.scope === base, swState);
    await sleep(500);
    await page.reload({ waitUntil: 'networkidle0' });
    check('page is controlled by the worker after a reload', await page.evaluate(() => !!navigator.serviceWorker.controller));
    const cached = await page.evaluate(async () => { const keys = await caches.keys(); const c = await caches.open(keys[0]); return { keys, n: (await c.keys()).length }; });
    const sw = fs.readFileSync(path.join(APP, 'sw.js'), 'utf8');
    const listed = (sw.match(/const PRECACHE = \[([\s\S]*?)\];/)[1].match(/'[^']+'/g) || []).length;
    check('every precache entry was stored', cached.n === listed && cached.keys.length === 1, { cached, listed });

    const man = await page.evaluate(async () => { const r = await fetch(document.querySelector('link[rel=manifest]').href); return r.json(); });
    check('manifest loads and is standalone', man.display === 'standalone' && man.start_url === './' && man.scope === './', man);
    const sizes = await page.evaluate(async (icons) => Promise.all(icons.map((i) => new Promise((res) => { const im = new Image(); im.onload = () => res([i, im.naturalWidth, im.naturalHeight]); im.onerror = () => res([i, 0, 0]); im.src = i; }))), man.icons.map((i) => i.src));
    check('manifest icons load at their declared sizes', sizes.every((s, k) => `${s[1]}x${s[2]}` === man.icons[k].sizes), sizes);
    const cdp = await page.createCDPSession();
    await cdp.send('Page.enable');
    let instErrors = null;
    try { instErrors = (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors; } catch (e) { instErrors = 'unsupported: ' + e.message; }
    check('Chrome reports no installability errors', Array.isArray(instErrors) && instErrors.length === 0, instErrors);

    // pinyin letters Schibsted lacks come from the fallback face
    const faces = await page.evaluate(() => document.fonts.load('600 16px "Schibsted Grotesk"', 'ǐǒǔǚ').then((f) => f.map((x) => x.unicodeRange)));
    check('ǐ ǒ ǔ ǚ load from the pinyin fallback font', faces.some((u) => /1CF/i.test(u)), faces);
    check('About shows the stamped build', (await page.evaluate(() => document.getElementById('app-version').textContent)) === 'testA');

    // ship a new version: the page should offer it, and switch only when asked
    state.build = 'testB';
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
    let toastShown = false;
    for (let i = 0; i < 40 && !toastShown; i++) { await sleep(150); toastShown = await page.evaluate(() => !document.getElementById('toast').hidden); }
    check('a new deploy shows the "new version is ready" toast', toastShown);
    const mid = await page.evaluate(async () => ({ keys: (await caches.keys()).sort(), version: document.getElementById('app-version').textContent }));
    check('the old version keeps running until the user agrees', mid.version === 'testA' && mid.keys.length === 2, mid);
    const toastBox = await rectOf(page, '#toast'), navBox = await rectOf(page, '.tabs');
    check('the toast sits above the tab bar', toastBox.b <= navBox.y + 1, { toast: toastBox.b, tabs: navBox.y });
    await shot(page, 'p-update-toast');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), tap(page, '#toast-go')]);
    await sleep(300);
    const after = await page.evaluate(async () => ({ keys: await caches.keys(), version: document.getElementById('app-version').textContent, ctl: !!navigator.serviceWorker.controller, toast: document.getElementById('toast').hidden }));
    check('Reload switches to the new version and deletes the old cache', after.version === 'testB' && after.keys.length === 1 && after.keys[0] === 'bishun-testB' && after.ctl && after.toast, after);

    // pull the plug: stop the server, then reload and use the app
    await page.close();
    await new Promise((r) => srv.close(r));
    srv.closeAllConnections && srv.closeAllConnections();
    const off = await browser.newPage();
    await off.setViewport({ width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const offErrors = [];
    off.on('pageerror', (e) => offErrors.push(e.message));
    await off.goto(base, { waitUntil: 'load' });
    check('offline: app shell loads with the server down', (await off.title()) === 'Bǐshùn Workbook');
    check('offline: stroke data is there', await off.evaluate(() => window.__bishun && window.__bishun.CH.length === 47));
    const offFonts = await off.evaluate(() => document.fonts.ready.then(() => document.fonts.check('900 20px "Noto Serif TC"', '永')));
    check('offline: fonts still render', offFonts);
    await off.touchscreen.tap(...(await (async () => { const r = await rectOf(off, '#w-next'); return [r.x + r.w / 2, r.y + r.h / 2]; })()));
    check('offline: Next Stroke works', await off.evaluate(() => window.__bishun.W.i === 1));
    const offDeep = await off.goto(base + 'index.html?utm=x#quiz', { waitUntil: 'load' });
    check('offline: other URLs inside the scope still open the app', (await off.title()) === 'Bǐshùn Workbook' && await off.evaluate(() => document.getElementById('panel-quiz').hidden === false));
    check('offline: no script errors', offErrors.length === 0, offErrors);
    await shot(off, 'p-offline');
    await off.close();
  }

  check('every tapped control was actually reachable (nothing sat on top of it)', covered.length === 0, covered);
  check('no console errors, page errors or failed requests while online', problems.length === 0, problems.slice(0, 6));
  await browser.close();
  try { srv.close(); } catch (e) {}
  console.log(failures ? '\n' + failures + ' check(s) failed' : '\nall browser checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
