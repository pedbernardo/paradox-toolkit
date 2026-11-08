import type { SprFile } from '@paradoxlab/spr'
import { packAtlas } from './backpack-atlas.js'
import { encodePng } from './backpack-png.js'
import type { AtlasImage, AtlasOptions, Deflate, SpriteSheet } from './types.js'

export const SPRITE_SHEET_SCHEMA = '2.0.0'

function spriteOf(spr: SprFile): (id: number) => AtlasImage {
  return (id) => {
    const sprite = spr.get(id)
    if (sprite === undefined)
      throw new RangeError(`Sprite ${id} is not in the file (1..${spr.count})`)
    return sprite
  }
}

function allIds(spr: SprFile): number[] {
  return Array.from({ length: spr.count }, (_, index) => index + 1)
}

/**
 * Packs the sprites of a `.spr` into PNG pages no larger than `maxPageSize`, with the position of
 * every sprite. Pages are drawn and encoded one at a time.
 */
export async function buildSpriteSheet(
  spr: SprFile,
  options: AtlasOptions & { deflate: Deflate }
): Promise<SpriteSheet> {
  const ids = options.ids === undefined ? allIds(spr) : [...options.ids]
  const layout = packAtlas(ids, spriteOf(spr), options)
  const pages: Uint8Array[] = []
  for (let index = 0; index < layout.pages.length; index++) {
    const page = layout.renderPage(index)
    pages.push(await encodePng(page.rgba, page.width, page.height, options.deflate))
  }
  return {
    json: {
      meta: {
        schema: SPRITE_SHEET_SCHEMA,
        client: spr.version,
        spr: spr.signature.toString(16).toUpperCase().padStart(8, '0'),
        pages: layout.pages.map(({ width, height }) => ({ width, height })),
        sprites: ids.length
      },
      frames: layout.frames
    },
    pages
  }
}

/** One PNG per sprite, for tools and websites that want single images. */
export async function* extractSprites(
  spr: SprFile,
  ids: Iterable<number>,
  deflate: Deflate
): AsyncGenerator<{ id: number; png: Uint8Array }> {
  const imageOf = spriteOf(spr)
  for (const id of ids) {
    const sprite = imageOf(id)
    yield { id, png: await encodePng(sprite.rgba, sprite.width, sprite.height, deflate) }
  }
}
