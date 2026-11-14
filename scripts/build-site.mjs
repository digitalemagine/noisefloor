// Builds site/dist/ from site/: index.html with the HTML-escaped TypeScript sources
// inlined into the source viewer (the <!--__SRC__--> placeholder) and the package version
// at <!--__VERSION__-->, style.css, main.js,
// the browser bundle dist/noisefloor.iife.js (run `npm run build` first), the reduced
// illustrations (media/*.webp), the README GIF and Open Graph image (media/demo.gif, media/og.jpg,
// written by scripts/capture.mjs), favicon.svg and the self-hosted fonts with their licences
// (fonts/*.woff2, fonts/*.txt). No dependencies.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(root, 'site');
const out = join(site, 'dist');
const bundle = join(root, 'dist/noisefloor.iife.js');
if (!existsSync(bundle)) throw new Error('dist/noisefloor.iife.js is missing: run `npm run build` first');

const SOURCES = ['index', 'types', 'shared', 'css', 'scramble', 'glitch', 'ambient', 'auto'];
const src = SOURCES
  .map((name) => `// ---- src/${name}.ts\n\n` + readFileSync(join(root, `src/${name}.ts`), 'utf8').trim())
  .join('\n\n')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const page = readFileSync(join(site, 'index.html'), 'utf8');
if (!page.includes('<!--__SRC__-->')) throw new Error('site/index.html is missing the <!--__SRC__--> placeholder');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
// Function form: no $-pattern expansion.
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const html = page.replace('<!--__SRC__-->', () => src).replace('<!--__VERSION__-->', version);
writeFileSync(join(out, 'index.html'), html);
copyFileSync(join(site, 'style.css'), join(out, 'style.css'));
copyFileSync(join(site, 'main.js'), join(out, 'main.js'));
// The source map is not published: drop the comment that points to it.
writeFileSync(
  join(out, 'noisefloor.iife.js'),
  readFileSync(bundle, 'utf8').replace(/\n\/\/# sourceMappingURL=.*\s*$/, '\n'),
);

function copyDir(dir, keep) {
  mkdirSync(join(out, dir), { recursive: true });
  for (const f of readdirSync(join(site, dir)).filter(keep)) copyFileSync(join(site, dir, f), join(out, dir, f));
}
copyDir('media', (f) => f.endsWith('.webp') || f === 'og.jpg' || f === 'demo.gif');
copyFileSync(join(site, 'favicon.svg'), join(out, 'favicon.svg'));
copyDir('fonts', (f) => f.endsWith('.woff2') || f.endsWith('.txt'));

console.log(`site/dist/ written (index.html ${(html.length / 1024).toFixed(1)} KB)`);
