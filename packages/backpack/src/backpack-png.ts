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

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft
  const toLeft = Math.abs(estimate - left)
  const toUp = Math.abs(estimate - up)
  const toUpLeft = Math.abs(estimate - upLeft)
  if (toLeft <= toUp && toLeft <= toUpLeft) return left
  return toUp <= toUpLeft ? up : upLeft
}

const signedCost = (value: number): number => (value < 128 ? value : 256 - value)

/**
 * Writes `row` filtered with `type` into `target` and returns its cost (sum of absolute signed
 * bytes), stopping early once the cost reaches `limit`. One specialized loop per filter keeps the
 * hot loop free of per-byte branching.
 */
function applyFilter(
  type: number,
  row: Uint8Array,
  up: Uint8Array,
  target: Uint8Array,
  limit: number
): number {
  const length = row.length
  const bpp = BYTES_PER_PIXEL
  let cost = 0
  switch (type) {
    case 0:
      for (let i = 0; i < length && cost < limit; i++) {
        target[i] = row[i]!
        cost += signedCost(row[i]!)
      }
      return cost
    case 1:
      for (let i = 0; i < length && cost < limit; i++) {
        const value = (row[i]! - (i >= bpp ? row[i - bpp]! : 0)) & 0xff
        target[i] = value
        cost += signedCost(value)
      }
      return cost
    case 2:
      for (let i = 0; i < length && cost < limit; i++) {
        const value = (row[i]! - up[i]!) & 0xff
        target[i] = value
        cost += signedCost(value)
      }
      return cost
    case 3:
      for (let i = 0; i < length && cost < limit; i++) {
        const value = (row[i]! - (((i >= bpp ? row[i - bpp]! : 0) + up[i]!) >> 1)) & 0xff
        target[i] = value
        cost += signedCost(value)
      }
      return cost
    default:
      for (let i = 0; i < length && cost < limit; i++) {
        const left = i >= bpp ? row[i - bpp]! : 0
        const upLeft = i >= bpp ? up[i - bpp]! : 0
        const value = (row[i]! - paeth(left, up[i]!, upLeft)) & 0xff
        target[i] = value
        cost += signedCost(value)
      }
      return cost
  }
}

/**
 * Filters one row with each PNG filter and keeps the one with the smallest cost, the usual
 * heuristic for what deflate compresses best.
 */
function filterRow(row: Uint8Array, up: Uint8Array, out: Uint8Array, scratch: Uint8Array): void {
  let bestType = 0
  let bestCost = applyFilter(0, row, up, out.subarray(1), Number.POSITIVE_INFINITY)
  for (let type = 1; type <= 4; type++) {
    const cost = applyFilter(type, row, up, scratch, bestCost)
    if (cost < bestCost) {
      bestCost = cost
      bestType = type
      out.set(scratch.subarray(0, row.length), 1)
    }
  }
  out[0] = bestType
}

/** Encodes 8-bit RGBA pixels as a lossless PNG, with a filter chosen per row. */
/** `Deflate` over `CompressionStream`, for browsers and workers (also in Node 18+). */
export const deflateWeb: Deflate = async (data) => {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new CompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

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
  const filtered = new Uint8Array((stride + 1) * height)
  const scratch = new Uint8Array(stride)
  const zeroRow = new Uint8Array(stride)
  for (let y = 0; y < height; y++) {
    const row = rgba.subarray(y * stride, (y + 1) * stride)
    const up = y === 0 ? zeroRow : rgba.subarray((y - 1) * stride, y * stride)
    filterRow(row, up, filtered.subarray(y * (stride + 1), (y + 1) * (stride + 1)), scratch)
  }

  const header = new Uint8Array(13)
  const view = new DataView(header.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  header[8] = 8 // bit depth
  header[9] = 6 // color type: RGBA
  const parts = [
    SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', await deflate(filtered)),
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
