import { IMG_CSS, SCAN_CSS, injectCSS } from './css';
import { Finished, PALETTE, bindHover, burstArgs, clamp, disown, own, pick, reducedMotion, runLoop, sanitize, snapshot, spread, toList, unbind, warn } from './shared';
import type { BindOptions, BurstOptions, Burstable, GlitchOptions, Targets } from './types';

const DEFAULTS: Readonly<GlitchOptions> = Object.freeze({
  duration: 0.6,
  fps: 20,
  palette: PALETTE,
  rgbSplit: 6,
  slices: 10,
  tear: 24,
  blocks: 6,
  lines: 4,
  jitter: 2,
  flicker: 0.1,
  scanlines: true
});

const RANGES = {
  duration: [0, Infinity], fps: [1, Infinity], rgbSplit: [0, Infinity], slices: [0, Infinity], tear: [0, Infinity],
  blocks: [0, Infinity], lines: [0, Infinity], jitter: [0, Infinity], flicker: [0, 1]
} as const;

/**
 * Buffer resolution in canvas px per CSS px, independent of devicePixelRatio. A
 * glitch frame is on screen for a fraction of a second, so 1x is enough, and it
 * keeps the four W x H canvases at a quarter of their 2x DPR size.
 */
const BUFFER_SCALE = 1;
/** Idle time after which the buffers are released; rebuilt on the next play or burst. */
const RELEASE_MS = 30000;
/** How long the overlay keeps following the img's transform after finish(): its fade-out (CSS, 0.25 s) plus margin. */
const FADE_MS = 300;
/** Individual transform properties, applied before `transform` in this order. */
const TRANSFORMS = ['translate', 'rotate', 'scale'] as const;

function makeCanvas(doc: Document, w: number, h: number): HTMLCanvasElement {
  const c = doc.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/**
 * Offset of the drawn image along one axis for one computed object-position
 * component, such as `30%`, `12px` or `calc(100% - 10px)`. `free` is the
 * container size minus the drawn size; `scale` converts CSS px to buffer px.
 */
function positionOffset(pos: string, free: number, scale: number): number {
  const re = /([+-])?\s*(-?\d*\.?\d+(?:e[+-]?\d+)?)(%|px)/gi;
  let off = 0, any = false, m: RegExpExecArray | null;
  while ((m = re.exec(pos))) {
    const v = parseFloat(m[2] as string) * (m[1] === '-' ? -1 : 1);
    off += m[3] === '%' ? free * v / 100 : v * scale;
    any = true;
  }
  return any ? off : free / 2;
}

/** Splits a computed object-position into its horizontal and vertical components. */
function splitPosition(pos: string): [string, string] {
  const parts: string[] = [];
  let depth = 0, cur = '';
  for (const c of pos.trim()) {
    if (c === '(') depth++;
    else if (c === ')') depth--;
    if (c === ' ' && depth === 0) { if (cur) parts.push(cur); cur = ''; } else cur += c;
  }
  if (cur) parts.push(cur);
  return parts.length === 2 ? [parts[0] as string, parts[1] as string] : ['50%', '50%'];
}

/**
 * Radius of the content-edge curve for one corner: the computed outer radius
 * (`r` or `rx ry`, px or % of the border box) minus the border and padding on
 * that corner's two sides. Replaced content is clipped to this curve.
 */
function innerRadius(r: string, bw: number, bh: number, insetX: number, insetY: number): string {
  const [rx = '0', ry = rx] = r.split(' ');
  const len = (v: string, size: number): number => (v.endsWith('%') ? parseFloat(v) * size / 100 : parseFloat(v)) || 0;
  return Math.max(0, len(rx, bw) - insetX) + 'px ' + Math.max(0, len(ry, bh) - insetY) + 'px';
}

/**
 * Computed `translate` with percentages resolved against the img's reference
 * box (`w` x `h`), since the overlay box they would otherwise resolve against
 * differs when the img has borders or padding.
 */
function absTranslate(v: string, w: number, h: number): string {
  return v.split(' ').map((p, i) => (p.endsWith('%') && i < 2 ? parseFloat(p) * (i ? h : w) / 100 + 'px' : p)).join(' ');
}

function context(c: HTMLCanvasElement): CanvasRenderingContext2D {
  return c.getContext('2d') as CanvasRenderingContext2D;
}

/**
 * Canvas image glitch. The <img> stays in place (layout, alt text, clicks
 * untouched); a canvas laid exactly over it is shown only while glitching.
 * The R, G and B channels are pre-separated once with compositing
 * (multiply + destination-in) and recombined per frame with additive blending
 * at offsets. No pixel reads, so cross-origin images work without CORS.
 */
export class Glitch implements Burstable {
  static get defaults(): Readonly<GlitchOptions> { return DEFAULTS; }

  readonly img: HTMLImageElement;
  /** positioned wrapper holding the img, canvas and fx layer */
  readonly wrap: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  private readonly cfg: GlitchOptions;
  private isReady = false;
  /** pending rAF id; 0 when idle */
  private readonly loop = { raf: 0 };
  private readonly done = new Finished<this>(this);
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fx: HTMLElement;
  /** the element inside the wrapper: the img, or its <picture> */
  private readonly wrapped: Element;
  private readonly ownWrap: boolean;
  private readonly ro: ResizeObserver | undefined;
  /** pending coalesced resize; 0 when none */
  private resizeRaf = 0;
  /** pending transform-following rAF; 0 when idle */
  private followRaf = 0;
  /** performance.now() until which the overlay follows the img's transform after finish() */
  private fadeEnd = 0;
  /** last transform state written to the overlay, to skip identical writes */
  private tfKey = '';
  /** img border and padding (left, top) and border box size (width, height) */
  private box = [0, 0, 0, 0];
  /** ResizeObserver / load handler: at most one rebuild per animation frame */
  private readonly onResize = (): void => {
    if (this.resizeRaf) return;
    this.resizeRaf = requestAnimationFrame(() => { this.resizeRaf = 0; this.resize(); });
  };
  private releaseTimer: ReturnType<typeof setTimeout> | undefined;
  private palette: string[] = [];
  private W = 1;
  private H = 1;
  /** R, G, B channel buffers; empty until the first play or burst, and after release */
  private ch: HTMLCanvasElement[] = [];
  private gone = false;

  /** A second instance on the same img destroys the first and takes over. */
  constructor(img: HTMLImageElement, opts?: Partial<GlitchOptions>) {
    own(img, this);
    const doc = img.ownerDocument;
    injectCSS(img, [SCAN_CSS, IMG_CSS]);
    this.img = img;
    this.cfg = Object.assign({}, DEFAULTS);

    // Wrapper: reuse a parent marked [data-nf-wrap], otherwise insert one. An img
    // inside <picture> must stay its child to keep source selection, so the
    // <picture> is wrapped instead.
    const pic = img.parentElement && img.parentElement.tagName === 'PICTURE' ? img.parentElement : null;
    this.wrapped = pic || img;
    const p = this.wrapped.parentElement;
    if (p && p.hasAttribute('data-nf-wrap')) { this.wrap = p; this.ownWrap = false; }
    else {
      this.wrap = doc.createElement('span');
      const disp = getComputedStyle(img).display;
      this.wrap.style.display = (disp === 'inline' || disp === 'inline-block') ? 'inline-block' : 'block';
      (this.wrapped.parentNode as ParentNode & Node).insertBefore(this.wrap, this.wrapped);
      this.wrap.appendChild(this.wrapped);
      this.ownWrap = true;
    }
    this.wrap.classList.add('nf-img');

    this.canvas = makeCanvas(doc, 1, 1);
    this.canvas.className = 'nf-img-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = context(this.canvas);
    this.fx = doc.createElement('span');
    this.fx.className = 'nf-img-fx';
    this.fx.setAttribute('aria-hidden', 'true');
    const scan = doc.createElement('span');
    scan.className = 'nf-scan';
    this.fx.appendChild(scan);
    this.wrap.appendChild(this.canvas);
    this.wrap.appendChild(this.fx);

    if (typeof ResizeObserver === 'function') {
      this.ro = new ResizeObserver(this.onResize);
      this.ro.observe(img);
    }
    img.addEventListener('load', this.onResize);
    this.set(opts);
    this.resize();
  }

  /** Update options; safe while playing. No-op after destroy(). */
  set(opts?: Partial<GlitchOptions>): this {
    if (this.gone) return this;
    Object.assign(this.cfg, opts);
    sanitize('Glitch', this.cfg, DEFAULTS, RANGES, opts);
    if (!__NF_IIFE__) try { if (process.env.NODE_ENV !== 'production' && !(this.cfg.palette && this.cfg.palette.length)) warn('Glitch.palette', 'Glitch: palette is empty; using the default palette'); } catch { /* no process global */ }
    this.palette = this.cfg.palette && this.cfg.palette.length ? this.cfg.palette.slice() : PALETTE.slice();
    this.cfg.palette = Object.freeze(this.palette.slice());
    this.wrap.classList.toggle('nf-noscan', !this.cfg.scanlines);
    return this;
  }

  /**
   * Re-measure and position the overlay. Called automatically on resize/load.
   * Buffers are rebuilt now if an animation is running, otherwise released and
   * rebuilt lazily.
   */
  private resize(): void {
    const img = this.img, cs = getComputedStyle(img);
    // Content box: the img's border box minus borders and padding.
    const px = (v: string): number => parseFloat(v) || 0;
    const l = px(cs.borderLeftWidth) + px(cs.paddingLeft), r = px(cs.borderRightWidth) + px(cs.paddingRight);
    const t = px(cs.borderTopWidth) + px(cs.paddingTop), b = px(cs.borderBottomWidth) + px(cs.paddingBottom);
    const ow = img.offsetWidth, oh = img.offsetHeight, w = ow - l - r, h = oh - t - b;
    this.isReady = !!(img.complete && img.naturalWidth && w && h);
    if (!this.isReady) return;
    this.W = Math.max(1, Math.round(w * BUFFER_SCALE));
    this.H = Math.max(1, Math.round(h * BUFFER_SCALE));

    // Offset from the wrapper, through a positioned <picture> if there is one.
    let x = img.offsetLeft, y = img.offsetTop;
    for (let op = img.offsetParent as HTMLElement | null; op && op !== this.wrap; op = op.offsetParent as HTMLElement | null) {
      x += op.offsetLeft + op.clientLeft; y += op.offsetTop + op.clientTop;
    }
    const box = {
      left: x + l + 'px', top: y + t + 'px', width: w + 'px', height: h + 'px',
      borderTopLeftRadius: innerRadius(cs.borderTopLeftRadius, ow, oh, l, t),
      borderTopRightRadius: innerRadius(cs.borderTopRightRadius, ow, oh, r, t),
      borderBottomRightRadius: innerRadius(cs.borderBottomRightRadius, ow, oh, r, b),
      borderBottomLeftRadius: innerRadius(cs.borderBottomLeftRadius, ow, oh, l, b)
    };
    Object.assign(this.canvas.style, box);
    Object.assign(this.fx.style, box);
    this.box = [l, t, ow, oh];
    this.syncTransform(cs);
    if (this.running) this.build(); else this.release();
  }

  /**
   * Mirror the img's transforms onto the overlay, which is positioned from
   * offset* and so ignores them. transform-origin and `translate` percentages
   * are relative to the img's border box; the overlay is the content box, so the
   * origin shifts by the border and padding and percentages are resolved here.
   * A non-default transform-box is not supported: browsers report the origin
   * against the border box even when it renders against another box.
   */
  private syncTransform(cs = getComputedStyle(this.img)): void {
    const [l, t, ow, oh] = this.box as [number, number, number, number];
    const [ox = 0, oy = 0, oz = 0] = cs.transformOrigin.split(' ').map(parseFloat);
    const origin = (ox - l) + 'px ' + (oy - t) + 'px ' + oz + 'px';
    const tf = cs.transform !== 'none' ? cs.transform : '';
    const parts = TRANSFORMS.map((p) => {
      const v = cs.getPropertyValue(p);
      return !v || v === 'none' ? '' : p === 'translate' ? absTranslate(v, ow, oh) : v;
    });
    const key = origin + '|' + tf + '|' + parts.join('|');
    if (key === this.tfKey) return;
    this.tfKey = key;
    for (const el of [this.canvas, this.fx]) {
      const s = el.style;
      s.transformOrigin = origin;
      if (tf) s.setProperty('--nf-img-tf', tf); else s.removeProperty('--nf-img-tf');
      TRANSFORMS.forEach((p, i) => { if (parts[i]) s.setProperty(p, parts[i] as string); else s.removeProperty(p); });
    }
  }

  /**
   * Re-read the img's transforms every animation frame while the overlay is
   * visible (live or fading out), so transitions such as a hover zoom stay aligned.
   */
  private follow(): void {
    if (this.followRaf) return;
    const tick = (now: number): void => {
      this.syncTransform();
      this.followRaf = this.running || now < this.fadeEnd ? requestAnimationFrame(tick) : 0;
    };
    this.followRaf = requestAnimationFrame(tick);
  }

  /** Size the visible canvas and build the base frame and the R, G, B channel buffers. */
  private build(): void {
    const img = this.img, doc = img.ownerDocument, cs = getComputedStyle(img), W = this.W, H = this.H, k = BUFFER_SCALE;
    this.canvas.width = W; this.canvas.height = H;

    // Base frame, honouring object-fit and object-position.
    const base = makeCanvas(doc, W, H), bx = context(base);
    const fit = cs.objectFit, iw = img.naturalWidth, ih = img.naturalHeight;
    if (fit === 'cover' || fit === 'contain' || fit === 'scale-down' || fit === 'none') {
      let s = fit === 'cover' ? Math.max(W / iw, H / ih) : fit === 'none' ? k : Math.min(W / iw, H / ih);
      if (fit === 'scale-down') s = Math.min(s, k);
      const dw = iw * s, dh = ih * s, [px, py] = splitPosition(cs.objectPosition);
      bx.drawImage(img, positionOffset(px, W - dw, k), positionOffset(py, H - dh, k), dw, dh);
    } else {
      bx.drawImage(img, 0, 0, W, H);
    }
    this.ch = ['#f00', '#0f0', '#00f'].map((col) => {
      const c = makeCanvas(doc, W, H), x = context(c);
      x.drawImage(base, 0, 0);
      x.globalCompositeOperation = 'multiply';
      x.fillStyle = col;
      x.fillRect(0, 0, W, H);
      x.globalCompositeOperation = 'destination-in';
      x.drawImage(base, 0, 0);
      return c;
    });
  }

  /** Free the channel buffers and shrink the visible canvas. */
  private release(): void {
    clearTimeout(this.releaseTimer);
    this.ch = [];
    this.canvas.width = this.canvas.height = 1;
  }

  /** Current options, validated; a frozen copy. Change them with set(). */
  get options(): Readonly<GlitchOptions> { return snapshot(this.cfg); }
  /** True once the image is loaded and measured. */
  get ready(): boolean { return this.isReady; }
  /** True while an animation (play or burst) is running. */
  get running(): boolean { return this.loop.raf !== 0; }
  /** True after destroy(); play, burst, set and finish are then no-ops. */
  get destroyed(): boolean { return this.gone; }
  /**
   * Resolves with the instance when the current animation ends (naturally,
   * through finish() or destroy()); already resolved when idle. Never rejects.
   */
  get finished(): Promise<this> { return this.done.promise; }

  /** Full glitch. */
  play(): this { return this.gone ? this : this.run(Math.max(0.05, this.cfg.duration), 1, 1); }

  /**
   * Micro-glitch. Ignored while an animation is running.
   *   amount     0..1 how much of the frame is disturbed   default 0.2
   *   duration   s                                         default 0.15
   *   intensity  0..1 artefact strength                    default 0.5
   */
  burst(opts?: BurstOptions): this {
    if (this.running || this.gone) return this;
    const opt = burstArgs(opts);
    const amount = opt.amount != null ? opt.amount : (opt.count != null ? clamp(opt.count / 10, 0.05, 1) : 0.2);
    return this.run(Math.max(0.03, opt.duration || 0.15), opt.intensity != null ? opt.intensity : 0.5, amount);
  }

  private run(D: number, intensity: number, amount: number): this {
    if (reducedMotion()) { this.finish(); return this; }
    if (!this.isReady) this.resize();
    if (!this.isReady) return this;
    clearTimeout(this.releaseTimer);
    if (!this.ch.length) this.build();
    this.syncTransform();
    this.done.start();
    this.wrap.classList.add('nf-live');
    runLoop(this.loop, D, this.cfg.fps, (t) => {
      const p = t / D, k = (1 - p * p) * intensity; // holds strong, then collapses
      this.frame(Math.max(0, k), amount);
    }, () => { this.finish(); });
    this.follow();
    return this;
  }

  private frame(k: number, amt: number): void {
    const o = this.cfg, ctx = this.ctx, W = this.W, H = this.H, d = BUFFER_SCALE, cv = this.canvas, r = Math.random;
    const [cr, cg, cb] = this.ch as [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement];
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);

    // 1. channel split: additive recombination at offsets
    const s = o.rgbSplit * d * k * (0.5 + r());
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(cr, -s, spread(o.rgbSplit * 0.3 * d * k));
    ctx.drawImage(cg, 0, 0);
    ctx.drawImage(cb, s, spread(o.rgbSplit * 0.3 * d * k));
    ctx.globalCompositeOperation = 'source-over';

    // 2. slice tear: horizontal bands displaced sideways
    const n = Math.round(o.slices * amt * (0.4 + 0.6 * r()));
    for (let i = 0; i < n; i++) {
      const y = r() * H, bh = H * (0.006 + r() * 0.06 * Math.max(0.3, amt));
      const dx = spread(o.tear * d) * Math.max(0.3, k);
      ctx.drawImage(cv, 0, y, W, bh, dx, y, W, bh);
    }

    // 3. block moves: rectangles copied out of place, sometimes a single channel
    const m = Math.round(o.blocks * amt * r());
    for (let j = 0; j < m; j++) {
      const bw = W * (0.03 + r() * 0.14), bhh = H * (0.02 + r() * 0.07);
      const sx = r() * (W - bw), sy = r() * (H - bhh);
      const src = r() < 0.5 ? cv : pick(this.ch);
      if (src !== cv) ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(src, sx, sy, bw, bhh, sx + spread(W * 0.06), sy + spread(H * 0.015), bw, bhh);
      ctx.globalCompositeOperation = 'source-over';
    }

    // 4. palette lines and an occasional tinted band
    ctx.globalCompositeOperation = 'screen';
    const nl = Math.round(o.lines * Math.max(0.4, amt));
    for (let q = 0; q < nl; q++) {
      ctx.fillStyle = pick(this.palette);
      ctx.globalAlpha = (0.3 + 0.7 * r()) * Math.max(0.3, k);
      ctx.fillRect(r() * W * 0.6, r() * H, W * (0.08 + r() * 0.5), (r() < 0.2 ? 2 : 1) * d);
    }
    if (r() < 0.35 * k) {
      ctx.fillStyle = pick(this.palette);
      ctx.globalAlpha = 0.12 + 0.12 * r();
      ctx.fillRect(0, r() * H, W, H * (0.02 + r() * 0.08));
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // 5. frame shake + flicker (CSS, compositor only)
    const ws = this.wrap.style;
    ws.setProperty('--nf-img-dy', spread(o.jitter * k).toFixed(1) + 'px');
    ws.setProperty('--nf-img-dx', (r() < 0.2 * k ? spread(o.jitter * 1.5) : 0).toFixed(1) + 'px');
    ws.setProperty('--nf-img-op', r() < o.flicker ? '0.75' : '1');
  }

  /** Jump to the resting state; the canvas fades out over the clean <img>. */
  finish(): this {
    if (this.gone) return this;
    cancelAnimationFrame(this.loop.raf);
    this.loop.raf = 0;
    this.done.end();
    this.wrap.classList.remove('nf-live');
    this.wrap.style.setProperty('--nf-img-dx', '0px');
    this.wrap.style.setProperty('--nf-img-dy', '0px');
    this.fadeEnd = performance.now() + FADE_MS;
    clearTimeout(this.releaseTimer);
    this.releaseTimer = setTimeout(() => { this.release(); }, RELEASE_MS);
    return this;
  }

  /** Remove the overlay, listeners added by bind() and, if it was inserted, the wrapper. Idempotent. */
  destroy(): void {
    if (this.gone) return;
    this.finish();
    this.gone = true;
    unbind(this);
    disown(this.img, this);
    cancelAnimationFrame(this.resizeRaf);
    cancelAnimationFrame(this.followRaf);
    this.release();
    if (this.ro) this.ro.disconnect();
    this.img.removeEventListener('load', this.onResize);
    this.canvas.remove();
    this.fx.remove();
    this.wrap.classList.remove('nf-img', 'nf-noscan', 'nf-live');
    if (this.ownWrap) { (this.wrap.parentNode as ParentNode & Node).insertBefore(this.wrapped, this.wrap); this.wrap.remove(); }
  }

  /** Wrap every match; play on hover/focus (or `trigger`) of its closest link or button, else its parent. */
  static bind(targets: Targets<HTMLImageElement>, opts?: Partial<GlitchOptions>, bindOpts?: BindOptions<HTMLImageElement>): Glitch[] {
    const b = Object.assign({ trigger: 'mouseenter', host: (img: HTMLImageElement): Element => img.closest('a,button') || img.parentElement as Element }, bindOpts);
    const list = toList(targets).map((img) => new Glitch(img, opts));
    return bindHover(list, b.trigger, (inst) => b.host(inst.img), !!b.once);
  }
}
