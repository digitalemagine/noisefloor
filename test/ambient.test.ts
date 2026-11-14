import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Ambient } from '../src/index';
import type { Burstable } from '../src/index';

function target(running = false): Burstable & { burst: ReturnType<typeof vi.fn> } {
  const t = { running, burst: vi.fn() };
  t.burst.mockReturnValue(t);
  return t as unknown as Burstable & { burst: ReturnType<typeof vi.fn> };
}

describe('Ambient scheduling', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('waits an exponentially distributed delay: -ln(1 - u) * 60000 / rate', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const t = target();
    new Ambient([t], { rate: 60 }); // mean 1000 ms, delay ln 2 * 1000 = 693.1 ms (fake timers: 693)
    vi.advanceTimersByTime(692);
    expect(t.burst).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(t.burst).toHaveBeenCalledTimes(1);
  });

  it('caps a single delay at four times the mean', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1 - 1e-12);
    const t = target();
    new Ambient([t], { rate: 60 });
    vi.advanceTimersByTime(3999);
    expect(t.burst).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(t.burst).toHaveBeenCalledTimes(1);
  });

  it('reschedules after every event', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const t = target();
    new Ambient([t], { rate: 60 });
    vi.advanceTimersByTime(693.2 * 5);
    expect(t.burst).toHaveBeenCalledTimes(5);
  });

  it('passes amount, duration and intensity to burst()', () => {
    const t = target();
    new Ambient([t], { enabled: false, amount: 0.4, duration: 0.3, intensity: 0.9 }).fire();
    expect(t.burst).toHaveBeenCalledWith({ amount: 0.4, duration: 0.3, intensity: 0.9 });
  });

  it('only picks targets that are not running', () => {
    const busy = target(true), idle = target(false);
    const amb = new Ambient([busy, idle], { enabled: false });
    for (let i = 0; i < 20; i++) amb.fire();
    expect(busy.burst).not.toHaveBeenCalled();
    expect(idle.burst).toHaveBeenCalledTimes(20);
  });

  it('does nothing while the document is hidden', () => {
    const t = target();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    new Ambient([t], { enabled: false }).fire();
    expect(t.burst).not.toHaveBeenCalled();
    hidden.mockRestore();
  });

  it('does not schedule when disabled or at rate 0; stop() cancels, start() resumes', () => {
    const t = target();
    new Ambient([t], { rate: 0 });
    const amb = new Ambient([t], { enabled: false });
    vi.advanceTimersByTime(60000);
    expect(t.burst).not.toHaveBeenCalled();
    amb.start();
    vi.advanceTimersByTime(60000);
    const n = t.burst.mock.calls.length;
    expect(n).toBeGreaterThan(0);
    amb.stop();
    vi.advanceTimersByTime(60000);
    expect(t.burst).toHaveBeenCalledTimes(n);
  });

  it('setTargets() replaces the target list', () => {
    const a = target(), b = target();
    const amb = new Ambient([a], { enabled: false }).setTargets([b]);
    amb.fire();
    expect(a.burst).not.toHaveBeenCalled();
    expect(b.burst).toHaveBeenCalledTimes(1);
  });

  it('drops destroyed targets', () => {
    const a = target(), b = target();
    (a as { destroyed?: boolean }).destroyed = true;
    const amb = new Ambient([a, b], { enabled: false });
    amb.fire();
    amb.fire();
    expect(a.burst).not.toHaveBeenCalled();
    expect(b.burst).toHaveBeenCalledTimes(2);
    expect(amb.targets).toEqual([b]);
  });

  it('destroy() stops for good and releases the targets', () => {
    const t = target();
    const amb = new Ambient([t], { rate: 600 });
    amb.destroy();
    amb.start();
    amb.set({ rate: 600 });
    amb.fire();
    vi.advanceTimersByTime(60000);
    expect(t.burst).not.toHaveBeenCalled();
    expect(amb.targets).toEqual([]);
  });
});
