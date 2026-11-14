/**
 * noisefloor/auto: effects declared in HTML attributes.
 *
 *   <span data-nf="scramble" data-nf-order="center">Docs</span>
 *   <img data-nf="glitch" data-nf-rgb-split="6" data-nf-ambient src="feed.jpg" alt="">
 *
 * Importing this module (or loading noisefloor.auto.iife.js) scans the
 * document when it is ready and keeps watching it: elements added later are
 * set up, removed ones are destroyed. The core `noisefloor` entry has no such
 * side effect.
 */
import { Ambient } from './ambient';
import { Glitch } from './glitch';
import { Scramble } from './scramble';
import { owner, warn } from './shared';
import type { BindOptions } from './types';

type Effect = Scramble | Glitch;

/** `data-nf-*` attributes that are not effect options. */
const RESERVED = ['wrap', 'trigger', 'once', 'ambient'];

const live = new Set<Effect>();
let observer: MutationObserver | null = null;
let shared: Ambient | null = null;
/** start() pending on DOMContentLoaded; cleared by stop() */
let pending = false;

const target = (inst: Effect): Element => (inst instanceof Glitch ? inst.img : inst.el);

/**
 * Effect options from the element's `data-nf-*` attributes, typed by the
 * defaults: numbers, booleans (present means true, "false" means false),
 * `palette` as a comma-separated list, strings as given. Names are matched
 * without dashes and case, since HTML lowercases attribute names:
 * `data-nf-rgb-split` and `data-nf-rgbsplit` both set `rgbSplit`. Unknown names
 * are passed on, so the effect warns about them in development builds.
 */
function options(el: Element, defaults: object): Record<string, unknown> {
  const o: Record<string, unknown> = {}, names = Object.keys(defaults), d = defaults as Record<string, unknown>;
  for (const a of Array.from(el.attributes)) {
    if (a.name.slice(0, 8) !== 'data-nf-') continue;
    const raw = a.name.slice(8);
    if (RESERVED.indexOf(raw) >= 0) continue;
    const flat = raw.replace(/-/g, '');
    const k = names.filter((n) => n.toLowerCase() === flat)[0] || raw.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    const def = d[k], v = a.value;
    if (typeof def === 'number') o[k] = v.trim() === '' ? NaN : Number(v);
    else if (typeof def === 'boolean') o[k] = v !== 'false';
    else if (Array.isArray(def)) o[k] = v.split(/,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean); // commas inside rgb(...) stay
    else o[k] = v;
  }
  return o;
}

/** Set up one `[data-nf]` element. Skips elements that already have an instance or are detached. */
function create(el: Element): Effect | null {
  if (owner(el) || !el.isConnected) return null;
  const kind = (el.getAttribute('data-nf') || '').trim().toLowerCase();
  const trigger = el.getAttribute('data-nf-trigger') || 'mouseenter';
  const b = { trigger, once: el.hasAttribute('data-nf-once') } as BindOptions<Element>;
  let inst: Effect;
  if (kind === 'scramble') {
    const el2 = el as HTMLElement, o = options(el, Scramble.defaults);
    inst = trigger === 'none' ? new Scramble(el2, o) : Scramble.bind(el2, o, b)[0] as Scramble;
  } else if (kind === 'glitch' && el.tagName === 'IMG') {
    const img = el as HTMLImageElement, o = options(el, Glitch.defaults);
    inst = trigger === 'none' ? new Glitch(img, o) : Glitch.bind(img, o, b)[0] as Glitch;
  } else {
    if (!__NF_IIFE__) {
      try {
        if (process.env.NODE_ENV !== 'production') {
          warn('auto.kind.' + kind + el.tagName, kind === 'glitch'
            ? `auto: data-nf="glitch" needs an <img>, got <${el.tagName.toLowerCase()}>; ignored`
            : `auto: data-nf must be "scramble" or "glitch", got ${JSON.stringify(kind)}; ignored`);
        }
      } catch { /* no process global */ }
    }
    return null;
  }
  live.add(inst);
  if (el.hasAttribute('data-nf-ambient')) { const a = ambient(); a.setTargets(a.targets.concat(inst)); }
  return inst;
}

function drop(inst: Effect): void {
  live.delete(inst);
  inst.destroy();
}

function onMutations(records: MutationRecord[]): void {
  let removed = false;
  for (const r of records) {
    if (r.type === 'attributes') {
      const el = r.target as Element;
      live.forEach((inst) => { if (target(inst) === el) drop(inst); });
      if (el.hasAttribute('data-nf')) create(el);
      continue;
    }
    for (const n of Array.from(r.removedNodes)) if (n.nodeType === 1) removed = true;
    for (const n of Array.from(r.addedNodes)) if (n.nodeType === 1) scan(n as Element);
  }
  if (removed) live.forEach((inst) => { if (!target(inst).isConnected) drop(inst); });
}

/**
 * Set up every `[data-nf]` element in `root` (and `root` itself) that has no
 * instance yet; returns the new instances. start() does this for the
 * document; call it for content the observer does not see, such as a shadow
 * root. Instances made here are not destroyed automatically when removed.
 */
export function scan(root: ParentNode = document): Effect[] {
  const els: Element[] = Array.prototype.slice.call(root.querySelectorAll('[data-nf]'));
  if ((root as Element).nodeType === 1 && (root as Element).hasAttribute('data-nf')) els.unshift(root as Element);
  const out: Effect[] = [];
  for (const el of els) { const inst = create(el); if (inst) out.push(inst); }
  return out;
}

/**
 * Scan the document and watch it for added or removed elements and changes of
 * the `data-nf` attribute. Called on import; idempotent.
 */
export function start(): void {
  pending = false;
  if (observer || typeof document === 'undefined') return;
  scan(document);
  if (typeof MutationObserver !== 'function') return;
  observer = new MutationObserver(onMutations);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-nf'] });
}

/** Stop watching and destroy every instance created from attributes, and the shared Ambient. */
export function stop(): void {
  pending = false;
  if (observer) { observer.disconnect(); observer = null; }
  live.forEach(drop);
  if (shared) { shared.destroy(); shared = null; }
}

/**
 * The Ambient that drives elements marked `data-nf-ambient`, created on first
 * use with the default options; change them with `ambient().set({ rate: 12 })`.
 */
export function ambient(): Ambient {
  if (!shared) shared = new Ambient([]);
  return shared;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    pending = true;
    document.addEventListener('DOMContentLoaded', () => { if (pending) start(); }, { once: true });
  } else start();
}
