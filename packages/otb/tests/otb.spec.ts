import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { OtbFile } from "../src/otb.js";
import { Otb } from "../src/otb.js";
import { ITEM_GROUP } from "../src/otb-config.js";

const dirname = fileURLToPath(new URL(".", import.meta.url));
const fixture = (name: string) => join(dirname, "..", "fixtures", name);

function readFixture(version: number): ArrayBuffer {
  const buf = readFileSync(fixture(`items-${version}.otb`));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function loadOtb(version: number): OtbFile {
  return Otb().load(readFixture(version));
}

describe("items-772.otb", () => {
  let file: OtbFile;

  beforeAll(() => {
    file = loadOtb(772);
  });

  it("validate() does not throw", () => {
    expect(() => Otb().validate(readFixture(772))).not.toThrow();
  });

  it("count is greater than 0", () => {
    expect(file.count).toBeGreaterThan(0);
  });

  it("schemaVersion major is a known OTB version", () => {
    const major = parseInt(file.schemaVersion.split(".")[0]!, 10);
    expect([1, 2, 3]).toContain(major);
  });

  it("item 100 exists and is not deprecated", () => {
    const item = file.get(100);
    expect(item).toBeDefined();
    expect(item!.group).not.toBe(ITEM_GROUP.DEPRECATED);
  });

  it("item 100 is in GROUND group", () => {
    expect(file.get(100)!.group).toBe(ITEM_GROUP.GROUND);
  });

  it("item 100 has a non-zero cid", () => {
    expect(file.get(100)!.cid).toBeGreaterThan(0);
  });

  it("entries() count matches file.count and get() returns identical references", () => {
    let n = 0;
    for (const [sid, item] of file.entries()) {
      expect(file.get(sid)).toBe(item);
      n++;
    }
    expect(n).toBe(file.count);
  });

  it("all items have groups within the valid range (not DEPRECATED)", () => {
    for (const [, item] of file.entries()) {
      expect(item.group).toBeGreaterThanOrEqual(ITEM_GROUP.NONE);
      expect(item.group).toBeLessThan(ITEM_GROUP.DEPRECATED);
    }
  });

  it("all entries have sid matching their map key", () => {
    for (const [sid, item] of file.entries()) {
      expect(item.sid).toBe(sid);
    }
  });
});

// ─── items-960: coverage for attribute handlers absent in 772 ─────────────────

describe("items-960.otb", () => {
  let file: OtbFile;

  beforeAll(() => {
    file = loadOtb(960);
  });

  it("count is greater than 5000", () => {
    expect(file.count).toBeGreaterThan(5000);
  });

  it("schemaVersion is 3.x.x", () => {
    expect(file.schemaVersion.startsWith("3.")).toBe(true);
  });

  it("all items have groups within the valid range (not DEPRECATED)", () => {
    for (const [, item] of file.entries()) {
      expect(item.group).toBeGreaterThanOrEqual(ITEM_GROUP.NONE);
      expect(item.group).toBeLessThan(ITEM_GROUP.DEPRECATED);
    }
  });

  it("all entries have sid matching their map key", () => {
    for (const [sid, item] of file.entries()) {
      expect(item.sid).toBe(sid);
    }
  });
});
