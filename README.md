<h1 align="center">
  <img src="./img/paradox-toolkit.png" alt="Paradox Toolkit logo">
  <p>Paradox Toolkit</p>
  <p align="center">
    <a href="https://github.com/pedbernardo/paradox-toolkit/actions/workflows/ci.yml">
      <img src="https://img.shields.io/github/actions/workflow/status/pedbernardo/paradox-toolkit/ci.yml?branch=main&label=CI" alt="CI">
    </a>
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License">
    <img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen" alt="Node >=22">
  </p>
</h1>

<p align="center">
  TypeScript parsers, writers, and build tools for the OTServer ecosystem.<br>
  Read, modify, and write <code>.dat</code>, <code>.spr</code>, <code>.otb</code>, and <code>.otbm</code> files, and build the assets a client or map editor loads.
</p>

<p align="center">
  <a href="#Packages">Packages</a> |
  <a href="#Quick-Start">Quick Start</a> |
  <a href="#Installation">Installation</a> |
  <a href="#Background">Background</a>
</p>

<br>

## Packages

| Package | Version | Description |
|---|---|---|
| [`@paradoxlab/utils`](packages/utils/README.md) | [![npm](https://img.shields.io/npm/v/@paradoxlab/utils.svg)](https://www.npmjs.com/package/@paradoxlab/utils) | Shared binary reader/writer primitives |
| [`@paradoxlab/dat`](packages/dat/README.md) | [![npm](https://img.shields.io/npm/v/@paradoxlab/dat.svg)](https://www.npmjs.com/package/@paradoxlab/dat) | `.dat` parser and writer (item/creature/effect/missile definitions) |
| [`@paradoxlab/spr`](packages/spr/README.md) | [![npm](https://img.shields.io/npm/v/@paradoxlab/spr.svg)](https://www.npmjs.com/package/@paradoxlab/spr) | `.spr` parser and writer (sprites, RLE decompression) |
| [`@paradoxlab/otb`](packages/otb/README.md) | [![npm](https://img.shields.io/npm/v/@paradoxlab/otb.svg)](https://www.npmjs.com/package/@paradoxlab/otb) | `items.otb` parser and writer (OTServer item metadata) |
| [`@paradoxlab/otbm`](packages/otbm/README.md) | [![npm](https://img.shields.io/npm/v/@paradoxlab/otbm.svg)](https://www.npmjs.com/package/@paradoxlab/otbm) | Lossless `.otbm` reader and writer (OTServer map format), streaming |
| [`@paradoxlab/appearance`](packages/appearance/README.md) | [![npm](https://img.shields.io/npm/v/@paradoxlab/appearance.svg)](https://www.npmjs.com/package/@paradoxlab/appearance) | Visual rules of thing types: sprite index, patterns, elevation, animation phase |
| [`@paradoxlab/backpack`](packages/backpack/README.md) | [![npm](https://img.shields.io/npm/v/@paradoxlab/backpack.svg)](https://www.npmjs.com/package/@paradoxlab/backpack) | Build tool: Asset Packs (items by sid, composed frames, atlas pages) and a browser loader; item content and sprite atlases |

## Quick Start

```ts
import { readFileSync, writeFileSync } from 'node:fs'
import { buildPack, deflateNode, writePack } from '@paradoxlab/backpack'
import { Dat } from '@paradoxlab/dat'
import { Otb } from '@paradoxlab/otb'
import { Otbm } from '@paradoxlab/otbm'
import { Spr } from '@paradoxlab/spr'

// Parse the client files
const dat = Dat().load(readFileSync('client.dat'))
const spr = Spr().load(readFileSync('client.spr'))
const otb = Otb().load(readFileSync('items.otb'))

// Change a thing and write it back
dat.get('items', 100)!.flags.stackable = true
writeFileSync('out.dat', Dat(dat.version).write(dat))

// Count a map's tiles without building objects
let tiles = 0
Otbm().read(readFileSync('map.otbm'), { tile: () => void tiles++ })

// Build an Asset Pack for a renderer: items by sid, composed frames, atlas pages
writePack('./pack', await buildPack({ dat, spr, otb, deflate: deflateNode }))
```

## Installation

Packages are independent - install only what you need:

```bash
npm install @paradoxlab/dat @paradoxlab/otb
# or
pnpm add @paradoxlab/dat @paradoxlab/otb
```

## Background

The **OTServer** ecosystem uses a set of binary formats inherited from the original client and servers like TFS (The Forgotten Server):

- **`.dat`** - Visual and layout definitions for game entities (items, creatures, effects, missiles). One entry per client ID.
- **`.spr`** - Sprite data: 32×32 RGBA pixels, RLE-compressed, indexed by sprite ID.
- **`.otb`** - OTServer item metadata: server IDs, flags, and attributes like name and weight.
- **`.otbm`** - Map format: a binary tree of tile areas, towns, and waypoints.

paradox-toolkit reads and writes all four formats, keeps OTBM maps byte for byte, and builds what renderers and tools load from them with `@paradoxlab/backpack`: Asset Packs, item content by sid and sprite atlases.

## License

**MIT** - see [LICENSE](LICENSE).
