# Roadmap

Pending work in order. Remove items once done; rationale belongs in `DESIGN.md`.

## 1. After 0.1.0

- npm publishing without tokens: add the trusted publisher on the `noisefloor` package settings (GitHub Actions; repository `digitalemagine/noisefloor`, workflow `release.yml`, environment `npm`), set publishing access to require 2FA and disallow tokens, delete the npm tokens and the secrets on the `npm` environment. The next release then publishes through OIDC only; confirm it shows the provenance badge.
- Check a link preview of the site (Open Graph image) in a real client.

## Later

- CSP without a separate stylesheet: a `nonce` setting in `configure()`, set on the injected `<style>`, if `style.css` proves inconvenient. Not `adoptedStyleSheets` (see `DESIGN.md`, "CSS injection").
- `noisefloor/auto` scoping, only if observer cost shows up: benchmark the page-wide MutationObserver under heavy DOM churn; if needed, a Stimulus-style `start(root)` (needs a way to skip the automatic start) and a `data-nf-ignore` subtree opt-out. No page-level gate attribute: importing the entry point is the opt-in.
- `<video>` support for Glitch (VFX-JS has it).
- Paragraph-scale Scramble, if asked for (decoding or typing in body text). Scramble is per character, which is too many elements and per-frame restyles for long text. First benchmark the current mode on long text; then a per-word mode (word cells sized like character cells, so the layout still never moves), with lighter styling (glyph swaps and palette colour, no per-character jitter, skew or glow) and tear and glitch lines per line rather than per character; likely `granularity: 'word'` on Scramble rather than a new class. Wrapping must not change while scrambling.
- Thin framework wrappers under `@digitalemagine/` if recipes prove insufficient.

## Separate track: CodePen showcase

Goal: a demo polished enough to be picked for the CodePen Spark newsletter. Independent of the items above; needs its own discussion before any work.

Open questions:

- Form: a dedicated pen, a page of the project site, or pen code derived from the site.
- Library source in the pen: the published bundle from unpkg/jsdelivr (requires the npm release) or the source pasted in.
- Concept and content of the showcase itself.
