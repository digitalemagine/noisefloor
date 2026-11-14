/** Library-wide settings, passed to `configure()`. */
export interface GlobalOptions {
  /** insert the base stylesheet automatically; default true */
  injectCSS: boolean;
}

/** Order in which a full scramble locks characters into place. */
export type LockOrder = 'ltr' | 'rtl' | 'center' | 'random';
/** How a full scramble starts: every character at once, or typed in `order`. */
export type Reveal = 'all' | 'type';

export interface ScrambleOptions {
  /** s, until the last character locks */
  duration: number;
  /** glyph / jitter refresh rate */
  fps: number;
  /** s, colour + position decay after a character locks */
  settle: number;
  order: LockOrder;
  /** 'type': characters appear one by one in `order`, each scrambling for `trail` before it locks */
  reveal: Reveal;
  /** s, scramble time of a typed character between appearing and locking */
  trail: number;
  /** characters per second while typing; when > 0 it sets the run length instead of `duration`. Default 0 (off) */
  speed: number;
  /** block caret at the typing head while typing */
  cursor: boolean;
  /** glyphs drawn while scrambling */
  chars: string;
  palette: readonly string[];
  /** px, max vertical offset of a scrambling character */
  jitter: number;
  /** deg */
  skew: number;
  /** px, chromatic aberration (palette[0] / palette[1]) */
  rgbSplit: number;
  /** px */
  glow: number;
  /** 0..1, chance a scrambling character dims on a frame */
  flicker: number;
  /** 0..8 glitch lines over the label */
  lines: number;
  /** px, horizontal sync slip of the whole label */
  tear: number;
  scanlines: boolean;
}

/** Arguments of Scramble.play(). */
export interface PlayOptions {
  /** new label to scramble to; the current one if omitted */
  text?: string;
}

export interface GlitchOptions {
  /** s */
  duration: number;
  fps: number;
  palette: readonly string[];
  /** px, max channel offset */
  rgbSplit: number;
  /** horizontal bands displaced per frame (at full amount) */
  slices: number;
  /** px, max horizontal displacement of a band */
  tear: number;
  /** rectangular blocks copied out of place per frame */
  blocks: number;
  /** palette-coloured scan lines per frame */
  lines: number;
  /** px, vertical shake of the whole frame */
  jitter: number;
  /** 0..1, chance a frame dims */
  flicker: number;
  scanlines: boolean;
}

export interface AmbientOptions {
  /** micro-glitches per minute, across all targets (Poisson-timed) */
  rate: number;
  /** 0..1 how much of a target is disturbed */
  amount: number;
  /** s per micro-glitch */
  duration: number;
  /** 0..1 artefact strength */
  intensity: number;
  enabled: boolean;
}

export interface BurstOptions {
  /** 0..1 share of the target disturbed */
  amount?: number;
  /** exact number of characters (text; overrides amount) */
  count?: number;
  /** s */
  duration?: number;
  /** 0..1 artefact strength */
  intensity?: number;
}

export interface BindOptions<T extends Element> {
  /**
   * event that plays the effect; default `mouseenter` (also plays on focus).
   * `visible`: when the host enters the viewport (already visible ones play at once)
   */
  trigger?: keyof HTMLElementEventMap | 'visible';
  /** play on the first trigger only, then remove the listener */
  once?: boolean;
  /** element that receives the trigger listener */
  host?: (el: T) => Element;
}

/** Anything Ambient can drive. */
export interface Burstable {
  /** True while an animation is running. */
  readonly running: boolean;
  /** True once destroyed; Ambient drops such targets. */
  readonly destroyed?: boolean;
  burst(opts?: BurstOptions): this;
}

/** A selector, a single item, or a list of items. */
export type Targets<T> = string | ArrayLike<T> | T | null | undefined;
