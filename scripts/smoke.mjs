// Smoke test: loads the built site in headless Chromium, exercises text,
// image and ambient effects, and fails on any page error.
// Run: npm run smoke   (requires: npm i && npx playwright install chromium)
import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = pathToFileURL(join(root, 'site/dist/index.html')).href;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const errors = [], warnings = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });

await page.goto(url);
await page.waitForTimeout(1500);

const checks = await page.evaluate(async () => {
  const out = {};
  const { Scramble, Glitch, Ambient } = window.Noisefloor || {};
  out.globals = !!(Scramble && Glitch && Ambient) && !('Scramble' in window) && !('Scramble' in window);

  // text: layout must not move while scrambling
  const el = document.querySelector('.menu .navlink');
  const before = el.getBoundingClientRect().width;
  el.dispatchEvent(new MouseEvent('mouseenter'));
  await new Promise((r) => setTimeout(r, 120));
  out.textStable = Math.abs(el.getBoundingClientRect().width - before) < 0.01;
  out.textLive = !!el.querySelector('.nf-text.nf-live');

  // image: canvas overlay sized to the image content box and shown while live
  const img = document.getElementById('img-main');
  const wrap = img.closest('.nf-img');
  const canvas = wrap && wrap.querySelector('canvas.nf-img-canvas');
  img.closest('.shot').dispatchEvent(new MouseEvent('mouseenter'));
  await new Promise((r) => setTimeout(r, 120));
  out.imageLive = !!wrap && wrap.classList.contains('nf-live');
  const ics = getComputedStyle(img);
  const contentWidth = img.clientWidth - parseFloat(ics.paddingLeft) - parseFloat(ics.paddingRight);
  out.canvasSized = !!canvas && Math.abs(parseFloat(canvas.style.width) - contentWidth) < 1;

  // image buffers: none until the first play, released by the idle timer
  const lazyImg = document.body.appendChild(img.cloneNode());
  lazyImg.removeAttribute('id');
  await lazyImg.decode();
  const lazy = new Glitch(lazyImg);
  await new Promise((r) => setTimeout(r, 50));
  const unbuilt = lazy.canvas.width === 1;
  const realTimeout = window.setTimeout;
  let release = null;
  window.setTimeout = (fn, ms, ...rest) => (ms === 30000 ? ((release = fn), 0) : realTimeout(fn, ms, ...rest));
  lazy.play();
  const built = lazy.canvas.width > 1;
  lazy.finish();
  window.setTimeout = realTimeout;
  if (release) release();
  out.imageBuffersLazy = unbuilt && built && !!release && lazy.canvas.width === 1;
  lazy.destroy();
  lazyImg.remove();

  // ambient: firing produces a burst on some idle target
  const amb = new Ambient([new Scramble(Object.assign(document.createElement('span'), { textContent: 'probe' }))], { enabled: false });
  document.body.appendChild(amb.targets[0].el);
  amb.fire();
  await new Promise((r) => setTimeout(r, 30));
  out.ambientFires = amb.targets[0].el.classList.contains('nf-live');

  // running: true while animating, false at rest; Ambient skips running targets
  const probe = amb.targets[0];
  probe.finish();
  const idleBefore = probe.running === false;
  probe.play();
  const busy = probe.running === true;
  const skipped = new Ambient([probe], { enabled: false }).fire() && probe.running;
  probe.finish();
  out.running = idleBefore && busy && skipped && probe.running === false;

  // CSS is injected into every document that hosts an instance, not only the first
  const frame = document.body.appendChild(document.createElement('iframe'));
  const fdoc = frame.contentDocument;
  new Scramble(fdoc.body.appendChild(fdoc.createElement('span')));
  out.cssPerDocument = !!fdoc.head.querySelector('style[data-noisefloor]');
  frame.remove();

  // invalid options are clamped or replaced by defaults (silently: the IIFE is a production build)
  const bad = new Scramble(document.createElement('span'), { fps: -5, flicker: 3, lines: 20, order: 'up', palette: [], chars: '', bogus: 1 });
  out.optionsClamped = bad.options.fps === 1 && bad.options.flicker === 1 && bad.options.lines === 8 && bad.options.order === 'ltr';

  // destroy() removes the listeners bind() added
  const host = document.body.appendChild(Object.assign(document.createElement('button'), { innerHTML: '<span>bound</span>' }));
  const [bound] = Scramble.bind(host.firstChild);
  bound.destroy();
  host.dispatchEvent(new MouseEvent('mouseenter'));
  host.dispatchEvent(new FocusEvent('focus'));
  await new Promise((r) => setTimeout(r, 30));
  out.destroyUnbinds = !host.querySelector('.nf-live') && host.textContent === 'bound';
  host.remove();
  return out;
});

checks.noWarnings = warnings.length === 0;

// Strict CSP (style-src 'self'): the injected <style> is blocked, so the page must be
// able to load dist/style.css instead and turn injection off.
const csp = await browser.newPage();
csp.on('pageerror', (e) => errors.push('csp page: ' + e.message));
await csp.addInitScript(() => {
  window.__violations = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__violations.push(e.violatedDirective));
});
await csp.route('http://nf.test/**', (route) => {
  const path = new URL(route.request().url()).pathname, link = path === '/linked.html';
  if (path.endsWith('.html')) {
    return route.fulfill({
      contentType: 'text/html',
      headers: { 'Content-Security-Policy': "default-src 'self'; style-src 'self'" },
      body: (link ? '<link rel="stylesheet" href="/style.css">' : '') + '<script src="/noisefloor.iife.js"></script><span id="t">Label</span>'
    });
  }
  return route.fulfill({ path: join(root, 'dist', path.slice(1)) });
});
const cspCase = async (page, injectCSS) => {
  await csp.goto(`http://nf.test/${page}.html`);
  return csp.evaluate(async (inject) => {
    Noisefloor.configure({ injectCSS: inject });
    new Noisefloor.Scramble(document.getElementById('t'));
    await new Promise((r) => setTimeout(r, 50)); // violation events are dispatched in a later task
    const cell = document.querySelector('.nf-text-cell');
    return { styled: getComputedStyle(cell, '::before').visibility === 'hidden', violations: window.__violations.length };
  }, injectCSS);
};
const blocked = await cspCase('plain', true), linked = await cspCase('linked', false);
checks.cspBlocksInjection = !blocked.styled && blocked.violations > 0;
checks.cspStyleCss = linked.styled && linked.violations === 0;

// Attribute auto-init: dist/noisefloor.auto.iife.js loaded in <head>, so it starts on
// DOMContentLoaded and must then pick up the markup and later additions.
const auto = await browser.newPage();
auto.on('pageerror', (e) => errors.push('auto page: ' + e.message));
await auto.route('http://nf.test/**', (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/auto.html') {
    return route.fulfill({
      contentType: 'text/html',
      body: '<script src="/noisefloor.auto.iife.js"></script>' +
        '<a href="#" id="link"><span data-nf="scramble" data-nf-order="center" data-nf-duration="2" data-nf-ambient>Docs</span></a>' +
        '<img data-nf="glitch" data-nf-rgb-split="4" alt="">'
    });
  }
  return route.fulfill({ path: join(root, 'dist', path.slice(1)) });
});
await auto.goto('http://nf.test/auto.html');
Object.assign(checks, await auto.evaluate(async () => {
  const N = window.Noisefloor, key = Symbol.for('noisefloor.instance');
  const span = document.querySelector('[data-nf="scramble"]'), img = document.querySelector('img');
  const s = span[key], g = img[key];
  document.getElementById('link').dispatchEvent(new MouseEvent('mouseenter'));
  const later = document.body.appendChild(document.createElement('span'));
  later.textContent = 'later';
  later.setAttribute('data-nf', 'scramble');
  await new Promise((r) => setTimeout(r, 0));
  return {
    autoGlobal: !!(N && N.Scramble && N.auto && typeof N.auto.scan === 'function'),
    autoSetup: s instanceof N.Scramble && s.options.order === 'center' && g instanceof N.Glitch && g.options.rgbSplit === 4,
    autoHover: s.running,
    autoAmbient: N.auto.ambient().targets.length === 1 && N.auto.ambient().targets[0] === s,
    autoObserves: later[key] instanceof N.Scramble
  };
}));
// Playground: closed by default; every [data-pg-toggle] opens and closes it and says which.
// Wide screens: a side panel that pushes the page aside; settings apply and the image overlay
// follows the shift; Replay demo scrolls the demo into view before replaying. Narrow: the
// controls expand in the Playground section.
const wide = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
wide.on('pageerror', (e) => errors.push('wide: ' + e.message));
await wide.goto(url);
await wide.waitForTimeout(1500);
const labels = (p) => p.evaluate(() => [...document.querySelectorAll('[data-pg-toggle]')].map((b) => b.textContent + '|' + b.getAttribute('aria-expanded')));
checks.pgClosedByDefault = await wide.evaluate(() => document.getElementById('tune').hidden && document.getElementById('pg-body').hidden)
  && (await labels(wide)).every((l) => l === 'Open playground|false');
await wide.click('#demo [data-pg-toggle]');
Object.assign(checks, await wide.evaluate(async () => {
  const out = {};
  const tune = document.getElementById('tune'), wrap = document.querySelector('.wrap');
  out.pgPanelOpens = !tune.hidden && document.getElementById('controls').parentElement.id === 'tune-body'
    && document.getElementById('pg-body').hidden && document.activeElement.id === 'tune-close';
  out.pgPanelPushes = wrap.getBoundingClientRect().left >= tune.getBoundingClientRect().right;
  // a setting applies to the page: text scanlines off
  document.getElementById('t-scan').click();
  out.pgApplies = document.querySelector('.menu .nf-text').classList.contains('nf-noscan');
  document.getElementById('t-scan').click();
  // the image overlay is sized to the shifted image
  const img = document.getElementById('img-main');
  img.closest('.shot').dispatchEvent(new MouseEvent('mouseenter'));
  await new Promise((r) => setTimeout(r, 1200));
  const canvas = img.closest('.nf-img').querySelector('canvas.nf-img-canvas');
  const ics = getComputedStyle(img);
  const contentWidth = img.clientWidth - parseFloat(ics.paddingLeft) - parseFloat(ics.paddingRight);
  out.pgOverlaySized = Math.abs(parseFloat(canvas.style.width) - contentWidth) < 1;
  return out;
}));
checks.pgTogglesSay = (await labels(wide)).every((l) => l === 'Close playground|true');
// Replay demo from far down the page: scrolls back, then replays
await wide.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, document.getElementById('api').offsetTop); });
await wide.waitForTimeout(300);
await wide.click('#tune-replay');
await wide.waitForTimeout(400);
checks.pgReplayScrolls = await wide.evaluate(() => {
  const r = document.getElementById('stage').getBoundingClientRect();
  return r.top >= 0 && r.top < innerHeight && !!document.querySelector('#hero .nf-text.nf-live');
});
await wide.keyboard.press('Escape');
checks.pgEscCloses = await wide.evaluate(() => document.getElementById('tune').hidden
  && document.activeElement.matches('#demo [data-pg-toggle]') && getComputedStyle(document.body).paddingLeft === '0px');
// narrow (the 1100 px page): the section toggle expands the controls in place
const narrowClosed = await page.evaluate(() => document.getElementById('pg-body').hidden && document.getElementById('tune').hidden);
await page.click('#playground [data-pg-toggle]');
checks.pgNarrowInSection = narrowClosed && await page.evaluate(() => !document.getElementById('pg-body').hidden
  && document.getElementById('controls').parentElement.id === 'pg-body' && document.getElementById('tune').hidden);

await browser.close();
console.log(checks);
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
if (errors.length) console.error('page errors:', errors);
if (failed.length || errors.length) { console.error('FAILED:', failed.join(', ') || 'page errors'); process.exit(1); }
console.log('smoke OK');
