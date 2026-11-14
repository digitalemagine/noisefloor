// Records the README GIF (site/media/demo.gif) and the Open Graph image (site/media/og.jpg)
// from the built site (needs site/dist; `npm run capture` builds first). Requires ffmpeg.
//
// Reproducible: the page runs on Playwright's fake clock (timers, requestAnimationFrame,
// performance.now) with a seeded Math.random, so frames are evenly spaced however slow a
// screenshot is, and a re-recording of the same site looks the same. CSS transitions run on
// real time and may differ slightly between recordings.
//
// Composition: menu, the demo stage and both images, with the intro hidden, at a 1500 px wide
// viewport scaled by 0.8 (the content column is 1080 px), so the whole stack fits 1200x630.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = pathToFileURL(join(root, 'site/dist/index.html')).href;
const media = join(root, 'site/media');
const VIEW = { width: 1500, height: 788 }, SCALE = 0.8; // 1200x630 output
const CONTENT = 1080, MARGIN = 28; // .wrap max-width; dark margin kept around it in the GIF
const FRAME_MS = 50; // GIF at 20 fps
const GIF_WIDTH = 720;

try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch { console.error('ffmpeg not found on PATH'); process.exit(1); }

const browser = await chromium.launch();

/** A fresh page on the fake clock, loaded, fonts and images ready, effects idle. */
async function open() {
  const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: SCALE });
  page.on('pageerror', (e) => { throw e; });
  await page.addInitScript(() => {
    let a = 7; // mulberry32
    Math.random = () => { a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  });
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.goto(url);
  await page.addStyleTag({ content: '.intro, #demo > h2, .stage-foot, .hint { display: none !important } .wrap { padding-top: 0 !important } #demo { margin-top: 24px !important }' });
  await page.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 50; i++) {
    await page.clock.runFor(100);
    if (await page.evaluate(() => ['img-main', 'img-side'].every((id) => { const im = document.getElementById(id); return im.complete && im.naturalWidth > 0; }))) break;
  }
  await page.clock.runFor(3000); // first typed line and any start-up glitches finish
  return page;
}

/** Fires the site's own hover handlers on every element matching `sel`. */
const hover = (page, sel) => page.evaluate((s) => document.querySelectorAll(s).forEach((e) => e.dispatchEvent(new MouseEvent('mouseenter'))), sel);

// ---- Open Graph image: text half resolved, images mid-glitch
{
  const page = await open();
  await hover(page, '.navlink, #hero');
  await page.clock.runFor(550);
  await hover(page, '.shot');
  await page.clock.runFor(60);
  await page.screenshot({ path: join(media, 'og.jpg'), type: 'jpeg', quality: 88 });
  await page.close();
}

// ---- GIF: ambient micro-glitches and the typed line throughout; each beat pairs text with an
// image, and one beat fires everything, so every effect is on screen within a short loop
{
  const page = await open();
  const dir = mkdtempSync(join(tmpdir(), 'nf-gif-'));
  const clip = { x: (VIEW.width - CONTENT) / 2 - MARGIN, y: 0, width: CONTENT + 2 * MARGIN, height: VIEW.height };
  const nav = (i) => `.navlink:nth-child(${i})`;
  // [time in ms, selector to hover]; the menu is swept left to right like a pointer
  const script = [
    [500, '#hero'], [500, '#shot-main'],
    [1800, nav(1)], [1900, nav(2)], [2000, '.gallery .side .shot'], [2000, nav(3)], [2100, nav(4)], [2200, nav(5)],
    [3500, '#hero'], [3500, '.shot'], [3500, '.navlink']
  ];
  const total = 5600;
  let n = 0;
  for (let t = 0; t < total; t += FRAME_MS) {
    for (const [at, sel] of script) if (at >= t && at < t + FRAME_MS) await hover(page, sel);
    await page.clock.runFor(FRAME_MS);
    await page.screenshot({ path: join(dir, `f${String(n++).padStart(4, '0')}.png`), clip });
  }
  const gif = join(media, 'demo.gif');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(1000 / FRAME_MS), '-i', join(dir, 'f%04d.png'),
    '-vf', `scale=${GIF_WIDTH}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
    '-loop', '0', gif]);
  rmSync(dir, { recursive: true, force: true });
  await page.close();
  console.log(`site/media/demo.gif: ${n} frames, ${(statSync(gif).size / 1024).toFixed(0)} KB`);
}

console.log(`site/media/og.jpg: ${(statSync(join(media, 'og.jpg')).size / 1024).toFixed(0)} KB`);
await browser.close();
