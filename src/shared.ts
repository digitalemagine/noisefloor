import type { BurstOptions, Targets } from './types';

export const PALETTE: readonly string[] = Object.freeze(['#ff2bd6', '#00f0ff', '#f5ff3b']);

/** Random element of a non-empty array. */
export function pick<T>(a: readonly T[]): T {
  return a[Math.floor(Math.random() * a.length)] as T;
}
/** Uniform in [-v, v). */
export function spread(v: number): number {
  return (Math.random() * 2 - 1) * v;
}
export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}
export function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function toList<T>(targets: Targets<T>, doc?: Document): T[] {
  if (typeof targets === 'string') return Array.prototype.slice.call((doc || document).querySelectorAll(targets));
  if (targets && (targets as ArrayLike<T>).length != null) return Array.prototype.slice.call(targets);
  return targets ? [targets as T] : [];
}

let segmenter: { segment(s: string): Iterable<{ segment: string }> } | null | undefined;

/**
 * User-perceived characters (grapheme clusters): a letter with combining marks
 * or an emoji with modifiers is one item. Falls back to code points without
 * Intl.Segmenter.
 */
export function graphemes(s: string): string[] {
  if (segmenter === undefined) {
    // Intl.Segmenter is ES2022; lib is ES2020.
    const I = Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => NonNullable<typeof segmenter> };
    segmenter = typeof Intl === 'object' && I.Segmenter ? new I.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  }
  return segmenter ? Array.from(segmenter.segment(s), (x) => x.segment) : Array.from(s);
}

/** k distinct items. */
export function sample<T>(arr: readonly T[], k: number): T[] {
  const a = arr.slice(), n = Math.min(k, a.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (a.length - i));
    const t = a[i] as T; a[i] = a[j] as T; a[j] = t;
  }
  return a.slice(0, n);
}

const warned = new Set<string>();

/** Test hook: forget which warnings were shown. Not exported from the package. */
export function resetWarnings(): void { warned.clear(); }

/**
 * console.warn once per key. Call only as
 * `if (!__NF_IIFE__) try { if (process.env.NODE_ENV !== 'production' && ...) warn(...) } catch {}`:
 * the IIFE build constant and a bundler's NODE_ENV replacement each fold the branch
 * to false so the minifier drops the call and its message; the try keeps an
 * unbundled import (no `process` global) from throwing.
 */
export function warn(key: string, msg: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn('[noisefloor] ' + msg);
}

/** Inclusive [min, max] per numeric option. */
export type Ranges<T> = { [K in keyof T]?: readonly [number, number] };

/**
 * Validates options in place: numeric options outside their range are clamped,
 * non-numbers fall back to the default. In development builds, warns about
 * each correction and about unknown keys in `given`.
 */
export function sanitize<T extends object>(name: string, o: T, defaults: Readonly<T>, ranges: Ranges<T>, given?: object | null): void {
  if (!__NF_IIFE__) try { if (process.env.NODE_ENV !== 'production' && given) for (const k of Object.keys(given)) if (!(k in defaults)) warn(name + '.' + k, `${name}: unknown option "${k}"`); } catch { /* no process global */ }
  for (const k of Object.keys(ranges) as Array<keyof T & string>) {
    const [min, max] = ranges[k] as readonly [number, number], v: unknown = o[k];
    if (typeof v !== 'number' || v !== v) {
      o[k] = defaults[k];
      if (!__NF_IIFE__) try { if (process.env.NODE_ENV !== 'production') warn(name + '.' + k, `${name}: ${k} must be a number, got ${JSON.stringify(v)}; using ${String(defaults[k])}`); } catch { /* no process global */ }
    } else if (v < min || v > max) {
      o[k] = clamp(v, min, max) as T[typeof k];
      if (!__NF_IIFE__) try { if (process.env.NODE_ENV !== 'production') warn(name + '.' + k, `${name}: ${k} ${v} is outside [${min}, ${max}]; using ${String(o[k])}`); } catch { /* no process global */ }
    }
  }
}

/**
 * Read-only snapshot of an instance's options for the public `options` getter.
 * Writes would bypass validation, so the copy is frozen (set() stores palettes
 * as frozen copies); change options with set().
 */
export function snapshot<T extends object>(o: T): Readonly<T> {
  return Object.freeze(Object.assign({}, o));
}

const BURST_RANGES: Ranges<Required<BurstOptions>> = { amount: [0, 1], count: [0, Infinity], duration: [0, Infinity], intensity: [0, 1] };

/** Normalise burst({ amount, count, duration, intensity }). Invalid values are dropped (default applies) or clamped; a non-object argument is ignored. */
export function burstArgs(a?: BurstOptions): BurstOptions {
  if (!__NF_IIFE__) try { if (process.env.NODE_ENV !== 'production' && a != null && typeof a !== 'object') warn('burst.args', `burst: expected an options object such as { count, duration }, got ${JSON.stringify(a)}; using the defaults`); } catch { /* no process global */ }
  const o: BurstOptions = Object.assign({}, typeof a === 'object' ? a : null);
  for (const k of Object.keys(BURST_RANGES) as Array<keyof BurstOptions>) {
    const v: unknown = o[k];
    if (v == null) continue;
    const [min, max] = BURST_RANGES[k] as readonly [number, number];
    if (typeof v !== 'number' || v !== v) {
      delete o[k];
      if (!__NF_IIFE__) try { if (process.env.NODE_ENV !== 'production') warn('burst.' + k, `burst: ${k} must be a number, got ${JSON.stringify(v)}; using the default`); } catch { /* no process global */ }
    } else if (v < min || v > max) {
      o[k] = clamp(v, min, max);
      if (!__NF_IIFE__) try { if (process.env.NODE_ENV !== 'production') warn('burst.' + k, `burst: ${k} ${v} is outside [${min}, ${max}]; using ${o[k]}`); } catch { /* no process global */ }
    }
  }
  return o;
}

/**
 * Backs the WAAPI-style `finished` getter: a new pending promise when an
 * animation starts (kept if one is already pending, as when play() restarts),
 * resolved with the instance when it ends. Never rejects: destroy() resolves it.
 */
export class Finished<T> {
  promise: Promise<T>;
  private readonly value: T;
  private resolve: ((v: T) => void) | null = null;
  constructor(value: T) { this.value = value; this.promise = Promise.resolve(value); }
  start(): void { if (!this.resolve) this.promise = new Promise((r) => { this.resolve = r; }); }
  end(): void { const r = this.resolve; this.resolve = null; if (r) r(this.value); }
}

/** Stepped rAF loop shared by both effects. Stores the pending frame id in `self.raf`; the caller resets it to 0 in `done`. */
export function runLoop(self: { raf: number }, D: number, fps: number, frame: (t: number) => void, done: () => void): void {
  cancelAnimationFrame(self.raf);
  const t0 = performance.now(), frameMs = 1000 / Math.max(1, fps);
  let last = -1e9;
  const tick = (now: number): void => {
    const t = (now - t0) / 1000;
    if (now - last >= frameMs) { last = now; frame(t); }
    if (t < D) self.raf = requestAnimationFrame(tick);
    else done();
  };
  self.raf = requestAnimationFrame(tick);
}

/**
 * Element-to-instance link, stored on the element under a registry symbol so it
 * survives module re-evaluation (HMR) and duplicate copies of the library.
 */
const OWNER = Symbol.for('noisefloor.instance');
type Owned = { [OWNER]?: { destroy(): void } };

/** Destroy the instance currently on `el`, if any, and record `inst` as its owner. */
export function own(el: Element, inst: { destroy(): void }): void {
  const prev = (el as Owned)[OWNER];
  if (prev && prev !== inst) prev.destroy();
  (el as Owned)[OWNER] = inst;
}

/** The live instance on `el`, if any. */
export function owner(el: Element): object | undefined {
  return (el as Owned)[OWNER];
}

/** Clear the link if `inst` still owns `el`. */
export function disown(el: Element, inst: object): void {
  if ((el as Owned)[OWNER] === inst) delete (el as Owned)[OWNER];
}

/** Listener removers added by bindHover, per instance; run by unbind() from destroy(). */
const bound = new WeakMap<object, Array<() => void>>();

/**
 * Plays each instance on `trigger` of its host: a DOM event (`mouseenter` also
 * listens for focus), or `visible`, when the host enters the viewport (one
 * IntersectionObserver per call). `once` unbinds after the first play.
 */
export function bindHover<T extends { play(): unknown }>(instances: T[], trigger: string, hostOf: (inst: T) => Element, once = false): T[] {
  const seen = new Map<Element, Array<() => void>>();
  const io = trigger === 'visible' && typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) (seen.get(e.target) || []).slice().forEach((f) => { f(); }); });
    }, { rootMargin: '0px 0px -10% 0px' }) // a bottom band, not a ratio, so hosts taller than the viewport still play
    : null;
  instances.forEach((inst) => {
    const h = hostOf(inst), offs = bound.get(inst) || [];
    const play = (): void => { inst.play(); if (once) unbind(inst); };
    bound.set(inst, offs);
    if (trigger === 'visible') {
      if (!io) { play(); return; }
      const fs = seen.get(h) || [];
      fs.push(play);
      seen.set(h, fs);
      io.observe(h);
      offs.push(() => {
        fs.splice(fs.indexOf(play), 1);
        if (!fs.length) { io.unobserve(h); seen.delete(h); }
      });
      return;
    }
    h.addEventListener(trigger, play);
    offs.push(() => h.removeEventListener(trigger, play));
    if (trigger === 'mouseenter') {
      h.addEventListener('focus', play, true);
      offs.push(() => h.removeEventListener('focus', play, true));
    }
  });
  return instances;
}

export function unbind(inst: object): void {
  const offs = bound.get(inst);
  if (offs) offs.forEach((off) => off());
  bound.delete(inst);
}
