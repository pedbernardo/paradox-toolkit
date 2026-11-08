import type { SprFile } from '@paradoxlab/spr'
import { StackOrder } from './backpack-flags.js'
import type {
  AppearanceColumns,
  AtlasImage,
  ComposedAppearances,
  RenderAppearanceColumns
} from './types.js'

const SIZE = 32
const PIXELS = SIZE * SIZE

/** Stacks layers into one 32x32 RGBA image, layer 0 at the bottom (source-over). */
export function composeLayers(layers: readonly (Uint8Array | undefined)[]): Uint8Array {
  const out = new Uint8Array(PIXELS * 4)
  for (const layer of layers) {
    if (layer === undefined) continue
    for (let p = 0; p < PIXELS * 4; p += 4) {
      const a = layer[p + 3]!
      if (a === 0) continue
      if (a === 255) {
        out[p] = layer[p]!
        out[p + 1] = layer[p + 1]!
        out[p + 2] = layer[p + 2]!
        out[p + 3] = 255
        continue
      }
      const below = out[p + 3]! / 255
      const alpha = a / 255
      const outAlpha = alpha + below * (1 - alpha)
      for (let c = 0; c < 3; c++) {
        const src = layer[p + c]! * alpha
        const dst = out[p + c]! * below * (1 - alpha)
        out[p + c] = Math.round((src + dst) / outAlpha)
      }
      out[p + 3] = Math.round(outAlpha * 255)
    }
  }
  return out
}

const enum Coverage {
  Empty,
  Partial,
  Opaque
}

/** Opaque means every pixel at full alpha: a half-transparent frame does not hide what is below. */
function coverageOf(rgba: Uint8Array): Coverage {
  let visible = 0
  let solid = 0
  for (let p = 3; p < rgba.length; p += 4) {
    if (rgba[p] !== 0) visible++
    if (rgba[p] === 255) solid++
  }
  return visible === 0 ? Coverage.Empty : solid === PIXELS ? Coverage.Opaque : Coverage.Partial
}

function emptyColumns(): RenderAppearanceColumns {
  return {
    cid: [],
    width: [],
    height: [],
    patternX: [],
    patternY: [],
    patternZ: [],
    frames: [],
    frameStart: [],
    frameIds: [],
    opaque: [],
    order: [],
    elevation: [],
    offsetX: [],
    offsetY: [],
    lightLevel: [],
    lightColor: [],
    flags: []
  }
}

/**
 * Composes the layers of the given appearance rows into frames: one frame per sprite index of a
 * single-layer layout. Frames with the same layer sprites are shared, and fully transparent ones
 * become frame 0.
 */
export function composeAppearances(
  source: AppearanceColumns,
  rows: readonly number[],
  spr: SprFile
): ComposedAppearances {
  const out = emptyColumns()
  const tuples: (number | readonly number[])[] = [0]
  const priorities: number[] = [1]
  const frameOfSprite = new Map<number, number>()
  const frameOfTuple = new Map<string, number>()
  const coverages: Coverage[] = [Coverage.Empty]

  const pixelsOf = (id: number): Uint8Array | undefined =>
    id === 0 ? undefined : spr.get(id)?.rgba
  const composed = (tuple: readonly number[]): Uint8Array => composeLayers(tuple.map(pixelsOf))

  const frameOf = (tuple: readonly number[], priority: number): number => {
    const single = tuple.length === 1
    let frame = single ? frameOfSprite.get(tuple[0]!) : frameOfTuple.get(tuple.join(','))
    if (frame === undefined) {
      const rgba = single ? pixelsOf(tuple[0]!) : composed(tuple)
      const coverage = rgba === undefined ? Coverage.Empty : coverageOf(rgba)
      frame = coverage === Coverage.Empty ? 0 : tuples.length
      if (frame !== 0) {
        tuples.push(single ? tuple[0]! : tuple)
        priorities.push(priority)
        coverages.push(coverage)
      }
      if (single) frameOfSprite.set(tuple[0]!, frame)
      else frameOfTuple.set(tuple.join(','), frame)
    }
    if (priority < priorities[frame]!) priorities[frame] = priority
    return frame
  }

  for (const row of rows) {
    const layers = source.layers[row]!
    const parts = source.width[row]! * source.height[row]!
    const cells =
      source.patternX[row]! * source.patternY[row]! * source.patternZ[row]! * source.frames[row]!
    const spriteStart = source.spriteStart[row]!
    const order = source.order[row]!
    const priority = order === StackOrder.Ground || order === StackOrder.Border ? 0 : 1
    const start = out.frameIds.length
    let opaque = true
    // In DAT order the layers sit between the pattern cell and the parts (see `spriteIndex`), so
    // composed index i = cell * parts + part reads layer l at (cell * layers + l) * parts + part.
    for (let i = 0; i < cells * parts; i++) {
      const cell = Math.floor(i / parts)
      const part = i % parts
      const tuple: number[] = []
      for (let layer = 0; layer < layers; layer++)
        tuple.push(source.spriteIds[spriteStart + (cell * layers + layer) * parts + part] ?? 0)
      const frame = frameOf(tuple, priority)
      opaque &&= coverages[frame] === Coverage.Opaque
      out.frameIds.push(frame)
    }
    out.cid.push(source.cid[row]!)
    out.width.push(source.width[row]!)
    out.height.push(source.height[row]!)
    out.patternX.push(source.patternX[row]!)
    out.patternY.push(source.patternY[row]!)
    out.patternZ.push(source.patternZ[row]!)
    out.frames.push(source.frames[row]!)
    out.frameStart.push(start)
    out.opaque.push(opaque ? 1 : 0)
    out.order.push(order)
    out.elevation.push(source.elevation[row]!)
    out.offsetX.push(source.offsetX[row]!)
    out.offsetY.push(source.offsetY[row]!)
    out.lightLevel.push(source.lightLevel[row]!)
    out.lightColor.push(source.lightColor[row]!)
    out.flags.push(source.flags[row]!)
  }

  return {
    appearances: out,
    frameCount: tuples.length - 1,
    imageOf(frame): AtlasImage {
      const tuple = tuples[frame]!
      const rgba = typeof tuple === 'number' ? pixelsOf(tuple)! : composed(tuple)
      return { width: SIZE, height: SIZE, rgba }
    },
    priorityOf: (frame) => priorities[frame]!
  }
}
