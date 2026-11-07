---
status: accepted
date: 2026-11-07
---

# `@paradoxlab/backpack` generates Asset Packs and absorbs `thinger` and `spriter`

The toolkit is the **Asset Pack** generator for the Paradox Map editor and the paradox-engine. A pack needs item metadata (DAT + OTB, what `thinger` did), **Composed frames** (DAT + SPR), atlas pages (what `spriter` did, on raw sprites) and a browser-safe loader. We decided on a single package, `@paradoxlab/backpack` (CLI `backpack`), with four entry points: the root for building packs in Node, `/load` for the runtime loader with zero dependencies, `/content` for item metadata (formerly `thinger`), and `/sprites` for `.spr` atlases and per-sprite extraction (formerly `spriter`). `thinger` and `spriter` are removed from the repository with no further releases: both are 0.x with no relevant npm consumers, so no deprecation path is kept.

## Considered Options

- **A new `asset-pack` package on top of `thinger` and `spriter`**: rejected; it creates a three-level release cascade (parsers → tools → pack) and keeps two intermediate public APIs whose only standalone uses (the engine's `content.json`, a sprite sheet for a website) are covered by subpaths.
- **Frame composition inside `spriter`**: rejected; `spriter` would depend on the DAT and the pack format would have no clear owner.

## Consequences

- The dependency graph has two levels: `backpack → appearance, dat, spr, otb → utils`. `otbm` stays out of the chain; checking a pack against a map uses only the numbers in the OTBM header.
- `@paradoxlab/appearance` is a first-level, zero-dependency package (promoted from the editor's `packages/appearance`): its rules (sprite index, patterns, elevation, animation phase) describe DAT thing types, not packs, so they serve renderers and tools that never use a pack.
- Dropping `sharp` (native) is what made the merge cheap: without it, `backpack`'s dependencies are small, pure TypeScript parsers, and subpaths with `sideEffects: false` keep isolated uses light.
- The atlas packer and PNG encoder stay internal modules.
