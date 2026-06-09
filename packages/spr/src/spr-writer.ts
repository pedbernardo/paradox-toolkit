import { createBinaryWriter, getVersionFeatures, ParseError } from '@paradoxlab/utils'
import { SPR_SIGNATURES } from './spr-config.js'
import type { Sprite, SprWriteInput } from './types.js'

export function serializeSpr(
  data: SprWriteInput,
  version: number,
  onSprite?: (index: number, total: number) => void
): Uint8Array[] {
  const features = getVersionFeatures(version)
  const sig = SPR_SIGNATURES[version]

  if (sig === undefined || sig === 0) {
    throw new ParseError(
      `SPR signature unknown for version ${version} - no fixture available to confirm`
    )
  }

  const { extendedSprites } = features
  const sprites = resolveInput(data)
  const count = sprites.length
  const headerSize = extendedSprites ? 8 : 6
  const tableSize = count * 4
  const baseOffset = headerSize + tableSize
  const spriteChunks: Uint8Array[] = []
  const addresses: number[] = []

  let currentOffset = baseOffset

  for (let i = 0; i < count; i++) {
    const sprite = sprites[i]
    if (sprite === null || sprite === undefined) {
      addresses.push(0)
    } else {
      const chunk = encodeSprite(sprite)
      spriteChunks.push(chunk)
      addresses.push(currentOffset)
      currentOffset += chunk.length
    }
    onSprite?.(i, count)
  }

  const headerWriter = createBinaryWriter()
  headerWriter.u32(sig)
  if (extendedSprites) {
    headerWriter.u32(count)
  } else {
    headerWriter.u16(count)
  }

  const tableWriter = createBinaryWriter()
  for (const addr of addresses) {
    tableWriter.u32(addr)
  }

  return [headerWriter.finish(), tableWriter.finish(), ...spriteChunks]
}

function isGetInput(
  data: SprWriteInput
): data is { readonly count: number; get(id: number): Sprite | undefined } {
  return (
    typeof (data as { count?: unknown }).count === 'number' &&
    typeof (data as { get?: unknown }).get === 'function'
  )
}

function resolveInput(data: SprWriteInput): Array<Sprite | null | undefined> {
  if (isGetInput(data)) {
    const result: Array<Sprite | undefined> = []
    for (let id = 1; id <= data.count; id++) {
      result.push(data.get(id))
    }
    return result
  }
  return [...data]
}

function encodeSprite(sprite: Sprite): Uint8Array {
  const rgba = sprite.rgba
  const totalPixels = 1024 // 32x32

  const runsWriter = createBinaryWriter()
  let i = 0

  while (i < totalPixels) {
    let transparentCount = 0

    while (i < totalPixels && rgba[i * 4 + 3] === 0) {
      transparentCount++
      i++
    }

    if (i >= totalPixels) break // trailing transparents are implicit

    const coloredStart = i

    while (i < totalPixels && rgba[i * 4 + 3] !== 0) {
      i++
    }

    const coloredCount = i - coloredStart

    runsWriter.u16(transparentCount)
    runsWriter.u16(coloredCount)

    for (let j = coloredStart; j < i; j++) {
      runsWriter.u8(rgba[j * 4]!)
      runsWriter.u8(rgba[j * 4 + 1]!)
      runsWriter.u8(rgba[j * 4 + 2]!)
    }
  }

  const spriteSize = runsWriter.length
  const chunkWriter = createBinaryWriter()

  chunkWriter.u8(0xff)
  chunkWriter.u8(0x00)
  chunkWriter.u8(0xff)
  chunkWriter.u16(spriteSize)

  if (spriteSize > 0) {
    chunkWriter.bytes(runsWriter.finish())
  }

  return chunkWriter.finish()
}
