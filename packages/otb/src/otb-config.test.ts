import { describe, expect, it } from "vitest";
import { ParseError } from "@paradox/utils";
import { parseSchemaVersion } from "./otb-config.js";

describe("parseSchemaVersion", () => {
  it("parses a valid version string", () => {
    expect(parseSchemaVersion("3.57.0")).toEqual({ major: 3, minor: 57, build: 0 });
  });

  it("parses version with non-zero build", () => {
    expect(parseSchemaVersion("2.1.5")).toEqual({ major: 2, minor: 1, build: 5 });
  });

  it("throws ParseError for missing part", () => {
    expect(() => parseSchemaVersion("3.57")).toThrow(ParseError);
  });

  it("throws ParseError for non-numeric parts", () => {
    expect(() => parseSchemaVersion("abc")).toThrow(ParseError);
  });

  it("throws ParseError for empty string", () => {
    expect(() => parseSchemaVersion("")).toThrow(ParseError);
  });

  it("throws ParseError for unsupported major version", () => {
    expect(() => parseSchemaVersion("99.0.0")).toThrow(ParseError);
  });

  it("accepts all supported major versions", () => {
    expect(() => parseSchemaVersion("1.0.0")).not.toThrow();
    expect(() => parseSchemaVersion("2.0.0")).not.toThrow();
    expect(() => parseSchemaVersion("3.0.0")).not.toThrow();
  });
});
