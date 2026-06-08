import { describe, it, expect } from "vitest";
import type { Thing, ThingFlags, ThingLayout } from "@paradox/dat";
import type { OtbItem, OtbItemFlags, OtbItemAttributes } from "@paradox/otb";
import { toItem, toVisualOnly } from "./thinger-mapper.js";

const defaultLayout: ThingLayout = {
  width: 1,
  height: 1,
  layers: 1,
  patternX: 1,
  patternY: 1,
  patternZ: 1,
  frames: 1,
  realSize: 32,
  exactSize: 32,
};

const defaultOtbFlags: OtbItemFlags = {
  unpassable: false,
  blockMissiles: false,
  blockPathfinder: false,
  hasElevation: false,
  useable: false,
  pickupable: false,
  moveable: false,
  stackable: false,
  floorChangeDown: false,
  floorChangeNorth: false,
  floorChangeEast: false,
  floorChangeSouth: false,
  floorChangeWest: false,
  alwaysOnTop: false,
  readable: false,
  rotable: false,
  hangable: false,
  hookEast: false,
  hookSouth: false,
  cannotDecay: false,
  allowDistRead: false,
  clientDuration: false,
  clientCharges: false,
  ignoreLook: false,
  isAnimation: false,
  fullGround: false,
  forceUse: false,
};

function makeThing(cid: number, flags: ThingFlags = {}): Thing {
  return { cid, group: "items", flags, layout: defaultLayout, spriteIds: [1] };
}

function makeOtb(
  cid: number,
  flags: Partial<OtbItemFlags> = {},
  attributes: OtbItemAttributes = {},
): OtbItem {
  return { sid: cid, cid, group: 1, flags: { ...defaultOtbFlags, ...flags }, attributes };
}

describe("mapItem - stackOrder", () => {
  it("returns 'ground' for ground flag", () => {
    const item = toItem(makeThing(1, { ground: { speed: 150 } }), undefined, {});
    expect(item.visual.stackOrder).toBe("ground");
  });

  it("returns 'border' for groundBorder flag", () => {
    const item = toItem(makeThing(1, { groundBorder: true }), undefined, {});
    expect(item.visual.stackOrder).toBe("border");
  });

  it("returns 'bottom' for onBottom flag", () => {
    const item = toItem(makeThing(1, { onBottom: true }), undefined, {});
    expect(item.visual.stackOrder).toBe("bottom");
  });

  it("returns 'top' for onTop flag", () => {
    const item = toItem(makeThing(1, { onTop: true }), undefined, {});
    expect(item.visual.stackOrder).toBe("top");
  });

  it("returns 'regular' when no stack flags", () => {
    const item = toItem(makeThing(1), undefined, {});
    expect(item.visual.stackOrder).toBe("regular");
  });
});

describe("mapItem - blocksSight and blocksMissile", () => {
  it("blocksSight === blocksMissile from OTB blockMissiles", () => {
    const item = toItem(makeThing(1), makeOtb(1, { blockMissiles: true }), {});
    expect(item.gameplay.blocksSight).toBe(true);
    expect(item.gameplay.blocksMissile).toBe(true);
    expect(item.gameplay.blocksSight).toBe(item.gameplay.blocksMissile);
  });

  it("both false when OTB blockMissiles is false", () => {
    const item = toItem(makeThing(1), makeOtb(1, { blockMissiles: false }), {});
    expect(item.gameplay.blocksSight).toBe(false);
    expect(item.gameplay.blocksMissile).toBe(false);
  });
});

describe("mapItem - floorChange flags", () => {
  it("floorChange comes from DAT independently of OTB directional flags", () => {
    const item = toItem(
      makeThing(1, { floorChange: true }),
      makeOtb(1, { floorChangeDown: true, floorChangeNorth: false }),
      {},
    );
    expect(item.gameplay.floorChange).toBe(true);
    expect(item.gameplay.floorChangeDown).toBe(true);
    expect(item.gameplay.floorChangeNorth).toBe(false);
  });

  it("floorChange is false when DAT flag absent, OTB directional still works", () => {
    const item = toItem(makeThing(1, {}), makeOtb(1, { floorChangeEast: true }), {});
    expect(item.gameplay.floorChange).toBe(false);
    expect(item.gameplay.floorChangeEast).toBe(true);
  });
});

describe("mapItem - writable and writableOnce", () => {
  it("writable preserves length from DAT", () => {
    const item = toItem(makeThing(1, { writable: { length: 255 } }), undefined, {});
    expect(item.gameplay.writable).toEqual({ length: 255 });
  });

  it("writableOnce preserves length from DAT", () => {
    const item = toItem(makeThing(1, { writableOnce: { length: 64 } }), undefined, {});
    expect(item.gameplay.writableOnce).toEqual({ length: 64 });
  });

  it("writable is null when DAT flag absent", () => {
    const item = toItem(makeThing(1), undefined, {});
    expect(item.gameplay.writable).toBeNull();
  });

  it("writableOnce is null when DAT flag absent", () => {
    const item = toItem(makeThing(1), undefined, {});
    expect(item.gameplay.writableOnce).toBeNull();
  });
});

describe("mapItem - offset", () => {
  it("offset maps offsetX/offsetY to x/y", () => {
    const item = toItem(makeThing(1, { hasOffset: { offsetX: 10, offsetY: 20 } }), undefined, {});
    expect(item.visual.offset).toEqual({ x: 10, y: 20 });
  });

  it("offset is null when DAT flag absent", () => {
    const item = toItem(makeThing(1), undefined, {});
    expect(item.visual.offset).toBeNull();
  });
});

describe("mapItem - numeric fields with default 0", () => {
  it("groundSpeed defaults to 0 when OTB attribute absent", () => {
    const item = toItem(makeThing(1), makeOtb(1, {}, {}), {});
    expect(item.gameplay.groundSpeed).toBe(0);
  });

  it("groundSpeed uses OTB speed attribute", () => {
    const item = toItem(makeThing(1), makeOtb(1, {}, { speed: 150 }), {});
    expect(item.gameplay.groundSpeed).toBe(150);
  });

  it("weight defaults to 0 when absent", () => {
    const item = toItem(makeThing(1), makeOtb(1), {});
    expect(item.gameplay.weight).toBe(0);
  });

  it("maxItems defaults to 0 when absent", () => {
    const item = toItem(makeThing(1), makeOtb(1), {});
    expect(item.gameplay.maxItems).toBe(0);
  });

  it("maxWriteLength defaults to 0 when absent", () => {
    const item = toItem(makeThing(1), makeOtb(1), {});
    expect(item.gameplay.maxWriteLength).toBe(0);
  });

  it("alwaysOnTopOrder defaults to 0 when absent", () => {
    const item = toItem(makeThing(1), makeOtb(1), {});
    expect(item.gameplay.alwaysOnTopOrder).toBe(0);
  });
});

describe("mapItem - light", () => {
  it("light is null when lightInfo absent", () => {
    const item = toItem(makeThing(1), undefined, {});
    expect(item.visual.light).toBeNull();
  });

  it("light maps lightInfo level and color", () => {
    const item = toItem(makeThing(1, { lightInfo: { level: 5, color: 0xff } }), undefined, {});
    expect(item.visual.light).toEqual({ level: 5, color: 0xff });
  });
});

describe("toVisualOnly - light", () => {
  it("light is null when lightInfo absent", () => {
    const visual = toVisualOnly(makeThing(1));
    expect(visual.visual.light).toBeNull();
  });

  it("light maps lightInfo level and color", () => {
    const visual = toVisualOnly(makeThing(1, { lightInfo: { level: 3, color: 0xaa } }));
    expect(visual.visual.light).toEqual({ level: 3, color: 0xaa });
  });
});

describe("mapItem - nullable fields return null when absent", () => {
  it("rotateTo is null when OTB attribute absent", () => {
    const item = toItem(makeThing(1), makeOtb(1), {});
    expect(item.gameplay.rotateTo).toBeNull();
  });

  it("rotateTo uses OTB attribute value", () => {
    const item = toItem(makeThing(1), makeOtb(1, {}, { rotateTo: 102 }), {});
    expect(item.gameplay.rotateTo).toBe(102);
  });

  it("minimapColor is null when both OTB and DAT minimap absent", () => {
    const item = toItem(makeThing(1), makeOtb(1), {});
    expect(item.gameplay.minimapColor).toBeNull();
  });

  it("minimapColor uses OTB attribute", () => {
    const item = toItem(makeThing(1), makeOtb(1, {}, { minimapColor: 210 }), {});
    expect(item.gameplay.minimapColor).toBe(210);
  });

  it("minimapColor falls back to DAT minimap.color when OTB absent", () => {
    const item = toItem(makeThing(1, { minimap: { color: 88 } }), makeOtb(1), {});
    expect(item.gameplay.minimapColor).toBe(88);
  });

  it("lensHelp is null when DAT flag absent", () => {
    const item = toItem(makeThing(1), makeOtb(1), {});
    expect(item.gameplay.lensHelp).toBeNull();
  });

  it("lensHelp uses DAT lensHelp.value", () => {
    const item = toItem(makeThing(1, { lensHelp: { value: 6 } }), makeOtb(1), {});
    expect(item.gameplay.lensHelp).toBe(6);
  });
});
