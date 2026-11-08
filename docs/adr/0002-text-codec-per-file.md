---
status: accepted
date: 2026-11-07
---

# OTBM strings are decoded with a per-file text codec; DAT and OTB use windows-1252

OTBM, OTB and DAT store strings as bytes without recording their encoding. In an OTBM, the strings are written by end users (books, signs, descriptions, town names), and each community wrote them in its own Windows code page: windows-1252 (Portuguese, English, Spanish), windows-1250 (Polish), windows-1251 (Russian), and UTF-8 in some modern forks. The toolkit decoded with `TextDecoder('latin1')` (which WHATWG defines as windows-1252) and the 0.2 OTBM writer encoded with `charCode & 0xff`, corrupting `’` and `€`.

We decided that the OTBM reader and encoder take a **Text codec** option, windows-1252 by default, with windows-1250, windows-1251 and UTF-8 built in. Each single-byte codec decodes all 256 bytes to 256 distinct characters (verified in Node 26), so its inverse table makes any unedited string round-trip byte for byte; UTF-8 keeps invalid bytes as U+DC80..U+DCFF for the same reason. Text that the chosen codec cannot represent makes the encoder throw a typed error, never substitute a character. A detector suggests a codec (reliable for UTF-8, a context-based guess between the single-byte code pages); choosing one is the consumer's decision.

DAT and OTB strings (market names, item names and descriptions) are game content shipped with the client, not user text: English, produced by tools, and not edited through the toolkit. They use windows-1252 with no option. Across the 17 OTB files available, the only non-ASCII names are two already corrupted at the source (UTF-8 bytes of U+FFFD), and they round-trip byte for byte anyway. The `utils` readers and writers still accept a codec, so a format can gain the option if a real case appears.

## Considered Options

- **Byte-to-char (true ISO-8859-1)**: lossless and neutral, but shows `’ “ ” – … €` as invisible control characters and cannot encode them when typed; rejected for display and editing.
- **Fixed windows-1252 everywhere**: right for Western maps, wrong for the large Polish community; kept as the default, and as the only codec for DAT and OTB.
- **A codec option on every format**: the first version of this decision; dropped for DAT and OTB, where it was ceremony without a real case.
- **Raw bytes in events**: lossless, but leaves every consumer to decode on its own.
