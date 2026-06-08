import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { DatFile } from "../src/dat.js";
import { Dat } from "../src/dat.js";

const dirname = fileURLToPath(new URL(".", import.meta.url));
const fixture = (name: string) => join(dirname, "..", "fixtures", name);

function loadDat(version: number): DatFile {
  const buffer = readFileSync(fixture(`dat-${version}.dat`));
  return Dat(version).load(buffer);
}

const FIXTURE_VERSIONS = [710, 740, 760, 772, 860, 870, 960, 980, 1098];

describe("smoke — all fixture versions", () => {
  for (const version of FIXTURE_VERSIONS) {
    it(`dat-${version}: loads without throwing`, () => {
      const file = loadDat(version);
      expect(file.counts.itemsMaxCid).toBeGreaterThan(0);
      expect(file.counts.creatures).toBeGreaterThan(0);
      expect(file.get(100)).toBeDefined();
      expect(file.get(100)?.group).toBe("items");
    });
  }
});
