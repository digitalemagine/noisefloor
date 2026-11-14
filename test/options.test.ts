import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Ambient, Glitch, Scramble } from '../src/index';
import { resetWarnings } from '../src/shared';

const span = (text = 'label'): HTMLElement => {
  const el = document.createElement('span');
  el.textContent = text;
  document.body.appendChild(el);
  return el;
};

describe('option merging', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('defaults and their palettes are frozen', () => {
    for (const C of [Scramble, Glitch, Ambient]) expect(Object.isFrozen(C.defaults)).toBe(true);
    expect(Object.isFrozen(Scramble.defaults.palette)).toBe(true);
    expect(Object.isFrozen(Glitch.defaults.palette)).toBe(true);
  });

  it('constructor options override defaults without touching them', () => {
    const s = new Scramble(span(), { fps: 30, order: 'rtl' });
    expect(s.options).toEqual({ ...Scramble.defaults, fps: 30, order: 'rtl' });
    expect(Scramble.defaults.fps).toBe(24);
    expect(new Scramble(span()).options.fps).toBe(24);
  });

  it('set() merges into the current options', () => {
    const s = new Scramble(span(), { fps: 30 });
    s.set({ skew: 2 }).set({ glow: 0 });
    expect(s.options).toMatchObject({ fps: 30, skew: 2, glow: 0, duration: Scramble.defaults.duration });
  });

  it('options is a frozen snapshot: writes cannot bypass validation', () => {
    const pal = ['#123456', '#abcdef'];
    const s = new Scramble(span(), { fps: 30, palette: pal });
    const o = s.options;
    expect(Object.isFrozen(o) && Object.isFrozen(o.palette)).toBe(true);
    expect(() => { (o as { fps: number }).fps = -1; }).toThrow(TypeError);
    pal.push('#000000'); // the caller's array is not the stored one either
    expect(s.options.palette).toEqual(['#123456', '#abcdef']);
    expect(s.options).not.toBe(o);
    const g = new Glitch(document.body.appendChild(document.createElement('img')));
    expect(() => { (g as { ready: boolean }).ready = true; }).toThrow(TypeError);
    expect(g.ready).toBe(false);
  });

  it('Ambient merges constructor options and set()', () => {
    const a = new Ambient([], { enabled: false, rate: 10 });
    a.set({ amount: 0.5 });
    expect(a.options).toEqual({ ...Ambient.defaults, enabled: false, rate: 10, amount: 0.5 });
    a.stop();
  });

  it('palette feeds the RGB split colours; an empty one falls back to the default', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = span();
    new Scramble(el, { palette: ['#111', '#222'] });
    expect(el.style.getPropertyValue('--nf-rgb-a')).toBe('#111');
    expect(el.style.getPropertyValue('--nf-rgb-b')).toBe('#222');
    const el2 = span();
    const s2 = new Scramble(el2, { palette: [], chars: '' });
    expect(el2.style.getPropertyValue('--nf-rgb-a')).toBe(Scramble.defaults.palette[0]);
    expect(s2.options).toMatchObject({ palette: Scramble.defaults.palette, chars: '01' }); // options reports what is used
  });
});

describe('option validation', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('clamps numbers into range and replaces non-numbers with the default', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = new Scramble(span(), { fps: -5, flicker: 3, lines: 20, jitter: -1, skew: 'x' as unknown as number });
    expect(s.options).toMatchObject({ fps: 1, flicker: 1, lines: 8, jitter: 0, skew: Scramble.defaults.skew });
    const a = new Ambient([], { enabled: false, amount: 2, intensity: -1, rate: NaN });
    expect(a.options).toMatchObject({ amount: 1, intensity: 0, rate: Ambient.defaults.rate });
  });

  it('replaces an unknown lock order with ltr', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(new Scramble(span(), { order: 'up' as never }).options.order).toBe('ltr');
    expect(new Scramble(span(), { reveal: 'typed' as never }).options.reveal).toBe('all');
  });
});

describe('development warnings', () => {
  beforeEach(() => { resetWarnings(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('warns once per option, and about unknown keys', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = new Scramble(span(), { fps: -5, fpz: 1 } as never);
    s.set({ fps: -9 });
    expect(warn.mock.calls.map((c) => c[0])).toEqual([
      '[noisefloor] Scramble: unknown option "fpz"',
      '[noisefloor] Scramble: fps -5 is outside [1, Infinity]; using 1'
    ]);
  });

  it('warns about a non-object burst() argument and uses the defaults', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = new Scramble(span('abcdefghij'));
    s.burst(3 as never);
    expect(warn.mock.calls.map((c) => c[0])).toEqual(['[noisefloor] burst: expected an options object such as { count, duration }, got 3; using the defaults']);
    expect(s.running).toBe(true);
    s.finish();
  });

  it('warns about child markup, unless data-text is set', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const withText = span();
    withText.setAttribute('data-text', 'x');
    withText.appendChild(document.createElement('i'));
    new Scramble(withText);
    expect(warn).not.toHaveBeenCalled();
    const marked = span('Go ');
    marked.appendChild(document.createElement('b')).textContent = 'now';
    new Scramble(marked);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(marked.querySelector('b')).toBeNull();
  });
});
