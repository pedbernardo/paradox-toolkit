import { ParseError, BufferOverflowError } from "@paradox/utils";
import type { EscapedSliceReader } from "@paradox/utils";
import { OTBM_ATTRIBUTE, OTBM_TILE_FLAG } from "./otbm-config.js";
import type { OtbmItem, OtbmTile, OtbmTileFlags } from "./types.js";

export type TileAttrHandler = (reader: EscapedSliceReader, tile: OtbmTile) => void;
export type ItemAttrHandler = (reader: EscapedSliceReader, item: OtbmItem) => void;

export function decodeTileFlags(bits: number): OtbmTileFlags {
  return {
    protectionZone: !!(bits & OTBM_TILE_FLAG.PROTECTION_ZONE),
    noPvp: !!(bits & OTBM_TILE_FLAG.NO_PVP),
    noLogout: !!(bits & OTBM_TILE_FLAG.NO_LOGOUT),
    pvpZone: !!(bits & OTBM_TILE_FLAG.PVP_ZONE),
    refresh: !!(bits & OTBM_TILE_FLAG.REFRESH),
  };
}

export const TILE_ATTR_HANDLERS: Record<number, TileAttrHandler> = {
  [OTBM_ATTRIBUTE.TILE_FLAGS]: (reader, tile) => {
    tile.flags = reader.u32();
  },

  [OTBM_ATTRIBUTE.ITEM]: (reader, tile) => {
    tile.items.push({ sid: reader.u16() });
  },

  [OTBM_ATTRIBUTE.ACTION_ID]: (reader, tile) => {
    tile.actionId = reader.u16();
  },
};

export const ITEM_ATTR_HANDLERS: Record<number, ItemAttrHandler> = {
  [OTBM_ATTRIBUTE.ACTION_ID]: (reader, item) => {
    item.actionId = reader.u16();
  },

  [OTBM_ATTRIBUTE.UNIQUE_ID]: (reader, item) => {
    item.uniqueId = reader.u16();
  },

  [OTBM_ATTRIBUTE.TEXT]: (reader, item) => {
    item.text = reader.str(reader.u16());
  },

  [OTBM_ATTRIBUTE.DESC]: (reader, item) => {
    item.text = reader.str(reader.u16());
  },

  [OTBM_ATTRIBUTE.TELE_DEST]: (reader, item) => {
    item.destX = reader.u16();
    item.destY = reader.u16();
    item.destZ = reader.u8();
  },

  [OTBM_ATTRIBUTE.DEPOT_ID]: (reader, item) => {
    item.depotId = reader.u16();
  },

  [OTBM_ATTRIBUTE.RUNE_CHARGES]: (reader, item) => {
    item.charges = reader.u8();
  },

  [OTBM_ATTRIBUTE.HOUSE_DOOR]: (reader, item) => {
    item.houseDoor = reader.u8();
  },

  [OTBM_ATTRIBUTE.COUNT]: (reader, item) => {
    item.count = reader.u8();
  },

  [OTBM_ATTRIBUTE.DURATION]: (reader, item) => {
    item.duration = reader.u32();
  },

  [OTBM_ATTRIBUTE.DECAY_STATE]: (reader, item) => {
    item.decayState = reader.u8();
  },

  [OTBM_ATTRIBUTE.WRITTEN_DATE]: (reader, item) => {
    item.writtenDate = reader.u32();
  },

  [OTBM_ATTRIBUTE.WRITTEN_BY]: (reader, item) => {
    item.writtenBy = reader.str(reader.u16());
  },

  [OTBM_ATTRIBUTE.SLEEPER_GUID]: (reader) => {
    reader.u32();
  },

  [OTBM_ATTRIBUTE.SLEEP_START]: (reader) => {
    reader.u32();
  },

  [OTBM_ATTRIBUTE.CHARGES]: (reader, item) => {
    item.charges = reader.u16();
  },

  [OTBM_ATTRIBUTE.ATTRIBUTE_MAP]: (reader) => {
    while (!reader.isEOF) reader.u8();
  },
};

export function parseTileAttrs(reader: EscapedSliceReader, tile: OtbmTile, strict: boolean): void {
  while (!reader.isEOF) {
    const attrType = reader.u8();
    const handler = TILE_ATTR_HANDLERS[attrType];
    if (handler) {
      if (strict) {
        handler(reader, tile);
      } else {
        try {
          handler(reader, tile);
        } catch (e) {
          if (e instanceof BufferOverflowError) break;
          throw e;
        }
      }
    } else {
      break;
    }
  }
}

export function parseItemAttrs(reader: EscapedSliceReader, item: OtbmItem, strict: boolean): void {
  while (!reader.isEOF) {
    const attrType = reader.u8();
    const handler = ITEM_ATTR_HANDLERS[attrType];
    if (handler) {
      if (strict) {
        handler(reader, item);
      } else {
        try {
          handler(reader, item);
        } catch (e) {
          if (e instanceof BufferOverflowError) break;
          throw e;
        }
      }
    } else if (strict) {
      throw new ParseError(`Unknown item attribute 0x${attrType.toString(16)}`);
    } else {
      break;
    }
  }
}
