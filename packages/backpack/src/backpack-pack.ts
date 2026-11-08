import { packAtlas } from './backpack-atlas.js'
import { composeAppearances } from './backpack-compose.js'
import { buildContent } from './backpack-content.js'
import { PACK_SCHEMA } from './backpack-load.js'
import { encodePng } from './backpack-png.js'
import type { AssetPackFiles, PackManifest, PackOptions, RenderFrameColumns } from './types.js'

const hex = (signature: number): string => signature.toString(16).toUpperCase().padStart(8, '0')

/**
 * Builds an Asset Pack in memory: items by sid, the appearances they use with composed frames, and
 * atlas pages with grounds and borders first. Pages are drawn and encoded one at a time.
 */
export async function buildPack(options: PackOptions): Promise<AssetPackFiles> {
  const { dat, spr, deflate, maxPageSize, padding } = options
  const content = buildContent(options.otb === undefined ? { dat } : { dat, otb: options.otb })

  // Only appearances that some item uses go into the pack; rows are renumbered to match.
  const renderRowOf = new Map<number, number>()
  for (const row of [...new Set(content.items.appearance)]
    .filter((r) => r >= 0)
    .sort((a, b) => a - b))
    renderRowOf.set(row, renderRowOf.size)
  const items = {
    ...content.items,
    appearance: content.items.appearance.map((row) => renderRowOf.get(row) ?? -1)
  }

  const composed = composeAppearances(content.appearances, [...renderRowOf.keys()], spr)
  const frameIds = Array.from({ length: composed.frameCount }, (_, index) => index + 1)
  const layout = packAtlas(frameIds, composed.imageOf, {
    ...(maxPageSize === undefined ? {} : { maxPageSize }),
    // Renderers sample pack pages nearest-neighbor, so frames can touch: fewer pixels and pages.
    padding: padding ?? 0,
    trim: true,
    priorityOf: composed.priorityOf
  })

  const { id: _, ...packed } = layout.frames
  const frames: RenderFrameColumns = {
    page: [-1, ...packed.page],
    x: [0, ...packed.x],
    y: [0, ...packed.y],
    w: [0, ...packed.w],
    h: [0, ...packed.h],
    offsetX: [0, ...packed.offsetX],
    offsetY: [0, ...packed.offsetY]
  }

  const pages: Uint8Array[] = []
  for (let index = 0; index < layout.pages.length; index++) {
    const page = layout.renderPage(index)
    pages.push(await encodePng(page.rgba, page.width, page.height, deflate))
  }

  const manifest: PackManifest = {
    schema: PACK_SCHEMA,
    client: dat.version,
    dat: hex(dat.signature),
    spr: hex(spr.signature),
    lineage: content.meta.lineage,
    pages: layout.pages.map(({ width, height }, index) => ({
      file: `page-${index}.png`,
      width,
      height
    })),
    counts: {
      items: items.sid.length,
      appearances: composed.appearances.cid.length,
      frames: frames.page.length
    }
  }
  return { manifest, items, render: { appearances: composed.appearances, frames }, pages }
}
