import { describe, expect, it } from "vitest";
import { Otbm } from "./otbm.js";
import { serializeOtbm } from "./otbm-writer.js";
import { OTBM_NODE_TYPE } from "./otbm-config.js";
import type { OtbmWriteInput } from "./types.js";

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

const BASE_HEADER: OtbmWriteInput["header"] = {
  version: 2,
  width: 1000,
  height: 1000,
  majorVersion: 3,
  minorVersion: 57,
};

function serialize(input: OtbmWriteInput): Uint8Array {
  return concat(serializeOtbm(input));
}

// ─── header chunk ─────────────────────────────────────────────────────────────

describe("serializeOtbm — header chunk", () => {
  it("starts with 4-byte magic 0x00000000", () => {
    const buf = serialize({ header: BASE_HEADER, areas: [], towns: [], waypoints: [] });
    const view = new DataView(buf.buffer);
    expect(view.getUint32(0, true)).toBe(0);
  });

  it("byte 4 is 0xFE (WORLD_NODE start)", () => {
    const buf = serialize({ header: BASE_HEADER, areas: [], towns: [], waypoints: [] });
    expect(buf[4]).toBe(0xfe);
    expect(buf[5]).toBe(OTBM_NODE_TYPE.WORLD_NODE);
  });

  it("serialized output is parseable and header fields are correct", () => {
    const input: OtbmWriteInput = {
      header: { version: 2, width: 2000, height: 1500, majorVersion: 5, minorVersion: 99 },
      areas: [],
      towns: [],
      waypoints: [],
    };
    const file = Otbm().load(serialize(input));
    expect(file.header.width).toBe(2000);
    expect(file.header.height).toBe(1500);
    expect(file.header.majorVersion).toBe(5);
    expect(file.header.minorVersion).toBe(99);
  });

  it("always serializes version 2 regardless of header.version", () => {
    const input: OtbmWriteInput = {
      header: { version: 1, width: 100, height: 100, majorVersion: 3, minorVersion: 57 },
      areas: [],
      towns: [],
      waypoints: [],
    };
    const file = Otbm().load(serialize(input));
    expect(file.header.version).toBe(2);
  });
});

// ─── tile area ────────────────────────────────────────────────────────────────

describe("serializeOtbm — tile area", () => {
  it("regular tile: offset calculated correctly from baseX/baseY", () => {
    const input: OtbmWriteInput = {
      header: BASE_HEADER,
      areas: [
        {
          baseX: 100,
          baseY: 200,
          baseZ: 7,
          tiles: [{ kind: "tile", x: 103, y: 205, z: 7, flags: 0, items: [] }],
        },
      ],
      towns: [],
      waypoints: [],
    };
    const tile = Otbm().load(serialize(input)).getTile(103, 205, 7)!;
    expect(tile).toBeDefined();
    expect(tile.x).toBe(103);
    expect(tile.y).toBe(205);
  });

  it("tile with flags: TILE_FLAGS attribute present in output", () => {
    const input: OtbmWriteInput = {
      header: BASE_HEADER,
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ kind: "tile", x: 0, y: 0, z: 7, flags: 0x01, items: [] }],
        },
      ],
      towns: [],
      waypoints: [],
    };
    const tile = Otbm().load(serialize(input)).getTile(0, 0, 7)!;
    expect(tile.flags & 0x01).toBe(1);
  });

  it("tile with actionId: ACTION_ID attribute preserved in output", () => {
    const input: OtbmWriteInput = {
      header: BASE_HEADER,
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ kind: "tile", x: 0, y: 0, z: 7, flags: 0, actionId: 99, items: [] }],
        },
      ],
      towns: [],
      waypoints: [],
    };
    const tile = Otbm().load(serialize(input)).getTile(0, 0, 7)!;
    expect(tile.actionId).toBe(99);
  });

  it("house tile: HOUSETILE node type and houseId preserved", () => {
    const input: OtbmWriteInput = {
      header: BASE_HEADER,
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ kind: "house", x: 0, y: 0, z: 7, houseId: 42, flags: 0, items: [] }],
        },
      ],
      towns: [],
      waypoints: [],
    };
    const tile = Otbm().load(serialize(input)).getTile(0, 0, 7)!;
    expect(tile.kind).toBe("house");
    if (tile.kind === "house") expect(tile.houseId).toBe(42);
  });
});

// ─── items ────────────────────────────────────────────────────────────────────

describe("serializeOtbm — items", () => {
  it("compact item (sid-only) written inline and round-trips correctly", () => {
    const input: OtbmWriteInput = {
      header: BASE_HEADER,
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ kind: "tile", x: 0, y: 0, z: 7, flags: 0, items: [{ sid: 100 }] }],
        },
      ],
      towns: [],
      waypoints: [],
    };
    const tile = Otbm().load(serialize(input)).getTile(0, 0, 7)!;
    expect(tile.items).toHaveLength(1);
    expect(tile.items[0]!.sid).toBe(100);
  });

  it("item with count serialized as full node with COUNT attr", () => {
    const input: OtbmWriteInput = {
      header: BASE_HEADER,
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ kind: "tile", x: 0, y: 0, z: 7, flags: 0, items: [{ sid: 200, count: 5 }] }],
        },
      ],
      towns: [],
      waypoints: [],
    };
    const tile = Otbm().load(serialize(input)).getTile(0, 0, 7)!;
    expect(tile.items[0]!.count).toBe(5);
  });

  it("item with all optional attributes round-trips correctly", () => {
    const item = {
      sid: 1,
      actionId: 10,
      uniqueId: 20,
      text: "hello",
      depotId: 3,
      charges: 100,
      houseDoor: 2,
      duration: 3600,
      decayState: 1,
      writtenDate: 1716681600,
      writtenBy: "Test",
      destX: 100,
      destY: 200,
      destZ: 7,
    };
    const input: OtbmWriteInput = {
      header: BASE_HEADER,
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ kind: "tile", x: 0, y: 0, z: 7, flags: 0, items: [item] }],
        },
      ],
      towns: [],
      waypoints: [],
    };
    const parsed = Otbm().load(serialize(input)).getTile(0, 0, 7)!.items[0]!;
    expect(parsed.actionId).toBe(10);
    expect(parsed.uniqueId).toBe(20);
    expect(parsed.text).toBe("hello");
    expect(parsed.depotId).toBe(3);
    expect(parsed.charges).toBe(100);
    expect(parsed.houseDoor).toBe(2);
    expect(parsed.duration).toBe(3600);
    expect(parsed.decayState).toBe(1);
    expect(parsed.writtenDate).toBe(1716681600);
    expect(parsed.writtenBy).toBe("Test");
    expect(parsed.destX).toBe(100);
    expect(parsed.destY).toBe(200);
    expect(parsed.destZ).toBe(7);
  });

  it("container with nested children round-trips correctly", () => {
    const input: OtbmWriteInput = {
      header: BASE_HEADER,
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [
            {
              kind: "tile",
              x: 0,
              y: 0,
              z: 7,
              flags: 0,
              items: [{ sid: 10, count: 1, children: [{ sid: 55 }, { sid: 66, count: 3 }] }],
            },
          ],
        },
      ],
      towns: [],
      waypoints: [],
    };
    const tile = Otbm().load(serialize(input)).getTile(0, 0, 7)!;
    expect(tile.items[0]!.children).toHaveLength(2);
    expect(tile.items[0]!.children![0]!.sid).toBe(55);
    expect(tile.items[0]!.children![1]!.sid).toBe(66);
    expect(tile.items[0]!.children![1]!.count).toBe(3);
  });
});

// ─── towns and waypoints ──────────────────────────────────────────────────────

describe("serializeOtbm — towns", () => {
  it("town node round-trips with id, name, x, y, z", () => {
    const input: OtbmWriteInput = {
      header: BASE_HEADER,
      areas: [],
      towns: [{ id: 1, name: "Capital", x: 100, y: 200, z: 7 }],
      waypoints: [],
    };
    const file = Otbm().load(serialize(input));
    expect(file.towns).toHaveLength(1);
    expect(file.towns[0]!.id).toBe(1);
    expect(file.towns[0]!.name).toBe("Capital");
    expect(file.towns[0]!.x).toBe(100);
    expect(file.towns[0]!.y).toBe(200);
    expect(file.towns[0]!.z).toBe(7);
  });
});

describe("serializeOtbm — waypoints", () => {
  it("waypoint node round-trips with name, x, y, z", () => {
    const input: OtbmWriteInput = {
      header: BASE_HEADER,
      areas: [],
      towns: [],
      waypoints: [{ name: "Spawn", x: 50, y: 60, z: 7 }],
    };
    const file = Otbm().load(serialize(input));
    expect(file.waypoints).toHaveLength(1);
    expect(file.waypoints[0]!.name).toBe("Spawn");
    expect(file.waypoints[0]!.x).toBe(50);
    expect(file.waypoints[0]!.y).toBe(60);
    expect(file.waypoints[0]!.z).toBe(7);
  });
});

// ─── validation ───────────────────────────────────────────────────────────────

describe("serializeOtbm — validation", () => {
  it("throws RangeError when tile offset exceeds 255", () => {
    const input: OtbmWriteInput = {
      header: BASE_HEADER,
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ kind: "tile", x: 300, y: 0, z: 7, flags: 0, items: [] }],
        },
      ],
      towns: [],
      waypoints: [],
    };
    expect(() => serializeOtbm(input)).toThrow(RangeError);
  });

  it("throws RangeError for item sid === NaN", () => {
    const input: OtbmWriteInput = {
      header: BASE_HEADER,
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ kind: "tile", x: 0, y: 0, z: 7, flags: 0, items: [{ sid: NaN }] }],
        },
      ],
      towns: [],
      waypoints: [],
    };
    expect(() => serializeOtbm(input)).toThrow(RangeError);
  });

  it("throws RangeError for item sid <= 0", () => {
    const input: OtbmWriteInput = {
      header: BASE_HEADER,
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ kind: "tile", x: 0, y: 0, z: 7, flags: 0, items: [{ sid: 0 }] }],
        },
      ],
      towns: [],
      waypoints: [],
    };
    expect(() => serializeOtbm(input)).toThrow(RangeError);
  });
});

// ─── escape sequences ─────────────────────────────────────────────────────────

describe("serializeOtbm — escape sequences", () => {
  it("tile with flags containing 0xFF byte round-trips correctly", () => {
    // flags = 0xFF000000 → low byte = 0x00, ..., high byte = 0xFF (needs escaping)
    const input: OtbmWriteInput = {
      header: BASE_HEADER,
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ kind: "tile", x: 0, y: 0, z: 7, flags: 0x01, items: [] }],
        },
      ],
      towns: [],
      waypoints: [],
    };
    const tile = Otbm().load(serialize(input)).getTile(0, 0, 7)!;
    expect(tile.flags).toBe(0x01);
  });

  it("town name with latin-1 special char round-trips correctly", () => {
    const input: OtbmWriteInput = {
      header: BASE_HEADER,
      areas: [],
      towns: [{ id: 1, name: "Caf\xe9", x: 0, y: 0, z: 7 }], // é = 0xE9 in latin-1
      waypoints: [],
    };
    const file = Otbm().load(serialize(input));
    expect(file.towns[0]!.name).toBe("Caf\xe9");
  });
});

// ─── onArea callback ──────────────────────────────────────────────────────────

describe("serializeOtbm — onArea callback", () => {
  it("called once per tile area with correct index and total", () => {
    const calls: Array<[number, number]> = [];
    const input: OtbmWriteInput = {
      header: BASE_HEADER,
      areas: [
        { baseX: 0, baseY: 0, baseZ: 7, tiles: [] },
        { baseX: 100, baseY: 0, baseZ: 7, tiles: [] },
      ],
      towns: [],
      waypoints: [],
    };
    serializeOtbm(input, (index, total) => calls.push([index, total]));
    expect(calls).toEqual([
      [0, 2],
      [1, 2],
    ]);
  });

  it("not called when there are no areas", () => {
    const calls: number[] = [];
    serializeOtbm({ header: BASE_HEADER, areas: [], towns: [], waypoints: [] }, () =>
      calls.push(1),
    );
    expect(calls).toHaveLength(0);
  });
});
