import { describe, expect, it } from 'vitest'
import {
  BinaryReaderError,
  BufferOverflowError,
  ByteNotFoundError,
  ParseError,
  UnsupportedVersionError
} from './errors.js'

describe('ParseError', () => {
  it('sets name and message correctly', () => {
    const err = new ParseError('unexpected byte')
    expect(err.name).toBe('ParseError')
    expect(err.message).toBe('unexpected byte')
    expect(err).toBeInstanceOf(Error)
  })
})

describe('BinaryReaderError', () => {
  it('is base class for buffer and byte errors', () => {
    expect(new BufferOverflowError('x')).toBeInstanceOf(BinaryReaderError)
    expect(new ByteNotFoundError('x')).toBeInstanceOf(BinaryReaderError)
  })
})

describe('UnsupportedVersionError', () => {
  it('sets name and message correctly', () => {
    const err = new UnsupportedVersionError('v999')
    expect(err.name).toBe('UnsupportedVersionError')
    expect(err.message).toBe('v999')
    expect(err).toBeInstanceOf(Error)
  })
})
