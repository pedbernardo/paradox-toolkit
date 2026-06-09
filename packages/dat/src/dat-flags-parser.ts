import { type BinaryReader, type BinaryWriter, snakeCaseToCamelCase } from '@paradoxlab/utils'
import type { MarketData, ThingFlags } from './types.js'

type FlagMap = Record<string, number>
type SingleRule = [attr: string, read: (r: BinaryReader) => number]
type MultiRule = [attrs: string[], reads: Array<(r: BinaryReader) => number>]
type FnRule = (r: BinaryReader) => ParsedFlag
type AdvancedRule = SingleRule | MultiRule | FnRule

function isFnRule(rule: AdvancedRule): rule is FnRule {
  return typeof rule === 'function'
}

function isSingleRule(rule: AdvancedRule): rule is SingleRule {
  return !isFnRule(rule) && typeof rule[0] === 'string'
}

const ADVANCED_RULES: Record<string, AdvancedRule> = {
  GROUND: ['speed', (r) => r.u16()],
  WRITABLE: ['length', (r) => r.u16()],
  WRITABLE_ONCE: ['length', (r) => r.u16()],
  LIGHT_INFO: [
    ['level', 'color'],
    [(r) => r.u16(), (r) => r.u16()]
  ],
  HAS_OFFSET: [
    ['offsetX', 'offsetY'],
    [(r) => r.u16(), (r) => r.u16()]
  ],
  HAS_ELEVATION: ['height', (r) => r.u16()],
  MINIMAP: ['color', (r) => r.u16()],
  LENS_HELP: ['value', (r) => r.u16()],
  CLOTH: ['slot', (r) => r.u16()],
  USABLE: ['value', (r) => r.u16()],
  MARKET: (r): ParsedFlag => {
    const category = r.u16()
    const tradeAs = r.u16()
    const showAs = r.u16()
    const nameLen = r.u16()
    const name = r.str(nameLen)
    const restrictVocation = r.u16()
    const requiredLevel = r.u16()
    return { market: { category, tradeAs, showAs, name, restrictVocation, requiredLevel } }
  }
}

type ParsedFlag = Partial<ThingFlags>

type RuleEntry = {
  displayName: string
  parse: (reader: BinaryReader) => ParsedFlag
}

export function createFlagsParser(
  flags: FlagMap,
  version: number
): {
  parse(flagInt: number, reader: BinaryReader): ParsedFlag | null
} {
  const rules = new Map<number, RuleEntry>()

  for (const [flagName, flagValue] of Object.entries(flags)) {
    if (flagName === 'END_OF_FLAGS') continue
    const displayName = snakeCaseToCamelCase(flagName)

    // HAS_OFFSET is boolean in DAT format 74 (versions <= 750) - no extra bytes
    const advanced =
      flagName === 'HAS_OFFSET' && version <= 750 ? undefined : ADVANCED_RULES[flagName]

    if (!advanced) {
      rules.set(flagValue, {
        displayName,
        parse: () => ({ [displayName]: true }) as ParsedFlag
      })
      continue
    }

    if (isFnRule(advanced)) {
      rules.set(flagValue, { displayName, parse: advanced })
    } else if (isSingleRule(advanced)) {
      const [attr, read] = advanced
      rules.set(flagValue, {
        displayName,
        parse: (r) => ({ [displayName]: { [attr]: read(r) } }) as ParsedFlag
      })
    } else {
      const [attrs, reads] = advanced
      rules.set(flagValue, {
        displayName,
        parse: (r) => {
          const nested: Record<string, number> = {}
          for (let i = 0; i < attrs.length; i++) {
            nested[attrs[i]!] = reads[i]!(r)
          }
          return { [displayName]: nested } as ParsedFlag
        }
      })
    }
  }

  return { parse }

  // Unknown flags are treated as simple (no extra bytes consumed) and skipped.
  // Real DAT files contain flags outside known maps (OT extensions, undocumented entries).
  function parse(flagInt: number, reader: BinaryReader): ParsedFlag | null {
    const rule = rules.get(flagInt)
    if (!rule) return null
    return rule.parse(reader)
  }
}

type WritePayloadFn = (writer: BinaryWriter, value: unknown) => void

// Payload writers (flag byte already written by caller).
const WRITE_PAYLOADS: Partial<Record<string, WritePayloadFn>> = {
  GROUND: (writer, value) => writer.u16((value as { speed: number }).speed),
  WRITABLE: (writer, value) => writer.u16((value as { length: number }).length),
  WRITABLE_ONCE: (writer, value) => writer.u16((value as { length: number }).length),
  LIGHT_INFO: (writer, value) => {
    const d = value as { level: number; color: number }
    writer.u16(d.level)
    writer.u16(d.color)
  },
  HAS_OFFSET: (writer, value) => {
    const d = value as { offsetX: number; offsetY: number }
    writer.u16(d.offsetX)
    writer.u16(d.offsetY)
  },
  HAS_ELEVATION: (writer, value) => writer.u16((value as { height: number }).height),
  MINIMAP: (writer, value) => writer.u16((value as { color: number }).color),
  LENS_HELP: (writer, value) => writer.u16((value as { value: number }).value),
  CLOTH: (writer, value) => writer.u16((value as { slot: number }).slot),
  USABLE: (writer, value) => writer.u16((value as { value: number }).value),
  MARKET: (writer, value) => {
    const market = value as MarketData
    writer.u16(market.category)
    writer.u16(market.tradeAs)
    writer.u16(market.showAs)
    writer.str(market.name)
    writer.u16(market.restrictVocation)
    writer.u16(market.requiredLevel)
  }
}

export function createWriteRules(
  flags: FlagMap,
  version: number
): {
  serialize(flagName: string, value: unknown, writer: BinaryWriter): void
} {
  const rules = new Map<string, (writer: BinaryWriter, value: unknown) => void>()

  for (const [flagName, flagByte] of Object.entries(flags)) {
    if (flagName === 'END_OF_FLAGS') continue
    const displayName = snakeCaseToCamelCase(flagName)

    // HAS_OFFSET: no payload bytes for versions <= 750
    const payloadFn =
      flagName === 'HAS_OFFSET' && version <= 750 ? undefined : WRITE_PAYLOADS[flagName]

    const byte = flagByte
    rules.set(displayName, (writer, value) => {
      writer.u8(byte)
      payloadFn?.(writer, value)
    })
  }

  return {
    serialize(flagName: string, value: unknown, writer: BinaryWriter): void {
      rules.get(flagName)?.(writer, value)
    }
  }
}
