import { TextEncoder } from "node:util";
import { describe, expect, it } from "vitest";
import {
  type BinaryReader,
  createBinaryReader,
  createEscapedBinaryReader,
  createEscapedSliceReader,
} from "./binary-reader.js";
import { BufferOverflowError, ByteNotFoundError } from "./errors.js";

describe("createBinaryReader", () => {
  describe("u8", () => {
    it("reads a single byte", () => {
      const r = createBinaryReader(new Uint8Array([0x42]).buffer);
      expect(r.u8()).toBe(0x42);
    });

    it("reads sequential bytes correctly", () => {
      const r = createBinaryReader(new Uint8Array([0x01, 0x02, 0x03]).buffer);
      expect(r.u8()).toBe(0x01);
      expect(r.u8()).toBe(0x02);
      expect(r.u8()).toBe(0x03);
    });

    it("advances cursor by 1", () => {
      const r = createBinaryReader(new Uint8Array([0x01, 0x02]).buffer);
      r.u8();
      expect(r.offset).toBe(1);
    });

    it("throws BufferOverflowError when exhausted", () => {
      const r = createBinaryReader(new Uint8Array([0x01]).buffer);
      r.u8();
      expect(() => r.u8()).toThrow(BufferOverflowError);
    });
  });

  describe("u16", () => {
    it("reads 2 bytes little-endian", () => {
      const r = createBinaryReader(new Uint8Array([0x34, 0x12]).buffer);
      expect(r.u16()).toBe(0x1234);
    });

    it("reads maximum u16 value", () => {
      const r = createBinaryReader(new Uint8Array([0xff, 0xff]).buffer);
      expect(r.u16()).toBe(0xffff);
    });

    it("advances cursor by 2", () => {
      const r = createBinaryReader(new Uint8Array([0x01, 0x02, 0x03]).buffer);
      r.u16();
      expect(r.offset).toBe(2);
    });

    it("throws BufferOverflowError with 1 byte remaining", () => {
      const r = createBinaryReader(new Uint8Array([0x01]).buffer);
      expect(() => r.u16()).toThrow(BufferOverflowError);
    });
  });

  describe("u32", () => {
    it("reads 4 bytes little-endian", () => {
      const r = createBinaryReader(new Uint8Array([0x78, 0x56, 0x34, 0x12]).buffer);
      expect(r.u32()).toBe(0x12345678);
    });

    it("reads maximum u32 value", () => {
      const r = createBinaryReader(new Uint8Array([0xff, 0xff, 0xff, 0xff]).buffer);
      expect(r.u32()).toBe(0xffffffff);
    });

    it("advances cursor by 4", () => {
      const r = createBinaryReader(new Uint8Array([1, 2, 3, 4, 5]).buffer);
      r.u32();
      expect(r.offset).toBe(4);
    });

    it("throws BufferOverflowError with 3 bytes remaining", () => {
      const r = createBinaryReader(new Uint8Array([0x01, 0x02, 0x03]).buffer);
      expect(() => r.u32()).toThrow(BufferOverflowError);
    });
  });

  describe("str", () => {
    it("reads n bytes as Latin-1 by default", () => {
      const r = createBinaryReader(new Uint8Array([72, 101, 108, 108, 111]).buffer);
      expect(r.str(5)).toBe("Hello");
    });

    it("reads with explicit encoding", () => {
      const bytes = new TextEncoder().encode("Hello");
      const r = createBinaryReader(bytes.buffer);
      expect(r.str(5, "utf-8")).toBe("Hello");
    });

    it("advances cursor by n", () => {
      const r = createBinaryReader(new Uint8Array([65, 66, 67]).buffer);
      r.str(2);
      expect(r.offset).toBe(2);
    });

    it("throws BufferOverflowError when n exceeds remaining bytes", () => {
      const r = createBinaryReader(new Uint8Array([65, 66]).buffer);
      expect(() => r.str(3)).toThrow(BufferOverflowError);
    });
  });

  describe("bytes", () => {
    it("returns Uint8Array with correct values", () => {
      const r = createBinaryReader(new Uint8Array([0x01, 0x02, 0x03]).buffer);
      expect(r.bytes(2)).toEqual(new Uint8Array([0x01, 0x02]));
    });

    it("advances cursor by n", () => {
      const r = createBinaryReader(new Uint8Array([1, 2, 3]).buffer);
      r.bytes(2);
      expect(r.offset).toBe(2);
    });

    it("returns a view over the same underlying buffer, not a copy", () => {
      const arr = new Uint8Array([0x01, 0x02, 0x03]);
      const r = createBinaryReader(arr);
      const result = r.bytes(3);
      expect(result.buffer).toBe(arr.buffer);
    });

    it("throws BufferOverflowError when n exceeds remaining bytes", () => {
      const r = createBinaryReader(new Uint8Array([1, 2]).buffer);
      expect(() => r.bytes(3)).toThrow(BufferOverflowError);
    });
  });

  describe("u16arr", () => {
    it("reads n u16 values in sequence", () => {
      const r = createBinaryReader(new Uint8Array([0x01, 0x00, 0x02, 0x00, 0x03, 0x00]).buffer);
      expect(r.u16arr(3)).toEqual([1, 2, 3]);
    });

    it("reads little-endian values correctly", () => {
      const r = createBinaryReader(new Uint8Array([0x34, 0x12, 0x78, 0x56]).buffer);
      expect(r.u16arr(2)).toEqual([0x1234, 0x5678]);
    });

    it("advances cursor by n*2", () => {
      const r = createBinaryReader(new Uint8Array([1, 0, 2, 0, 3, 0]).buffer);
      r.u16arr(2);
      expect(r.offset).toBe(4);
    });

    it("throws BufferOverflowError when bytes run out", () => {
      const r = createBinaryReader(new Uint8Array([0x01, 0x00, 0x02]).buffer);
      expect(() => r.u16arr(2)).toThrow(BufferOverflowError);
    });
  });

  describe("skip", () => {
    it("advances cursor without consuming a value", () => {
      const r = createBinaryReader(new Uint8Array([1, 2, 3, 4]).buffer);
      r.skip(2);
      expect(r.offset).toBe(2);
    });

    it("allows reading the correct byte after skip", () => {
      const r = createBinaryReader(new Uint8Array([0x01, 0x02, 0x03]).buffer);
      r.skip(2);
      expect(r.u8()).toBe(0x03);
    });

    it("throws BufferOverflowError when n exceeds remaining bytes", () => {
      const r = createBinaryReader(new Uint8Array([1, 2]).buffer);
      expect(() => r.skip(3)).toThrow(BufferOverflowError);
    });
  });

  describe("seek", () => {
    it("repositions cursor to the given absolute position", () => {
      const r = createBinaryReader(new Uint8Array([0x01, 0x02, 0x03]).buffer);
      r.seek(2);
      expect(r.offset).toBe(2);
      expect(r.u8()).toBe(0x03);
    });

    it("seek(0) resets cursor to the beginning", () => {
      const r = createBinaryReader(new Uint8Array([0x01, 0x02]).buffer);
      r.u8();
      r.seek(0);
      expect(r.offset).toBe(0);
      expect(r.u8()).toBe(0x01);
    });

    it("seek to byteLength is allowed (EOF position)", () => {
      const r = createBinaryReader(new Uint8Array([0x01, 0x02]).buffer);
      r.seek(2);
      expect(r.isEOF).toBe(true);
    });

    it("throws BufferOverflowError for position beyond byteLength", () => {
      const r = createBinaryReader(new Uint8Array([0x01, 0x02]).buffer);
      expect(() => r.seek(3)).toThrow(BufferOverflowError);
    });

    it("throws BufferOverflowError for negative position", () => {
      const r = createBinaryReader(new Uint8Array([0x01]).buffer);
      expect(() => r.seek(-1)).toThrow(BufferOverflowError);
    });
  });

  describe("seekByte", () => {
    it("positions cursor immediately after the found byte", () => {
      const r = createBinaryReader(new Uint8Array([0x01, 0x02, 0xff, 0x04]).buffer);
      r.seekByte(0xff);
      expect(r.offset).toBe(3);
    });

    it("finds the first occurrence from current cursor position", () => {
      const r = createBinaryReader(new Uint8Array([0xff, 0x01, 0xff]).buffer);
      r.seekByte(0xff);
      expect(r.offset).toBe(1);
    });

    it("finds byte at the very start of the buffer", () => {
      const r = createBinaryReader(new Uint8Array([0xab, 0x01]).buffer);
      r.seekByte(0xab);
      expect(r.offset).toBe(1);
    });

    it("throws ByteNotFoundError when byte is absent", () => {
      const r = createBinaryReader(new Uint8Array([0x01, 0x02]).buffer);
      expect(() => r.seekByte(0xff)).toThrow(ByteNotFoundError);
    });

    it("preserves cursor when byte is not found", () => {
      const r = createBinaryReader(new Uint8Array([0x01, 0x02]).buffer);
      r.skip(1);
      try {
        r.seekByte(0xff);
      } catch {}
      expect(r.offset).toBe(1);
    });
  });

  describe("seekAnyByte", () => {
    it("returns the matched byte", () => {
      const r = createBinaryReader(new Uint8Array([0x01, 0xab, 0x03]).buffer);
      expect(r.seekAnyByte([0xab, 0xcd])).toBe(0xab);
    });

    it("positions cursor immediately after the found byte", () => {
      const r = createBinaryReader(new Uint8Array([0x01, 0xab, 0x03]).buffer);
      r.seekAnyByte([0xab, 0xcd]);
      expect(r.offset).toBe(2);
    });

    it("finds whichever target comes first in the buffer", () => {
      const r = createBinaryReader(new Uint8Array([0xcd, 0xab]).buffer);
      const found = r.seekAnyByte([0xab, 0xcd]);
      expect(found).toBe(0xcd);
      expect(r.offset).toBe(1);
    });

    it("throws ByteNotFoundError when no target is present", () => {
      const r = createBinaryReader(new Uint8Array([0x01, 0x02]).buffer);
      expect(() => r.seekAnyByte([0xab, 0xcd])).toThrow(ByteNotFoundError);
    });

    it("preserves cursor when no target is found", () => {
      const r = createBinaryReader(new Uint8Array([0x01, 0x02]).buffer);
      r.skip(1);
      try {
        r.seekAnyByte([0xab]);
      } catch {}
      expect(r.offset).toBe(1);
    });
  });

  describe("peekU8At", () => {
    it("reads the byte at the given absolute position", () => {
      const r = createBinaryReader(new Uint8Array([0x01, 0x02, 0x03]).buffer);
      expect(r.peekU8At(1)).toBe(0x02);
    });

    it("does not move the cursor", () => {
      const r = createBinaryReader(new Uint8Array([0x01, 0x02, 0x03]).buffer);
      r.skip(1);
      r.peekU8At(2);
      expect(r.offset).toBe(1);
    });

    it("reads from position 0", () => {
      const r = createBinaryReader(new Uint8Array([0xde, 0xad]).buffer);
      r.skip(1);
      expect(r.peekU8At(0)).toBe(0xde);
    });

    it("throws BufferOverflowError when pos equals byteLength", () => {
      const r = createBinaryReader(new Uint8Array([0x01]).buffer);
      expect(() => r.peekU8At(1)).toThrow(BufferOverflowError);
    });

    it("throws BufferOverflowError when pos exceeds byteLength", () => {
      const r = createBinaryReader(new Uint8Array([0x01, 0x02]).buffer);
      expect(() => r.peekU8At(5)).toThrow(BufferOverflowError);
    });
  });

  describe("isEOF", () => {
    it("is false before consuming all bytes", () => {
      const r = createBinaryReader(new Uint8Array([0x01]).buffer);
      expect(r.isEOF).toBe(false);
    });

    it("is true after consuming all bytes", () => {
      const r = createBinaryReader(new Uint8Array([0x01]).buffer);
      r.u8();
      expect(r.isEOF).toBe(true);
    });

    it("is true immediately for an empty buffer", () => {
      const r = createBinaryReader(new Uint8Array(0).buffer);
      expect(r.isEOF).toBe(true);
    });
  });

  describe("offset and byteLength", () => {
    it("offset starts at 0", () => {
      const r = createBinaryReader(new Uint8Array([1, 2, 3]).buffer);
      expect(r.offset).toBe(0);
    });

    it("byteLength reflects the source size", () => {
      const r = createBinaryReader(new Uint8Array([1, 2, 3]).buffer);
      expect(r.byteLength).toBe(3);
    });

    it("offset updates correctly across mixed reads", () => {
      const r = createBinaryReader(new Uint8Array([1, 0, 2, 0, 0, 0, 0, 0, 3]).buffer);
      r.u8();
      expect(r.offset).toBe(1);
      r.u16();
      expect(r.offset).toBe(3);
      r.u32();
      expect(r.offset).toBe(7);
    });
  });

  describe("input normalization", () => {
    it("accepts ArrayBuffer", () => {
      const r = createBinaryReader(new Uint8Array([0x42]).buffer);
      expect(r.u8()).toBe(0x42);
    });

    it("accepts Uint8Array", () => {
      const r = createBinaryReader(new Uint8Array([0x42]));
      expect(r.u8()).toBe(0x42);
    });

    it("accepts Uint8Array with byteOffset > 0 (Buffer pool simulation)", () => {
      const bigBuf = new ArrayBuffer(10);
      const dv = new DataView(bigBuf);
      dv.setUint8(3, 0x42);
      const slice = new Uint8Array(bigBuf, 3, 1);
      const r = createBinaryReader(slice);
      expect(r.u8()).toBe(0x42);
      expect(r.byteLength).toBe(1);
    });

    it("bytes() view shares the original buffer when input has byteOffset > 0", () => {
      const bigBuf = new ArrayBuffer(10);
      const dv = new DataView(bigBuf);
      dv.setUint8(3, 0x01);
      dv.setUint8(4, 0x02);
      const slice = new Uint8Array(bigBuf, 3, 2);
      const r = createBinaryReader(slice);
      const result = r.bytes(2);
      expect(result.buffer).toBe(bigBuf);
    });
  });
});

describe("createEscapedBinaryReader", () => {
  describe("escU8", () => {
    it("reads a plain byte without escape", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0x42]).buffer);
      expect(r.escU8()).toBe(0x42);
    });

    it("skips the escape marker and returns the following byte", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0xfd, 0x42]).buffer);
      expect(r.escU8()).toBe(0x42);
    });

    it("advances cursor by 1 for a plain byte", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0x42, 0x00]).buffer);
      r.escU8();
      expect(r.offset).toBe(1);
    });

    it("advances cursor by 2 for an escaped byte", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0xfd, 0x42, 0x00]).buffer);
      r.escU8();
      expect(r.offset).toBe(2);
    });

    it("throws BufferOverflowError when escape marker is the last byte", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0xfd]).buffer);
      expect(() => r.escU8()).toThrow(BufferOverflowError);
    });
  });

  describe("escU16", () => {
    it("reads 2 plain bytes little-endian", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0x34, 0x12]).buffer);
      expect(r.escU16()).toBe(0x1234);
    });

    it("handles escape on the low byte", () => {
      // lo byte: escape + 0x34; hi byte: 0x12 plain -> 0x1234
      const r = createEscapedBinaryReader(new Uint8Array([0xfd, 0x34, 0x12]).buffer);
      expect(r.escU16()).toBe(0x1234);
      expect(r.offset).toBe(3);
    });

    it("handles escape on the high byte", () => {
      // lo byte: 0x34 plain; hi byte: escape + 0x12 -> 0x1234
      const r = createEscapedBinaryReader(new Uint8Array([0x34, 0xfd, 0x12]).buffer);
      expect(r.escU16()).toBe(0x1234);
      expect(r.offset).toBe(3);
    });

    it("handles escape on both bytes", () => {
      // lo: escape + 0x34; hi: escape + 0x12 -> 0x1234
      const r = createEscapedBinaryReader(new Uint8Array([0xfd, 0x34, 0xfd, 0x12]).buffer);
      expect(r.escU16()).toBe(0x1234);
      expect(r.offset).toBe(4);
    });
  });

  describe("escU32", () => {
    it("reads 4 plain bytes little-endian", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0x78, 0x56, 0x34, 0x12]).buffer);
      expect(r.escU32()).toBe(0x12345678);
    });

    it("handles all 4 bytes escaped", () => {
      const r = createEscapedBinaryReader(
        new Uint8Array([0xfd, 0x78, 0xfd, 0x56, 0xfd, 0x34, 0xfd, 0x12]).buffer,
      );
      expect(r.escU32()).toBe(0x12345678);
      expect(r.offset).toBe(8);
    });

    it("handles mixed escaped and plain bytes", () => {
      // b0: 0x78 plain; b1: escape+0x56; b2: 0x34 plain; b3: escape+0x12
      const r = createEscapedBinaryReader(
        new Uint8Array([0x78, 0xfd, 0x56, 0x34, 0xfd, 0x12]).buffer,
      );
      expect(r.escU32()).toBe(0x12345678);
      expect(r.offset).toBe(6);
    });

    it("returns unsigned value when high bit is set", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0xff, 0xff, 0xff, 0xff]).buffer);
      expect(r.escU32()).toBe(0xffffffff);
    });
  });

  describe("escStr", () => {
    it("reads n bytes as Latin-1 string without escapes", () => {
      const r = createEscapedBinaryReader(new Uint8Array([72, 101, 108, 108, 111]).buffer);
      expect(r.escStr(5)).toBe("Hello");
    });

    it("reads n output bytes even with escape sequences", () => {
      // "AB": A=0x41 (escaped as 0xFD,0x41), B=0x42 plain
      const r = createEscapedBinaryReader(new Uint8Array([0xfd, 0x41, 0x42]).buffer);
      expect(r.escStr(2)).toBe("AB");
    });

    it("supports explicit encoding", () => {
      const buf = new Uint8Array([72, 101, 108, 108, 111]);
      const r = createEscapedBinaryReader(buf.buffer);
      expect(r.escStr(5, "utf-8")).toBe("Hello");
    });
  });

  describe("escU64", () => {
    it("reads 8 plain bytes as little-endian u64 number", () => {
      // value: 0x0000000100000002 = 4294967298
      const r = createEscapedBinaryReader(
        new Uint8Array([0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00]).buffer,
      );
      expect(r.escU64()).toBe(0x0000000100000002);
    });

    it("returns 0 for 8 zero bytes", () => {
      const r = createEscapedBinaryReader(new Uint8Array(8).buffer);
      expect(r.escU64()).toBe(0);
    });

    it("handles escape sequence in low bytes", () => {
      // lo: [0xFD,0xFE, 0x00,0x00,0x00,0x00] = lo=0xFE=254; hi: [0x00,0x00,0x00,0x00] = 0
      const r = createEscapedBinaryReader(
        new Uint8Array([0xfd, 0xfe, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]).buffer,
      );
      expect(r.escU64()).toBe(254);
    });

    it("advances cursor by decoded byte count (8 logical bytes)", () => {
      // 8 plain bytes → cursor moves 8 raw bytes
      const r = createEscapedBinaryReader(new Uint8Array(8).buffer);
      r.escU64();
      expect(r.offset).toBe(8);
    });

    it("advances cursor past escape pairs (9 raw bytes for one escaped byte)", () => {
      // 1 escaped byte + 7 plain bytes = 9 raw bytes total
      const r = createEscapedBinaryReader(
        new Uint8Array([0xfd, 0xfe, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]).buffer,
      );
      r.escU64();
      expect(r.offset).toBe(9);
    });
  });

  describe("escBytes", () => {
    it("reads n bytes without escapes", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0x01, 0x02, 0x03]).buffer);
      expect(r.escBytes(3)).toEqual(new Uint8Array([0x01, 0x02, 0x03]));
    });

    it("reads n output bytes with escape sequences in the middle", () => {
      // output: [0x01, 0x42, 0x03]; raw: [0x01, 0xFD, 0x42, 0x03]
      const r = createEscapedBinaryReader(new Uint8Array([0x01, 0xfd, 0x42, 0x03]).buffer);
      expect(r.escBytes(3)).toEqual(new Uint8Array([0x01, 0x42, 0x03]));
      expect(r.offset).toBe(4);
    });
  });

  describe("custom escapeMarker", () => {
    it("uses the custom marker instead of 0xFD", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0xee, 0x42]).buffer, 0xee);
      expect(r.escU8()).toBe(0x42);
    });

    it("does not treat 0xFD as escape when marker is custom", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0xfd]).buffer, 0xee);
      expect(r.escU8()).toBe(0xfd);
    });
  });

  describe("inherited base methods", () => {
    it("u8 reads raw byte", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0x42]).buffer);
      expect(r.u8()).toBe(0x42);
    });

    it("u16 reads raw little-endian u16", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0x34, 0x12]).buffer);
      expect(r.u16()).toBe(0x1234);
    });

    it("u32 reads raw little-endian u32", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0x78, 0x56, 0x34, 0x12]).buffer);
      expect(r.u32()).toBe(0x12345678);
    });

    it("str reads raw bytes as string", () => {
      const r = createEscapedBinaryReader(new Uint8Array([72, 105]).buffer);
      expect(r.str(2)).toBe("Hi");
    });

    it("bytes returns raw Uint8Array view", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0x01, 0x02]).buffer);
      expect(r.bytes(2)).toEqual(new Uint8Array([0x01, 0x02]));
    });

    it("u16arr reads array of raw u16 values", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0x01, 0x00, 0x02, 0x00]).buffer);
      expect(r.u16arr(2)).toEqual([1, 2]);
    });

    it("skip advances raw cursor", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0x01, 0x02, 0x03]).buffer);
      r.skip(2);
      expect(r.offset).toBe(2);
    });

    it("seek repositions raw cursor to absolute position", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0x01, 0x02, 0x03]).buffer);
      r.seek(2);
      expect(r.offset).toBe(2);
    });

    it("seekByte finds raw byte", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0x01, 0xab, 0x03]).buffer);
      r.seekByte(0xab);
      expect(r.offset).toBe(2);
    });

    it("seekAnyByte works on raw buffer", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0x01, 0xfd, 0x03]).buffer);
      const found = r.seekAnyByte([0xfd]);
      expect(found).toBe(0xfd);
      expect(r.offset).toBe(2);
    });

    it("peekU8At reads raw byte without moving cursor", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0x01, 0xab, 0x03]).buffer);
      expect(r.peekU8At(1)).toBe(0xab);
      expect(r.offset).toBe(0);
    });

    it("offset reflects raw buffer position", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0x01, 0x02, 0x03]).buffer);
      r.u8();
      expect(r.offset).toBe(1);
    });

    it("isEOF is true after consuming all bytes", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0x01]).buffer);
      r.u8();
      expect(r.isEOF).toBe(true);
    });

    it("byteLength reflects source size", () => {
      const r = createEscapedBinaryReader(new Uint8Array([1, 2, 3]).buffer);
      expect(r.byteLength).toBe(3);
    });
  });

  describe("seekNodeBoundary", () => {
    it("returns the matching unescaped byte", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0x01, 0xfe, 0x03]).buffer);
      expect(r.seekNodeBoundary([0xfe, 0xff])).toBe(0xfe);
    });

    it("positions cursor immediately after the found byte", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0x01, 0xfe, 0x03]).buffer);
      r.seekNodeBoundary([0xfe, 0xff]);
      expect(r.offset).toBe(2);
    });

    it("skips an escaped target — [0xFD, 0xFE] is data, not a boundary", () => {
      // [0xFD, 0xFE] = escaped 0xFE (data byte); plain 0xFF = boundary
      const r = createEscapedBinaryReader(new Uint8Array([0xfd, 0xfe, 0xff]).buffer);
      expect(r.seekNodeBoundary([0xfe, 0xff])).toBe(0xff);
      expect(r.offset).toBe(3);
    });

    it("finds whichever target comes first unescaped", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0x01, 0xff, 0xfe]).buffer);
      expect(r.seekNodeBoundary([0xfe, 0xff])).toBe(0xff);
    });

    it("throws ByteNotFoundError when EOF is reached without a match", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0x01, 0x02]).buffer);
      expect(() => r.seekNodeBoundary([0xfe, 0xff])).toThrow(ByteNotFoundError);
    });

    it("preserves cursor when target is not found", () => {
      const r = createEscapedBinaryReader(new Uint8Array([0x01, 0x02]).buffer);
      r.skip(1);
      try {
        r.seekNodeBoundary([0xfe]);
      } catch {}
      expect(r.offset).toBe(1);
    });
  });

  describe("EscapedBinaryReader is assignable to BinaryReader", () => {
    it("can be used wherever a BinaryReader is expected", () => {
      const er = createEscapedBinaryReader(new Uint8Array([0x42]).buffer);
      const br: BinaryReader = er;
      expect(br.u8()).toBe(0x42);
    });
  });
});

describe("createEscapedSliceReader", () => {
  it("reads u8 without escape marker", () => {
    const r = createEscapedSliceReader(new Uint8Array([0x42, 0x10]));
    r.seekWindow(0, 2);
    expect(r.u8()).toBe(0x42);
    expect(r.u8()).toBe(0x10);
  });

  it("reads u8 skipping escape marker", () => {
    const r = createEscapedSliceReader(new Uint8Array([0xfd, 0xfe]));
    r.seekWindow(0, 2);
    expect(r.u8()).toBe(0xfe);
  });

  it("reads u16 little-endian with escape in first byte", () => {
    // data bytes: 0xFE, 0x01 => stored as [0xFD, 0xFE, 0x01] => 0x01FE
    const r = createEscapedSliceReader(new Uint8Array([0xfd, 0xfe, 0x01]));
    r.seekWindow(0, 3);
    expect(r.u16()).toBe(0x01fe);
  });

  it("reads u16 little-endian with escape in second byte", () => {
    // data bytes: 0x01, 0xFE => stored as [0x01, 0xFD, 0xFE] => 0xFE01
    const r = createEscapedSliceReader(new Uint8Array([0x01, 0xfd, 0xfe]));
    r.seekWindow(0, 3);
    expect(r.u16()).toBe(0xfe01);
  });

  it("reads u32 with escapes in intercalated bytes", () => {
    // data bytes: 0x01 0xFD 0x02 0xFF => stored as [0x01, 0xFD,0xFD, 0x02, 0xFD,0xFF]
    const buf = new Uint8Array([0x01, 0xfd, 0xfd, 0x02, 0xfd, 0xff]);
    const r = createEscapedSliceReader(buf);
    r.seekWindow(0, buf.length);
    expect(r.u32()).toBe((0x01 | (0xfd << 8) | (0x02 << 16) | (0xff << 24)) >>> 0);
  });

  it("reads str with escape in middle byte", () => {
    // data chars: 'A' (0x41), 0xFE (encoded as [0xFD,0xFE]), 'B' (0x42)
    const buf = new Uint8Array([0x41, 0xfd, 0xfe, 0x42]);
    const r = createEscapedSliceReader(buf);
    r.seekWindow(0, buf.length);
    expect(r.str(3)).toBe("A\xFEB");
  });

  it("skip advances past escape-encoded bytes", () => {
    // [0xFD, 0xFE, 0x42]: skip(1) consumes the escaped 0xFE, next u8 = 0x42
    const buf = new Uint8Array([0xfd, 0xfe, 0x42]);
    const r = createEscapedSliceReader(buf);
    r.seekWindow(0, buf.length);
    r.skip(1);
    expect(r.u8()).toBe(0x42);
  });

  it("seekWindow repositions cursor and updates window limit", () => {
    const buf = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const r = createEscapedSliceReader(buf);
    r.seekWindow(0, 2);
    expect(r.u8()).toBe(0x01);
    r.seekWindow(2, 4);
    expect(r.u8()).toBe(0x03);
  });

  it("isEOF is false before window end and true after", () => {
    const buf = new Uint8Array([0x01]);
    const r = createEscapedSliceReader(buf);
    r.seekWindow(0, 1);
    expect(r.isEOF).toBe(false);
    r.u8();
    expect(r.isEOF).toBe(true);
  });

  it("isEOF is window-relative, not buffer-relative", () => {
    const buf = new Uint8Array([0x01, 0x02, 0x03]);
    const r = createEscapedSliceReader(buf);
    r.seekWindow(0, 1);
    r.u8();
    expect(r.isEOF).toBe(true);
  });

  it("throws BufferOverflowError when reading past windowEnd", () => {
    const buf = new Uint8Array([0x01, 0x02]);
    const r = createEscapedSliceReader(buf);
    r.seekWindow(0, 1);
    r.u8();
    expect(() => r.u8()).toThrow(BufferOverflowError);
  });

  it("custom escapeMarker: default 0xFD byte is not treated as escape", () => {
    const buf = new Uint8Array([0xfd, 0x10]);
    const r = createEscapedSliceReader(buf, 0xee);
    r.seekWindow(0, 2);
    expect(r.u8()).toBe(0xfd);
    expect(r.u8()).toBe(0x10);
  });

  it("custom escapeMarker is skipped when it appears", () => {
    const buf = new Uint8Array([0xee, 0xfd]);
    const r = createEscapedSliceReader(buf, 0xee);
    r.seekWindow(0, 2);
    expect(r.u8()).toBe(0xfd);
  });
});
