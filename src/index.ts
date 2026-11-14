/**
 * noisefloor: analog-video glitch effects for text and images.
 *
 *   Scramble  per-character text scramble (colour, jitter, RGB split, lines)
 *   Glitch    canvas image glitch (channel split, slice tear, block moves)
 *   Ambient   randomised micro-glitch scheduler for any of the above
 *
 * The base CSS is injected automatically; `configure({ injectCSS: false })`
 * turns that off for pages that load `noisefloor/style.css` instead.
 */
export { Scramble } from './scramble';
export { Glitch } from './glitch';
export { Ambient } from './ambient';
export { configure } from './css';
export type {
  AmbientOptions, GlobalOptions, BindOptions, Burstable, BurstOptions, GlitchOptions, LockOrder, PlayOptions, Reveal, ScrambleOptions, Targets
} from './types';

export const version: string = __VERSION__;
