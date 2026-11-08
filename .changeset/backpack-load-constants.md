---
'@paradoxlab/backpack': patch
---

`/load` exports `ItemFlag`, `FloorChange`, `StackOrder` and `AppearanceFlag`, so a browser that only loads packs can read item and appearance flags without importing `/content` (which carries the content builder) or the package root (which imports Node modules). The constants moved to a module with no imports; the root and `/content` still export the same objects.
