---
status: accepted
date: 2026-11-07
---

# Strings are decoded with a per-file text codec, windows-1252 by default

OTBM, OTB and DAT store strings as bytes without recording their encoding, and each community wrote them in its own Windows code page: windows-1252 (Portuguese, English, Spanish), windows-1250 (Polish), windows-1251 (Russian), and UTF-8 in some modern forks. The toolkit decoded with `TextDecoder('latin1')` (which WHATWG defines as windows-1252) and the 0.2 OTBM writer encoded with `charCode & 0xff`, corrupting `’` and `€`. We decided that every reader and writer takes a **Text codec** option, windows-1252 by default, with windows-1250, windows-1251 and UTF-8 built in. Each single-byte codec decodes all 256 bytes to 256 distinct characters (verified in Node 26), so its inverse table makes any unedited string round-trip byte for byte. Text that the chosen codec cannot represent makes the encoder throw a typed error, never substitute a character. A detector suggests a codec (reliable for UTF-8, a frequency-based guess between windows-1250 and windows-1252); choosing one is the consumer's decision.

## Considered Options

- **Byte-to-char (true ISO-8859-1)**: lossless and neutral, but shows `’ “ ” – … €` as invisible control characters and cannot encode them when typed; rejected for display and editing.
- **Fixed windows-1252**: right for Western maps, wrong for the large Polish community; kept only as the default.
- **Raw bytes in events**: lossless, but leaves every consumer to decode on its own.
