// Writes dist/style.css (the `noisefloor/style.css` export) from the stylesheet
// the library injects, so the two cannot diverge. Run after tsdown, which cleans dist/.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CSS } from '../src/css.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
writeFileSync(join(root, 'dist/style.css'), `/*! noisefloor v${version} | MIT | (c) 2026 digitalemagine */\n${CSS}\n`);
console.log('dist/style.css written');
