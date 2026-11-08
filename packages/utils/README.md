# @paradoxlab/utils

[![npm](https://img.shields.io/npm/v/@paradoxlab/utils.svg)](https://www.npmjs.com/package/@paradoxlab/utils)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

Shared primitives of the paradox-toolkit packages: cursor-based binary readers and writers, the escaped readers and output buffer of the OTB and OTBM formats, per-file text codecs, version feature flags and the typed errors.

## Installation

```bash
npm install @paradoxlab/utils
```

## How to use

```ts
import { createBinaryReader, createBinaryWriter, windows1252 } from '@paradoxlab/utils'

// Reading: every read advances the cursor; integers are little-endian
const reader = createBinaryReader(bytes, { text: windows1252 })
const signature = reader.u32()
const count = reader.u16()
const name = reader.str(count) // `count` bytes decoded with the reader's codec

// Writing: the buffer grows as needed
const writer = createBinaryWriter()
writer.u32(0xffffff00)
writer.str('Green Grass') // encoded with the writer's codec, no length prefix
const out: Uint8Array = writer.finish()
```

## Binary readers and writers

`createBinaryReader(source, { text? })` reads an `ArrayBuffer` or `Uint8Array`:

| Member | Description |
|---|---|
| `u8()`, `u16()`, `u32()` | Unsigned integers, little-endian |
| `str(n)` | `n` bytes decoded with the text codec |
| `bytes(n)`, `u16arr(n)` | Raw bytes; `n` u16 values |
| `skip(n)`, `seek(pos)` | Move the cursor |
| `seekByte(byte)`, `seekAnyByte(bytes)` | Advance to the next occurrence |
| `peekU8At(pos)` | Read without moving |
| `isEOF`, `offset`, `byteLength` | Cursor state |

`createBinaryWriter({ text? })` has `u8`, `u16`, `u32`, `str`, `bytes`, `length` and `finish()`.

### OTB and OTBM: escaped bytes

The OTB and OTBM formats reserve 0xFE (node start) and 0xFF (node end); a data byte ≥ 0xFD is written after the escape byte 0xFD.

- `createEscapedBinaryReader(source, { escapeMarker?, text? })` adds `escU8`, `escU16`, `escU32`, `escU64`, `escStr(n)`, `escBytes(n)` and `seekNodeBoundary` to the reader.
- `createEscapedSliceReader(bytes, options)` reads windows of one buffer without allocating (`seekWindow(begin, end)`, then `u8`, `u16`, `u32`, `str`, `skip`, `rest()`).
- `createOutputBuffer({ initialBytes?, text? })` is the writer side: raw and escaped writes (`escU8` … `escU64`, `escBytes`, `escStr` with a u16 length), `mark()` and `truncate(mark)` to drop a group, and `take()` to hand out what was written in chunks.

## Text codecs

Strings inside one file share one encoding. Every reader and writer that handles strings takes a `text` codec, `windows1252` by default:

| Codec | For |
|---|---|
| `windows1252` | Western European (default) |
| `windows1250` | Central European (Polish, Czech, …) |
| `windows1251` | Cyrillic |
| `utf8` | Files written in UTF-8 |

Each codec gives back the original bytes of a string that was not edited (`encode(decode(bytes))` is the identity, invalid UTF-8 included), and `encode` throws `UnencodableTextError` for a character the codec cannot represent (`canEncode` checks first). `detectTextCodec(strings)` suggests a codec for a file's raw strings, with a confidence and decoded samples.

## Versions

```ts
import { getVersionFeatures, isVersionSupported, SUPPORTED_VERSIONS } from '@paradoxlab/utils'

getVersionFeatures(772)
// → { patternZ: true, transparency: true, extendedSprites: false, animations: false, ... }
```

`getVersionFeatures` throws `UnsupportedVersionError` for a version outside `SUPPORTED_VERSIONS`.

## Errors

| Error | When |
|---|---|
| `ParseError` | Malformed or unexpected binary data; thrown by every parser |
| `UnsupportedVersionError` | A client version outside the supported list |
| `UnencodableTextError` | Writing a character the file's codec cannot represent |
| `BufferOverflowError`, `ByteNotFoundError` | A read past the end, or a byte that is not there |

---

[← Back to paradox-toolkit](../../README.md)
