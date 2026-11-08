# @paradoxlab/utils

## 0.3.0

### Minor Changes

- d695c52: Add `createOutputBuffer`, one growing buffer per file with raw and escaped writes and chunked `take()`, and per-file text codecs (`windows1252`, `windows1250`, `windows1251`, `utf8`) with `detectTextCodec` and `UnencodableTextError`.

  Breaking changes:

  - `createEscapedBinaryWriter` and `EscapedBinaryWriter` are removed; use `createOutputBuffer`.
  - Readers and writers take a `text` codec option instead of an encoding label: `str(n, encoding)` and `escStr(n, encoding)` become `str(n)` and `escStr(n)`.
  - `createEscapedBinaryReader` and `createEscapedSliceReader` take an options object (`{ escapeMarker, text }`) instead of a bare escape marker.
  - Strings default to windows-1252 in both directions. Before, readers decoded windows-1252 (or ISO-8859-1 in the slice reader) while writers kept the low byte of each UTF-16 unit, which corrupted `’`, `€` and other characters in 0x80-0x9F.

## 0.2.0

### Minor Changes

- First unstable release
