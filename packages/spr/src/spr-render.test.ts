import { describe, expect, it } from 'vitest'
import type { Sprite } from './types.js'
import { renderAscii } from './spr-render.js'

function makeSprite(rgba: number[]): Sprite {
  return {
    id: 1,
    rgba: new Uint8Array(rgba.concat(Array(4096 - rgba.length).fill(0))),
    width: 32,
    height: 32
  }
}

describe('renderAscii', () => {
  it('produces 32 rows each ending with newline', () => {
    const sprite = makeSprite([])
    const lines = renderAscii(sprite).split('\n')
    // split on 32 newlines produces 33 elements (last is empty string)
    expect(lines).toHaveLength(33)
    expect(lines[32]).toBe('')
  })

  it('each row has 32 characters', () => {
    const sprite = makeSprite([])
    const lines = renderAscii(sprite).split('\n').slice(0, 32)
    for (const line of lines) {
      expect(line).toHaveLength(32)
    }
  })

  it('transparent sprite is all spaces', () => {
    const sprite = makeSprite([])
    const result = renderAscii(sprite)
    expect(result).toBe((' '.repeat(32) + '\n').repeat(32))
  })

  it('white opaque pixel renders as █', () => {
    // pixel 0: r=255, g=255, b=255, a=255
    const sprite = makeSprite([255, 255, 255, 255])
    expect(renderAscii(sprite)[0]).toBe('█')
  })

  it('black opaque pixel renders as ▪', () => {
    // pixel 0: r=0, g=0, b=0, a=255
    const sprite = makeSprite([0, 0, 0, 255])
    expect(renderAscii(sprite)[0]).toBe('▪')
  })

  it('transparent pixel (a=0) renders as space regardless of rgb', () => {
    const sprite = makeSprite([255, 255, 255, 0])
    expect(renderAscii(sprite)[0]).toBe(' ')
  })

  it('medium-brightness pixel renders as ▒', () => {
    // perceptual brightness ~128: pure green at ~218 gives ~128 perceptual
    // use r=128,g=128,b=128 → brightness = 0.299*128 + 0.587*128 + 0.114*128 = 128
    // 128/255 * 5 = 2.51 → floor = 2, +1 = 3 → DENSITY[3] = '▒'
    const sprite = makeSprite([128, 128, 128, 255])
    expect(renderAscii(sprite)[0]).toBe('▒')
  })
})
