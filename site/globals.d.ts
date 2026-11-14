// Types for the type check of main.js (site/tsconfig.json). main.js runs after
// dist/noisefloor.iife.js, which defines the Noisefloor global.
declare const Noisefloor: typeof import('../src/index');

type ScrambleOptions = import('../src/types').ScrambleOptions;
type GlitchOptions = import('../src/types').GlitchOptions;
type AmbientOptions = import('../src/types').AmbientOptions;
type GlitchInstance = import('../src/glitch').Glitch;
/** A Scramble instance tagged with the page group it belongs to (data-group). */
type SiteText = import('../src/scramble').Scramble & { group: string };
type Burstable = import('../src/types').Burstable;
