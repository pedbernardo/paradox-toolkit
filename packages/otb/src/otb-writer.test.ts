import { describe, expect, it, vi } from "vitest";
import { ParseError } from "@paradox/utils";
import { Otb } from "./otb.js";
import { serializeOtb } from "./otb-writer.js";
import { ITEM_GROUP } from "./otb-config.js";
import type { OtbItem, OtbWriteInput } from "./types.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeItem(sid: number, overrides: Partial<OtbItem> = {}): OtbItem {
  return {
    sid,
    cid: 0,
    group: ITEM_GROUP.GROUND,
    flags: {
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
    },
    attributes: {},
    ...overrides,
  };
}

function roundTrip(input: OtbWriteInput) {
  return Otb().load(serializeOtb(input));
}

// ─── round-trip ───────────────────────────────────────────────────────────────

describe("serializeOtb — round-trip", () => {
  it("empty file round-trips", () => {
    const file = roundTrip({ items: [], schemaVersion: "3.57.0" });
    expect(file.count).toBe(0);
    expect(file.schemaVersion).toBe("3.57.0");
  });

  it("item count is preserved", () => {
    const items = [makeItem(100), makeItem(101), makeItem(102)];
    const file = roundTrip({ items, schemaVersion: "3.57.0" });
    expect(file.count).toBe(3);
  });

  it("each item is recoverable by sid", () => {
    const items = [makeItem(200, { cid: 300, attributes: { name: "Sword", speed: 80 } })];
    const file = roundTrip({ items, schemaVersion: "3.57.0" });
    const re = file.get(200)!;
    expect(re.sid).toBe(200);
    expect(re.cid).toBe(300);
    expect(re.attributes.name).toBe("Sword");
    expect(re.attributes.speed).toBe(80);
  });

  it("all TLV attributes survive round-trip", () => {
    const item = makeItem(150, {
      cid: 200,
      group: ITEM_GROUP.WEAPON,
      attributes: {
        name: "Axe",
        description: "sharp",
        speed: 90,
        weight: 100,
        spriteHash: new Uint8Array(16).fill(0x42),
        minimapColor: 210,
        maxItems: 5,
        rotateTo: 151,
        maxWriteLength: 255,
        maxReadLength: 512,
        lightLevel: 8,
        lightColor: 0xd7,
        alwaysOnTopOrder: 2,
        wareId: 1234,
        classification: 3,
      },
    });
    const a = roundTrip({ items: [item], schemaVersion: "3.57.0" }).get(150)!.attributes;
    expect(a.name).toBe("Axe");
    expect(a.description).toBe("sharp");
    expect(a.speed).toBe(90);
    expect(a.weight).toBe(100);
    expect(a.spriteHash).toEqual(new Uint8Array(16).fill(0x42));
    expect(a.minimapColor).toBe(210);
    expect(a.maxItems).toBe(5);
    expect(a.rotateTo).toBe(151);
    expect(a.maxWriteLength).toBe(255);
    expect(a.maxReadLength).toBe(512);
    expect(a.lightLevel).toBe(8);
    expect(a.lightColor).toBe(0xd7);
    expect(a.alwaysOnTopOrder).toBe(2);
    expect(a.wareId).toBe(1234);
    expect(a.classification).toBe(3);
  });

  it("latin1 char > 0x7F in name survives round-trip", () => {
    const item = makeItem(101, { attributes: { name: "\xe3" } });
    expect(roundTrip({ items: [item], schemaVersion: "3.57.0" }).get(101)!.attributes.name).toBe(
      "\xe3",
    );
  });

  it("wareId and classification survive round-trip", () => {
    const item = makeItem(102, { attributes: { wareId: 999, classification: 7 } });
    const a = roundTrip({ items: [item], schemaVersion: "3.57.0" }).get(102)!.attributes;
    expect(a.wareId).toBe(999);
    expect(a.classification).toBe(7);
  });

  it("flags round-trip", () => {
    const item = makeItem(104, {
      flags: { ...makeItem(104).flags, stackable: true, pickupable: true },
    });
    const flags = roundTrip({ items: [item], schemaVersion: "3.57.0" }).get(104)!.flags;
    expect(flags.stackable).toBe(true);
    expect(flags.pickupable).toBe(true);
    expect(flags.moveable).toBe(false);
  });
});

// ─── LIGHT2 ───────────────────────────────────────────────────────────────────

describe("serializeOtb — LIGHT2", () => {
  it("writes LIGHT2 (42), not LIGHT (36)", () => {
    const item = makeItem(103, { attributes: { lightLevel: 5, lightColor: 0xe0 } });
    const buf = serializeOtb({ items: [item], schemaVersion: "3.57.0" });
    expect(buf.includes(36)).toBe(false);
    const a = Otb().load(buf).get(103)!.attributes;
    expect(a.lightLevel).toBe(5);
    expect(a.lightColor).toBe(0xe0);
  });
});

// ─── validation ───────────────────────────────────────────────────────────────

describe("serializeOtb — validation", () => {
  it("throws ParseError for invalid schemaVersion", () => {
    expect(() => serializeOtb({ items: [], schemaVersion: "x" })).toThrow(ParseError);
  });

  it("throws ParseError for unsupported schema major version", () => {
    expect(() => serializeOtb({ items: [], schemaVersion: "99.0.0" })).toThrow(ParseError);
  });

  it("throws ParseError for sid=0", () => {
    expect(() => serializeOtb({ items: [makeItem(0)], schemaVersion: "3.57.0" })).toThrow(
      ParseError,
    );
  });

  it("throws ParseError for duplicate sid", () => {
    expect(() =>
      serializeOtb({ items: [makeItem(100), makeItem(100)], schemaVersion: "3.57.0" }),
    ).toThrow(ParseError);
  });
});

// ─── DEPRECATED ──────────────────────────────────────────────────────────────

describe("serializeOtb — DEPRECATED", () => {
  it("DEPRECATED item is absent from output", () => {
    const items = [makeItem(100, { group: ITEM_GROUP.DEPRECATED }), makeItem(101)];
    const file = roundTrip({ items, schemaVersion: "3.57.0" });
    expect(file.count).toBe(1);
    expect(file.get(101)).toBeDefined();
  });

  it("DEPRECATED item triggers console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    serializeOtb({
      items: [makeItem(100, { group: ITEM_GROUP.DEPRECATED })],
      schemaVersion: "3.57.0",
    });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("deprecated"));
    spy.mockRestore();
  });
});
