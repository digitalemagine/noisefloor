import type { GlobalOptions } from './types';

// The base stylesheet in three parts, so a single-effect import carries only its own rules:
// each effect passes its parts to injectCSS, and an unused part is dropped by the bundler.
// String concatenation (not [].join) keeps the constants side-effect free.

/** Scanlines, shared by both effects. */
export const SCAN_CSS =
  '.nf-scan{position:absolute;inset:0;background:repeating-linear-gradient(to bottom,transparent 0 2px,var(--nf-scan-color,rgba(0,0,0,.32)) 2px 3px);' +
  'animation:nf-roll .3s steps(3) infinite}' +
  '.nf-noscan .nf-scan{display:none}' +
  '@keyframes nf-roll{to{background-position:0 3px}}';

/** Scramble. */
export const TEXT_CSS =
  '.nf-text{position:relative;display:inline-block;white-space:nowrap;vertical-align:baseline}' +
  '.nf-text-sr{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}' +
  '.nf-text-row{display:inline-block;-webkit-user-select:none;user-select:none;transform:translateX(var(--nf-tx,0px))}' +
  '.nf-text-cell{position:relative;display:inline-block;white-space:pre}' +
  '.nf-text-cell::before{content:attr(data-c);visibility:hidden}' +
  '.nf-text-glyph{position:absolute;left:50%;top:0;white-space:pre;pointer-events:none;' +
  'transform:translate(-50%,var(--nf-dy,0px)) skewX(var(--nf-sk,0deg));opacity:var(--nf-op,1);' +
  'text-shadow:calc(var(--nf-rgb,0px) * -1) 0 var(--nf-rgb-a,#ff2bd6),var(--nf-rgb,0px) 0 var(--nf-rgb-b,#00f0ff),0 0 var(--nf-glow,0px) currentColor}' +
  '.nf-text-glyph.nf-lock{transition:color var(--nf-settle,.35s) ease-out,text-shadow var(--nf-settle,.35s) ease-out,' +
  'transform var(--nf-settle,.35s) cubic-bezier(.2,.8,.2,1),opacity .12s linear}' +
  '.nf-text-cell.nf-head::after{content:"";position:absolute;left:100%;top:.15em;bottom:.1em;width:.55em;pointer-events:none;' +
  'background:var(--nf-cursor,currentColor);box-shadow:0 0 var(--nf-cglow,0px) var(--nf-cursor,currentColor);transform:translateY(var(--nf-cy,0px))}' +
  '.nf-caret-left .nf-text-cell.nf-head::after{left:auto;right:100%}' +
  '.nf-text-fx{position:absolute;inset:-2px -6px;pointer-events:none;overflow:hidden;opacity:0;transition:opacity .3s ease-out}' +
  '.nf-text.nf-live .nf-text-fx{opacity:1;transition:none}' +
  '.nf-text-fx i{position:absolute;display:block;left:var(--nf-lx,0);top:var(--nf-ly,0);width:var(--nf-lw,0);height:var(--nf-lh,1px);' +
  'background:var(--nf-lc,#fff);box-shadow:0 0 6px var(--nf-lc,#fff);opacity:var(--nf-lo,0)}' +
  '@media (prefers-reduced-motion:reduce){.nf-text-fx{display:none}}';

/** Glitch. */
export const IMG_CSS =
  '.nf-img{position:relative;vertical-align:top}' +
  '.nf-img-canvas,.nf-img-fx{position:absolute;pointer-events:none}' +
  '.nf-img-canvas{opacity:0;transition:opacity .18s ease-out;transform:translate(var(--nf-img-dx,0px),var(--nf-img-dy,0px)) var(--nf-img-tf,translate(0px))}' +
  '.nf-img.nf-live .nf-img-canvas{opacity:var(--nf-img-op,1);transition:none}' +
  '.nf-img-fx{overflow:hidden;opacity:0;transition:opacity .25s ease-out;transform:var(--nf-img-tf,none)}' +
  '.nf-img.nf-live .nf-img-fx{opacity:1;transition:none}' +
  '@media (prefers-reduced-motion:reduce){.nf-img-fx,.nf-img-canvas{display:none}}';

/** The whole stylesheet; written to dist/style.css by scripts/build-css.mjs. */
export const CSS = SCAN_CSS + TEXT_CSS + IMG_CSS;

const styled = new WeakMap<Node, { style: HTMLStyleElement; parts: string[] }>();
let inject = true;

/**
 * Library-wide settings. `injectCSS: false` stops the base stylesheet from
 * being inserted, for pages that load `noisefloor/style.css` themselves (such
 * as under a Content-Security-Policy without 'unsafe-inline' in style-src).
 * Affects documents and shadow roots not styled yet, so call it before
 * creating instances.
 */
export function configure(opts: Partial<GlobalOptions>): void {
  if (opts.injectCSS != null) inject = !!opts.injectCSS;
}

/**
 * Inserts the given stylesheet parts once per document or shadow root containing
 * `el`, in one `<style data-noisefloor>` placed first in <head> or in the shadow
 * root so page and component CSS can override it; parts added later by another
 * effect are appended to the same element. A detached element styles its owner document.
 */
export function injectCSS(el: Element, parts: readonly string[]): void {
  if (!inject) return;
  const doc = el.ownerDocument, root = el.getRootNode();
  const shadow = typeof ShadowRoot === 'function' && root instanceof ShadowRoot ? root : null;
  const target: Node = shadow || doc;
  let entry = styled.get(target);
  if (!entry) {
    const style = doc.createElement('style');
    style.setAttribute('data-noisefloor', '');
    const parent = shadow || doc.head;
    parent.insertBefore(style, parent.firstChild);
    styled.set(target, entry = { style, parts: [] });
  }
  let added = false;
  for (const p of parts) if (entry.parts.indexOf(p) < 0) { entry.parts.push(p); added = true; }
  if (added) entry.style.textContent = entry.parts.join('');
}
