// Image overlay fidelity: for each object-fit / object-position / border / padding
// case, and for an img inside <picture> (optionally positioned, with border and padding), the overlay must cover exactly the img content box, and its base frame
// (the R, G and B buffers recombined) must match a screenshot of the real img.
// Then, for img transforms (static, and changed while playing), the visible overlay must
// cover the transformed img.
// Reads Glitch's internal channel buffers (`ch`) and stubs `frame`, so it tests internals on purpose.
// Run: npm run fidelity   (requires: npm i && npx playwright install chromium)
import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = pathToFileURL(join(root, 'site/dist/index.html')).href;

const SIZE = 'width:300px;height:200px;';
const CASES = [
  '',
  'object-fit:cover',
  'object-fit:cover;object-position:left top',
  'object-fit:cover;object-position:right 10px bottom 20px',
  'object-fit:contain;object-position:30% 70%',
  'object-fit:none;object-position:20px 10px',
  'object-fit:scale-down;object-position:right top',
  'object-fit:cover;border:6px solid #f0f;padding:10px 4px',
  'object-fit:cover;object-position:left top;border:3px solid #f0f;border-radius:24px;padding:5px',
  { css: 'object-fit:cover', picture: '' },
  { css: 'object-fit:contain;padding:4px', picture: 'display:block;position:relative;border:5px solid #0ff;padding:7px 11px' }
].map((c) => typeof c === 'string' ? { css: c } : c);
const label = (c) => (c.picture != null ? `<picture style="${c.picture}"> ` : '') + (c.css || 'default');
const MAX_MEAN_DIFF = 4; // mean absolute RGB difference, 0..255

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 3200 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.waitForTimeout(800);

const cases = await page.evaluate(async ({ cases, size }) => {
  document.body.innerHTML = '';
  document.body.style.background = '#000';
  // Asymmetric test image: four coloured quadrants and two off-centre white blocks.
  const src = document.createElement('canvas');
  src.width = 400; src.height = 160;
  const x = src.getContext('2d');
  [['#e33', 0, 0], ['#3e3', 200, 0], ['#33e', 0, 80], ['#ee3', 200, 80]].forEach(([c, l, t]) => { x.fillStyle = c; x.fillRect(l, t, 200, 80); });
  x.fillStyle = '#fff'; x.fillRect(20, 20, 60, 30); x.fillRect(330, 110, 50, 30);
  const dataUrl = src.toDataURL();

  const out = [];
  for (const { css, picture } of cases) {
    const holder = document.body.appendChild(document.createElement('div'));
    holder.style.cssText = 'margin:20px;height:260px';
    let parent = holder;
    if (picture != null) { parent = holder.appendChild(document.createElement('picture')); parent.style.cssText = picture; }
    const img = parent.appendChild(document.createElement('img'));
    img.style.cssText = size + css + ';display:block';
    img.src = dataUrl;
    await img.decode();
    const g = new Noisefloor.Glitch(img);
    await new Promise((r) => setTimeout(r, 50));
    g.play(); // buffers are built lazily
    g.finish();

    const cs = getComputedStyle(img), n = (k) => parseFloat(cs[k]);
    const ir = img.getBoundingClientRect(), cr = g.canvas.getBoundingClientRect();
    const content = {
      x: ir.left + n('borderLeftWidth') + n('paddingLeft'), y: ir.top + n('borderTopWidth') + n('paddingTop'),
      w: ir.width - n('borderLeftWidth') - n('borderRightWidth') - n('paddingLeft') - n('paddingRight'),
      h: ir.height - n('borderTopWidth') - n('borderBottomWidth') - n('paddingTop') - n('paddingBottom')
    };
    const base = document.createElement('canvas');
    base.width = g.ch[0].width; base.height = g.ch[0].height;
    const bx = base.getContext('2d');
    bx.globalCompositeOperation = 'lighter';
    g.ch.forEach((c) => bx.drawImage(c, 0, 0));
    out.push({ css, picture, content, overlay: { x: cr.left, y: cr.top, w: cr.width, h: cr.height }, base: base.toDataURL() });
  }
  return out;
}, { cases: CASES, size: SIZE });

const failed = [];
for (const c of cases) {
  const shot = await page.screenshot({ clip: { x: c.content.x, y: c.content.y, width: c.content.w, height: c.content.h } });
  const diff = await page.evaluate(async ([a, b]) => {
    const load = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
    const px = (i) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const da = px(ia), db = px(ib);
    let s = 0;
    for (let k = 0; k < da.length; k += 4) s += Math.abs(da[k] - db[k]) + Math.abs(da[k + 1] - db[k + 1]) + Math.abs(da[k + 2] - db[k + 2]);
    return s / (w * h * 3);
  }, ['data:image/png;base64,' + shot.toString('base64'), c.base]);
  const o = c.overlay, t = c.content;
  const boxOk = [o.x - t.x, o.y - t.y, o.w - t.w, o.h - t.h].every((v) => Math.abs(v) < 0.5);
  const ok = boxOk && diff < MAX_MEAN_DIFF;
  if (!ok) failed.push(label(c));
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label(c).padEnd(90)} box ${boxOk ? 'ok' : 'off'}  pixel diff ${diff.toFixed(2)}`);
}

// Transforms: the overlay, showing its clean base frame, must cover the transformed
// img exactly. Compared on screen: overlay hidden vs shown, over the img's bounding
// box. `change` is applied after play() starts, to check the overlay follows it.
const TRANSFORM_CASES = [
  { css: 'object-fit:cover;transform:scale(1.2) rotate(6deg)' },
  { css: 'object-fit:cover;border:6px solid #f0f;padding:10px 4px;transform-origin:left top;transform:scale(1.15) translate(12px,-8px)' },
  { css: 'object-fit:contain;padding:8px;transform-origin:right bottom;transform:rotate(-8deg)' },
  { css: 'object-fit:cover;padding:6px;translate:10% 5px;rotate:4deg;scale:1.1' },
  { css: 'object-fit:cover;transform:scale(1)', change: 'scale(1.25) rotate(3deg)' }
];
// Share of pixels in the bounding box where some channel differs by more than 64:
// antialiased edges stay well below it, any misplacement of the grid exceeds it.
const MAX_TRANSFORM_DIFF = 0.01;

for (const c of TRANSFORM_CASES) {
  const rect = await page.evaluate(async ({ css, change, size }) => {
    document.body.innerHTML = '';
    const src = document.createElement('canvas');
    src.width = 400; src.height = 160;
    const x = src.getContext('2d');
    [['#e33', 0, 0], ['#3e3', 200, 0], ['#33e', 0, 80], ['#ee3', 200, 80]].forEach(([col, l, t]) => { x.fillStyle = col; x.fillRect(l, t, 200, 80); });
    x.fillStyle = '#fff'; x.fillRect(20, 20, 60, 30); x.fillRect(330, 110, 50, 30);
    // A fine grid, so a misplaced overlay differs from the img almost everywhere.
    x.fillStyle = '#000';
    for (let k = 0; k < 400; k += 16) { x.fillRect(k, 0, 3, 160); if (k < 160) x.fillRect(0, k, 400, 3); }
    const holder = document.body.appendChild(document.createElement('div'));
    holder.style.cssText = 'margin:80px;height:300px';
    const img = holder.appendChild(document.createElement('img'));
    img.style.cssText = size + css + ';display:block';
    img.src = src.toDataURL();
    await img.decode();
    const g = new Noisefloor.Glitch(img, { duration: 30, jitter: 0, flicker: 0, scanlines: false });
    await new Promise((r) => setTimeout(r, 50));
    g.frame = () => {}; // keep the canvas showing the clean base frame
    g.play();
    const cx = g.canvas.getContext('2d');
    cx.globalCompositeOperation = 'lighter';
    g.ch.forEach((ch) => cx.drawImage(ch, 0, 0));
    window.__g = g;
    if (change) img.style.transform = change;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const b = img.getBoundingClientRect();
    return { x: b.left - 4, y: b.top - 4, width: b.width + 8, height: b.height + 8 };
  }, { ...c, size: SIZE });
  const shown = await page.screenshot({ clip: rect });
  await page.evaluate(() => { window.__g.canvas.style.visibility = 'hidden'; });
  const hidden = await page.screenshot({ clip: rect });
  await page.evaluate(() => { window.__g.destroy(); });
  const diff = await page.evaluate(async ([a, b]) => {
    const load = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const w = ia.width, h = ia.height;
    const px = (i) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const da = px(ia), db = px(ib);
    let n = 0;
    for (let k = 0; k < da.length; k += 4) if (Math.max(Math.abs(da[k] - db[k]), Math.abs(da[k + 1] - db[k + 1]), Math.abs(da[k + 2] - db[k + 2])) > 64) n++;
    return n / (w * h);
  }, ['data:image/png;base64,' + shown.toString('base64'), 'data:image/png;base64,' + hidden.toString('base64')]);
  const name = c.css + (c.change ? `, then transform:${c.change}` : '');
  const ok = diff < MAX_TRANSFORM_DIFF;
  if (!ok) failed.push(name);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(90)} pixels off ${(diff * 100).toFixed(2)}%`);
}

await browser.close();
if (errors.length) console.error('page errors:', errors);
if (failed.length || errors.length) { console.error('FAILED:', failed.join(' | ') || 'page errors'); process.exit(1); }
console.log('fidelity OK');
