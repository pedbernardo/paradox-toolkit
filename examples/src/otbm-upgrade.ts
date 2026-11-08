import { Otbm, upgradeOtbm } from '@paradoxlab/otbm'
import type { OtbmOptions } from '@paradoxlab/otbm'

/**
 * Upgrades a map to OTBM v3 in streaming: chunks of about 1 MB come out as the file is read, so
 * memory stays flat whatever the map size. Reading an OTBM v1 needs `hasInlineCount` in `options`.
 */
export function upgradeToV3(bytes: Uint8Array, options: OtbmOptions = {}): Uint8Array[] {
  const otbm = Otbm(options)
  const chunks: Uint8Array[] = []
  for (const chunk of otbm.writeStream(upgradeOtbm(otbm.source(bytes), 3))) {
    chunks.push(chunk) // in a real tool: await file.write(chunk)
  }
  return chunks
}
