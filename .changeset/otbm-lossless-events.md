---
'@paradoxlab/otbm': minor
---

Lossless OTBM: the reader reports a map as events in file order and the writer consumes the same events, so reading and writing back gives the same bytes, malformed maps included.

- `Otbm(options)` returns `read`, `source`, `load`, `write`, `writeStream` and `validate`. `read` takes one visitor or several, fed in a single pass. `write` and `writeStream` take an event source (a parsed file, a document, a composer, a conversion); `writeStream` hands out chunks with backpressure.
- `load` returns an `OtbmDocument` that keeps the Shape (inline vs node items, attribute order, unknown attributes and nodes, root type, trailing bytes) and is itself an event source.
- `collectSourceLayout` and `composeOtbm` write a consumer's own model (an `OtbmTileSource`) in the original layout, or in canonical areas with `layout: 'canonical'`.
- `upgradeOtbm` converts v1 → v2 → v3 in streaming; downgrades are refused.
- `compareOtbm` lists semantic differences between two maps.
- Strings use a text codec (`text` option, windows-1252 by default).
- Diagnostics for unexpected structure (unknown or misplaced nodes, extra properties, tile flags out of order, trailing bytes, strings that look like UTF-8), reported once per kind; ceilings in `DEFAULT_OTBM_LIMITS`.

Breaking: the 0.2 API is removed (`OtbmFile`, `OtbmWriteInput`, the optional-field `OtbmItem`, `OtbLookup`, the `cid` field, `decodeTileFlags`; the `OTBM_TILE_FLAG` bits stay). The map speaks sid only; OTBM v1 needs `hasInlineCount` (`inlineCountOf` from `@paradoxlab/otb`).
