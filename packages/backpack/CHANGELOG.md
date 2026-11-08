# @paradoxlab/backpack

## 0.1.1

### Patch Changes

- 56d3530: `/load` exports `ItemFlag`, `FloorChange`, `StackOrder` and `AppearanceFlag`, so a browser that only loads packs can read item and appearance flags without importing `/content` (which carries the content builder) or the package root (which imports Node modules). The constants moved to a module with no imports; the root and `/content` still export the same objects.

## 0.1.0

### Minor Changes

- 9fb9866: First release.

  - Asset Packs: `buildPack` and `backpack build` write `pack.json`, `items.json` (one row per sid), `render.json` (appearances with their layers composed into trimmed, shared frames) and atlas pages, grounds and borders first. `@paradoxlab/backpack/load` reads a pack into typed arrays in browsers, workers and Node (`loadPack`, `urlReader`; `fsReader` from the root entry in Node), with views by sid (`pack.items.get(sid)`) and `checkCompatibility` against a map's OTB version.
  - Item content by sid (`buildContent`, `backpack content`), with `viewContent` to read it by sid.
  - Lossless sprite atlases in pages that fit a GPU texture (`buildSpriteSheet`, `backpack sprites`, `viewFrames`) and per-sprite extraction (`extractSprites`, `backpack extract`).
  - A PNG encoder without native dependencies (`encodePng`) over an injected deflate (`deflateNode`, `deflateWeb`).

### Patch Changes

- Updated dependencies [d695c52]
- Updated dependencies [d695c52]
  - @paradoxlab/dat@0.2.1
  - @paradoxlab/otb@0.3.0
  - @paradoxlab/spr@0.2.1
