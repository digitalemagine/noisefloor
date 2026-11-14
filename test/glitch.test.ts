import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Glitch } from '../src/index';

// burst() argument mapping is checked through the internal run(); rendering
// geometry against the real img is covered by scripts/fidelity.mjs.
const solid = (color: string): string => {
  const c = document.createElement('canvas');
  c.width = 20; c.height = 10;
  const x = c.getContext('2d')!;
  x.fillStyle = color; x.fillRect(0, 0, 20, 10);
  return c.toDataURL();
};

const make = () => {
  const img = document.body.appendChild(document.createElement('img'));
  const g = new Glitch(img);
  const run = vi.spyOn(g as unknown as { run(D: number, i: number, a: number): Glitch }, 'run').mockReturnValue(g);
  return { g, run };
};

describe('Glitch burst arguments', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('defaults: duration 0.15 s, intensity 0.5, amount 0.2', () => {
    const { g, run } = make();
    g.burst();
    expect(run).toHaveBeenCalledWith(0.15, 0.5, 0.2);
  });

  it('count maps to amount = count / 10, clamped to [0.05, 1]', () => {
    const { g, run } = make();
    g.burst({ count: 5 });
    g.burst({ count: 0 });
    g.burst({ count: 30 });
    expect(run.mock.calls.map((c) => c[2])).toEqual([0.5, 0.05, 1]);
  });

  it('amount wins over count; duration has a floor of 0.03 s', () => {
    const { g, run } = make();
    g.burst({ amount: 0.7, count: 9, duration: 0.01, intensity: 1 });
    expect(run).toHaveBeenCalledWith(0.03, 1, 0.7);
  });

  it('wraps the img and restores it on destroy()', () => {
    const img = document.body.appendChild(document.createElement('img'));
    const g = new Glitch(img);
    expect(img.parentElement!.classList.contains('nf-img')).toBe(true);
    g.destroy();
    expect(img.parentElement).toBe(document.body);
  });

  it('play(), burst() and set() after destroy() do nothing', () => {
    const box = document.body.appendChild(document.createElement('div'));
    const img = box.appendChild(document.createElement('img'));
    const g = new Glitch(img);
    g.destroy();
    expect(g.destroyed).toBe(true);
    g.play(); g.burst(); g.set({ scanlines: false }); g.finish();
    expect(g.running).toBe(false);
    expect(box.innerHTML).toBe('<img>');
  });

  it('a second instance on the same img replaces the first without nesting wrappers', () => {
    const box = document.body.appendChild(document.createElement('div'));
    const img = box.appendChild(document.createElement('img'));
    const first = new Glitch(img), second = new Glitch(img);
    expect(box.querySelectorAll('.nf-img')).toHaveLength(1);
    expect(img.parentElement).toBe(second.wrap);
    first.destroy(); // already destroyed by the takeover: must not touch the new instance
    expect(img.parentElement).toBe(second.wrap);
    second.destroy();
    expect(box.innerHTML).toBe('<img>');
  });
});

describe('Glitch in <picture>', () => {
  it('wraps the <picture>, so the img keeps selecting from its <source> elements', async () => {
    const red = solid('#f00'), blue = solid('#00f');
    const pic = document.body.appendChild(document.createElement('picture'));
    pic.innerHTML = `<source srcset="${blue}"><img src="${red}">`;
    const img = pic.querySelector('img')!;
    await img.decode();
    const g = new Glitch(img);
    expect(pic.parentElement).toBe(g.wrap);
    img.src = red + '#reselect'; // force source selection to run again
    await img.decode();
    expect(img.currentSrc.startsWith(blue)).toBe(true);
    g.destroy();
    expect(pic.parentElement).toBe(document.body);
    expect(img.parentElement).toBe(pic);
    pic.remove();
  });
});

describe('Glitch rendering', () => {
  let img: HTMLImageElement;
  beforeEach(async () => {
    const src = document.createElement('canvas');
    src.width = 40; src.height = 20;
    const x = src.getContext('2d')!;
    x.fillStyle = '#c84'; x.fillRect(0, 0, 40, 20);
    img = document.body.appendChild(document.createElement('img'));
    img.style.cssText = 'width:200px;height:100px;display:block';
    img.src = src.toDataURL();
    await img.decode();
  });
  afterEach(() => { vi.useRealTimers(); (img.closest('.nf-img') || img).remove(); });

  const lit = (c: HTMLCanvasElement): number => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) n++;
    return n / (d.length / 4);
  };

  it('play() draws the image into the overlay canvas, sized to the img at 1x', async () => {
    const g = new Glitch(img);
    g.play();
    await new Promise((r) => setTimeout(r, 120));
    expect([g.canvas.width, g.canvas.height]).toEqual([200, 100]);
    expect(lit(g.canvas)).toBeGreaterThan(0.5);
    g.destroy();
  });

  it('finished is pending while glitching and resolves when it ends', async () => {
    const g = new Glitch(img, { duration: 0.06 });
    const p = g.play().finished;
    expect(g.running).toBe(true);
    expect(await p).toBe(g);
    expect(g.running).toBe(false);
    g.destroy();
  });

  it('builds buffers on the first play and releases them 30 s after the last one', () => {
    vi.useFakeTimers();
    const g = new Glitch(img);
    expect(g.canvas.width).toBe(1);
    g.play();
    expect(g.canvas.width).toBe(200);
    g.finish();
    vi.advanceTimersByTime(29999);
    expect(g.canvas.width).toBe(200);
    g.burst(); // reuses the buffers and restarts the idle timer
    g.finish();
    vi.advanceTimersByTime(29999);
    expect(g.canvas.width).toBe(200);
    vi.advanceTimersByTime(1);
    expect(g.canvas.width).toBe(1);
    g.destroy();
  });
});
