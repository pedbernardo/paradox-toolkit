import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// SPR signature for version 772 (from @paradox/spr spr-config.ts)
const SIGNATURE_772 = 0x439852be

const COUNT = 10
const TRANSPARENT_IDS = [1, 2, 3, 4, 5]
const COLORED_IDS = [6, 7, 8, 9, 10]

// Colored sprite data: color key (3 bytes) + spriteSize u16 + 1 RLE run
// RLE run: transparentPixels u16=0, coloredPixels u16=1, 1 pixel RGB (3 bytes)
// total = 3 + 2 + 2 + 2 + 3 = 12 bytes
function makeColoredData(): number[] {
  return [
    0x00,
    0x00,
    0x00, // color key (magenta key - 3 bytes)
    0x07,
    0x00, // spriteSize u16 LE = 7 (2+2+3 bytes of RLE data)
    0x00,
    0x00, // transparentPixels u16 = 0
    0x01,
    0x00, // coloredPixels u16 = 1
    0xff,
    0x80,
    0x00 // 1 pixel RGB (orange)
  ]
}

// Layout:
//   header: signature u32 LE + count u16 LE = 6 bytes
//   address table: COUNT * u32 LE = 40 bytes
//   colored data starts at offset 6 + 40 = 46
const HEADER_SIZE = 6
const TABLE_SIZE = COUNT * 4
const DATA_OFFSET = HEADER_SIZE + TABLE_SIZE

const coloredData = makeColoredData()
const coloredDataSize = coloredData.length

const totalSize = DATA_OFFSET + COLORED_IDS.length * coloredDataSize
const buf = Buffer.alloc(totalSize, 0)

let offset = 0

// signature u32 LE
buf.writeUInt32LE(SIGNATURE_772, offset)
offset += 4

// count u16 LE
buf.writeUInt16LE(COUNT, offset)
offset += 2

// address table: IDs 1-5 transparent (address=0), IDs 6-10 point to data
for (let i = 0; i < COUNT; i++) {
  const id = i + 1
  if (TRANSPARENT_IDS.includes(id)) {
    buf.writeUInt32LE(0, offset)
  } else {
    const coloredIndex = COLORED_IDS.indexOf(id)
    const dataPos = DATA_OFFSET + coloredIndex * coloredDataSize
    buf.writeUInt32LE(dataPos, offset)
  }
  offset += 4
}

// write colored sprite data
for (let i = 0; i < COLORED_IDS.length; i++) {
  const dataPos = DATA_OFFSET + i * coloredDataSize
  for (let b = 0; b < coloredData.length; b++) {
    buf[dataPos + b] = coloredData[b]!
  }
}

const outPath = resolve(import.meta.dirname, '../fixtures/sample.spr')
writeFileSync(outPath, buf)
