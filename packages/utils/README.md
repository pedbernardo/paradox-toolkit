# @paradoxlab/utils

[![npm](https://img.shields.io/npm/v/@paradoxlab/utils.svg)](https://www.npmjs.com/package/@paradoxlab/utils)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

Shared binary reader and writer primitives used by all paradox-toolkit packages. Provides cursor-based reads and writes over `ArrayBuffer` / `Uint8Array`, version feature flags, and a typed parse error.

## Installation

```bash
npm install @paradoxlab/utils
```

## How to Use

```ts
import { createBinaryReader, createBinaryWriter, ParseError } from '@paradoxlab/utils'

// Reading
const reader = createBinaryReader(buffer)
const magic  = reader.u32()   // read 4 bytes as uint32
const count  = reader.u16()   // read 2 bytes as uint16
const name   = reader.str()   // read length-prefixed UTF-8 string
reader.skip(4)                // advance cursor by 4 bytes

// Writing
const writer = createBinaryWriter()
writer.u32(0xFFFFFF00)
writer.u16(count)
writer.str('Green Grass')
const result: Uint8Array = writer.bytes()

// Escaped sequences (OTB / OTBM formats)
import { createEscapedBinaryWriter } from '@paradoxlab/utils'
const esc = createEscapedBinaryWriter()
esc.escU16(100)   // writes 0xFD escape prefix when needed
```

## API

### `createBinaryReader(buffer: ArrayBuffer | Uint8Array)`

Returns a cursor-based reader. All reads advance the cursor.

| Method | Returns | Description |
|---|---|---|
| `u8()` | `number` | Read unsigned 8-bit integer |
| `u16()` | `number` | Read unsigned 16-bit integer (LE) |
| `u32()` | `number` | Read unsigned 32-bit integer (LE) |
| `f64()` | `number` | Read 64-bit float (LE) |
| `u16arr(n)` | `number[]` | Read `n` uint16 values |
| `str()` | `string` | Read uint16-prefixed UTF-8 string |
| `skip(n)` | `void` | Advance cursor by `n` bytes |
| `seek(pos)` | `void` | Move cursor to absolute position |
| `seekByte(byte)` | `number` | Advance until `byte` found; returns position or -1 |
| `peekU8()` | `number` | Read u8 without advancing cursor |
| `peekU16()` | `number` | Read u16 without advancing cursor |
| `peekU32()` | `number` | Read u32 without advancing cursor |

### `createBinaryWriter()`

Returns an auto-expanding writer. Call `.bytes()` to get the final `Uint8Array`.

| Method | Description |
|---|---|
| `u8(n)` | Write unsigned 8-bit integer |
| `u16(n)` | Write unsigned 16-bit integer (LE) |
| `u32(n)` | Write unsigned 32-bit integer (LE) |
| `i8(n)` | Write signed 8-bit integer |
| `i32(n)` | Write signed 32-bit integer (LE) |
| `str(s)` | Write uint16-prefixed UTF-8 string |
| `raw(bytes)` | Append raw bytes |
| `bytes()` | Return written data as `Uint8Array` |

### `createEscapedBinaryWriter()`

Extends `createBinaryWriter` with escape-sequence-aware writes (OTB / OTBM format: `0xFD` prefix before reserved bytes).

| Method | Description |
|---|---|
| `escU8(n)` | Write u8 with escape prefix if reserved |
| `escU16(n)` | Write u16 with escape prefix on reserved bytes |
| `escU32(n)` | Write u32 with escape prefix on reserved bytes |
| `escRaw(bytes)` | Write raw bytes escaping reserved values |

### `getVersionFeatures(version: number)`

Returns feature flags for a given client version.

```ts
import { getVersionFeatures } from '@paradoxlab/utils'
const features = getVersionFeatures(772)
// → { patternZ: false, extendedSprites: false, frameDurations: false, ... }
```

### `isVersionSupported(version: number): boolean`

Returns `true` if the version is in the supported range.

### `ParseError`

Typed error thrown by all toolkit readers on malformed input.

```ts
import { ParseError } from '@paradoxlab/utils'
try { Dat(772).load(badBuffer) }
catch (e) { if (e instanceof ParseError) console.error(e.message) }
```

---

[← Back to paradox-toolkit](../../README.md)
