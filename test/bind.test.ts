import { afterEach, describe, expect, it, vi } from 'vitest';
import { Scramble } from '../src/index';

const frames = (n = 3): Promise<void> => new Promise((r) => {
  const step = (): void => { if (--n <= 0) r(); else requestAnimationFrame(step); };
  requestAnimationFrame(step);
});

// A label at a given page offset; the page is made tall enough to scroll to it.
const label = (top: number): HTMLElement => {
  const el = document.body.appendChild(document.createElement('span'));
  el.textContent = 'label';
  el.style.cssText = `position:absolute;left:0;top:${top}px`;
  return el;
};

describe("bind trigger: 'visible'", () => {
  afterEach(() => { document.body.innerHTML = ''; document.body.style.height = ''; window.scrollTo(0, 0); });

  it('plays labels already in view, and others when scrolled into view', async () => {
    document.body.style.height = '6000px';
    const [near, far] = Scramble.bind([label(10), label(4000)], { duration: 5 }, { trigger: 'visible' });
    await frames();
    expect(near!.running).toBe(true);
    expect(far!.running).toBe(false);
    window.scrollTo(0, 3800);
    await frames();
    expect(far!.running).toBe(true);
  });

  it('replays on each entry, or only the first one with once', async () => {
    document.body.style.height = '6000px';
    const [again, once] = Scramble.bind([label(4000)], { duration: 5 }, { trigger: 'visible' })
      .concat(Scramble.bind([label(4000)], { duration: 5 }, { trigger: 'visible', once: true }));
    window.scrollTo(0, 3800); await frames();
    expect(again!.running && once!.running).toBe(true);
    again!.finish(); once!.finish();
    window.scrollTo(0, 0); await frames();
    window.scrollTo(0, 3800); await frames();
    expect(again!.running).toBe(true);
    expect(once!.running).toBe(false);
  });

  it('destroy() unobserves the host once no instance on it is left', () => {
    const unobserve = vi.spyOn(IntersectionObserver.prototype, 'unobserve');
    const host = document.body.appendChild(document.createElement('div'));
    const a = host.appendChild(label(4000)), b = host.appendChild(label(4000));
    const [s, t] = Scramble.bind([a, b], {}, { trigger: 'visible', host: () => host });
    s!.destroy();
    expect(unobserve).not.toHaveBeenCalled();
    t!.destroy();
    expect(unobserve).toHaveBeenCalledWith(host);
    unobserve.mockRestore();
  });
});

describe('bind once with events', () => {
  it('plays on the first mouseenter only', () => {
    const host = document.body.appendChild(document.createElement('button'));
    host.innerHTML = '<span>go</span>';
    const [s] = Scramble.bind(host.firstChild as HTMLElement, {}, { once: true });
    host.dispatchEvent(new MouseEvent('mouseenter'));
    expect(s!.running).toBe(true);
    s!.finish();
    host.dispatchEvent(new MouseEvent('mouseenter'));
    host.dispatchEvent(new FocusEvent('focus'));
    expect(s!.running).toBe(false);
    s!.destroy();
  });
});
