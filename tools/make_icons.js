// Draws the app icons from the 永 stroke data in app/data.js. Run: npm install && node make_icons.js
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const out = path.join(__dirname, '..', 'app', 'icons');
const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'data.js'), 'utf8');
const win = {};
new Function('window', src)(win);
const yong = win.BISHUN_DATA.chars.find((c) => c.c === '永');

const INK = '#15222B', PAPER = '#F7FAF8', SAGE = '#9DB8AC', RED = '#D3392B';

function cell() {
  // the 1024-unit workbook cell: white sheet, dashed 米 guide, 永 with its first stroke in red
  const strokes = yong.s.map((s, i) => `<path d="${s.d}" fill="${i === 0 ? RED : INK}"/>`).join('');
  const dash = `stroke="${SAGE}" stroke-width="9" stroke-dasharray="26 20" fill="none"`;
  return `<rect x="0" y="0" width="1024" height="1024" rx="34" fill="${PAPER}"/>` +
    `<line x1="512" y1="40" x2="512" y2="984" ${dash}/><line x1="40" y1="512" x2="984" y2="512" ${dash}/>` +
    `<line x1="40" y1="40" x2="984" y2="984" ${dash}/><line x1="984" y1="40" x2="40" y2="984" ${dash}/>` +
    `<g transform="translate(0,900) scale(1,-1)">${strokes}</g>`;
}

function tile(size, { round, frac }) {
  const side = size * frac, o = (size - side) / 2, k = side / 1024;
  const bg = round
    ? `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${INK}"/>`
    : `<rect width="${size}" height="${size}" fill="${INK}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg}` +
    `<g transform="translate(${o} ${o}) scale(${k})">${cell()}</g></svg>`;
}

function png(svg, size, file) {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
  fs.writeFileSync(path.join(out, file), r.render().asPng());
}

fs.mkdirSync(out, { recursive: true });
png(tile(512, { round: true, frac: 0.66 }), 512, 'icon-512.png');
png(tile(512, { round: true, frac: 0.66 }), 192, 'icon-192.png');
png(tile(512, { round: false, frac: 0.54 }), 512, 'icon-maskable-512.png');   // glyph stays inside the 80% safe circle
png(tile(512, { round: false, frac: 0.66 }), 180, 'apple-touch-icon.png');    // iOS rounds the corners itself

// favicon: bolder and simpler so it still reads at 16 px
const fav = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${INK}"/>` +
  `<g transform="translate(6 6) scale(${52 / 1024})"><rect width="1024" height="1024" rx="60" fill="${PAPER}"/>` +
  `<g transform="translate(0,900) scale(1,-1)">${yong.s.map((s, i) => `<path d="${s.d}" fill="${i === 0 ? RED : INK}" stroke="${i === 0 ? RED : INK}" stroke-width="34" stroke-linejoin="round"/>`).join('')}</g></g></svg>`;
fs.writeFileSync(path.join(out, 'favicon.svg'), fav);
png(fav, 32, 'favicon-32.png');
console.log('icons written to', out);
