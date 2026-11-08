# @paradoxlab/otb

## 0.3.0

### Minor Changes

- d695c52: Add `inlineCountOf(otb)`, the predicate that reading an OTBM v1 needs (stackable, splash and fluid-container items store an untagged count byte).

  Item names and descriptions are read and written as windows-1252 in both directions, so every byte round-trips (before, writing kept the low byte of each UTF-16 unit). Writing a character windows-1252 cannot represent throws `UnencodableTextError`.

### Patch Changes

- Updated dependencies [d695c52]
  - @paradoxlab/utils@0.3.0

## 0.2.0

### Minor Changes

- First unstable release

### Patch Changes

- Updated dependencies
  - @paradoxlab/utils@0.2.0
