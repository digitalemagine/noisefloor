import { describe, expect, it } from 'vitest';
import readme from '../README.md?raw';
import { Ambient, Glitch, Scramble } from '../src/index';

/** Rows of the README table under `<summary>{name} options</summary>`: [option, default as written]. */
function rows(name: string): Array<[string, string]> {
  const start = readme.indexOf(`<summary>${name} options</summary>`);
  expect(start, `README has no "${name} options" table`).toBeGreaterThan(-1);
  const block = readme.slice(start, readme.indexOf('</details>', start));
  return [...block.matchAll(/^\| `([^`]+)` \| `((?:[^`\\]|\\.)*)` \|/gm)].map((m) => [m[1]!, m[2]!.replace(/\\\|/g, '|')]);
}

describe('README option tables', () => {
  for (const [name, defaults] of [['Scramble', Scramble.defaults], ['Glitch', Glitch.defaults], ['Ambient', Ambient.defaults]] as const) {
    it(`${name}: every option, in order, with its current default`, () => {
      const expected = Object.entries(defaults).map(([k, v]) => [k, JSON.stringify(v)]);
      expect(rows(name)).toEqual(expected);
    });
  }
});
