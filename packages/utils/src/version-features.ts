import { UnsupportedVersionError } from './errors.js'

export const SUPPORTED_VERSIONS: readonly number[] = [
  710, 740, 750, 755, 760, 770, 772, 860, 870, 960, 980, 1098
]

export type VersionFeatures = {
  readonly patternZ: boolean
  readonly transparency: boolean
  readonly extendedSprites: boolean
  readonly animations: boolean
  readonly idleAnimations: boolean
  readonly frameDurations: boolean
  readonly frameGroups: boolean
}

export function isVersionSupported(version: number): boolean {
  return SUPPORTED_VERSIONS.includes(version)
}

export function getVersionFeatures(version: number): VersionFeatures {
  if (!isVersionSupported(version)) {
    throw new UnsupportedVersionError(`Unsupported Tibia version: ${version}`)
  }
  return {
    patternZ: version >= 755,
    transparency: version >= 755,
    extendedSprites: version >= 960,
    animations: version >= 1010,
    idleAnimations: version >= 1020,
    frameDurations: version >= 1030,
    frameGroups: version >= 1090
  }
}
