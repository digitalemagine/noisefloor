import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsdown';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
// process.env.NODE_ENV maps to itself: the ESM/CJS builds must leave it for the consumer's bundler
// (rolldown would otherwise replace it for platform 'browser').
const define = { __VERSION__: JSON.stringify(version), __NF_IIFE__: 'false', 'process.env.NODE_ENV': 'process.env.NODE_ENV' };

// Browser floor (Vite's default build target, Baseline widely available 2025): no syntax these support is rewritten.
const TARGET = ['chrome107', 'edge107', 'firefox104', 'safari16'];

const banner = `/*! noisefloor v${version} | MIT | (c) 2026 digitalemagine */`;
// The script-tag bundles: minified production builds, dev warnings compiled out.
const iife = { globalName: 'Noisefloor', minify: true, define: { ...define, __NF_IIFE__: 'true' } };

export default defineConfig([
  {
    entry: { noisefloor: 'src/index.ts', auto: 'src/auto.ts' },
    platform: 'browser',
    target: TARGET,
    sourcemap: true,
    clean: false, // configs may run concurrently; the build script empties dist first
    define,
    banner,
    // Code shared by noisefloor and noisefloor/auto (the whole library): name it for what it is.
    outputOptions: (o, format) => {
      const cjs = format === 'cjs';
      return { ...o, chunkFileNames: (c) => (c.name.endsWith('.d') ? (cjs ? 'core.d.cts' : 'core.d.ts') : (cjs ? 'core.cjs' : 'core.js')) };
    },
    format: { esm: { dts: true }, cjs: { dts: true } }
  },
  { entry: { noisefloor: 'src/index.ts' }, platform: 'browser', target: TARGET, sourcemap: true, banner, format: { iife } },
  // Library plus attribute auto-init; IIFE output cannot share chunks, so it is a separate bundle.
  { entry: { 'noisefloor.auto': 'src/auto-iife.ts' }, platform: 'browser', target: TARGET, sourcemap: true, banner, format: { iife } }
]);
