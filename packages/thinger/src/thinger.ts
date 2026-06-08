import type { DatFile } from "@paradox/dat";
import type { OtbFile, OtbItem } from "@paradox/otb";
import { toItem, toVisualOnly } from "./thinger-mapper.js";
import { CONTENT_SCHEMA_VERSION, type ContentDefinitions } from "./types.js";
import nameMapData from "./resources/name-map.json" with { type: "json" };

const nameMap = nameMapData as Record<string, string>;

type Thinger = {
  build(): ContentDefinitions;
};

export function Thinger({ dat, otb }: { dat: DatFile; otb: OtbFile }): Thinger {
  const cidToOtb = new Map<number, OtbItem>();

  for (const [, item] of otb.entries()) {
    cidToOtb.set(item.cid, item);
  }

  return { build };

  function build(): ContentDefinitions {
    const items: ContentDefinitions["items"] = [];
    const creatures: ContentDefinitions["creatures"] = [];
    const effects: ContentDefinitions["effects"] = [];
    const missiles: ContentDefinitions["missiles"] = [];

    for (const thing of dat.entries()) {
      if (thing.group === "items") {
        items.push(toItem(thing, cidToOtb.get(thing.cid), nameMap));
      } else if (thing.group === "creatures") {
        creatures.push(toVisualOnly(thing));
      } else if (thing.group === "effects") {
        effects.push(toVisualOnly(thing));
      } else if (thing.group === "missiles") {
        missiles.push(toVisualOnly(thing));
      }
    }

    return {
      meta: {
        schema: CONTENT_SCHEMA_VERSION,
        version: dat.version,
        dat: dat.signature.toString(16).toUpperCase().padStart(8, "0"),
        otb: otb.schemaVersion,
        counts: {
          items: items.length,
          creatures: creatures.length,
          effects: effects.length,
          missiles: missiles.length,
        },
      },
      items,
      creatures,
      effects,
      missiles,
    };
  }
}
