export type OtbItemFlags = {
  unpassable: boolean;
  blockMissiles: boolean;
  blockPathfinder: boolean;
  hasElevation: boolean;
  useable: boolean;
  pickupable: boolean;
  moveable: boolean;
  stackable: boolean;
  floorChangeDown: boolean;
  floorChangeNorth: boolean;
  floorChangeEast: boolean;
  floorChangeSouth: boolean;
  floorChangeWest: boolean;
  alwaysOnTop: boolean;
  readable: boolean;
  rotable: boolean;
  hangable: boolean;
  hookEast: boolean;
  hookSouth: boolean;
  cannotDecay: boolean;
  allowDistRead: boolean;
  clientDuration: boolean;
  clientCharges: boolean;
  ignoreLook: boolean;
  isAnimation: boolean;
  fullGround: boolean;
  forceUse: boolean;
};

export type OtbItemAttributes = {
  name?: string;
  description?: string;
  speed?: number;
  weight?: number;
  spriteHash?: Uint8Array;
  minimapColor?: number;
  maxItems?: number;
  rotateTo?: number;
  maxWriteLength?: number;
  maxReadLength?: number;
  lightLevel?: number;
  lightColor?: number;
  alwaysOnTopOrder?: number;
  wareId?: number;
  classification?: number;
};

export type OtbItem = {
  sid: number;
  cid: number;
  group: number;
  flags: OtbItemFlags;
  attributes: OtbItemAttributes;
};

export type OtbFile = {
  readonly schemaVersion: string;
  readonly count: number;
  readonly items: OtbItem[];
  get(sid: number): OtbItem | undefined;
  entries(): Iterable<[number, OtbItem]>;
};

export type OtbWriteInput = {
  items: OtbItem[];
  schemaVersion: string;
};
