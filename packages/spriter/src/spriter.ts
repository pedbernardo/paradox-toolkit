import sharp from 'sharp'
import type { SprFile } from '@paradoxlab/spr'
import { SPRITESHEET_SCHEMA_VERSION, type SpritesheetOutput } from './types.js'

const SPRITE_SIZE = 32
const DEFAULT_MAX_WIDTH = 4096
const PADDING = 1
const CELL_SIZE = SPRITE_SIZE + PADDING

type SpritesheetInput = {
  spr: SprFile
  maxWidth?: number
}

export function Spriter({ spr, maxWidth = DEFAULT_MAX_WIDTH }: SpritesheetInput) {
  if (maxWidth < CELL_SIZE) {
    throw new Error(
      `maxWidth must be at least ${CELL_SIZE} (SPRITE_SIZE + PADDING); got ${maxWidth}`
    )
  }

  return { build }

  async function build(): Promise<SpritesheetOutput> {
    const columns = Math.floor(maxWidth / CELL_SIZE)
    const rows = Math.ceil(spr.count / columns)
    const width = columns * CELL_SIZE - PADDING
    const height = rows * CELL_SIZE - PADDING

    const rawBuffer = new Uint8Array(width * height * 4)
    const positions = new Map<number, { x: number; y: number }>()

    let index = 0
    for (const [id, sprite] of spr.entries()) {
      const col = index % columns
      const row = Math.floor(index / columns)
      const x = col * CELL_SIZE
      const y = row * CELL_SIZE

      positions.set(id, { x, y })
      copySprite(sprite.rgba, rawBuffer, x, y, width)
      index++
    }

    /**
     * PNG encoding strategy: palette quantization + maximum compression effort.
     *
     * palette: true - libimagequant reduces the image to ≤256 indexed colors instead of
     * storing raw RGBA (4 bytes/pixel). Tibia pixel art uses a naturally limited palette
     * per sprite, and the majority of spritesheet pixels are fully transparent, so the
     * quantization budget covers all distinct colors without visible loss. Result for
     * version 772: ~3.7 MB instead of ~11 MB with RGBA encoding.
     *
     * effort: 10 - maximum encoder effort for filter selection and zlib strategy. Increases
     * build time but produces the smallest possible output for a given set of pixels.
     *
     * limitInputPixels: false - disables sharp's default safety cap (~268 MP). Safe here
     * because the raw buffer is always generated internally, never from external input.
     *
     * If custom sprites with complex color gradients are added in the future, palette
     * quantization may introduce visible dithering. Revisit at that point.
     */
    const png = await sharp(Buffer.from(rawBuffer.buffer), {
      raw: { width, height, channels: 4 },
      limitInputPixels: false
    })
      .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, effort: 10 })
      .toBuffer()

    const meta = {
      schema: SPRITESHEET_SCHEMA_VERSION,
      version: spr.version,
      spr: spr.signature.toString(16).toUpperCase().padStart(8, '0'),
      width,
      height,
      sprites: spr.count
    }

    return { meta, png, positions }
  }
}

function copySprite(
  rgba: Uint8Array,
  target: Uint8Array,
  startX: number,
  startY: number,
  targetWidth: number
): void {
  for (let py = 0; py < SPRITE_SIZE; py++) {
    for (let px = 0; px < SPRITE_SIZE; px++) {
      const srcIndex = (py * SPRITE_SIZE + px) * 4
      const dstIndex = ((startY + py) * targetWidth + (startX + px)) * 4
      target[dstIndex] = rgba[srcIndex]!
      target[dstIndex + 1] = rgba[srcIndex + 1]!
      target[dstIndex + 2] = rgba[srcIndex + 2]!
      target[dstIndex + 3] = rgba[srcIndex + 3]!
    }
  }
}
