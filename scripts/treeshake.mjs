// Tree-shaking check of the built package (needs dist/): bundles a single named import of each
// effect from dist/noisefloor.js the way a consumer's production build does (esbuild, NODE_ENV
// production) and fails if another effect's class or CSS is left in the output. Prints the minified
// gzip -9 size of each bundle.
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('../dist/noisefloor.js', import.meta.url));
const EFFECTS = ['Scramble', 'Glitch', 'Ambient'];

async function bundle(names, minify) {
  const r = await build({
    stdin: { contents: `import { ${names.join(', ')} } from ${JSON.stringify(entry)}; console.log(${names.join(', ')});`, resolveDir: process.cwd() },
    bundle: true, write: false, format: 'esm', minify, logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"production"' }
  });
  return r.outputFiles[0].text;
}

const CSS_MARK = { Scramble: '.nf-text{', Glitch: '.nf-img{' };
const hasClass = (code, name) => new RegExp(`\\b${name}\\s*=\\s*class\\b|\\bclass ${name}\\b`).test(code);
const hasCSS = (code, name) => !!CSS_MARK[name] && code.includes(CSS_MARK[name]);
// An unused effect leaks if its class or its CSS is left; a used one must have its class (and CSS, if any).
const leaked = (code, name) => hasClass(code, name) || hasCSS(code, name);
const present = (code, name) => hasClass(code, name) && (!CSS_MARK[name] || hasCSS(code, name));
let failed = false;

for (const name of [...EFFECTS.map((n) => [n]), EFFECTS]) {
  const code = await bundle(name, false);
  const extra = EFFECTS.filter((n) => !name.includes(n) && leaked(code, n));
  const missing = name.filter((n) => !present(code, n));
  const size = gzipSync(await bundle(name, true), { level: 9 }).length;
  const label = name.length === EFFECTS.length ? 'everything' : name[0] + ' only';
  if (extra.length || missing.length) failed = true;
  console.log(`${extra.length || missing.length ? 'FAIL' : 'ok  '} ${label.padEnd(14)} ${(size / 1024).toFixed(1)} KB gzip${extra.length ? `; also contains ${extra.join(', ')}` : ''}${missing.length ? `; missing ${missing.join(', ')}` : ''}`);
}

if (failed) { console.error('treeshake FAILED'); process.exit(1); }
console.log('treeshake OK');
