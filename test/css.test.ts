import { afterEach, describe, expect, it } from 'vitest';
import { Glitch, Scramble, configure } from '../src/index';

// Each test uses a fresh shadow root: the document may already be styled by another test.
const shadowLabel = (): { root: ShadowRoot; el: HTMLElement } => {
  const root = document.body.appendChild(document.createElement('div')).attachShadow({ mode: 'open' });
  const el = root.appendChild(document.createElement('span'));
  el.textContent = 'Label';
  return { root, el };
};

describe('CSS injection', () => {
  afterEach(() => { configure({ injectCSS: true }); });

  it('inserts the base stylesheet once, first in the shadow root', () => {
    const { root, el } = shadowLabel();
    new Scramble(el);
    new Scramble(el);
    expect(root.querySelectorAll('style[data-noisefloor]')).toHaveLength(1);
    expect(root.firstChild).toBe(root.querySelector('style[data-noisefloor]'));
  });

  it('configure({ injectCSS: false }) skips it; true restores it', () => {
    const off = shadowLabel();
    configure({ injectCSS: false });
    new Scramble(off.el);
    expect(off.root.querySelector('style')).toBeNull();
    configure({ injectCSS: true });
    const on = shadowLabel();
    new Scramble(on.el);
    expect(on.root.querySelector('style[data-noisefloor]')).not.toBeNull();
  });

  it('injects only the parts an effect uses, then appends the other effect\'s part to the same element', () => {
    const { root, el } = shadowLabel();
    new Scramble(el);
    const style = root.querySelector('style[data-noisefloor]') as HTMLStyleElement;
    expect(style.textContent).toContain('.nf-text{');
    expect(style.textContent).toContain('.nf-scan{');
    expect(style.textContent).not.toContain('.nf-img');
    const img = root.appendChild(document.createElement('img'));
    new Glitch(img);
    expect(root.querySelectorAll('style[data-noisefloor]')).toHaveLength(1);
    expect(style.textContent).toContain('.nf-img{');
    expect(style.textContent!.split('@keyframes nf-roll').length).toBe(2); // shared scanline part once
  });

  it('Glitch alone gets the image and scanline rules, including scanlines: false', () => {
    const root = document.body.appendChild(document.createElement('div')).attachShadow({ mode: 'open' });
    const img = root.appendChild(document.createElement('img'));
    new Glitch(img, { scanlines: false });
    const css = root.querySelector('style[data-noisefloor]')!.textContent!;
    expect(css).toContain('.nf-img{');
    expect(css).toContain('.nf-noscan .nf-scan{display:none}');
    expect(css).not.toContain('.nf-text');
    expect(getComputedStyle(root.querySelector('.nf-scan')!).display).toBe('none');
  });
});
