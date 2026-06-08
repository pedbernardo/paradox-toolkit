import { describe, expect, it } from "vitest";
import { Spriter } from "./spriter.js";
import { SPRITESHEET_SCHEMA_VERSION } from "./types.js";
import type { SprFile } from "@paradox/spr";

const COUNT = 5;
const VERSION = 772;
const SIGNATURE = 0x12345678;

function makeRgba(r: number, g: number, b: number): Uint8Array {
  const rgba = new Uint8Array(32 * 32 * 4);
  rgba[0] = r;
  rgba[1] = g;
  rgba[2] = b;
  rgba[3] = 255;
  return rgba;
}

function makeFakeSpr(count = COUNT): SprFile {
  const sprites = Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    rgba: makeRgba(0, 0, 0),
    width: 32 as const,
    height: 32 as const,
  }));

  return {
    get version() {
      return VERSION;
    },
    get signature() {
      return SIGNATURE;
    },
    get count() {
      return count;
    },
    get(id: number) {
      return sprites[id - 1];
    },
    *entries() {
      for (const s of sprites) yield [s.id, s] as [number, (typeof sprites)[0]];
    },
  };
}

describe("Spriter", () => {
  it("build() returns SpritesheetOutput with correct sprite count", async () => {
    const result = await Spriter({ spr: makeFakeSpr() }).build();
    expect(result.meta.sprites).toBe(COUNT);
  });

  it("positions.size equals sprite count", async () => {
    const result = await Spriter({ spr: makeFakeSpr() }).build();
    expect(result.positions.size).toBe(COUNT);
  });

  it("sprite 1 is at origin (0, 0)", async () => {
    const result = await Spriter({ spr: makeFakeSpr() }).build();
    expect(result.positions.get(1)).toEqual({ x: 0, y: 0 });
  });

  it("sprite 2 is at (33, 0) with default cellSize=33", async () => {
    const result = await Spriter({ spr: makeFakeSpr() }).build();
    expect(result.positions.get(2)).toEqual({ x: 33, y: 0 });
  });

  it("last sprite position is correct for multi-row grid with custom maxWidth", async () => {
    // maxWidth=66 -> columns=2 (floor(66/33)=2), rows=ceil(5/2)=3
    // sprite 5 is index 4: col=0, row=2 -> x=0, y=66
    const result = await Spriter({ spr: makeFakeSpr(5), maxWidth: 66 }).build();
    expect(result.positions.get(5)).toEqual({ x: 0, y: 66 });
  });

  it("meta.schema matches SPRITESHEET_SCHEMA_VERSION", async () => {
    const result = await Spriter({ spr: makeFakeSpr() }).build();
    expect(result.meta.schema).toBe(SPRITESHEET_SCHEMA_VERSION);
  });

  it("meta.spr is uppercase hex string of 8 chars", async () => {
    const result = await Spriter({ spr: makeFakeSpr() }).build();
    expect(result.meta.spr).toBe("12345678");
    expect(result.meta.spr).toHaveLength(8);
    expect(result.meta.spr).toMatch(/^[0-9A-F]{8}$/);
  });

  it("png is a non-empty Buffer", async () => {
    const result = await Spriter({ spr: makeFakeSpr() }).build();
    expect(Buffer.isBuffer(result.png)).toBe(true);
    expect(result.png.length).toBeGreaterThan(0);
  });

  it("maxWidth < 33 throws with descriptive error", () => {
    expect(() => Spriter({ spr: makeFakeSpr(), maxWidth: 32 })).toThrow(
      /maxWidth must be at least 33/,
    );
  });

  it("custom maxWidth changes column count and resulting dimensions", async () => {
    // maxWidth=66 -> columns=2, rows=3, width=65, height=98
    const result = await Spriter({ spr: makeFakeSpr(5), maxWidth: 66 }).build();
    expect(result.meta.width).toBe(65);
    expect(result.meta.height).toBe(98);
  });
});
