import { ParseError } from "@paradox/utils";

type FlagMap = Record<string, number>;

const DAT_FLAGS_710: FlagMap = {
  GROUND: 0,
  ON_BOTTOM: 1,
  ON_TOP: 2,
  CONTAINER: 3,
  STACKABLE: 4,
  MULTI_USE: 5,
  FORCE_USE: 6,
  WRITABLE: 7,
  WRITABLE_ONCE: 8,
  FLUID_CONTAINER: 9,
  FLUID: 10,
  UNPASSABLE: 11,
  UNMOVABLE: 12,
  BLOCK_MISSILES: 13,
  PICKUPABLE: 14,
  LIGHT_INFO: 16,
  FLOOR_CHANGE: 17,
  FULL_GROUND: 18,
  HAS_ELEVATION: 19,
  HAS_OFFSET: 20,
  DONT_HIDE: 21,
  MINIMAP: 22,
  ROTATABLE: 23,
  LYING_OBJECT: 24,
  HANGABLE: 25,
  VERTICAL: 26,
  HORIZONTAL: 27,
  ALWAYS_ANIMATE: 28,
  LENS_HELP: 29,
  END_OF_FLAGS: 255,
};

const DAT_FLAGS_740_750: FlagMap = {
  ...DAT_FLAGS_710,
  BLOCK_PATHFINDER: 14, // inserted at byte 14; PICKUPABLE shifts to 15
  PICKUPABLE: 15,
};

const DAT_FLAGS_755_772: FlagMap = {
  ...DAT_FLAGS_740_750,
  GROUND_BORDER: 1,
  ON_BOTTOM: 2,
  ON_TOP: 3,
  CONTAINER: 4,
  STACKABLE: 5,
  FORCE_USE: 6,
  MULTI_USE: 7,
  WRITABLE: 8,
  WRITABLE_ONCE: 9,
  FLUID_CONTAINER: 10,
  FLUID: 11,
  UNPASSABLE: 12,
  UNMOVABLE: 13,
  BLOCK_MISSILES: 14,
  BLOCK_PATHFINDER: 15,
  PICKUPABLE: 16,
  HANGABLE: 17,
  VERTICAL: 18,
  HORIZONTAL: 19,
  ROTATABLE: 20,
  LIGHT_INFO: 21,
  DONT_HIDE: 22,
  FLOOR_CHANGE: 23,
  HAS_OFFSET: 24,
  HAS_ELEVATION: 25,
  LYING_OBJECT: 26,
  ALWAYS_ANIMATE: 27,
  MINIMAP: 28,
  LENS_HELP: 29,
  FULL_GROUND: 30,
};

const DAT_FLAGS_860_980: FlagMap = {
  ...DAT_FLAGS_755_772,
  TRANSLUCENT: 23,
  IGNORE_USER: 31,
  CLOTH: 32,
  MARKET: 33,
  USABLE: 34,
  WRAPPABLE: 35,
  UNWRAPPABLE: 36,
  TOP_EFFECT: 37,
  FLOOR_CHANGE: 252,
};

function incrementFlags(flags: FlagMap, increment: number, minimum: number): FlagMap {
  const result: FlagMap = {};
  for (const [key, value] of Object.entries(flags)) {
    result[key] = value <= minimum ? value : value + increment;
  }
  return result;
}

const DAT_FLAGS_1000_PLUS: FlagMap = {
  ...incrementFlags(DAT_FLAGS_860_980, 1, 15),
  NO_MOVE_ANIMATION: 16,
};

type VersionGroup = { flags: FlagMap; versions: readonly number[] };

const VERSION_GROUPS: readonly VersionGroup[] = [
  { flags: DAT_FLAGS_710, versions: [710] },
  { flags: DAT_FLAGS_740_750, versions: [740, 750] },
  { flags: DAT_FLAGS_755_772, versions: [755, 760, 770, 772] },
  { flags: DAT_FLAGS_860_980, versions: [860, 870, 960, 980] },
  { flags: DAT_FLAGS_1000_PLUS, versions: [1098] },
];

export function getDatFlags(version: number): FlagMap {
  const group = VERSION_GROUPS.find((g) => g.versions.includes(version));
  if (!group) throw new ParseError(`No flag map for version ${version}`);
  return group.flags;
}
