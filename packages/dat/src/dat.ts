import { createBinaryReader, getVersionFeatures, ParseError } from '@paradox/utils'
import { DAT_SIGNATURES, DAT_FLAG_END_MARK, THINGS_GROUPS } from './dat-config.js'
import { getDatFlags } from './dat-flags.js'
import { createFlagsParser } from './dat-flags-parser.js'
import { serializeDat } from './dat-writer.js'
import type {
  AnimationData,
  DatFile,
  DatCounts,
  DatWriteInput,
  FrameGroup,
  Thing,
  ThingLayout,
  ThingGroup
} from './types.js'

export type { DatFile }

type Dat = {
  readonly version: number | undefined
  validate(buffer: ArrayBuffer | Uint8Array): void
  load(buffer: ArrayBuffer | Uint8Array): DatFile
  write(data: DatWriteInput): Uint8Array
}

export function Dat(version?: number): Dat {
  if (version !== undefined) {
    getVersionFeatures(version)
  }

  return {
    version,
    validate,
    load,
    write
  }

  function peekSignature(buffer: ArrayBuffer | Uint8Array): number {
    const ab = buffer instanceof Uint8Array ? buffer.buffer : buffer
    const off = buffer instanceof Uint8Array ? buffer.byteOffset : 0
    const len = buffer instanceof Uint8Array ? buffer.byteLength : ab.byteLength
    if (len < 4) throw new ParseError('DAT buffer too small to read signature')
    return new DataView(ab, off).getUint32(0, true)
  }

  function findVersionBySig(sig: number): number {
    for (const [ver, s] of Object.entries(DAT_SIGNATURES)) {
      if (s === sig) return Number(ver)
    }
    throw new ParseError(
      `DAT signature 0x${sig.toString(16).padStart(8, '0')} does not match any known version`
    )
  }

  function checkSig(sig: number, ver: number): void {
    const expected = DAT_SIGNATURES[ver]
    if (sig !== expected) {
      throw new ParseError(
        `DAT signature mismatch for version ${ver}: expected 0x${expected?.toString(16).padStart(8, '0')}, got 0x${sig.toString(16).padStart(8, '0')}`
      )
    }
  }

  function validate(buffer: ArrayBuffer | Uint8Array): void {
    const sig = peekSignature(buffer)
    if (version !== undefined) {
      checkSig(sig, version)
    } else {
      findVersionBySig(sig) // throws if no matching version found
    }
  }

  function load(buffer: ArrayBuffer | Uint8Array): DatFile {
    const sig = peekSignature(buffer)
    const resolvedVersion = version !== undefined ? version : findVersionBySig(sig)
    if (version !== undefined) checkSig(sig, version)

    const features = getVersionFeatures(resolvedVersion)
    const flagsParser = createFlagsParser(getDatFlags(resolvedVersion), resolvedVersion)
    const reader = createBinaryReader(buffer)

    reader.seek(4) // skip signature
    const itemsMaxCid = reader.u16()
    const creatures = reader.u16()
    const effects = reader.u16()
    const missiles = reader.u16()

    const counts: DatCounts = { itemsMaxCid, creatures, effects, missiles }

    const itemsMap = new Map<number, Thing>()
    const creaturesMap = new Map<number, Thing>()
    const effectsMap = new Map<number, Thing>()
    const missilesMap = new Map<number, Thing>()

    const {
      items,
      creatures: creaturesGroup,
      effects: effectsGroup,
      missiles: missilesGroup
    } = THINGS_GROUPS
    const itemsCount = itemsMaxCid - items.startId + 1

    parseGroup(items.startId, itemsCount, items.group)
    parseGroup(creaturesGroup.startId, creatures, creaturesGroup.group)
    parseGroup(effectsGroup.startId, effects, effectsGroup.group)
    parseGroup(missilesGroup.startId, missiles, missilesGroup.group)

    const things = [
      ...itemsMap.values(),
      ...creaturesMap.values(),
      ...effectsMap.values(),
      ...missilesMap.values()
    ]

    return {
      version: resolvedVersion,
      signature: sig,
      counts,
      things,
      get(group: ThingGroup, index: number): Thing | undefined {
        if (group === 'items') return itemsMap.get(index)
        if (group === 'creatures') return creaturesMap.get(index)
        if (group === 'effects') return effectsMap.get(index)
        return missilesMap.get(index)
      },
      entries(): Iterable<Thing> {
        return things
      }
    }

    function parseGroup(startId: number, count: number, group: ThingGroup): void {
      const map =
        group === 'items'
          ? itemsMap
          : group === 'creatures'
            ? creaturesMap
            : group === 'effects'
              ? effectsMap
              : missilesMap
      for (let cid = startId; cid < startId + count; cid++) {
        const thing = parseThing(cid, group)
        if (thing !== null) map.set(cid, thing)
      }
    }

    // Returns null when a thing can't be parsed due to unknown advanced flags with
    // variable-length data. The cursor may be misaligned after a failed parse -
    // the caller skips and does not attempt to recover cursor position.
    function parseThing(cid: number, group: ThingGroup): Thing | null {
      try {
        const flags = parseFlags(cid)

        const isCreature = group === 'creatures'
        const hasFrameGroups = features.frameGroups && isCreature
        const groupCount = hasFrameGroups ? reader.u8() : 1

        let layout!: ThingLayout
        let spriteIds!: number[]
        let frameGroups: FrameGroup[] | undefined

        if (hasFrameGroups) {
          // Creatures in 10.57+ carry multiple frame groups (idle + moving).
          // layout and spriteIds on root mirror the last group.
          frameGroups = []
          for (let g = 0; g < groupCount; g++) {
            const groupType = reader.u8()
            const grpLayout = parseLayout()
            const grpSpriteIds = parseSprites(grpLayout)
            frameGroups.push({ groupType, layout: grpLayout, spriteIds: grpSpriteIds })
          }
          layout = frameGroups[frameGroups.length - 1]!.layout
          spriteIds = frameGroups[frameGroups.length - 1]!.spriteIds
        } else {
          layout = parseLayout()
          spriteIds = parseSprites(layout)
        }

        const thing: Thing = { cid, group, flags, layout, spriteIds }
        if (frameGroups) thing.frameGroups = frameGroups
        return thing
      } catch (err) {
        // oxlint-disable-next-line no-console
        console.warn(`[dat] skipped cid=${cid} group=${group} version=${resolvedVersion}:`, err)
        return null
      }
    }

    function parseFlags(_cid: number): Thing['flags'] {
      let flags: Thing['flags'] = {}
      let flagInt = reader.u8()

      while (flagInt !== DAT_FLAG_END_MARK) {
        const parsed = flagsParser.parse(flagInt, reader)
        if (parsed !== null) flags = { ...flags, ...parsed }
        flagInt = reader.u8()
      }

      return flags
    }

    function parseLayout(): ThingLayout {
      const width = reader.u8()
      const height = reader.u8()

      let realSize = 32
      if (width > 1 || height > 1) {
        realSize = reader.u8()
      }

      const exactSize = Math.min(realSize, Math.max(width * 32, height * 32))
      const layers = reader.u8()
      const patternX = reader.u8()
      const patternY = reader.u8()
      const patternZ = features.patternZ ? reader.u8() : 1
      const frames = reader.u8()

      // 10.30+: animated things carry per-frame duration metadata after the frame count.
      // Fields: async(u8) + loopCount(i32) + startPhase(i8) + frames*(min(u32)+max(u32)).
      let animation: AnimationData | undefined
      if (frames > 1 && features.frameDurations) {
        const asyncFlag = reader.u8() !== 0
        const loopCount = reader.u32() | 0 // reinterpret as signed i32
        const startPhase = (reader.u8() << 24) >> 24 // reinterpret as signed i8
        const phaseDurations: Array<{ min: number; max: number }> = []
        for (let f = 0; f < frames; f++) {
          phaseDurations.push({ min: reader.u32(), max: reader.u32() })
        }
        animation = { async: asyncFlag, loopCount, startPhase, phaseDurations }
      }

      const layout: ThingLayout = {
        width,
        height,
        layers,
        patternX,
        patternY,
        patternZ,
        frames,
        realSize,
        exactSize
      }
      if (animation !== undefined) layout.animation = animation
      return layout
    }

    function parseSprites(layout: ThingLayout): number[] {
      const { width, height, layers, patternX, patternY, patternZ, frames } = layout
      const count = width * height * layers * patternX * patternY * patternZ * frames
      const spriteIds = new Array<number>(count)

      for (let i = 0; i < count; i++) {
        spriteIds[i] = features.extendedSprites ? reader.u32() : reader.u16()
      }

      return spriteIds
    }
  }

  function write(data: DatWriteInput): Uint8Array {
    const resolvedVersion = version !== undefined ? version : data.version
    if (version !== undefined && data.version !== version) {
      throw new ParseError(
        `DAT version mismatch: constructor version ${version}, data.version ${data.version}`
      )
    }
    return serializeDat(data, resolvedVersion)
  }
}
