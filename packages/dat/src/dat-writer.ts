import { createBinaryWriter, getVersionFeatures } from "@paradox/utils";
import { DAT_SIGNATURES, DAT_FLAG_END_MARK, THINGS_GROUPS } from "./dat-config.js";
import { getDatFlags } from "./dat-flags.js";
import { createWriteRules } from "./dat-flags-parser.js";
import type { DatWriteInput, FrameGroup, Thing, ThingLayout } from "./types.js";

export function serializeDat(data: DatWriteInput, version: number): Uint8Array {
  const features = getVersionFeatures(version);
  const writeRules = createWriteRules(getDatFlags(version), version);
  const writer = createBinaryWriter();

  const items: Thing[] = [];
  const creatures: Thing[] = [];
  const effects: Thing[] = [];
  const missiles: Thing[] = [];

  for (const thing of data.things) {
    if (thing.group === "items") items.push(thing);
    else if (thing.group === "creatures") creatures.push(thing);
    else if (thing.group === "effects") effects.push(thing);
    else missiles.push(thing);
  }

  let itemsMaxCid = THINGS_GROUPS.items.startId - 1;
  for (const t of items) {
    if (t.cid > itemsMaxCid) itemsMaxCid = t.cid;
  }

  // header
  writer.u32(DAT_SIGNATURES[version]!);
  writer.u16(itemsMaxCid);
  writer.u16(creatures.length);
  writer.u16(effects.length);
  writer.u16(missiles.length);

  writeGroup(items);
  writeGroup(creatures);
  writeGroup(effects);
  writeGroup(missiles);

  return writer.finish();

  function writeGroup(group: Thing[]): void {
    for (const thing of group) {
      writeThing(thing);
    }
  }

  function writeThing(thing: Thing): void {
    for (const [flagName, value] of Object.entries(thing.flags)) {
      writeRules.serialize(flagName, value, writer);
    }
    writer.u8(DAT_FLAG_END_MARK);

    if (features.frameGroups && thing.group === "creatures") {
      if (thing.frameGroups && thing.frameGroups.length > 0) {
        writer.u8(thing.frameGroups.length);
        for (const fg of thing.frameGroups) {
          writeFrameGroup(fg);
        }
      } else {
        // Fallback: single group, use root layout/spriteIds
        writer.u8(1);
        writer.u8(0); // groupType 0 = idle
        writeLayout(thing.layout);
        writeSprites(thing.layout, thing.spriteIds);
      }
    } else {
      writeLayout(thing.layout);
      writeSprites(thing.layout, thing.spriteIds);
    }
  }

  function writeFrameGroup(fg: FrameGroup): void {
    writer.u8(fg.groupType);
    writeLayout(fg.layout);
    writeSprites(fg.layout, fg.spriteIds);
  }

  function writeLayout(layout: ThingLayout): void {
    writer.u8(layout.width);
    writer.u8(layout.height);
    if (layout.width > 1 || layout.height > 1) {
      writer.u8(layout.realSize);
    }
    writer.u8(layout.layers);
    writer.u8(layout.patternX);
    writer.u8(layout.patternY);
    if (features.patternZ) writer.u8(layout.patternZ);
    writer.u8(layout.frames);

    if (layout.frames > 1 && features.frameDurations) {
      if (layout.animation) {
        writer.u8(layout.animation.async ? 1 : 0);
        writer.u32(layout.animation.loopCount >>> 0); // i32 as two's-complement u32
        writer.u8(layout.animation.startPhase & 0xff); // i8 as u8
        for (const pd of layout.animation.phaseDurations) {
          writer.u32(pd.min);
          writer.u32(pd.max);
        }
      } else {
        // missing animation data: write zero-filled placeholder to keep cursor aligned
        writer.u8(0); // async = false
        writer.u32(0); // loopCount = 0
        writer.u8(0); // startPhase = 0
        for (let f = 0; f < layout.frames; f++) {
          writer.u32(0); // min
          writer.u32(0); // max
        }
      }
    }
  }

  function writeSprites(layout: ThingLayout, spriteIds: number[]): void {
    for (const id of spriteIds) {
      if (features.extendedSprites) {
        writer.u32(id);
      } else {
        writer.u16(id);
      }
    }
  }
}
