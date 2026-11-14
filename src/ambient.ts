import { pick, sanitize, snapshot, toList } from './shared';
import type { AmbientOptions, Burstable, Targets } from './types';

const DEFAULTS: Readonly<AmbientOptions> = Object.freeze({
  rate: 30,
  amount: 0.2,
  duration: 0.18,
  intensity: 0.5,
  enabled: true
});

const RANGES = { rate: [0, Infinity], amount: [0, 1], duration: [0, Infinity], intensity: [0, 1] } as const;

/**
 * Fires burst() on a random target at random (exponentially distributed)
 * intervals, so glitches cluster and pause like real interference instead of
 * ticking like a metronome. Skips while the tab is hidden.
 */
export class Ambient {
  static get defaults(): Readonly<AmbientOptions> { return DEFAULTS; }

  targets: Burstable[];
  private readonly cfg: AmbientOptions;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private gone = false;

  constructor(targets: Targets<Burstable>, opts?: Partial<AmbientOptions>) {
    this.targets = toList(targets);
    this.cfg = Object.assign({}, DEFAULTS, opts);
    sanitize('Ambient', this.cfg, DEFAULTS, RANGES, opts);
    this.schedule();
  }

  /** Current options, validated; a frozen copy. Change them with set(). */
  get options(): Readonly<AmbientOptions> { return snapshot(this.cfg); }

  private schedule(): void {
    clearTimeout(this.timer);
    if (this.gone || !this.cfg.enabled || !(this.cfg.rate > 0)) return;
    const mean = 60000 / this.cfg.rate;
    const delay = Math.min(mean * 4, -Math.log(1 - Math.random()) * mean);
    this.timer = setTimeout(() => { this.fire(); this.schedule(); }, delay);
  }

  /** Trigger one micro-glitch now on a random idle target. Destroyed targets are dropped. */
  fire(): this {
    if (this.targets.some((t) => t.destroyed)) this.targets = this.targets.filter((t) => !t.destroyed);
    if (this.gone || (typeof document !== 'undefined' && document.hidden)) return this;
    const idle = this.targets.filter((t) => !t.running);
    if (!idle.length) return this;
    pick(idle).burst({ amount: this.cfg.amount, duration: this.cfg.duration, intensity: this.cfg.intensity });
    return this;
  }

  set(opts?: Partial<AmbientOptions>): this {
    Object.assign(this.cfg, opts);
    sanitize('Ambient', this.cfg, DEFAULTS, RANGES, opts);
    this.schedule();
    return this;
  }
  setTargets(targets: Targets<Burstable>): this { this.targets = toList(targets); return this; }
  start(): this { return this.set({ enabled: true }); }
  stop(): this { this.cfg.enabled = false; clearTimeout(this.timer); return this; }
  /** Stop for good and release the targets; start() and set() no longer schedule. Does not destroy the targets. */
  destroy(): void { this.stop(); this.gone = true; this.targets = []; }
}
