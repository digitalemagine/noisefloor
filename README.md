# noisefloor

Analog-signal interference for UI: labels and images that break up like a weak signal, then recover. Layout never moves, screen readers and reduced-motion users are unaffected, and cross-origin images work without CORS. MIT, zero runtime dependencies, about 7.5 KB gzipped (4.5 KB for Scramble alone).

**[Live demo, docs and playground](https://digitalemagine.github.io/noisefloor/)**

![noisefloor demo: ambient micro-glitches, the menu and headline scrambling on hover, both images glitching](https://digitalemagine.github.io/noisefloor/media/demo.gif)

- **Ambient**: Poisson-timed micro-glitches across any mix of text and image instances: a page that sometimes loses signal, without anyone touching it.
- **Scramble**: per-character text scramble with palette colours, vertical jitter, skew, RGB split, glow, flicker, glitch lines and scanlines. Typing mode (`reveal: 'type'`) types the label character by character, each scrambling briefly before it locks, at a fitted `duration` or a fixed `speed`, with an optional block caret. Layout never moves. Works on plain text: child elements inside the target are replaced by its text. Made for labels and headings, not paragraphs: every character is its own element, restyled on each frame.
- **Glitch**: canvas image glitch over an existing `<img>`: channel split, slice tears, block moves, colour lines, frame shake. No pixel reads, so cross-origin images work without CORS.

## Install

```sh
npm i noisefloor
```

```js
import { Scramble, Glitch, Ambient } from 'noisefloor';
```

Without a bundler, one script tag exposes the `Noisefloor` global:

```html
<script src="https://unpkg.com/noisefloor"></script>
```

## Quick start

```html
<nav>
  <a href="#docs"><span class="label">Docs</span></a>
  <a href="#about"><span class="label">About</span></a>
</nav>
<img class="glitch" src="feed.jpg" alt="Camera feed">

<script type="module">
  import { Scramble, Glitch, Ambient } from 'noisefloor';

  const labels = Scramble.bind('nav a .label');
  const images = Glitch.bind('img.glitch');
  new Ambient([...labels, ...images], { rate: 30, amount: 0.25 });
</script>
```

With the script tag, use `Noisefloor.Scramble`, `Noisefloor.Glitch` and `Noisefloor.Ambient`.

## API

Every effect is a class: `new Scramble(el, options)`, `new Glitch(img, options)`, `new Ambient(targets, options)`. `Scramble.bind()` and `Glitch.bind()` take a selector, element or list, and return the instances.

- `play()`: a full scramble (characters lock in order) or a full image glitch. `play({ text })` scrambles a label to new text.
- `burst({ amount, count, duration, intensity })`: a micro-glitch on part of the target (`count`: Scramble only); this is what `Ambient` calls. Ignored while playing.
- `set(options)`: change options, safe while playing. `options` returns the current, validated values.
- `finished`: a promise resolved when the current animation ends: `await label.play().finished`.
- `finish()` jumps to rest; `destroy()` removes the effect (Scramble leaves the label as plain text); `running`, `destroyed`, and for Glitch `ready` (image loaded and measured).
- `bind(targets, options, { trigger, host, once })`: `trigger` is an event name (default `mouseenter`, which also plays on focus) or `'visible'` (when the element scrolls into view); `once: true` plays on the first trigger only; `host: (el) => element` picks the element that listens (by default the closest link or button; otherwise the label itself for Scramble, the image wrapper for Glitch).
- `Ambient`: `fire()`, `setTargets()`, `start()`, `stop()`, `destroy()` (targets are not destroyed). It picks an idle target each time and pauses while the tab is hidden.

Typing instead of scrambling, on scroll:

```js
Scramble.bind('h2', { reveal: 'type', cursor: true }, { trigger: 'visible', once: true });
```

Cycling words: `play({ text })` changes the width once, when it starts. To keep even that from moving the layout, reserve the widest word with `min-width`:

```html
<span id="status" style="min-width: 11ch">Idle</span>
<script type="module">
  import { Scramble } from 'noisefloor';

  const status = new Scramble(document.getElementById('status'));
  const words = ['Idle', 'Scanning', 'Reacquiring', 'Locked'];
  let i = 0;
  setInterval(() => status.play({ text: words[++i % words.length] }), 2000);
</script>
```

`ch` matches the widest word exactly only in a monospace font; with a proportional font, measure the widest word once, or round up.

Options are validated: numbers out of range are clamped, invalid values fall back to the default, and development builds warn once per option.

<details>
<summary>Scramble options</summary>

| Option | Default | Meaning |
|---|---|---|
| `duration` | `0.7` | Seconds until the last character locks. |
| `fps` | `24` | Glyph and jitter refresh rate. Lower reads more analog. |
| `settle` | `0.35` | Seconds for colour and position to decay after a character locks. |
| `order` | `"ltr"` | Lock order: ltr, rtl, center or random. With typing, also the order characters appear in. |
| `reveal` | `"all"` | 'all': every character scrambles at once. 'type': characters appear one by one in order, the width reserved from the start. |
| `trail` | `0.15` | Typing: seconds a character scrambles between appearing and locking. |
| `speed` | `0` | Typing: characters per second; when above 0 the run length follows the text and duration is ignored. |
| `cursor` | `false` | Typing: block caret at the typing head. Colour: --nf-cursor. |
| `chars` | `"01#%=$>≤<"` | Glyphs used while scrambling. |
| `palette` | `["#ff2bd6","#00f0ff","#f5ff3b"]` | Colours for scrambling glyphs and lines; [0] and [1] drive the RGB split. |
| `jitter` | `1.5` | Max vertical offset of a scrambling character, px. |
| `skew` | `8` | Max skew of a scrambling character, degrees. |
| `rgbSplit` | `1.5` | Chromatic aberration, px. |
| `glow` | `6` | Bloom on scrambling characters, px. |
| `flicker` | `0.12` | Chance (0-1) a scrambling character dims on a frame. |
| `lines` | `3` | Glitch lines drawn over the label (0-8). |
| `tear` | `2` | Horizontal sync slip of the whole label, px. |
| `scanlines` | `true` | Rolling scanline overlay while live. |

</details>

<details>
<summary>Glitch options</summary>

| Option | Default | Meaning |
|---|---|---|
| `duration` | `0.6` | Seconds per full glitch. |
| `fps` | `20` | Frame refresh rate. |
| `palette` | `["#ff2bd6","#00f0ff","#f5ff3b"]` | Colours for lines and tinted bands. |
| `rgbSplit` | `6` | Max R/B channel offset, px. |
| `slices` | `10` | Horizontal bands displaced per frame at full amount. |
| `tear` | `24` | Max sideways displacement of a band, px. |
| `blocks` | `6` | Rectangles copied out of place per frame. |
| `lines` | `4` | Palette-coloured scan lines per frame. |
| `jitter` | `2` | Vertical shake of the whole frame, px. |
| `flicker` | `0.1` | Chance (0-1) a frame dims. |
| `scanlines` | `true` | Rolling scanline overlay while live. |

</details>

<details>
<summary>Ambient options</summary>

| Option | Default | Meaning |
|---|---|---|
| `rate` | `30` | Micro-glitches per minute, across all targets. |
| `amount` | `0.2` | Share (0-1) of each target disturbed. |
| `duration` | `0.18` | Seconds per micro-glitch. |
| `intensity` | `0.5` | Artefact strength (0-1). |
| `enabled` | `true` | Start scheduling immediately. |

</details>

Live demo, full reference and a playground that writes the configuration for you: [the project site](https://digitalemagine.github.io/noisefloor/), also built locally by `npm run build:site`.

## HTML attributes

For static pages and CMS content, the same effects can be declared in markup. Import `noisefloor/auto` once, or load `noisefloor.auto.iife.js` (the full library plus auto-init) instead of the plain script tag:

```html
<script src="https://unpkg.com/noisefloor/dist/noisefloor.auto.iife.js"></script>

<a href="#docs"><span data-nf="scramble" data-nf-order="center">Docs</span></a>
<span data-nf="scramble" data-nf-reveal="type" data-nf-trigger="visible" data-nf-once>Reacquiring signal</span>
<img data-nf="glitch" data-nf-rgb-split="6" data-nf-ambient src="feed.jpg" alt="Camera feed">
```

```js
import 'noisefloor/auto';
```

- `data-nf`: `scramble` or `glitch` (an `<img>` only).
- `data-nf-<option>`: any effect option, in kebab case (`data-nf-rgb-split`) or as one word (`data-nf-rgbsplit`). Numbers and strings as written; booleans are true when present and false with `"false"`; `data-nf-palette` is a comma-separated list.
- `data-nf-trigger`: as `bind()`'s `trigger` (default hover/focus of the closest link or button; `visible`; any event name), or `none` for no trigger. `data-nf-once`: unbind after the first play.
- `data-nf-ambient`: add the element to one shared Ambient; `ambient().set({ rate: 12 })` changes its options.

It scans the document when it is ready and watches it: elements added later are set up, removed ones are destroyed, and changing `data-nf` rebuilds the effect. Other attributes are read once. Elements that already have an instance are skipped. The module exports `scan(root)` (for shadow roots, which the observer does not see), `start()`, `stop()` and `ambient()`; the script-tag bundle exposes them as `Noisefloor.auto`.

Not for markup a framework renders: use the recipes below, which control when instances are created and destroyed.

## Frameworks

React, Vue and Svelte own the nodes they render, while Scramble replaces an element's children and Glitch moves the img into a wrapper. Without care, the next render corrupts the label or throws (React: `insertBefore ... is not a child of this node`). Three rules keep them apart:

- **Render the label once**, then change it with `play({ text })`: the framework never patches the text node Scramble replaced. React: the first value from `useState`; Vue: `v-once`; Svelte: `untrack`.
- **Wrap the img in an element marked `data-nf-wrap`.** Glitch uses it instead of inserting its own wrapper, so the img stays where the framework put it.
- **Create instances after mount and `destroy()` them on unmount.** Options are read at mount; change them later with `set()`.

Checked with React 19 (StrictMode), Vue 3.5 and Svelte 5.

<details>
<summary>React</summary>

```jsx
// ScrambleText.jsx
import { useEffect, useRef, useState } from 'react';
import { Scramble } from 'noisefloor';

export function ScrambleText({ text, options, bindOptions }) {
  const ref = useRef(null);
  const inst = useRef(null);
  // Rendered once: Scramble owns the children from then on; later text goes through play().
  const [initial] = useState(text);

  useEffect(() => {
    const [s] = Scramble.bind(ref.current, options, bindOptions);
    inst.current = s;
    return () => s.destroy();
  }, []);

  useEffect(() => {
    const s = inst.current;
    if (s && s.text !== text) s.play({ text });
  }, [text]);

  return <span ref={ref}>{initial}</span>;
}
```

```jsx
// GlitchImage.jsx
import { useEffect, useRef } from 'react';
import { Glitch } from 'noisefloor';

export function GlitchImage({ options, bindOptions, ...img }) {
  const ref = useRef(null);

  useEffect(() => {
    const [g] = Glitch.bind(ref.current, options, bindOptions);
    return () => g.destroy();
  }, []);

  // data-nf-wrap: Glitch uses this span instead of moving the img into its own wrapper.
  return (
    <span data-nf-wrap="" style={{ display: 'inline-block' }}>
      <img ref={ref} {...img} />
    </span>
  );
}
```

</details>

<details>
<summary>Vue</summary>

`ScrambleText.vue`:

```vue
<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Scramble } from 'noisefloor';

const props = defineProps({ text: { type: String, required: true }, options: Object, bindOptions: Object });
const el = ref(null);
let s = null;

onMounted(() => { [s] = Scramble.bind(el.value, props.options, props.bindOptions); });
watch(() => props.text, (text) => { if (s) s.play({ text }); });
onBeforeUnmount(() => { if (s) s.destroy(); });
</script>

<template>
  <!-- v-once: Vue renders the first text and never patches it; later text goes through play() -->
  <span ref="el" v-once>{{ text }}</span>
</template>
```

`GlitchImage.vue`:

```vue
<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Glitch } from 'noisefloor';

const props = defineProps({ src: String, alt: String, options: Object, bindOptions: Object });
const img = ref(null);
let g = null;

onMounted(() => { [g] = Glitch.bind(img.value, props.options, props.bindOptions); });
onBeforeUnmount(() => { if (g) g.destroy(); });
</script>

<template>
  <!-- data-nf-wrap: Glitch uses this span instead of moving the img into its own wrapper -->
  <span data-nf-wrap style="display: inline-block"><img ref="img" :src="src" :alt="alt"></span>
</template>
```

</details>

<details>
<summary>Svelte</summary>

`ScrambleText.svelte`:

```svelte
<script>
  import { untrack } from 'svelte';
  import { Scramble } from 'noisefloor';

  let { text, options, bindOptions } = $props();
  // Rendered once: Scramble owns the children from then on; later text goes through play().
  const initial = untrack(() => text);

  function scramble(node, text) {
    const [s] = Scramble.bind(node, options, bindOptions);
    return {
      update(next) { s.play({ text: next }); },
      destroy() { s.destroy(); }
    };
  }
</script>

<span use:scramble={text}>{initial}</span>
```

`GlitchImage.svelte`:

```svelte
<script>
  import { Glitch } from 'noisefloor';

  let { options, bindOptions, ...img } = $props();

  function glitch(node) {
    const [g] = Glitch.bind(node, options, bindOptions);
    return { destroy() { g.destroy(); } };
  }
</script>

<!-- data-nf-wrap: Glitch uses this span instead of moving the img into its own wrapper -->
<span data-nf-wrap style="display: inline-block"><img use:glitch {...img} /></span>
```

</details>

## Content-Security-Policy

The base CSS is injected as a `<style>` element, which a policy without `'unsafe-inline'` in `style-src` blocks. Load the stylesheet yourself and turn injection off before creating instances:

```js
import 'noisefloor/style.css'; // or <link rel="stylesheet" href="https://unpkg.com/noisefloor/dist/style.css">
import { configure } from 'noisefloor';

configure({ injectCSS: false });
```

Inside a shadow root, the stylesheet must be loaded in that root.

## Browser support

Safari 16, Chrome and Edge 107, Firefox 104 and later (the default build target of Vite, Baseline widely available). The published files use no syntax beyond what these browsers support; a bundler targeting older browsers transpiles them. With the script tag, an older browser skips the library and the labels and images show unchanged.

## Development

```sh
npm i && npx playwright install chromium
npm run typecheck    # tsc --noEmit
npm test             # unit tests (Vitest browser mode, headless Chromium)
npm run build        # dist/: ESM, CJS, browser global bundle, .d.ts, style.css
npm run check:package # publint, arethetypeswrong, tree-shaking check (needs dist/)
npm run build:site   # site/dist/index.html (demo, docs, playground)
npm run smoke        # build, build:site, headless smoke test of the built site
npm run fidelity     # build, build:site, image overlay vs real image comparison
```

Design notes and decisions: `docs/DESIGN.md`. Changes: `CHANGELOG.md`.

## About this project

Like some of my other recent projects, noisefloor is a Claude-first experiment: the code, tests, docs and site were written with an AI assistant (Claude Code). My role was to steer it: I set the direction, reviewed plans before any code, challenged answers, iterated and reviewed the changes. The site illustrations are mine. Every change runs through the checks in this repository: unit tests in headless Chromium, a smoke test of the built site and a pixel comparison of the image overlay against the real image. It surely has rough edges I haven't found yet; feedback is welcome.

## Licence

MIT, Copyright (c) 2026 digitalemagine.
