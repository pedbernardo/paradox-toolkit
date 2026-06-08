<h1 align="center">
  <img
    src="./img/badge.png#gh-light-mode-only"
    alt="Paradox Toolkit logo"
  >

  <p align="center">
    <a href="https://github.com/pedbernardo/paradox-toolkit/actions/workflows/ci.yml">
      <img src="https://img.shields.io/github/actions/workflow/status/pedbernardo/paradox-toolkit/ci.yml?branch=main&label=CI" alt="CI">
    </a>
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License">
    <img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen" alt="Node >=22">
  </p>

  <p align="center">
    TypeScript parsers, writers, and build tools for the OTServer ecosystem.<br>
    Read, modify, and write <code>.dat</code>, <code>.spr</code>, <code>.otb</code>, and <code>.otbm</code> files with a clean, typed API.
  </p>
</h1>

<br>

## Packages

| Package | Version | Description |
|---|---|---|
| [`@paradoxlab/utils`](packages/utils/README.md) | [![npm](https://img.shields.io/npm/v/@paradoxlab/utils.svg)](https://www.npmjs.com/package/@paradoxlab/utils) | Shared binary reader/writer primitives |
| [`@paradoxlab/dat`](packages/dat/README.md) | [![npm](https://img.shields.io/npm/v/@paradoxlab/dat.svg)](https://www.npmjs.com/package/@paradoxlab/dat) | `.dat` parser and writer (item/creature/effect/missile definitions) |
| [`@paradoxlab/spr`](packages/spr/README.md) | [![npm](https://img.shields.io/npm/v/@paradoxlab/spr.svg)](https://www.npmjs.com/package/@paradoxlab/spr) | `.spr` parser and writer (sprites, RLE decompression) |
| [`@paradoxlab/otb`](packages/otb/README.md) | [![npm](https://img.shields.io/npm/v/@paradoxlab/otb.svg)](https://www.npmjs.com/package/@paradoxlab/otb) | `items.otb` parser and writer (OTServer item metadata) |
| [`@paradoxlab/otbm`](packages/otbm/README.md) | [![npm](https://img.shields.io/npm/v/@paradoxlab/otbm.svg)](https://www.npmjs.com/package/@paradoxlab/otbm) | `.otbm` parser and writer (OTServer map format) |
| [`@paradoxlab/thinger`](packages/thinger/README.md) | [![npm](https://img.shields.io/npm/v/@paradoxlab/thinger.svg)](https://www.npmjs.com/package/@paradoxlab/thinger) | Build tool: DAT + OTB → typed content JSON |
| [`@paradoxlab/spriter`](packages/spriter/README.md) | [![npm](https://img.shields.io/npm/v/@paradoxlab/spriter.svg)](https://www.npmjs.com/package/@paradoxlab/spriter) | Build tool: SPR → 4096×4096 spritesheet PNG + positions |

## Quick Start

```ts
import { readFileSync, writeFileSync } from 'node:fs'
import { Dat } from '@paradoxlab/dat'
import { Otb } from '@paradoxlab/otb'
import { Thinger } from '@paradoxlab/thinger'

// Parse binary files
const datFile = Dat().load(readFileSync('772.dat'))
const otbFile = Otb().load(readFileSync('items.otb'))

// Build typed content definitions
const { items, creatures, effects, missiles } = Thinger({ dat: datFile, otb: otbFile }).build()
console.log(`${items.length} items, ${creatures.length} creatures`)
// → 2004 items, 698 creatures

// Mutate and write back to binary
datFile.things[0]!.flags.stackable = true
writeFileSync('out.dat', Dat(772).write(datFile))
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

- **`.dat`** — Visual and layout definitions for every game entity (items, creatures, effects, missiles). One entry per client ID.
- **`.spr`** — Sprite data: 32×32 RGBA pixels, RLE-compressed, indexed by sprite ID.
- **`.otb`** — OTServer item metadata: server IDs, flags, and attributes like name and weight.
- **`.otbm`** — Map format: a binary tree of tile areas, towns, and waypoints.

paradox-toolkit provides full read and write support for all four formats, plus two build tools (`thinger`, `spriter`) that convert them into JSON and PNG artifacts suitable for game servers and web tooling.

## License

MIT — see [LICENSE](LICENSE).
