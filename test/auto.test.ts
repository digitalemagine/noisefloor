import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ambient, scan, start, stop } from '../src/auto';
import { Glitch, Scramble } from '../src/index';
import { resetWarnings } from '../src/shared';

// Importing ../src/auto started it on this document. Mutation records are
// delivered in a microtask; a macrotask wait covers the follow-up records too.
const settle = (): Promise<void> => new Promise((r) => { setTimeout(r, 0); });
const instance = (el: Element): Scramble | Glitch | undefined => (el as unknown as Record<symbol, Scramble | Glitch | undefined>)[Symbol.for('noisefloor.instance')];
const html = (s: string): HTMLElement => {
  const d = document.body.appendChild(document.createElement('div'));
  d.innerHTML = s;
  return d;
};

afterEach(() => { stop(); document.body.innerHTML = ''; start(); vi.restoreAllMocks(); });

describe('auto: setup from attributes', () => {
  it('sets up elements added to the document', async () => {
    const d = html('<a href="#"><span data-nf="scramble">Docs</span></a><img data-nf="glitch" alt="">');
    await settle();
    expect(instance(d.querySelector('span')!)).toBeInstanceOf(Scramble);
    expect(instance(d.querySelector('img')!)).toBeInstanceOf(Glitch);
  });

  it('parses options by the type of their default', async () => {
    const d = html('<span data-nf="scramble" data-nf-order="center" data-nf-duration="0.6" data-nf-rgb-split="3" data-nf-cursor data-nf-scanlines="false" data-nf-palette="rgb(1, 2, 3), #fff">x</span>');
    await settle();
    const o = (instance(d.firstElementChild!) as Scramble).options;
    expect(o).toMatchObject({ order: 'center', duration: 0.6, rgbSplit: 3, cursor: true, scanlines: false });
    expect(o.palette).toEqual(['rgb(1, 2, 3)', '#fff']);
  });

  it('matches option names without dashes, as HTML lowercases attribute names', async () => {
    const d = html('<img data-nf="glitch" data-nf-rgbSplit="7" alt="">');
    await settle();
    expect((instance(d.querySelector('img')!) as Glitch).options.rgbSplit).toBe(7);
  });

  it('skips elements that already have an instance', async () => {
    const el = document.body.appendChild(document.createElement('span'));
    el.textContent = 'x';
    const own = new Scramble(el, { order: 'rtl' });
    el.setAttribute('data-nf', 'scramble');
    await settle();
    expect(instance(el)).toBe(own);
  });

  it('scan() sets up elements the observer does not see, such as in a shadow root', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<span data-nf="scramble">x</span>';
    await settle();
    const el = root.firstElementChild!;
    expect(instance(el)).toBeUndefined();
    expect(scan(root)).toEqual([instance(el)]);
    expect(scan(root)).toEqual([]);
  });
});

describe('auto: triggers and Ambient', () => {
  it('plays on hover of the closest link by default; data-nf-trigger="none" does not bind', async () => {
    const d = html('<a href="#"><span data-nf="scramble">a</span></a><a href="#"><span data-nf="scramble" data-nf-trigger="none">b</span></a>');
    await settle();
    const [a, b] = Array.from(d.querySelectorAll('a'));
    a!.dispatchEvent(new MouseEvent('mouseenter'));
    b!.dispatchEvent(new MouseEvent('mouseenter'));
    expect(instance(a!.firstElementChild!)!.running).toBe(true);
    expect(instance(b!.firstElementChild!)!.running).toBe(false);
  });

  it('data-nf-trigger and data-nf-once map to bind options', async () => {
    const d = html('<button><span data-nf="scramble" data-nf-trigger="click" data-nf-once data-nf-duration="0.05">a</span></button>');
    await settle();
    const btn = d.querySelector('button')!, s = instance(btn.firstElementChild!)!;
    btn.dispatchEvent(new MouseEvent('mouseenter'));
    expect(s.running).toBe(false);
    btn.click();
    expect(s.running).toBe(true);
    await s.finished;
    btn.click();
    expect(s.running).toBe(false);
  });

  it('data-nf-ambient adds the element to the shared Ambient', async () => {
    const d = html('<span data-nf="scramble" data-nf-ambient>a</span><span data-nf="scramble">b</span>');
    await settle();
    expect(ambient().targets).toEqual([instance(d.firstElementChild!)]);
  });

  it('options-like attributes for bind and Ambient are not passed as effect options', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    resetWarnings();
    html('<span data-nf="scramble" data-nf-trigger="click" data-nf-once data-nf-ambient>a</span>');
    await settle();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('auto: lifecycle', () => {
  it('destroys instances whose element leaves the document, including a Glitch inside a removed parent', async () => {
    const d = html('<span data-nf="scramble">a</span><p><img data-nf="glitch" alt=""></p>');
    await settle();
    const s = instance(d.querySelector('span')!)!, g = instance(d.querySelector('img')!)!;
    d.querySelector('span')!.remove();
    d.querySelector('p')!.remove();
    await settle();
    expect(s.destroyed && g.destroyed).toBe(true);
  });

  it('keeps an element moved within the document', async () => {
    const d = html('<span data-nf="scramble">a</span>');
    await settle();
    const el = d.firstElementChild!, s = instance(el)!;
    document.body.appendChild(el);
    await settle();
    expect(s.destroyed).toBe(false);
    expect(instance(el)).toBe(s);
  });

  it('follows the data-nf attribute: added sets up, changed rebuilds, removed destroys', async () => {
    const d = html('<span>a</span>'), el = d.firstElementChild as HTMLElement;
    await settle();
    el.setAttribute('data-nf', 'scramble');
    await settle();
    const first = instance(el)!;
    expect(first).toBeInstanceOf(Scramble);
    el.setAttribute('data-nf-order', 'rtl');
    el.setAttribute('data-nf', 'scramble');
    await settle();
    expect(first.destroyed).toBe(true);
    expect((instance(el) as Scramble).options.order).toBe('rtl');
    el.removeAttribute('data-nf');
    await settle();
    expect(instance(el)).toBeUndefined();
    expect(el.innerHTML).toBe('a');
  });

  it('stop() destroys every instance and stops watching; start() scans again', async () => {
    const d = html('<span data-nf="scramble" data-nf-ambient>a</span>');
    await settle();
    const el = d.firstElementChild!, s = instance(el)!, a = ambient();
    stop();
    expect(s.destroyed).toBe(true);
    expect(a.targets).toEqual([]);
    html('<span data-nf="scramble">b</span>');
    await settle();
    expect(document.querySelectorAll('.nf-text')).toHaveLength(0);
    start();
    expect(document.querySelectorAll('.nf-text')).toHaveLength(2);
  });
});

describe('auto: development warnings', () => {
  beforeEach(() => { resetWarnings(); });

  it('warns about an unknown effect, a glitch on a non-img, and unknown options', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const d = html('<span data-nf="blur">a</span><div data-nf="glitch"></div><span data-nf="scramble" data-nf-bogus="1">b</span>');
    await settle();
    expect(instance(d.children[0]!)).toBeUndefined();
    expect(instance(d.children[1]!)).toBeUndefined();
    const msgs = warn.mock.calls.map((c) => String(c[0]));
    expect(msgs.some((m) => m.includes('data-nf must be "scramble" or "glitch", got "blur"'))).toBe(true);
    expect(msgs.some((m) => m.includes('needs an <img>, got <div>'))).toBe(true);
    expect(msgs.some((m) => m.includes('unknown option "bogus"'))).toBe(true);
  });

  it('a non-numeric number is reported and replaced by the default', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const d = html('<span data-nf="scramble" data-nf-duration="fast">a</span>');
    await settle();
    expect((instance(d.firstElementChild!) as Scramble).options.duration).toBe(Scramble.defaults.duration);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('duration must be a number'));
  });
});
