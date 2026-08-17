# TickTickClock — Temporal Intelligence Layer

Time-series continual learning engine. The `&time` primitive provider for the [&] Protocol ecosystem.

## Source-of-truth spec

- `docs/spec/README.md` — TickTickClock technical specification

## [&] Capabilities provided

| Capability | Contract | Operations |
|---|---|---|
| `&time.anomaly` | `AmpersandBoxDesign/contracts/v0.1.0/time.anomaly.contract.json` | detect, enrich, learn |
| `&time.forecast` | `AmpersandBoxDesign/contracts/v0.1.0/time.forecast.contract.json` | predict, explain, enrich, learn |
| `&time.pattern` | `AmpersandBoxDesign/contracts/v0.1.0/time.pattern.contract.json` | detect, summarize, enrich |

## Key technologies

- Selective State-Space Models (Mamba architecture) for anomaly detection
- Epoch-aware delta-CRDTs for convergent temporal state
- Multi-timescale consolidation (Nested Learning / Titans-inspired)
- Continual Compositionality & Orchestration (CCO)
- MCP-first API design

## Paired with

- **GeoFleetic** — spatial intelligence (when + where = complete situational awareness)
- **Graphonomous** — continual learning substrate
- **Delegatic** — governance enforcement for temporal operations

## Status

This is a spec site. **No implementation code — none, anywhere.** `build-site.mjs`
recounts that on every run (`.ex`/`.exs` lines outside `old_scraps/`) and the page
publishes the number. The nine figures in §10 of the spec are **targets**, and
three of them were published on the landing page as statistics until 2026-08-17;
see the retraction. Implementation will be Elixir/OTP when it starts; the
nearest honest first step is the spec's own **FV-2**, the multi-timescale
consolidation prototype, because it needs no model and no dataset.

## The landing page is GENERATED. Do not hand-edit `index.html`.

`/index.html`, `/phases.js` and `/say.js` are emitted by `build-site.mjs` from
`records/surface.json`, `docs/spec/README.md`, `records/contracts/*.contract.json`,
`src/landing.html`, `src/shell.css`, `src/phases.js` and `src/say.js`.
**An edit to the served HTML is reverted by the next build — and refused before
that**, because `records/build.json` fingerprints every input and hashes every
emitted artifact. Change the record or the template.

```
npm run test:launch   # re-derive the facts, emit the site, run the gate
```

`launch-gate.mjs` reads the emitted artifact and refuses to publish when it and
the records disagree: a retracted claim reinstated anywhere outside the
retraction, a performance target quoted as a figure, a rung invented, a CTA the
`spec` rung has not earned, a `§N` that resolves to no heading, an unrendered
token, a `mailto:`, a text token below 4.5:1, a same-origin link that resolves
to nothing, a stale or hand-edited artifact, or an identifying-animation
constant leaking into the copy. **It has been made to refuse 23 times
deliberately, against a throwaway copy, with an unmodified control run first** —
the control matters: the first run of that harness reported refusals that were
all refusing for an unrelated reason.

Do not hand-type the check count anywhere; the gate prints its own total.

Three checks are newer than the rest and are the ones to understand first:

- **The cascade resolver** (SHELL.md r7/r8). Every contrast check reads a
  *declared* token, and r7's header-CTA defect — `.top nav a` (0,2,1) beating
  `.btn` (0,1,0) — passed all of them for as long as it shipped on nine
  surfaces. The gate parses the emitted markup into elements with their
  ancestor chains, parses the emitted stylesheet with specificity, source
  order, `!important` and `@media`, and resolves `color` for every button at
  390px and 1280px, hovered and not. Cross-checked against the browser's own
  computed styles for all four buttons: they agreed. It also resolves
  `min-height` on the animation panel, because §8 placement is a computed
  height and not a string in a stylesheet.
- **Comment stripping is its own pass** (SHELL.md r8), and the page text is
  built by SPLITTING on tags rather than replacing them with a space. The
  first version shredded every text node into single words, which made every
  multi-word rule — including "no signup at the `spec` rung" — silently
  unfalsifiable. The gate now proves its own extractor on every run.
- **§10 is counted, never quoted.** The blocklist stops the three exact
  strings that shipped; this stops the shape of the defect coming back in
  another row's words.

**The band says "a specification in the ComputeDriven world", not "the temporal
layer of ComputeDriven", and that is deliberate.** `ampersand-nav` records
ticktickclock as `place: 3`, and its own `renderPlacement()` gives the layer
sentence to `place: 2` only; place 3 gets the specification sentence plus a spec
link, place 4 gets attribution alone. Three variants, not two.
