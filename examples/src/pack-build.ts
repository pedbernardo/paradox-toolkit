import { buildPack, deflateNode, writePack } from '@paradoxlab/backpack'
import type { AssetPackFiles } from '@paradoxlab/backpack'
import type { DatFile } from '@paradoxlab/dat'
import type { OtbFile } from '@paradoxlab/otb'
import type { SprFile } from '@paradoxlab/spr'

/** Builds an Asset Pack and, given a directory, writes pack.json, items.json, render.json and the pages. */
export async function buildAssetPack(
  client: { dat: DatFile; spr: SprFile; otb: OtbFile },
  out?: string
): Promise<AssetPackFiles> {
  const pack = await buildPack({ ...client, deflate: deflateNode })
  if (out !== undefined) writePack(out, pack)
  return pack
}
