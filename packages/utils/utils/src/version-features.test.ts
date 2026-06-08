import { describe, expect, it } from "vitest";
import { UnsupportedVersionError } from "./errors.js";
import { SUPPORTED_VERSIONS, getVersionFeatures, isVersionSupported } from "./version-features.js";

describe("isVersionSupported", () => {
  it("returns true for every version in SUPPORTED_VERSIONS", () => {
    for (const v of SUPPORTED_VERSIONS) {
      expect(isVersionSupported(v)).toBe(true);
    }
  });

  it("returns false for versions not in SUPPORTED_VERSIONS", () => {
    expect(isVersionSupported(500)).toBe(false);
    expect(isVersionSupported(773)).toBe(false);
    expect(isVersionSupported(999)).toBe(false);
  });
});

describe("getVersionFeatures", () => {
  it("version 710 - no optional features enabled", () => {
    const f = getVersionFeatures(710);
    expect(f.patternZ).toBe(false);
    expect(f.transparency).toBe(false);
    expect(f.extendedSprites).toBe(false);
    expect(f.animations).toBe(false);
    expect(f.idleAnimations).toBe(false);
    expect(f.frameDurations).toBe(false);
    expect(f.frameGroups).toBe(false);
  });

  it("version 750 - just below patternZ threshold", () => {
    const f = getVersionFeatures(750);
    expect(f.patternZ).toBe(false);
    expect(f.transparency).toBe(false);
  });

  it("version 755 - patternZ and transparency enabled", () => {
    const f = getVersionFeatures(755);
    expect(f.patternZ).toBe(true);
    expect(f.transparency).toBe(true);
    expect(f.extendedSprites).toBe(false);
  });

  it("version 772 - patternZ enabled, extendedSprites off", () => {
    const f = getVersionFeatures(772);
    expect(f.patternZ).toBe(true);
    expect(f.extendedSprites).toBe(false);
    expect(f.animations).toBe(false);
  });

  it("version 960 - extendedSprites enabled, animations still off", () => {
    const f = getVersionFeatures(960);
    expect(f.extendedSprites).toBe(true);
    expect(f.animations).toBe(false);
    expect(f.idleAnimations).toBe(false);
  });

  it("version 980 - extendedSprites on, animations still off", () => {
    const f = getVersionFeatures(980);
    expect(f.extendedSprites).toBe(true);
    expect(f.animations).toBe(false);
  });

  it("version 1098 - all features enabled", () => {
    const f = getVersionFeatures(1098);
    expect(f.patternZ).toBe(true);
    expect(f.transparency).toBe(true);
    expect(f.extendedSprites).toBe(true);
    expect(f.animations).toBe(true);
    expect(f.idleAnimations).toBe(true);
    expect(f.frameDurations).toBe(true);
    expect(f.frameGroups).toBe(true);
  });

  it("throws UnsupportedVersionError for an unsupported version", () => {
    expect(() => getVersionFeatures(500)).toThrow(UnsupportedVersionError);
  });

  it("error message contains the invalid version", () => {
    expect(() => getVersionFeatures(500)).toThrowError("500");
  });
});

describe("consistency", () => {
  it("every supported version resolves in getVersionFeatures without throwing", () => {
    for (const v of SUPPORTED_VERSIONS) {
      expect(() => getVersionFeatures(v)).not.toThrow();
    }
  });

  it("every unsupported version causes getVersionFeatures to throw UnsupportedVersionError", () => {
    for (const v of [500, 773, 861, 999]) {
      expect(() => getVersionFeatures(v)).toThrow(UnsupportedVersionError);
    }
  });
});

describe("UnsupportedVersionError", () => {
  it("is an instance of Error", () => {
    expect(new UnsupportedVersionError("test")).toBeInstanceOf(Error);
  });
});
