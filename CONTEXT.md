# Paradox Toolkit

Parsers, writers and build tools for OTServer client and map formats (`.dat`, `.spr`, `.otb`, `.otbm`), published as `@paradoxlab/*`. The toolkit is self-contained: consumers such as the Paradox Map editor and the paradox-engine depend on it, never the other way around.

## Language

### Item identity

**sid**:
Server id of an item, as stored in `items.otb` and in every OTBM; the canonical item identity across the toolkit.
_Avoid_: item id, server item id

**cid**:
Client id of an item, its index in the `.dat`; identifies a visual, not an item.
_Avoid_: client item id, dat id

**OTB lineage**:
A family of `items.otb` files that keep the same sid for the same item; a sid is only meaningful within one lineage.
_Avoid_: OTB version (ambiguous with the file's own version fields)

### OTBM fidelity

**Shape**:
How an OTBM stores its content, as opposed to what it means: inline vs node items, attribute order, unknown tails, root node type, empty lists, header version.
_Avoid_: format details, raw form

**Unknown tail**:
The bytes of a node from its first attribute the reader does not understand to the end of the node, kept verbatim because OTBM attributes carry no length prefix.
_Avoid_: unknown attributes, garbage

**Inline count**:
The untagged count byte that follows the sid of stackable, splash and fluid items in OTBM v1; readable only with knowledge from the item's OTB entry.
_Avoid_: count attribute (that is the tagged form used from v2 on)

**Source layout**:
The order of tile areas and of tiles inside each area as found in the original file.
_Avoid_: original order, file order

**Lossless roundtrip**:
Reading and writing an OTBM without any semantic change: same tiles, items, attributes and map data.
_Avoid_: roundtrip (unqualified)

**Byte-identical roundtrip**:
A **Lossless roundtrip** that also reproduces the original bytes, which requires the full **Shape** and the **Source layout**.

**Text codec**:
The character encoding of the user-written strings inside one map (windows-1252, windows-1250, windows-1251 or UTF-8); a property of the map, never recorded in it, so it is chosen or detected per map.
_Avoid_: charset, latin1 (the WHATWG `latin1` label is windows-1252)

### OTBM API

**OTBM event**:
One step of an OTBM in file order (header, map data, area, tile, item, list, unknown node), carrying its content and its **Shape**; the shared vocabulary of the reader and the **Encoder**.
_Avoid_: callback, node (a node is the on-disk unit)

**Encoder**:
The OTBM writer: consumes **OTBM events** and produces bytes, deciding nothing about **Shape** on its own.
_Avoid_: serializer, writer (when the event-consuming role matters)

**Event source**:
Anything that replays **OTBM events** in steps, pausing at safe points so the **Encoder** can hand out output in bounded chunks: a parsed file, an object document, a **Composer**, or a conversion wrapping another source.
_Avoid_: producer, stream (overloaded with byte streams)

**Composer**:
An **Event source** that turns an editable map plus its **Source layout** into **OTBM events**, keeping unedited areas in their original order and placing new tiles in canonical areas.
_Avoid_: layout writer

### Assets

**Asset Pack**:
The pre-generated, versioned bundle a renderer needs for one client version and **OTB lineage**: item metadata by **sid**, appearances, atlas pages and the lookup tables between them.
_Avoid_: spritesheet (that is only the pages), content.json (the older item-metadata output)

**Appearance**:
How one **cid** is drawn: its sprite layout (size, layers, patterns, frames) and offset; shared by every **sid** that points to that cid.
_Avoid_: thing, visual (unqualified)

**Composed frame**:
One drawable image of an item, built by stacking the layers of its DAT appearance from SPR sprites; the unit of an **Asset Pack** atlas, as opposed to a raw sprite.
_Avoid_: sprite (a sprite is the raw 32×32 image in the `.spr`)

## Relationships

- The reader emits **OTBM events**; the **Encoder** consumes the same events, so piping one into the other is a **Byte-identical roundtrip**.
- A **Composer** feeds an **Encoder** when the map lives in a consumer's own model.
- A **sid** belongs to exactly one **OTB lineage**; many **sids** can point to the same **cid**.
- Reading an OTBM v1 requires knowing which **sids** carry an **Inline count**.

## Example dialogue

> **Dev:** "The map came back with the same tiles but a different file hash. Is that a bug?"
> **Domain expert:** "Not by itself: that is a **Lossless roundtrip** but not a **Byte-identical** one. Check whether the **Composer** had the **Source layout**, and whether the events kept the **Shape**."

## Flagged ambiguities

- "item id" was used for both **sid** and **cid**. Resolved: they are distinct; sid identifies an item, cid identifies a visual, and the mapping sid → cid is many-to-one.
- "version" of an OTBM header (0-3) vs OTBM v1-v4. Resolved: docs say "OTBM v1-v4"; the raw header field is "header version".
