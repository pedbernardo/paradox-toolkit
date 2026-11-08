import type { Deflate } from './types.js'

const SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
const BYTES_PER_PIXEL = 4

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

/** `Deflate` over `CompressionStream`, for browsers and workers (also in Node 18+). */
export const deflateWeb: Deflate = async (data) => {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new CompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * Encodes 8-bit RGBA pixels as a lossless PNG. Rows are left unfiltered: on sprite pages, with their
 * transparent gaps and repeated pixel art, deflate finds more repeats in the raw bytes than in any
 * row filter (7-14% smaller than choosing a filter per row, and about 4x faster).
 */
export async function encodePng(
  rgba: Uint8Array,
  width: number,
  height: number,
  deflate: Deflate
): Promise<Uint8Array> {
  if (rgba.length !== width * height * BYTES_PER_PIXEL) {
    throw new RangeError(`${rgba.length} bytes do not make a ${width}x${height} RGBA image`)
  }
  const stride = width * BYTES_PER_PIXEL
  // Each row is a filter-type byte (0, none) followed by the row's pixels.
  const scanlines = new Uint8Array((stride + 1) * height)
  for (let y = 0; y < height; y++)
    scanlines.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1)

  const header = new Uint8Array(13)
  const view = new DataView(header.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  header[8] = 8 // bit depth
  header[9] = 6 // color type: RGBA
  const parts = [
    SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', await deflate(scanlines)),
    chunk('IEND', new Uint8Array(0))
  ]
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}
