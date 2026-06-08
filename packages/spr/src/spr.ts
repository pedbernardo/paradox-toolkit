import { createBinaryReader, getVersionFeatures, ParseError } from "@paradox/utils";
import { SPR_SIGNATURES } from "./spr-config.js";
import { serializeSpr } from "./spr-writer.js";
import type { Sprite, SprWriteInput, SprWriteOpts } from "./types.js";

export type { Sprite };

export type SprFile = {
  readonly version: number;
  readonly signature: number;
  readonly count: number;
  get(id: number): Sprite | undefined;
  entries(): Iterable<[number, Sprite]>;
};

type Spr = {
  readonly version: number | undefined;
  validate(buffer: ArrayBuffer | Uint8Array): void;
  load(buffer: ArrayBuffer | Uint8Array): SprFile;
  write(input: SprWriteInput, opts?: SprWriteOpts): Uint8Array;
  writeStream(input: SprWriteInput, opts?: SprWriteOpts): AsyncGenerator<Uint8Array>;
};

export function Spr(version?: number): Spr {
  if (version !== undefined) {
    getVersionFeatures(version);
  }

  return {
    version,
    validate,
    load,
    write,
    writeStream,
  };

  function peekSignature(buffer: ArrayBuffer | Uint8Array): number {
    const ab = buffer instanceof Uint8Array ? buffer.buffer : buffer;
    const off = buffer instanceof Uint8Array ? buffer.byteOffset : 0;
    const len = buffer instanceof Uint8Array ? buffer.byteLength : ab.byteLength;
    if (len < 4) throw new ParseError("SPR buffer too small to read signature");
    return new DataView(ab, off).getUint32(0, true);
  }

  function findVersionBySig(sig: number): number {
    for (const [ver, s] of Object.entries(SPR_SIGNATURES)) {
      if (s !== 0 && s === sig) return Number(ver);
    }
    throw new ParseError(
      `SPR signature 0x${sig.toString(16).padStart(8, "0")} does not match any known version`,
    );
  }

  function checkSig(sig: number, ver: number): void {
    const expected = SPR_SIGNATURES[ver];
    if (expected === undefined || expected === 0) {
      throw new ParseError(
        `SPR signature unknown for version ${ver} — no fixture available to confirm`,
      );
    }
    if (sig !== expected) {
      throw new ParseError(
        `SPR signature mismatch for version ${ver}: expected 0x${expected.toString(16).padStart(8, "0")}, got 0x${sig.toString(16).padStart(8, "0")}`,
      );
    }
  }

  function requireVersion(): number {
    if (version === undefined) {
      throw new ParseError(
        "SPR write requires an explicit version — construct with Spr(version) instead of Spr()",
      );
    }
    return version;
  }

  function write(input: SprWriteInput, opts?: SprWriteOpts): Uint8Array {
    const ver = requireVersion();
    const { onProgress } = opts ?? {};
    const onSprite = onProgress
      ? (index: number, total: number) => onProgress(total > 0 ? (index + 1) / total : 1)
      : undefined;
    const chunks = serializeSpr(input, ver, onSprite);
    const totalLen = chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }

  async function* writeStream(
    input: SprWriteInput,
    opts?: SprWriteOpts,
  ): AsyncGenerator<Uint8Array> {
    const ver = requireVersion();
    const chunks = serializeSpr(input, ver);
    const spriteChunkCount = chunks.length - 2;
    yield chunks[0]!;
    await Promise.resolve();
    yield chunks[1]!;
    await Promise.resolve();
    for (let i = 0; i < spriteChunkCount; i++) {
      yield chunks[i + 2]!;
      await Promise.resolve();
      opts?.onProgress?.(spriteChunkCount > 0 ? (i + 1) / spriteChunkCount : 1);
    }
  }

  function validate(buffer: ArrayBuffer | Uint8Array): void {
    const sig = peekSignature(buffer);
    if (version !== undefined) {
      checkSig(sig, version);
    } else {
      findVersionBySig(sig); // throws if no matching version found
    }
  }

  function load(buffer: ArrayBuffer | Uint8Array): SprFile {
    const sig = peekSignature(buffer);
    const resolvedVersion = version !== undefined ? version : findVersionBySig(sig);
    if (version !== undefined) checkSig(sig, version);

    const features = getVersionFeatures(resolvedVersion);
    const reader = createBinaryReader(buffer);
    reader.seek(4); // skip signature

    const { extendedSprites } = features;
    const count = extendedSprites ? reader.u32() : reader.u16();

    const headerSize = extendedSprites ? 8 : 6;
    if (headerSize + count * 4 > reader.byteLength) {
      throw new ParseError("SPR address table exceeds file size");
    }

    const addresses = new Map<number, number>();
    for (let id = 1; id <= count; id++) {
      addresses.set(id, reader.u32());
    }

    const cache = new Map<number, Sprite>();

    return {
      version: resolvedVersion,
      signature: sig,
      count,
      get: getSpr,
      entries,
    };

    function getSpr(id: number): Sprite | undefined {
      if (id < 1 || id > count) return undefined;
      return fetchSprite(id);
    }

    function* entries(): Generator<[number, Sprite]> {
      for (let id = 1; id <= count; id++) {
        yield [id, fetchSprite(id)];
      }
    }

    function fetchSprite(id: number): Sprite {
      if (cache.has(id)) return cache.get(id)!;
      const sprite = parseSprite(id);
      cache.set(id, sprite);
      return sprite;
    }

    function parseSprite(id: number): Sprite {
      const address = addresses.get(id)!;
      const rgba = new Uint8Array(4096);

      if (address === 0) {
        return { id, rgba, width: 32, height: 32 };
      }

      reader.seek(address);
      reader.skip(3); // color key bytes

      const spriteSize = reader.u16();
      const endOffset = reader.offset + spriteSize;

      let currentPixel = 0;

      while (reader.offset < endOffset) {
        const transparentPixels = reader.u16();
        const coloredPixels = reader.u16();

        currentPixel += transparentPixels;

        for (let i = 0; i < coloredPixels; i++) {
          const r = reader.u8();
          const g = reader.u8();
          const b = reader.u8();
          const index = currentPixel * 4;
          rgba[index] = r;
          rgba[index + 1] = g;
          rgba[index + 2] = b;
          rgba[index + 3] = 255;
          currentPixel++;
        }
      }

      return { id, rgba, width: 32, height: 32 };
    }
  }
}
