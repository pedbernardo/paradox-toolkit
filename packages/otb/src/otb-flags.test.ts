import { describe, expect, it } from "vitest";
import { ITEM_FLAG, flagsToInt, getItemFlags } from "./otb-flags.js";

describe("getItemFlags", () => {
  it("returns all 27 flags as false when flagsInt is 0", () => {
    const flags = getItemFlags(0);
    for (const value of Object.values(flags)) {
      expect(value).toBe(false);
    }
    expect(Object.keys(flags)).toHaveLength(27);
  });

  it("returns true only for the matching flag when a single bit is set", () => {
    const flags = getItemFlags(ITEM_FLAG.STACKABLE);
    expect(flags.stackable).toBe(true);
    expect(flags.unpassable).toBe(false);
    expect(flags.moveable).toBe(false);
  });

  it("returns true for all bits set simultaneously", () => {
    const allFlags = Object.values(ITEM_FLAG).reduce((acc, v) => acc | v, 0);
    const flags = getItemFlags(allFlags);
    for (const value of Object.values(flags)) {
      expect(value).toBe(true);
    }
  });

  it("maps BLOCK_MISSILES to blockMissiles (snake_case → camelCase)", () => {
    const flags = getItemFlags(ITEM_FLAG.BLOCK_MISSILES);
    expect(flags.blockMissiles).toBe(true);
  });

  it("maps CLIENT_CHARGES to clientCharges", () => {
    const flags = getItemFlags(ITEM_FLAG.CLIENT_CHARGES);
    expect(flags.clientCharges).toBe(true);
  });
});

describe("flagsToInt", () => {
  it("returns 0 for all-false flags", () => {
    expect(flagsToInt(getItemFlags(0))).toBe(0);
  });

  it("round-trips a single-bit value", () => {
    const n = ITEM_FLAG.STACKABLE;
    expect(flagsToInt(getItemFlags(n))).toBe(n);
  });

  it("round-trips all flags set simultaneously", () => {
    const allBits = Object.values(ITEM_FLAG).reduce((acc, v) => acc | v, 0);
    expect(flagsToInt(getItemFlags(allBits))).toBe(allBits);
  });

  it("round-trips a realistic multi-flag value", () => {
    const n = ITEM_FLAG.UNPASSABLE | ITEM_FLAG.BLOCK_MISSILES | ITEM_FLAG.PICKUPABLE;
    expect(flagsToInt(getItemFlags(n))).toBe(n);
  });
});
