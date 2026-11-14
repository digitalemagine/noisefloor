import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Scramble } from '../src/index';

interface Cell { ch: string; show: number; at: number; done: boolean; space: boolean }
// Lock ranks and cells are internal; these tests read them on purpose.
const internals = (s: Scramble): { cells: Cell[]; ranks(): number[] } => s as unknown as { cells: Cell[]; ranks(): number[] };

const make = (text: string, opts = {}): Scramble => {
  const el = document.createElement('span');
  el.textContent = text;
  document.body.appendChild(el);
  return new Scramble(el, opts);
};

describe('lock ranks', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('ltr, rtl and center', () => {
    expect(internals(make('abcde', { order: 'ltr' })).ranks()).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(internals(make('abcde', { order: 'rtl' })).ranks()).toEqual([1, 0.75, 0.5, 0.25, 0]);
    expect(internals(make('abcde', { order: 'center' })).ranks()).toEqual([1, 0.5, 0, 0.5, 1]);
  });

  it('random draws one value per character', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);
    expect(internals(make('abc', { order: 'random' })).ranks()).toEqual([0.3, 0.3, 0.3]);
  });

  it('a single character has rank 0', () => {
    expect(internals(make('a')).ranks()).toEqual([0]);
  });

  it('play() maps ranks to lock times in [0.25, 1] x duration; spaces are never scrambled', () => {
    const s = make('ab cd', { duration: 1 });
    s.play();
    const { cells } = internals(s);
    expect(cells.map((c) => c.at)).toEqual([0.25, 0.4375, 0, 0.8125, 1]);
    expect(cells.map((c) => c.done)).toEqual([false, false, true, false, false]);
    s.finish();
  });
});

describe('burst selection', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  const scrambling = (s: Scramble): Cell[] => internals(s).cells.filter((c) => !c.done);

  it('amount selects a share of the non-space characters, at least one', () => {
    const s = make('abc def'); // 6 non-space
    s.burst({ amount: 0.5 });
    expect(scrambling(s)).toHaveLength(3);
    s.finish().burst({ amount: 0 });
    expect(scrambling(s)).toHaveLength(1);
    s.finish().burst();
    expect(scrambling(s)).toHaveLength(1); // default 0.2 x 6 = 1.2 -> 1
    s.finish();
  });

  it('count overrides amount and is capped at the number of characters', () => {
    const s = make('abc def');
    s.burst({ count: 2, amount: 1 });
    expect(scrambling(s)).toHaveLength(2);
    s.finish().burst({ count: 99 });
    expect(scrambling(s)).toHaveLength(6);
    s.finish();
  });

  it('selected characters are distinct and never spaces', () => {
    const s = make('a b c d e f');
    for (let i = 0; i < 50; i++) {
      s.burst({ count: 4 });
      const picked = scrambling(s);
      expect(new Set(picked).size).toBe(4);
      expect(picked.every((c) => !c.space)).toBe(true);
      s.finish();
    }
  });

  it('burst({ count, duration }) picks count characters locking within the duration', () => {
    const s = make('abcdef');
    s.burst({ count: 3, duration: 1 });
    const picked = scrambling(s);
    expect(picked).toHaveLength(3);
    expect(picked.every((c) => c.at >= 0.4 && c.at <= 1)).toBe(true); // D * (0.4 + 0.6 u)
    s.finish();
  });

  it('is ignored while an animation is running', () => {
    const s = make('abcdef');
    s.play();
    const before = internals(s).cells.map((c) => c.at);
    s.burst({ count: 1 });
    expect(internals(s).cells.map((c) => c.at)).toEqual(before);
    s.finish();
  });

  it('a label of spaces only has nothing to burst', () => {
    const s = make('a');
    internals(s).cells.forEach((c) => { c.space = true; });
    s.burst();
    expect(s.running).toBe(false);
  });

  it('runs for its duration, then rests with every character locked', () => {
    const s = make('abc');
    s.burst({ count: 3, duration: 0.2 });
    expect(s.running).toBe(true);
    vi.advanceTimersByTime(400);
    expect(s.running).toBe(false);
    expect(internals(s).cells.every((c) => c.done)).toBe(true);
    expect(s.el.querySelector('.nf-text-row')!.textContent).toBe('abc');
  });
});

describe('play({ text })', () => {
  const visible = (s: Scramble): string => Array.from(s.el.querySelectorAll('.nf-text-glyph'), (g) => g.textContent).join('');

  it('scrambles to the new label and updates the accessible text at once', async () => {
    const s = make('Offline', { duration: 0.06 });
    s.play({ text: '  Back   online ' });
    expect(s.text).toBe('Back online');
    expect(s.el.querySelector('.nf-text-sr')!.textContent).toBe('Back online');
    expect(internals(s).cells.map((c) => c.ch).join('')).toBe('Back online');
    await s.finished;
    expect(visible(s)).toBe('Back online');
  });

  it('sizes the cells from the new text when the transition starts', () => {
    const s = make('ab');
    const ref = make('a much longer label');
    ref.destroy();
    const w = (el: HTMLElement): number => el.getBoundingClientRect().width;
    s.play({ text: 'a much longer label' });
    expect(Math.abs(w(s.el.querySelector('.nf-text-row')!) - w(ref.el))).toBeLessThan(0.5);
    s.finish();
  });

  it('keeps the cells when the text is unchanged, and a mid-run change restarts on the new cells', () => {
    const s = make('same');
    const before = internals(s).cells;
    s.play({ text: 'same' });
    expect(internals(s).cells).toBe(before);
    s.play({ text: 'other' });
    expect(s.running).toBe(true);
    expect(internals(s).cells.every((c) => 'other'.includes(c.ch))).toBe(true);
    s.finish();
    expect(visible(s)).toBe('other');
  });

  it('keeps data-text in sync, and destroy() restores the current label', () => {
    const s = make('ignored');
    s.el.setAttribute('data-text', 'First');
    const t = new Scramble(s.el);
    t.play({ text: 'Second' }).finish();
    expect(t.el.getAttribute('data-text')).toBe('Second');
    t.destroy();
    expect(t.el.textContent).toBe('Second');
    expect(new Scramble(t.el).text).toBe('Second');
  });
});

describe("reveal: 'type'", () => {
  const glyphs = (s: Scramble): string[] => Array.from(s.el.querySelectorAll('.nf-text-glyph'), (g) => g.textContent || '');

  it('characters appear in order at rank x (duration - trail) and lock trail later', () => {
    const s = make('ab cd', { reveal: 'type', duration: 1, trail: 0.2 });
    s.play();
    const cells = internals(s).cells;
    expect(cells.map((c) => +c.show.toFixed(6))).toEqual([0, 0.2, 0.4, 0.6, 0.8]);
    expect(cells.map((c) => +(c.at - c.show).toFixed(6))).toEqual([0.2, 0.2, 0, 0.2, 0.2]); // a space locks as it appears
    expect(Math.max(...cells.map((c) => c.at))).toBeLessThanOrEqual(1);
    s.finish();
  });

  it('a trail longer than the duration is clamped to it', () => {
    const s = make('abc', { reveal: 'type', duration: 0.5, trail: 3 });
    s.play();
    expect(internals(s).cells.every((c) => c.show === 0 && c.at === 0.5)).toBe(true);
    s.finish();
  });

  it('speed: one character every 1/speed s, the run length follows the text and ignores duration', () => {
    const s = make('abcde', { reveal: 'type', speed: 10, trail: 0.2, duration: 9 });
    s.play();
    const cells = internals(s).cells;
    expect(cells.map((c) => +c.show.toFixed(6))).toEqual([0, 0.1, 0.2, 0.3, 0.4]);
    expect(Math.max(...cells.map((c) => c.at))).toBeCloseTo(0.6);
    s.finish();
    s.play({ text: 'abcdefghijk' }); // twice as long: twice the time at the same pace
    expect(+internals(s).cells[10]!.show.toFixed(6)).toBe(1);
    s.finish();
  });

  it('speed is ignored by the all-at-once reveal', () => {
    const s = make('abcde', { speed: 10, duration: 1 });
    s.play();
    expect(Math.max(...internals(s).cells.map((c) => c.at))).toBeCloseTo(1);
    s.finish();
  });

  it('hides every glyph at the start without changing the width, and finish() shows the text', () => {
    const s = make('Typed label', { reveal: 'type' });
    const row = s.el.querySelector('.nf-text-row')!, before = row.getBoundingClientRect().width;
    s.play();
    expect(glyphs(s).every((g) => g === '')).toBe(true);
    expect(row.getBoundingClientRect().width).toBe(before);
    s.finish();
    expect(glyphs(s).join('')).toBe('Typed label');
  });

  it('cursor: the caret sits on the most recently appeared cell while typing, and is removed at the end', async () => {
    const s = make('abcdefgh', { reveal: 'type', cursor: true, duration: 0.8, trail: 0.05, fps: 60 });
    s.play();
    await new Promise((r) => setTimeout(r, 300));
    const cells = Array.from(s.el.querySelectorAll('.nf-text-cell')), heads = s.el.querySelectorAll('.nf-head');
    expect(heads).toHaveLength(1);
    const i = cells.indexOf(heads[0]!), shown = glyphs(s).filter((g) => g !== '').length;
    expect(i).toBe(shown - 1);
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(cells.length - 1);
    await s.finished;
    expect(s.el.querySelector('.nf-head')).toBeNull();
  });

  it('no caret without cursor, or in a burst', async () => {
    const s = make('abcdef', { reveal: 'type', duration: 0.3 });
    s.play();
    await new Promise((r) => setTimeout(r, 80));
    expect(s.el.querySelector('.nf-head')).toBeNull();
    s.finish().set({ cursor: true }).burst({ amount: 1, duration: 0.3 });
    await new Promise((r) => setTimeout(r, 80));
    expect(s.el.querySelector('.nf-head')).toBeNull();
    s.finish();
  });
});

describe('finished', () => {
  const settled = async (p: Promise<unknown>): Promise<boolean> => {
    let done = false;
    void p.then(() => { done = true; });
    await Promise.resolve(); await Promise.resolve();
    return done;
  };

  it('is resolved with the instance when idle', async () => {
    const s = make('abc');
    expect(await s.finished).toBe(s);
  });

  it('is pending while playing and resolves when the animation ends', async () => {
    const s = make('abc', { duration: 0.06 });
    const p = s.play().finished;
    expect(await settled(p)).toBe(false);
    expect(await p).toBe(s);
    expect(s.running).toBe(false);
  });

  it('keeps the same promise when play() restarts, and resolves on finish()', async () => {
    const s = make('abc');
    const p = s.play().finished;
    s.play(); s.burst();
    expect(s.finished).toBe(p);
    s.finish();
    expect(await settled(p)).toBe(true);
  });

  it('resolves on destroy()', async () => {
    const s = make('abc');
    const p = s.burst().finished;
    s.destroy();
    expect(await settled(p)).toBe(true);
  });
});

describe('Scramble construction', () => {
  afterEach(() => { document.body.innerHTML = ''; getSelection()?.removeAllRanges(); });

  it('selecting the label copies it once', () => {
    const el = make('Copy').el;
    const r = document.createRange();
    r.selectNodeContents(el);
    getSelection()!.addRange(r);
    expect(getSelection()!.toString()).toBe('Copy');
  });

  it('styles apply inside a shadow root, injected once and before the component CSS', () => {
    const root = document.body.appendChild(document.createElement('div')).attachShadow({ mode: 'open' });
    root.innerHTML = '<style>.own{}</style><span>Shadow</span><span>Root</span>';
    const [a, b] = Array.from(root.querySelectorAll('span'));
    new Scramble(a!);
    new Scramble(b!);
    expect(getComputedStyle(a!.querySelector('.nf-text-sr')!).position).toBe('absolute');
    expect(root.querySelectorAll('style[data-noisefloor]')).toHaveLength(1);
    expect(root.firstChild).toBe(root.querySelector('style[data-noisefloor]'));
  });

  it('play(), burst(), set() and finish() after destroy() do nothing', () => {
    const s = make('Gone'), el = s.el;
    s.destroy();
    expect(s.destroyed).toBe(true);
    s.burst({ amount: 1 });
    s.play();
    s.set({ scanlines: false });
    s.finish();
    expect(s.running).toBe(false);
    expect(el.className).toBe('');
    expect(el.getAttribute('style')).toBe('');
    expect(el.innerHTML).toBe('Gone');
  });

  it('a replaced instance cannot clear the live state of its successor', () => {
    const first = make('Docs'), second = new Scramble(first.el);
    second.play();
    first.finish();
    expect(first.el.classList.contains('nf-live')).toBe(true);
    second.finish();
  });

  it('one cell per grapheme cluster', () => {
    const s = make('é\u{1F44D}\u{1F3FD}'); // e + combining acute, thumbs up + skin tone
    expect(Array.from(s.el.querySelectorAll('.nf-text-cell'), (c) => c.getAttribute('data-c'))).toEqual(['é', '\u{1F44D}\u{1F3FD}']);
  });

  it('animating adds or removes no nodes, so childList observers see nothing', async () => {
    const s = make('Docs', { duration: 0.2, reveal: 'type' }), records: MutationRecord[] = [];
    const mo = new MutationObserver((r) => { records.push(...r); });
    mo.observe(s.el, { childList: true, subtree: true });
    s.play();
    await s.finished;
    s.burst({ duration: 0.1 });
    await s.finished;
    records.push(...mo.takeRecords());
    mo.disconnect();
    expect(records).toHaveLength(0);
  });

  it('a second instance on the same element replaces the first and keeps the label', () => {
    const first = make('Docs'), el = first.el;
    const second = new Scramble(el, { order: 'rtl' });
    expect(second.text).toBe('Docs');
    expect(el.querySelectorAll('.nf-text-row')).toHaveLength(1);
    expect(el.querySelector('.nf-text-row')!.textContent).toBe('Docs');
    first.destroy(); // already destroyed by the takeover: must not touch the new instance
    expect(el.classList.contains('nf-text')).toBe(true);
    second.destroy();
    expect(el.innerHTML).toBe('Docs');
  });
});
