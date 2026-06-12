import { describe, it, expect } from 'vitest'
import { extractDocId } from '../../src/lib/providers/google-docs.js'

describe('extractDocId', () => {
  it('extracts ID from standard Google Docs URL', () => {
    const url = 'https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit'
    expect(extractDocId(url)).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms')
  })

  it('extracts ID from URL without trailing path', () => {
    const url = 'https://docs.google.com/document/d/abc123def456'
    expect(extractDocId(url)).toBe('abc123def456')
  })

  it('extracts ID with underscores and hyphens', () => {
    const url = 'https://docs.google.com/document/d/1a-b_C2/edit?usp=sharing'
    expect(extractDocId(url)).toBe('1a-b_C2')
  })

  it('returns null for non-Google Docs URL', () => {
    expect(extractDocId('https://notion.so/some-page')).toBeNull()
  })

  it('returns null for malformed URL', () => {
    expect(extractDocId('not a url')).toBeNull()
  })

  it('returns null for Google Docs URL without document ID', () => {
    expect(extractDocId('https://docs.google.com/document/')).toBeNull()
  })
})
