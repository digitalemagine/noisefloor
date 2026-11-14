# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## 0.1.0 (2026-11-14)

First public release.

- `Scramble`: per-character text scramble with palette colours, vertical jitter, skew, RGB split, glow, flicker, glitch lines and scanlines. Typing mode (`reveal: 'type'`) at a fitted `duration` or a fixed `speed`, with an optional block caret. `play({ text })` scrambles to new text. Layout never moves.
- `Glitch`: canvas glitch over an existing `<img>`: channel split, slice tears, block moves, colour lines, frame shake. No pixel reads, so cross-origin images work without CORS. Honours `object-fit`, `object-position`, borders, padding and transforms.
- `Ambient`: Poisson-timed micro-glitches across any mix of text and image instances.
- `bind()` with hover, focus, `visible` or any event as trigger, and `once`; `finished` promises; `set()` for live option changes; options validated and clamped, with development warnings that production bundles drop.
- `noisefloor/auto`: effects declared in `data-nf` attributes, including elements added later.
- Accessibility: the real label stays readable by screen readers, copying a label yields it once, and `prefers-reduced-motion` disables playback.
- `noisefloor/style.css` and `configure({ injectCSS: false })` for a Content-Security-Policy without `'unsafe-inline'` styles.
- ESM, CJS and a script-tag bundle (`Noisefloor` global), TypeScript types, tree-shakable per effect. Browsers: Safari 16, Chrome and Edge 107, Firefox 104.
