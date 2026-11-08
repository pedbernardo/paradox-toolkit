---
'@paradoxlab/backpack': minor
---

First release.

- Asset Packs: `buildPack` and `backpack build` write `pack.json`, `items.json` (one row per sid), `render.json` (appearances with their layers composed into trimmed, shared frames) and atlas pages, grounds and borders first. `@paradoxlab/backpack/load` reads a pack into typed arrays in browsers, workers and Node (`loadPack`, `urlReader`, `fsReader`), with views by sid (`pack.items.get(sid)`) and `checkCompatibility` against a map's OTB version.
- Item content by sid (`buildContent`, `backpack content`), with `viewContent` to read it by sid.
- Lossless sprite atlases in pages that fit a GPU texture (`buildSpriteSheet`, `backpack sprites`, `viewFrames`) and per-sprite extraction (`extractSprites`, `backpack extract`).
- A PNG encoder without native dependencies (`encodePng`) over an injected deflate (`deflateNode`, `deflateWeb`).
