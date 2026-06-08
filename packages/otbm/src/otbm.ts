import { createEscapedSliceReader, ParseError } from "@paradox/utils";
import { NODE_SPECIAL_BYTE, TILE_KEY_Y_STRIDE, TILE_KEY_Z_STRIDE } from "./otbm-config.js";
import { OtbmStreamParser } from "./otbm-stream.js";
import { serializeOtbm } from "./otbm-writer.js";
import type { OtbmFile, OtbmOptions, OtbmWriteInput, OtbmWriteOpts } from "./types.js";

type OtbmLoadOptions = {
  onProgress?: (pct: number) => void;
};

export function Otbm(opts?: OtbmOptions): {
  validate(buffer: ArrayBuffer | Uint8Array): void;
  load(buffer: ArrayBuffer | Uint8Array, loadOpts?: OtbmLoadOptions): OtbmFile;
  write(data: OtbmWriteInput, writeOpts?: OtbmWriteOpts): Uint8Array;
  writeStream(data: OtbmWriteInput, writeOpts?: OtbmWriteOpts): AsyncIterable<Uint8Array>;
} {
  const otbLookup = opts?.lookup;

  return {
    validate,
    load,
    write,
    writeStream,
  };

  function validate(buffer: ArrayBuffer | Uint8Array): void {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

    if (bytes.byteLength < 6) {
      throw new ParseError("Buffer too small for OTBM file (< 6 bytes)");
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const magic = view.getUint32(0, true);

    if (magic > 3) {
      throw new ParseError(
        `Invalid OTBM magic: 0x${magic.toString(16).padStart(8, "0")} (expected 0-3)`,
      );
    }

    if (bytes[4] !== NODE_SPECIAL_BYTE.START) {
      throw new ParseError(`Expected 0xFE at offset 4, got 0x${bytes[4]!.toString(16)}`);
    }
  }

  function load(buffer: ArrayBuffer | Uint8Array, loadOpts?: OtbmLoadOptions): OtbmFile {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const sliceReader = createEscapedSliceReader(bytes);
    const parser = new OtbmStreamParser(bytes, sliceReader, otbLookup, loadOpts?.onProgress);

    parser.run();

    const { header, areas, tileMap, towns, waypoints, stats } = parser;

    if (header === null) throw new ParseError("No OTBM header found");

    return {
      header,
      areas,
      towns,
      waypoints,
      getTile: (x, y, z) => tileMap.get(x + y * TILE_KEY_Y_STRIDE + z * TILE_KEY_Z_STRIDE),
      getStats: () => ({ ...stats }),
    };
  }

  function write(data: OtbmWriteInput, writeOpts?: OtbmWriteOpts): Uint8Array {
    if (data.header.version !== 2) {
      console.warn(
        `OTBM write: header.version is ${data.header.version}, expected 2 - serializing as v2`,
      );
    }

    const total = data.areas.length;
    const onProgress = writeOpts?.onProgress;
    const onArea =
      onProgress !== undefined
        ? (index: number, _total: number) => onProgress(total > 0 ? (index + 1) / total : 1)
        : undefined;

    const chunks = serializeOtbm(data, onArea);

    let byteCount = 0;
    for (const c of chunks) byteCount += c.length;

    const result = new Uint8Array(byteCount);
    let off = 0;
    for (const c of chunks) {
      result.set(c, off);
      off += c.length;
    }
    return result;
  }

  async function* writeStream(
    data: OtbmWriteInput,
    writeOpts?: OtbmWriteOpts,
  ): AsyncGenerator<Uint8Array> {
    if (data.header.version !== 2) {
      console.warn(
        `OTBM write: header.version is ${data.header.version}, expected 2 - serializing as v2`,
      );
    }

    const chunks = serializeOtbm(data);
    const totalAreas = data.areas.length;
    let areasSeen = 0;

    for (let i = 0; i < chunks.length; i++) {
      yield chunks[i]!;
      await Promise.resolve();
      // chunks[0] = header, chunks[1..totalAreas] = areas, last = footer
      if (i >= 1 && i <= totalAreas) {
        areasSeen++;
        writeOpts?.onProgress?.(totalAreas > 0 ? areasSeen / totalAreas : 1);
      }
    }
  }
}
