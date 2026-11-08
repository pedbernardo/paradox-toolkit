---
'@paradoxlab/backpack': minor
---

First release: item content by sid (`buildContent`, `backpack content`) and lossless sprite atlases in pages that fit a GPU texture (`buildSpriteSheet`, `backpack sprites`), with per-sprite extraction (`extractSprites`, `backpack extract`) and a PNG encoder without native dependencies (`encodePng`). Entry points: the package root for Node, `/content` and `/sprites` usable in browsers with an injected `deflate`.
