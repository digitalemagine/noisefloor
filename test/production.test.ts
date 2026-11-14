// Runs in the "production" Vitest project, which compiles the source with
// process.env.NODE_ENV = "production", as a consumer's production bundle would.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Scramble } from '../src/index';
import { resetWarnings } from '../src/shared';

describe('production builds', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('clamp options without warning', () => {
    resetWarnings();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = document.body.appendChild(document.createElement('span'));
    el.append('Go ', document.createElement('b'));
    const s = new Scramble(el, { fps: -5, fpz: 1, palette: [] } as never);
    s.burst({ amount: 4 });
    expect(s.options.fps).toBe(1);
    expect(warn).not.toHaveBeenCalled();
    s.finish();
  });
});
