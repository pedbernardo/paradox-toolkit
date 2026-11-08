import { describe, expect, it } from 'vitest'
import { Otbm } from './otbm.js'
import { upgradeOtbm } from './otbm-upgrade.js'
import { mapBytes, node, u16 } from '../tests/support/otbm-bytes.js'

const AREA = 4
const TILE = 5
const ITEM = 6
const tile = (...children: ReturnType<typeof node>[]) =>
  node(AREA, [...u16(0), ...u16(0), 7], node(TILE, [0, 0], ...children))
const hasInlineCount = (sid: number) => sid === 2148

describe('upgradeOtbm', () => {
  const v1 = mapBytes(
    [tile(node(ITEM, [...u16(2148), 25, 0x04, ...u16(7)]), node(ITEM, u16(1987)))],
    0
  )

  it('turns v1 inline counts into tagged count attributes', () => {
    const otbm = Otbm({ hasInlineCount })
    const v2 = otbm.write(upgradeOtbm(otbm.source(v1), 2))
    expect(v2).toEqual(
      mapBytes(
        [tile(node(ITEM, [...u16(2148), 0x0f, 25, 0x04, ...u16(7)]), node(ITEM, u16(1987)))],
        1
      )
    )
  })

  it('changes only the header version from v2 to v3', () => {
    const v2 = mapBytes([tile(node(ITEM, [...u16(2148), 0x0f, 25]))], 1)
    const otbm = Otbm()
    const v3 = otbm.write(upgradeOtbm(otbm.source(v2), 3))
    const changed = [...v3].flatMap((b, i) => (b === v2[i] ? [] : [i]))
    expect(changed).toEqual([6])
    expect(v3[6]).toBe(2)
  })

  it('refuses a downgrade', () => {
    const v3 = mapBytes([tile()], 2)
    const otbm = Otbm()
    expect(() => otbm.write(upgradeOtbm(otbm.source(v3), 2))).toThrow(
      /Cannot convert OTBM v3 down to v2/
    )
  })

  it('keeps every item and count when reading the result back', () => {
    const otbm = Otbm({ hasInlineCount })
    const document = Otbm().load(otbm.write(upgradeOtbm(otbm.source(v1), 3)))
    const items = document.getTile(0, 0, 7)!.items
    expect(items).toMatchObject([
      {
        sid: 2148,
        form: 'node',
        attributes: [
          { kind: 'count', value: 25 },
          { kind: 'actionId', value: 7 }
        ]
      },
      { sid: 1987, form: 'node', attributes: null }
    ])
  })
})
