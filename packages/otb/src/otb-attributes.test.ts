import { describe, expect, it } from "vitest";
import { encodeStr } from "./otb-attributes.js";

describe("encodeStr", () => {
  it("preserves ASCII characters", () => {
    const result = encodeStr("Gold Coin");
    expect(result[0]).toBe("G".charCodeAt(0));
    expect(result.length).toBe(9);
  });

  it("produces correct byte for each ASCII character", () => {
    const s = "Sword";
    const result = encodeStr(s);
    for (let i = 0; i < s.length; i++) {
      expect(result[i]).toBe(s.charCodeAt(i));
    }
  });

  it("truncates codepoint to single byte for latin1 chars > 127", () => {
    const s = "\xe3"; // latin1 ã
    const result = encodeStr(s);
    expect(result.length).toBe(1);
    expect(result[0]).toBe(0xe3);
  });

  it("returns empty Uint8Array for empty string", () => {
    expect(encodeStr("")).toHaveLength(0);
  });
});
