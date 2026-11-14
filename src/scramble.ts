import { SCAN_CSS, TEXT_CSS, injectCSS } from './css';
import { Finished, PALETTE, bindHover, burstArgs, disown, graphemes, own, pick, reducedMotion, runLoop, sample, sanitize, snapshot, spread, toList, unbind, warn } from './shared';
import type { BindOptions, BurstOptions, Burstable, PlayOptions, ScrambleOptions, Targets } from './types';

const DEFAULTS: Readonly<ScrambleOptions> = Object.freeze({
  duration: 0.7,
  fps: 24,
  settle: 0.35,
  order: 'ltr',
  reveal: 'all',
  trail: 0.15,
  speed: 0,
  cursor: false,
  chars: '01#%=$>≤<',
  palette: PALETTE,
  jitter: 1.5,
  skew: 8,
  rgbSplit: 1.5,
  glow: 6,
  flicker: 0.12,
  lines: 3,
  tear: 2,
  scanlines: true
});

const RANGES = {
  duration: [0, Infinity], fps: [1, Infinity], settle: [0, Infinity], trail: [0, Infinity], speed: [0, Infinity], jitter: [0, Infinity], skew: [0, Infinity],
  rgbSplit: [0, Infinity], glow: [0, Infinity], flicker: [0, 1], lines: [0, 8], tear: [0, Infinity]
} as const;
const ORDERS = ['ltr', 'rtl', 'center', 'random'];
const REVEALS = ['all', 'type'];

/** Whitespace-collapsed label text. */
const label = (s: string): string => s.replace(/\s+/g, ' ').trim();

interface Cell {
  /** the real character */
  ch: string;
  /** animated glyph element */
  g: HTMLElement;
  /** its text node; written in place each frame, so no child nodes are added or removed */
  t: Text;
  /** s, appear time within the current run (typing); 0 otherwise */
  show: number;
  /** s, lock time within the current run */
  at: number;
  done: boolean;
  space: boolean;
}

/**
 * Per-character text scramble. Each character is a cell sized by an invisible
 * copy of the real glyph (::before); the animated glyph is absolutely
 * positioned inside it, so nothing the animation writes can change layout.
 */
export class Scramble implements Burstable {
  static get defaults(): Readonly<ScrambleOptions> { return DEFAULTS; }

  readonly el: HTMLElement;
  private readonly cfg: ScrambleOptions;
  /** pending rAF id; 0 when idle */
  private readonly loop = { raf: 0 };
  private readonly done = new Finished<this>(this);
  /** the label, whitespace-collapsed */
  private label: string;
  private readonly sr: HTMLElement;
  private readonly row: HTMLElement;
  private cells: Cell[] = [];
  /** cell showing the typing caret, if any */
  private caretAt: HTMLElement | null = null;
  private lineEls: HTMLElement[] = [];
  private glyphs: string[] = [];
  private palette: string[] = [];
  private gone = false;

  /** A second instance on the same element destroys the first and takes over. */
  constructor(el: HTMLElement, opts?: Partial<ScrambleOptions>) {
    own(el, this);
    injectCSS(el, [SCAN_CSS, TEXT_CSS]);
    if (!__NF_IIFE__) {
      try {
        if (process.env.NODE_ENV !== 'production' && el.children.length && !el.hasAttribute('data-text')) {
          warn('Scramble.markup', 'Scramble: the element has child elements; they are replaced by its plain text. Wrap only the text, e.g. <a><span class="label">Docs</span></a>');
        }
      } catch { /* no process global */ }
    }
    this.el = el;
    this.label = label(el.getAttribute('data-text') || el.textContent || '');
    this.cfg = Object.assign({}, DEFAULTS);
    const doc = el.ownerDocument;
    this.sr = doc.createElement('span');
    this.sr.className = 'nf-text-sr';
    this.row = doc.createElement('span');
    this.row.className = 'nf-text-row';
    this.row.setAttribute('aria-hidden', 'true');
    this.build();
    this.set(opts);
  }

  /** The label, whitespace-collapsed; changed by play({ text }). */
  get text(): string { return this.label; }

  private build(): void {
    const el = this.el, doc = el.ownerDocument;
    el.textContent = '';
    el.classList.add('nf-text');
    this.fill();
    const fx = doc.createElement('span');
    fx.className = 'nf-text-fx';
    fx.setAttribute('aria-hidden', 'true');
    const scan = doc.createElement('span');
    scan.className = 'nf-scan';
    fx.appendChild(scan);
    this.lineEls = [];
    for (let i = 0; i < 8; i++) {
      const l = doc.createElement('i');
      fx.appendChild(l);
      this.lineEls.push(l);
    }
    el.appendChild(this.sr);
    el.appendChild(this.row);
    el.appendChild(fx);
  }

  /** (Re)build the hidden label and one cell per character of the current label. */
  private fill(): void {
    const doc = this.el.ownerDocument;
    this.sr.textContent = this.label;
    this.row.textContent = '';
    this.cells = graphemes(this.label).map((ch) => {
      const c = doc.createElement('span');
      c.className = 'nf-text-cell';
      c.setAttribute('data-c', ch);
      const g = doc.createElement('span');
      g.className = 'nf-text-glyph';
      const t = g.appendChild(doc.createTextNode(ch));
      c.appendChild(g);
      this.row.appendChild(c);
      return { ch, g, t, show: 0, at: 0, done: true, space: /\s/.test(ch) };
    });
  }

  /** Update options; safe while playing. No-op after destroy(). */
  set(opts?: Partial<ScrambleOptions>): this {
    if (this.gone) return this;
    Object.assign(this.cfg, opts);
    const o = this.cfg, st = this.el.style;
    sanitize('Scramble', o, DEFAULTS, RANGES, opts);
    if (ORDERS.indexOf(o.order) < 0) {
      if (!__NF_IIFE__) try { if (process.env.NODE_ENV !== 'production') warn('Scramble.order', `Scramble: order must be one of ${ORDERS.join(', ')}, got ${JSON.stringify(o.order)}; using ltr`); } catch { /* no process global */ }
      o.order = 'ltr';
    }
    if (REVEALS.indexOf(o.reveal) < 0) {
      if (!__NF_IIFE__) try { if (process.env.NODE_ENV !== 'production') warn('Scramble.reveal', `Scramble: reveal must be one of ${REVEALS.join(', ')}, got ${JSON.stringify(o.reveal)}; using all`); } catch { /* no process global */ }
      o.reveal = 'all';
    }
    this.glyphs = graphemes(o.chars || '');
    if (!this.glyphs.length) {
      if (!__NF_IIFE__) try { if (process.env.NODE_ENV !== 'production') warn('Scramble.chars', 'Scramble: chars is empty; using "01"'); } catch { /* no process global */ }
      this.glyphs = ['0', '1'];
      o.chars = '01';
    }
    if (!__NF_IIFE__) try { if (process.env.NODE_ENV !== 'production' && !(o.palette && o.palette.length)) warn('Scramble.palette', 'Scramble: palette is empty; using the default palette'); } catch { /* no process global */ }
    this.palette = o.palette && o.palette.length ? o.palette.slice() : PALETTE.slice();
    o.palette = Object.freeze(this.palette.slice());
    st.setProperty('--nf-rgb-a', this.palette[0] as string);
    st.setProperty('--nf-rgb-b', this.palette[1 % this.palette.length] as string);
    st.setProperty('--nf-settle', o.settle + 's');
    st.setProperty('--nf-cglow', o.glow + 'px');
    this.el.classList.toggle('nf-noscan', !o.scanlines);
    this.el.classList.toggle('nf-caret-left', o.order === 'rtl');
    return this;
  }

  /** Lock rank per cell in [0, 1]: 0 locks first. */
  private ranks(): number[] {
    const n = this.cells.length, mode = this.cfg.order, r: number[] = [], m = Math.max(1, n - 1);
    for (let i = 0; i < n; i++) {
      if (mode === 'rtl') r[i] = (n - 1 - i) / m;
      else if (mode === 'center') r[i] = Math.abs(i - m / 2) / Math.max(0.5, m / 2);
      else if (mode === 'random') r[i] = Math.random();
      else r[i] = i / m;
    }
    return r;
  }

  /** Current options, validated; a frozen copy. Change them with set(). */
  get options(): Readonly<ScrambleOptions> { return snapshot(this.cfg); }
  /** True while an animation (play or burst) is running. */
  get running(): boolean { return this.loop.raf !== 0; }
  /** True after destroy(); play, burst, set and finish are then no-ops. */
  get destroyed(): boolean { return this.gone; }
  /**
   * Resolves with the instance when the current animation ends (naturally,
   * through finish() or destroy()); already resolved when idle. Never rejects.
   */
  get finished(): Promise<this> { return this.done.promise; }

  /**
   * Full scramble: every character scrambles, then locks in `order`; with
   * `reveal: 'type'` characters instead appear one by one in `order`, each
   * scrambling for `trail` before it locks (cells keep the full width);
   * `speed` > 0 types at that many characters per second instead of fitting
   * the text into `duration`. With
   * `text`, the label changes: cells are rebuilt from the new text when the
   * transition starts (the width changes once, then nothing moves) and the
   * accessible label updates at once.
   */
  play(opts?: PlayOptions): this {
    if (this.gone) return this;
    const next = opts && opts.text != null ? label(String(opts.text)) : this.label;
    if (next !== this.label) {
      this.label = next;
      if (this.el.hasAttribute('data-text')) this.el.setAttribute('data-text', next);
      this.fill();
    }
    const typing = this.cfg.reveal === 'type', r = this.ranks(), o = this.cfg;
    // speed: one character every 1/speed s, so the run lasts as long as the text needs
    const paced = typing && o.speed > 0 && this.cells.length > 0;
    const D = paced ? Math.max(0.05, (this.cells.length - 1) / o.speed + o.trail) : Math.max(0.05, o.duration);
    if (typing) {
      const trail = Math.min(o.trail, D), span = D - trail;
      this.cells.forEach((c, i) => {
        c.show = span * (r[i] as number);
        c.at = c.space ? c.show : c.show + trail;
        c.done = false;
        c.t.data = ''; // hidden until it appears; the cell keeps its width
      });
    } else {
      this.cells.forEach((c, i) => {
        c.show = 0;
        c.at = c.space ? 0 : D * (0.25 + 0.75 * (r[i] as number));
        c.done = c.space;
      });
    }
    return this.run(D, 1, typing);
  }

  /**
   * Micro-glitch on part of the label. Ignored while an animation is running.
   *   amount     0..1 share of characters (at least one)   default 0.2
   *   count      exact number of characters (overrides amount)
   *   duration   s                                         default 0.18
   *   intensity  0..1 artefact strength                    default 0.5
   */
  burst(opts?: BurstOptions): this {
    if (this.running || this.gone) return this;
    const opt = burstArgs(opts);
    const cand = this.cells.filter((c) => !c.space);
    if (!cand.length) return this;
    const k = opt.count != null ? opt.count
      : Math.max(1, Math.round((opt.amount != null ? opt.amount : 0.2) * cand.length));
    const D = Math.max(0.03, opt.duration || 0.18);
    this.cells.forEach((c) => { c.done = true; c.show = 0; });
    sample(cand, k).forEach((c) => {
      c.at = D * (0.4 + 0.6 * Math.random());
      c.done = false;
    });
    return this.run(D, opt.intensity != null ? opt.intensity : 0.5);
  }

  private run(D: number, intensity: number, typing = false): this {
    const o = this.cfg, cells = this.cells, caret = o.cursor && typing;
    if (reducedMotion()) { this.finish(); return this; }
    this.done.start();
    this.el.classList.add('nf-live');
    runLoop(this.loop, D, o.fps, (t) => {
      const k = Math.max(0, 1 - t / D) * intensity;
      let head: Cell | null = null;
      for (const c of cells) {
        if (t >= c.show && (!head || c.show >= head.show)) head = c;
        if (c.done || t < c.show) continue;
        if (t < c.at) this.scrambleCell(c, Math.max(0.35, intensity));
        else this.lockCell(c);
      }
      if (caret) this.moveCaret(head, o.jitter);
      this.el.style.setProperty('--nf-tx', Math.random() < 0.3 * k ? spread(o.tear).toFixed(1) + 'px' : '0px');
      this.drawLines(k);
    }, () => { this.finish(); });
    return this;
  }

  /** Block caret on the most recently appeared cell, after it (before it for rtl). */
  private moveCaret(head: Cell | null, jitter: number): void {
    const cell = head ? head.g.parentElement : null;
    if (this.caretAt !== cell) {
      if (this.caretAt) this.caretAt.classList.remove('nf-head');
      if (cell) cell.classList.add('nf-head');
      this.caretAt = cell;
    }
    this.el.style.setProperty('--nf-cy', spread(jitter * 0.5).toFixed(2) + 'px');
  }

  private scrambleCell(c: Cell, s: number): void {
    const o = this.cfg, st = c.g.style;
    c.g.classList.remove('nf-lock');
    c.t.data = pick(this.glyphs);
    st.color = pick(this.palette);
    st.setProperty('--nf-dy', spread(o.jitter * s).toFixed(2) + 'px');
    st.setProperty('--nf-sk', spread(o.skew * s).toFixed(1) + 'deg');
    st.setProperty('--nf-op', Math.random() < o.flicker ? '0.3' : '1');
    st.setProperty('--nf-rgb', (o.rgbSplit * s * (0.4 + Math.random() * 0.8)).toFixed(2) + 'px');
    st.setProperty('--nf-glow', (o.glow * s).toFixed(1) + 'px');
  }

  private lockCell(c: Cell): void {
    const st = c.g.style;
    c.done = true;
    c.t.data = c.ch;
    c.g.classList.add('nf-lock'); // CSS transitions decay from the last scramble state
    st.color = '';
    st.setProperty('--nf-dy', '0px');
    st.setProperty('--nf-sk', '0deg');
    st.setProperty('--nf-op', '1');
    st.setProperty('--nf-rgb', '0px');
    st.setProperty('--nf-glow', '0px');
  }

  private drawLines(k: number): void {
    const n = this.cfg.lines | 0;
    this.lineEls.forEach((l, i) => {
      const s = l.style;
      if (i >= n || k <= 0 || Math.random() > 0.35 + 0.65 * k) { s.setProperty('--nf-lo', '0'); return; }
      s.setProperty('--nf-ly', (Math.random() * 100).toFixed(1) + '%');
      s.setProperty('--nf-lx', (Math.random() * 70).toFixed(1) + '%');
      s.setProperty('--nf-lw', (8 + Math.random() * 50).toFixed(1) + '%');
      s.setProperty('--nf-lh', Math.random() < 0.2 ? '2px' : '1px');
      s.setProperty('--nf-lc', pick(this.palette));
      s.setProperty('--nf-lo', ((0.3 + 0.7 * Math.random()) * Math.max(0.25, k)).toFixed(2));
    });
  }

  /** Jump to the resting state. */
  finish(): this {
    if (this.gone) return this;
    cancelAnimationFrame(this.loop.raf);
    this.loop.raf = 0;
    this.done.end();
    for (const c of this.cells) if (!c.done) this.lockCell(c);
    this.moveCaret(null, 0);
    this.el.style.setProperty('--nf-tx', '0px');
    this.drawLines(0);
    this.el.classList.remove('nf-live');
    return this;
  }

  /** Restore the original plain text and remove listeners added by bind(). Idempotent. */
  destroy(): void {
    if (this.gone) return;
    this.finish();
    this.gone = true;
    unbind(this);
    disown(this.el, this);
    this.el.textContent = this.label;
    this.el.classList.remove('nf-text', 'nf-noscan', 'nf-caret-left');
    ['--nf-rgb-a', '--nf-rgb-b', '--nf-settle', '--nf-tx', '--nf-cglow', '--nf-cy'].forEach((p) => { this.el.style.removeProperty(p); });
  }

  /** Wrap every match; play on hover/focus (or `trigger`) of its closest link or button. */
  static bind(targets: Targets<HTMLElement>, opts?: Partial<ScrambleOptions>, bindOpts?: BindOptions<HTMLElement>): Scramble[] {
    const b = Object.assign({ trigger: 'mouseenter', host: (el: HTMLElement): Element => el.closest('a,button') || el }, bindOpts);
    const list = toList(targets).map((el) => new Scramble(el, opts));
    return bindHover(list, b.trigger, (inst) => b.host(inst.el), !!b.once);
  }
}
