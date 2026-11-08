// Constants that describe a built Asset Pack's columns. They import nothing, so both the builders
// and the browser-safe /load entry can expose them.

/** Bits of `ItemColumns.flags`. */
export const ItemFlag = {
  Walkable: 1 << 0,
  BlocksMissile: 1 << 1,
  BlocksPathfinder: 1 << 2,
  FullGround: 1 << 3,
  Container: 1 << 4,
  Stackable: 1 << 5,
  Moveable: 1 << 6,
  Pickupable: 1 << 7,
  Useable: 1 << 8,
  ForceUse: 1 << 9,
  MultiUse: 1 << 10,
  Readable: 1 << 11,
  AllowDistRead: 1 << 12,
  FluidContainer: 1 << 13,
  Fluid: 1 << 14,
  CannotDecay: 1 << 15,
  Hangable: 1 << 16,
  HookEast: 1 << 17,
  HookSouth: 1 << 18,
  Vertical: 1 << 19,
  Horizontal: 1 << 20,
  Rotatable: 1 << 21,
  AlwaysOnTop: 1 << 22,
  IsAnimation: 1 << 23,
  ClientCharges: 1 << 24,
  ClientDuration: 1 << 25,
  IgnoreLook: 1 << 26
} as const

/** Bits of `ItemColumns.floorChange`. */
export const FloorChange = {
  Any: 1 << 0,
  Down: 1 << 1,
  North: 1 << 2,
  East: 1 << 3,
  South: 1 << 4,
  West: 1 << 5
} as const

/** Values of `AppearanceColumns.order`: where a thing goes in a tile's stack, bottom to top. */
export const StackOrder = {
  Ground: 0,
  Border: 1,
  Bottom: 2,
  Top: 3,
  Common: 4
} as const

/** Bits of `AppearanceColumns.flags`. */
export const AppearanceFlag = {
  LyingObject: 1 << 0,
  AlwaysAnimate: 1 << 1,
  DontHide: 1 << 2,
  Translucent: 1 << 3,
  NoMoveAnimation: 1 << 4
} as const
