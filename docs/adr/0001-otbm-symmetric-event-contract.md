---
status: accepted
date: 2026-11-07
---

# OTBM reader and encoder share one event contract

`@paradoxlab/otbm` 0.2 parsed into one object per tile and item, could not hold an OTBM's **Shape**, and its writer always wrote header version 2, dropped MAP_DATA and reordered item stacks. Lossless-write spikes run in the Paradox Map editor (S1 reader, S5 writer: all 11 fixtures lossless, 10 byte-identical, 104 MB written in 1.5 s in a browser worker) showed that reader and writer must be designed together. We decided that the reader emits **OTBM events** in file order and the **Encoder** consumes the same events, so `read(bytes, encoder)` is a **Byte-identical roundtrip** with no model in between; that is the package's contract test. Everything else is built on top: an object model (`OtbmDocument`, a collector plus a replayer of events) for scripts and small maps, and a **Composer** that turns any editable model plus its **Source layout** into events.

## Considered Options

- **Extend the 0.2 object model with shape fields** (compatible API): rejected; it keeps one object per tile for every consumer (the largest known map has 9.5 M tiles).
- **Promote the spike code as is** (visitor reader, writer pulling `getTile` from the editor's model): rejected; it publishes an asymmetric contract and makes the lossless guarantee testable only through a model.
- **Pull cursor instead of push visitor**: rejected; the worker does not need pausing, and push keeps reader and encoder symmetric.

## Consequences

- Events carry the full **Shape**: root node type, areas, empty lists, unknown nodes at any depth, inline vs node items, the v1 **Inline count**, item attributes in file order (an immutable list allocated only when an item has attributes), and **Unknown tails**. Hot events (`tile`, `item`) take positional arguments; rare ones take objects. Tile attribute order (flags vs inline items) is canonical; any other order is reported as a diagnostic.
- The encoder decides nothing about shape and needs no item database. Reading OTBM v1 takes only a `hasInlineCount(sid)` predicate, built by `@paradoxlab/otb`; `otbm` keeps depending on `utils` only.
- `otbm` speaks **sid** only: `OtbLookup` and the `cid` field are removed. sid → cid is a consumer concern (`thinger`, asset packs).
- Unexpected structure is preserved, never repaired: a node in an unexpected place becomes an unknown node, extra properties become the node's tail, and a diagnostic is emitted. Repairing a map is an explicit consumer operation.
- Reading is tolerant by default (diagnostics, `strict` turns warnings into errors); fatal structure errors and hard ceilings always throw. The encoder is always strict.
- Version conversion is an event transform; only upgrades (v1 → v2 → v3) ship, since downgrades lose data.
- Breaking change: `OtbmFile`, `OtbmWriteInput` and the optional-field `OtbmItem` are removed in 0.3.0. The only external consumer (`paradox-engine/apps/editor`) pins 0.2.0.
