---
status: accepted
date: 2026-11-07
---

# Asset Pack format: JSON in columns, one file per consumer, items by sid

The **Asset Pack** is a public contract read by the Paradox Map editor and, later, the paradox-engine, and it will grow to all of the game content (creatures, outfits). We decided on JSON files laid out for code, not for people. Each table is stored as columns (one array per field, flags as bitmasks), and the loader (`@paradoxlab/backpack/load`) turns the columns into typed arrays and offers rich per-item views (`items.get(sid)`) on demand. Files are split by consumer: `pack.json` (manifest, read first to reject an incompatible pack before downloading anything else), `items.json` (one entry per **sid**, never invented; `cid` kept as a field), `render.json` (appearances by **cid** plus the frame table), `page-N.png` (atlas), and per-category files loaded on demand for creatures and outfits. The **OTB lineage** is explicit in the manifest, `null` when there is no OTB (then sid = cid, declared).

## Considered Options

Measured at 10.98 scale (25.5 k items, 48 k frames; Node 26):

- **Binary tables**: gzip makes them as small as JSON (404 vs 412 KB for frames), and the parse gain is 4-8 ms. Not worth a second format.
- **Nested objects per item** (`placement`, `gameplay`): 22 ms parse and 74 ms parse plus worker clone, against 3.3 and 6.8 ms in columns, a 7-10x gap that grows with creatures and outfits. Human readability of the file is not worth that; developer experience comes from the loader API.
- **One file for everything**: the server does not need render data, and creatures and outfits should load on demand. **One file per domain** (5+): appearances and frames are always consumed together; splitting them only adds requests.

## Consequences

- `sid → appearance` lookup is derived by the loader from `items.json`; no separate table ships.
- Pack load time is a tracked performance metric, like the OTBM targets.
