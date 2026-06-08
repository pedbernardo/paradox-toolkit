import { describe, expect, it } from "vitest";
import { ParseError } from "@paradox/utils";
import { Dat } from "./dat.js";
import { DAT_SIGNATURES, THINGS_GROUPS } from "./dat-config.js";
import type { DatWriteInput, Thing } from "./types.js";

function minItem(cid: number): Thing {
  return {
    cid,
    group: "items",
    flags: {},
    layout: {
      width: 1,
      height: 1,
      layers: 1,
      patternX: 1,
      patternY: 1,
      patternZ: 1,
      frames: 1,
      realSize: 32,
      exactSize: 32,
    },
    spriteIds: [1],
  };
}

function minCreature(cid: number): Thing {
  return {
    cid,
    group: "creatures",
    flags: {},
    layout: {
      width: 1,
      height: 1,
      layers: 1,
      patternX: 1,
      patternY: 1,
      patternZ: 1,
      frames: 1,
      realSize: 32,
      exactSize: 32,
    },
    spriteIds: [2],
  };
}

describe("Dat — write() header", () => {
  it("writes correct signature for version 772", () => {
    const data: DatWriteInput = { version: 772, signature: 0, things: [minItem(100)] };
    const out = Dat(772).write(data);
    const view = new DataView(out.buffer);
    expect(view.getUint32(0, true)).toBe(DAT_SIGNATURES[772]);
  });

  it("itemsMaxCid is max(item.cid)", () => {
    const data: DatWriteInput = {
      version: 772,
      signature: 0,
      things: [minItem(100), minItem(200), minItem(150)],
    };
    const out = Dat(772).write(data);
    const view = new DataView(out.buffer);
    expect(view.getUint16(4, true)).toBe(200); // max CID among items
  });

  it("creature count derived from array length", () => {
    const data: DatWriteInput = {
      version: 772,
      signature: 0,
      things: [minItem(100), minCreature(1), minCreature(2)],
    };
    const out = Dat(772).write(data);
    const view = new DataView(out.buffer);
    expect(view.getUint16(6, true)).toBe(2); // creatures
  });

  it("effect and missile counts are zero when absent", () => {
    const data: DatWriteInput = { version: 772, signature: 0, things: [minItem(100)] };
    const out = Dat(772).write(data);
    const view = new DataView(out.buffer);
    expect(view.getUint16(8, true)).toBe(0); // effects
    expect(view.getUint16(10, true)).toBe(0); // missiles
  });
});

describe("Dat — write() layout", () => {
  it("realSize emitted only when width > 1 or height > 1", () => {
    const thinItem: Thing = {
      cid: 100,
      group: "items",
      flags: {},
      layout: {
        width: 2,
        height: 2,
        layers: 1,
        patternX: 1,
        patternY: 1,
        patternZ: 1,
        frames: 1,
        realSize: 64,
        exactSize: 64,
      },
      spriteIds: [1, 2, 3, 4],
    };
    const data: DatWriteInput = { version: 772, signature: 0, things: [thinItem] };
    const buf = Dat(772).write(data);
    const reparsed = Dat(772).load(buf);
    expect(reparsed.get("items", 100)?.layout.realSize).toBe(64);
    expect(reparsed.get("items", 100)?.layout.width).toBe(2);
  });

  it("exactSize field is NOT emitted (derived on parse)", () => {
    const data: DatWriteInput = { version: 772, signature: 0, things: [minItem(100)] };
    const buf = Dat(772).write(data);
    const reparsed = Dat(772).load(buf);
    // exactSize = Math.min(realSize, Math.max(1*32, 1*32)) = 32
    expect(reparsed.get("items", 100)?.layout.exactSize).toBe(32);
  });
});

describe("Dat — write() AnimationData", () => {
  it("animationData with signed loopCount and startPhase survives write", () => {
    const item: Thing = {
      cid: 100,
      group: "items",
      flags: {},
      layout: {
        width: 1,
        height: 1,
        layers: 1,
        patternX: 1,
        patternY: 1,
        patternZ: 1,
        frames: 2,
        realSize: 32,
        exactSize: 32,
        animation: {
          async: true,
          loopCount: -1,
          startPhase: -1,
          phaseDurations: [
            { min: 100, max: 200 },
            { min: 50, max: 150 },
          ],
        },
      },
      spriteIds: [10, 11],
    };
    const data: DatWriteInput = { version: 1098, signature: 0, things: [item] };
    const buf = Dat(1098).write(data);
    const reparsed = Dat(1098).load(buf);
    const animation = reparsed.get("items", 100)!.layout.animation!;
    expect(animation.async).toBe(true);
    expect(animation.loopCount).toBe(-1);
    expect(animation.startPhase).toBe(-1);
    expect(animation.phaseDurations).toEqual([
      { min: 100, max: 200 },
      { min: 50, max: 150 },
    ]);
  });
});

describe("Dat — write() MarketData", () => {
  it("item with market flag serializes all 6 fields correctly", () => {
    const item: Thing = {
      cid: 100,
      group: "items",
      flags: {
        market: {
          category: 3,
          tradeAs: 100,
          showAs: 200,
          name: "Gold Coin",
          restrictVocation: 1,
          requiredLevel: 50,
        },
      },
      layout: {
        width: 1,
        height: 1,
        layers: 1,
        patternX: 1,
        patternY: 1,
        patternZ: 1,
        frames: 1,
        realSize: 32,
        exactSize: 32,
      },
      spriteIds: [5],
    };
    const data: DatWriteInput = { version: 960, signature: 0, things: [item] };
    const buf = Dat(960).write(data);
    const reparsed = Dat(960).load(buf);
    expect(reparsed.get("items", 100)!.flags.market).toEqual({
      category: 3,
      tradeAs: 100,
      showAs: 200,
      name: "Gold Coin",
      restrictVocation: 1,
      requiredLevel: 50,
    });
  });
});

describe("Dat — write() frameGroups", () => {
  it("creature with frameGroups writes groupCount + groupType per group", () => {
    const creature: Thing = {
      cid: 1,
      group: "creatures",
      flags: {},
      layout: {
        width: 1,
        height: 1,
        layers: 1,
        patternX: 1,
        patternY: 1,
        patternZ: 1,
        frames: 1,
        realSize: 32,
        exactSize: 32,
      },
      spriteIds: [6],
      frameGroups: [
        {
          groupType: 0,
          layout: {
            width: 1,
            height: 1,
            layers: 1,
            patternX: 1,
            patternY: 1,
            patternZ: 1,
            frames: 1,
            realSize: 32,
            exactSize: 32,
          },
          spriteIds: [5],
        },
        {
          groupType: 1,
          layout: {
            width: 1,
            height: 1,
            layers: 1,
            patternX: 1,
            patternY: 1,
            patternZ: 1,
            frames: 1,
            realSize: 32,
            exactSize: 32,
          },
          spriteIds: [6],
        },
      ],
    };
    const data: DatWriteInput = { version: 1098, signature: 0, things: [creature] };
    const buf = Dat(1098).write(data);
    const reparsed = Dat(1098).load(buf);
    expect(reparsed.get("creatures", 1)!.frameGroups).toHaveLength(2);
    expect(reparsed.get("creatures", 1)!.frameGroups![0]!.groupType).toBe(0);
    expect(reparsed.get("creatures", 1)!.frameGroups![1]!.groupType).toBe(1);
  });
});

describe("Dat — write() version consistency", () => {
  it("Dat(772).write({ version: 760, ... }) throws ParseError", () => {
    const data: DatWriteInput = { version: 760, signature: 0, things: [minItem(100)] };
    expect(() => Dat(772).write(data)).toThrow(ParseError);
  });

  it("Dat().write({ version: 772, ... }) uses data.version without throwing", () => {
    const data: DatWriteInput = { version: 772, signature: 0, things: [minItem(100)] };
    expect(() => Dat().write(data)).not.toThrow();
    const buf = Dat().write(data);
    const view = new DataView(buf.buffer);
    expect(view.getUint32(0, true)).toBe(DAT_SIGNATURES[772]);
  });
});

describe("Dat — write() no items edge case", () => {
  it("itemsMaxCid is startId-1 when things has no items", () => {
    const data: DatWriteInput = { version: 772, signature: 0, things: [] };
    const buf = Dat(772).write(data);
    const view = new DataView(buf.buffer);
    expect(view.getUint16(4, true)).toBe(THINGS_GROUPS.items.startId - 1);
  });
});
