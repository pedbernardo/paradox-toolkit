import { createEscapedBinaryReader, ParseError } from "@paradox/utils";
import type { EscapedBinaryReader } from "@paradox/utils";
import { NODE_SPECIAL_BYTE, ROOT_NODE_ATTR, OTB_VERSIONS, ITEM_GROUP } from "./otb-config.js";
import { getItemFlags } from "./otb-flags.js";
import { ATTRIBUTE_HANDLERS } from "./otb-attributes.js";
import { serializeOtb } from "./otb-writer.js";
import type { OtbFile, OtbItem, OtbWriteInput } from "./types.js";

export type { OtbFile, OtbItem, OtbWriteInput };

type Otb = {
  validate(buffer: ArrayBuffer | Uint8Array): void;
  load(buffer: ArrayBuffer | Uint8Array): OtbFile;
  write(data: OtbWriteInput): Uint8Array;
};

export function Otb(): Otb {
  return {
    validate,
    load,
    write,
  };

  function validate(buffer: ArrayBuffer | Uint8Array): void {
    const reader = createEscapedBinaryReader(buffer);

    if (reader.byteLength < 12) {
      throw new ParseError("OTB buffer too small (minimum 12 bytes)");
    }

    for (let i = 0; i < 4; i++) {
      if (reader.peekU8At(i) !== 0x00) {
        throw new ParseError(
          `OTB magic mismatch: expected 0x00 at offset ${i}, got 0x${reader.peekU8At(i).toString(16).padStart(2, "0")}`,
        );
      }
    }

    if (reader.peekU8At(4) !== NODE_SPECIAL_BYTE.START) {
      throw new ParseError(
        `OTB root node marker missing: expected 0xFE at offset 4, got 0x${reader.peekU8At(4).toString(16).padStart(2, "0")}`,
      );
    }
  }

  function load(buffer: ArrayBuffer | Uint8Array): OtbFile {
    const reader = createEscapedBinaryReader(buffer);
    const schemaVersion = parseHeader(reader);
    const itemsMap = parseItems(reader);
    const items = [...itemsMap.values()];

    return {
      schemaVersion,
      get count() {
        return itemsMap.size;
      },
      items,
      get: (sid) => itemsMap.get(sid),
      *entries() {
        for (const [id, item] of itemsMap) {
          yield [id, item] as [number, OtbItem];
        }
      },
    };
  }

  function parseHeader(reader: EscapedBinaryReader): string {
    reader.seek(5); // skip: 4 null bytes + 0xFE root START
    reader.u8(); // root group (always 0, discard)
    reader.escU32(); // root flags (always 0, discard)

    const attr = reader.u8();
    if (attr !== ROOT_NODE_ATTR) {
      throw new ParseError(`OTB: unexpected root attribute ${attr}, expected ${ROOT_NODE_ATTR}`);
    }

    reader.escU16(); // dataLength (discard)
    const major = reader.escU32();
    const minor = reader.escU32();
    const build = reader.escU32();

    if (!(OTB_VERSIONS as readonly number[]).includes(major)) {
      throw new ParseError(`OTB: unsupported schema version ${major}.${minor}.${build}`);
    }

    reader.skip(116); // remaining root node padding (128 total − 12 already read)

    return `${major}.${minor}.${build}`;
  }

  function parseItems(reader: EscapedBinaryReader): Map<number, OtbItem> {
    const items = new Map<number, OtbItem>();
    let nextSid = 100;

    while (!reader.isEOF) {
      let startByte: number;

      try {
        startByte = reader.seekNodeBoundary([NODE_SPECIAL_BYTE.START, NODE_SPECIAL_BYTE.END]);
      } catch {
        break;
      }

      if (startByte === NODE_SPECIAL_BYTE.END) break; // root END reached, done

      const dataStart = reader.offset; // right after the item's 0xFE
      let endByte: number;

      try {
        endByte = reader.seekNodeBoundary([NODE_SPECIAL_BYTE.START, NODE_SPECIAL_BYTE.END]);
      } catch {
        break;
      }

      if (endByte !== NODE_SPECIAL_BYTE.END) break; // unexpected nested START

      const endPos = reader.offset - 1; // raw position of the 0xFF byte

      reader.seek(dataStart);
      const item = parseItemNode(reader, endPos);
      reader.seek(endPos + 1);

      if (item === null) continue;

      if (item.sid === 0) {
        item.sid = nextSid++;
      } else {
        nextSid = Math.max(nextSid, item.sid + 1);
      }

      items.set(item.sid, item);
    }

    return items;
  }

  function write(data: OtbWriteInput): Uint8Array {
    return serializeOtb(data);
  }

  function parseItemNode(reader: EscapedBinaryReader, endPos: number): OtbItem | null {
    const group = reader.u8();

    if (group === ITEM_GROUP.DEPRECATED) return null;

    const flagsInt = reader.escU32();

    const item: OtbItem = {
      sid: 0,
      cid: 0,
      group,
      flags: getItemFlags(flagsInt),
      attributes: {},
    };

    if (group === ITEM_GROUP.RUNE) {
      item.flags.clientCharges = true;
    }

    while (reader.offset < endPos) {
      const remaining = endPos - reader.offset;

      if (remaining < 3) break;

      const attrId = reader.u8();
      const length = reader.escU16();

      if (length > 1000 || reader.offset + length > endPos) break;

      const handler = ATTRIBUTE_HANDLERS[attrId];

      if (handler) {
        handler({ item, reader, length });
      } else {
        reader.skip(length);
      }

      if (reader.offset >= endPos) break;
    }

    return item;
  }
}
