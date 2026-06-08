import { describe, expect, it } from "vitest";
import { snakeCaseToCamelCase } from "./string.js";

describe("snakeCaseToCamelCase", () => {
  it("single word becomes lowercase", () => {
    expect(snakeCaseToCamelCase("STACKABLE")).toBe("stackable");
    expect(snakeCaseToCamelCase("GROUND")).toBe("ground");
    expect(snakeCaseToCamelCase("CONTAINER")).toBe("container");
  });

  it("two-word snake case", () => {
    expect(snakeCaseToCamelCase("LIGHT_INFO")).toBe("lightInfo");
    expect(snakeCaseToCamelCase("HAS_OFFSET")).toBe("hasOffset");
    expect(snakeCaseToCamelCase("ON_BOTTOM")).toBe("onBottom");
    expect(snakeCaseToCamelCase("ON_TOP")).toBe("onTop");
    expect(snakeCaseToCamelCase("FULL_GROUND")).toBe("fullGround");
    expect(snakeCaseToCamelCase("DONT_HIDE")).toBe("dontHide");
    expect(snakeCaseToCamelCase("FLOOR_CHANGE")).toBe("floorChange");
  });

  it("three-word snake case", () => {
    expect(snakeCaseToCamelCase("GROUND_BORDER")).toBe("groundBorder");
    expect(snakeCaseToCamelCase("BLOCK_MISSILES")).toBe("blockMissiles");
    expect(snakeCaseToCamelCase("BLOCK_PATHFINDER")).toBe("blockPathfinder");
    expect(snakeCaseToCamelCase("ALWAYS_ANIMATE")).toBe("alwaysAnimate");
    expect(snakeCaseToCamelCase("LYING_OBJECT")).toBe("lyingObject");
    expect(snakeCaseToCamelCase("LENS_HELP")).toBe("lensHelp");
    expect(snakeCaseToCamelCase("HAS_ELEVATION")).toBe("hasElevation");
    expect(snakeCaseToCamelCase("WRITABLE_ONCE")).toBe("writableOnce");
    expect(snakeCaseToCamelCase("NO_MOVE_ANIMATION")).toBe("noMoveAnimation");
  });
});
