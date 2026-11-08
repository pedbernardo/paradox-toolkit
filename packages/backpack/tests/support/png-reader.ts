import { inflateSync } from 'node:zlib'

/** A minimal 8-bit RGBA PNG reader for tests: inflates IDAT and undoes the row filters. */
export function readPng(png: Uint8Array): { width: number; height: number; rgba: Uint8Array } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  let at = 8
  let width = 0
  let height = 0
  const idat: Uint8Array[] = []
  while (at < png.length) {
    const length = view.getUint32(at)
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8))
    const data = png.subarray(at + 8, at + 8 + length)
    if (type === 'IHDR') {
      width = view.getUint32(at + 8)
      height = view.getUint32(at + 12)
    } else if (type === 'IDAT') {
      idat.push(data)
    }
    at += 12 + length
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * 4
  const rgba = new Uint8Array(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!
    for (let i = 0; i < stride; i++) {
      const value = raw[y * (stride + 1) + 1 + i]!
      const left = i >= 4 ? rgba[y * stride + i - 4]! : 0
      const up = y > 0 ? rgba[(y - 1) * stride + i]! : 0
      const upLeft = y > 0 && i >= 4 ? rgba[(y - 1) * stride + i - 4]! : 0
      let predicted = 0
      if (filter === 1) predicted = left
      else if (filter === 2) predicted = up
      else if (filter === 3) predicted = (left + up) >> 1
      else if (filter === 4) {
        const p = left + up - upLeft
        const pa = Math.abs(p - left)
        const pb = Math.abs(p - up)
        const pc = Math.abs(p - upLeft)
        predicted = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft
      }
      rgba[y * stride + i] = (value + predicted) & 0xff
    }
  }
  return { width, height, rgba }
}
