import { Otbm } from '@paradoxlab/otbm'
import type { OtbmOptions } from '@paradoxlab/otbm'
import { detectTextCodec, windows1252 } from '@paradoxlab/utils'
import type { TextCodecSuggestion } from '@paradoxlab/utils'

const TEXT_ATTRIBUTES = new Set(['text', 'description', 'writtenBy'])

/**
 * Suggests the text codec of a map. Strings are read with windows-1252, which maps every byte to
 * one character, so encoding them back gives the exact bytes for the detector.
 */
export function suggestCodec(bytes: Uint8Array, options: OtbmOptions = {}): TextCodecSuggestion {
  const strings: Uint8Array[] = []
  Otbm({ ...options, text: windows1252 }).read(bytes, {
    item: (_sid, _form, attributes) => {
      for (const attribute of attributes ?? []) {
        const isText = TEXT_ATTRIBUTES.has(attribute.kind)
        if (isText) strings.push(windows1252.encode((attribute as { value: string }).value))
      }
    },
    town: (town) => {
      strings.push(windows1252.encode(town.name))
    }
  })
  return detectTextCodec(strings)
}
