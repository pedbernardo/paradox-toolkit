import type { AtlasImage, AtlasLayout, AtlasOptions, FrameColumns } from './types.js'

const DEFAULT_PAGE_SIZE = 4096
const DEFAULT_PADDING = 1

type Rect = { x: number; y: number; w: number; h: number }

/** The non-transparent rectangle of an image; `w = h = 0` when every pixel is transparent. */
function boundsOf(image: AtlasImage): Rect {
  const { width, height, rgba } = image
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] === 0) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: 0, h: 0 }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

/**
 * Lays images out in pages no larger than `maxPageSize` and draws one page at a time, so a large
 * atlas never holds more than one page of pixels. Without trimming, same-size images go on a grid;
 * otherwise rectangles go on shelves, by priority (lower first), then tallest first.
 */
export function packAtlas(
  ids: readonly number[],
  imageOf: (id: number) => AtlasImage,
  options: AtlasOptions & { priorityOf?: (id: number) => number } = {}
): AtlasLayout {
  const pageSize = options.maxPageSize ?? DEFAULT_PAGE_SIZE
  const padding = options.padding ?? DEFAULT_PADDING
  const trim = options.trim ?? false
  const priorityOf = options.priorityOf ?? (() => 0)

  const frames: FrameColumns = {
    id: [],
    page: [],
    x: [],
    y: [],
    w: [],
    h: [],
    offsetX: [],
    offsetY: []
  }
  const source: Rect[] = []
  for (const id of ids) {
    const image = imageOf(id)
    const rect = trim ? boundsOf(image) : { x: 0, y: 0, w: image.width, h: image.height }
    if (rect.w > pageSize || rect.h > pageSize) {
      throw new RangeError(`Image ${id} (${rect.w}x${rect.h}) does not fit a ${pageSize}px page`)
    }
    frames.id.push(id)
    frames.page.push(-1)
    frames.x.push(0)
    frames.y.push(0)
    frames.w.push(rect.w)
    frames.h.push(rect.h)
    frames.offsetX.push(rect.x)
    frames.offsetY.push(rect.y)
    source.push(rect)
  }

  const order = frames.id
    .map((id, index) => ({
      index,
      priority: priorityOf(id),
      w: frames.w[index]!,
      h: frames.h[index]!
    }))
    .filter((entry) => entry.w > 0)
    .sort((a, b) => a.priority - b.priority || b.h - a.h || b.w - a.w)

  const pages: { width: number; height: number }[] = []
  let page = -1
  let x = 0
  let y = 0
  let shelf = 0
  let lastPriority = Number.NaN
  const openPage = (): void => {
    pages.push({ width: 0, height: 0 })
    page++
    x = 0
    y = 0
    shelf = 0
  }
  for (const entry of order) {
    if (page < 0) openPage()
    const startsGroup = entry.priority !== lastPriority
    lastPriority = entry.priority
    if (startsGroup && x > 0) {
      // A new priority starts on a fresh shelf, so groups never interleave in a row.
      y += shelf + padding
      x = 0
      shelf = 0
    }
    if (x + entry.w > pageSize) {
      y += shelf + padding
      x = 0
      shelf = 0
    }
    if (y + entry.h > pageSize) openPage()
    frames.page[entry.index] = page
    frames.x[entry.index] = x
    frames.y[entry.index] = y
    const current = pages[page]!
    current.width = Math.max(current.width, x + entry.w)
    current.height = Math.max(current.height, y + entry.h)
    x += entry.w + padding
    shelf = Math.max(shelf, entry.h)
  }

  const byPage: number[][] = pages.map(() => [])
  frames.page.forEach((p, index) => {
    if (p >= 0) byPage[p]!.push(index)
  })

  return {
    frames,
    pages,
    renderPage(index) {
      const { width, height } = pages[index]!
      const rgba = new Uint8Array(width * height * 4)
      for (const frame of byPage[index]!) {
        const image = imageOf(frames.id[frame]!)
        const rect = source[frame]!
        const dx = frames.x[frame]!
        const dy = frames.y[frame]!
        for (let row = 0; row < rect.h; row++) {
          const from = ((rect.y + row) * image.width + rect.x) * 4
          rgba.set(image.rgba.subarray(from, from + rect.w * 4), ((dy + row) * width + dx) * 4)
        }
      }
      return { width, height, rgba }
    }
  }
}
