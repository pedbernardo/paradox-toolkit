# @paradoxlab/dat

## 0.2.1

### Patch Changes

- d695c52: Market names are read and written as windows-1252 in both directions, so every byte round-trips (before, writing kept the low byte of each UTF-16 unit and corrupted `’`, `€` and other characters in 0x80-0x9F). Writing a character windows-1252 cannot represent throws `UnencodableTextError`.
- Updated dependencies [d695c52]
  - @paradoxlab/utils@0.3.0

## 0.2.0

### Minor Changes

- First unstable release

### Patch Changes

- Updated dependencies
  - @paradoxlab/utils@0.2.0
