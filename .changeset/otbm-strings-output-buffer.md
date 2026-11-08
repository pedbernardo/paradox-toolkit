---
'@paradoxlab/otbm': patch
---

Strings are read and written as windows-1252 in both directions (they were read as ISO-8859-1 and written as the low byte of each UTF-16 unit), and the writer uses the shared output buffer.
