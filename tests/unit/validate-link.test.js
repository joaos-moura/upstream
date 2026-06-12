import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/lib/tokens.js', () => ({
  getProviderToken: vi.fn(),
}))

vi.mock('../../src/lib/providers/google-docs.js', () => ({
  extractDocId: vi.fn(),
  getFileMetadata: vi.fn(),
  refreshTokenIfNeeded: vi.fn(),
}))

vi.mock('../../src/lib/config.js', () => ({
  readConfig: vi.fn(() => ({ integrations: { google_docs: { client_id: 'cid', client_secret: 'csec' } } })),
}))

import { getProviderToken } from '../../src/lib/tokens.js'
import { extractDocId, getFileMetadata, refreshTokenIfNeeded } from '../../src/lib/providers/google-docs.js'
import { validateLink } from '../../src/lib/mcp/tools/validate-link.js'

beforeEach(() => vi.clearAllMocks())

describe('validateLink', () => {
  it('returns unknown for non-Google Docs URL', async () => {
    extractDocId.mockReturnValue(null)
    const result = await validateLink('https://notion.so/page')
    expect(result).toEqual({ valid: true, title: null, provider: 'unknown', last_edited: null, error: null })
  })

  it('returns not-authenticated error when no token', async () => {
    extractDocId.mockReturnValue('doc123')
    getProviderToken.mockReturnValue(null)
    const result = await validateLink('https://docs.google.com/document/d/doc123/edit')
    expect(result.provider).toBe('google-docs')
    expect(result.error).toBe('not authenticated')
    expect(result.valid).toBe(true)
    expect(result.title).toBeNull()
  })

  it('returns title and last_edited when authenticated', async () => {
    extractDocId.mockReturnValue('doc123')
    getProviderToken.mockReturnValue({ access_token: 'tok', refresh_token: 'rtok', expiry: 9999999999999 })
    refreshTokenIfNeeded.mockResolvedValue({ access_token: 'tok', refresh_token: 'rtok', expiry: 9999999999999 })
    getFileMetadata.mockResolvedValue({ name: 'My PRD', modifiedTime: '2026-06-11T10:00:00.000Z' })

    const result = await validateLink('https://docs.google.com/document/d/doc123/edit')
    expect(result).toEqual({
      valid: true,
      title: 'My PRD',
      provider: 'google-docs',
      last_edited: '2026-06-11T10:00:00.000Z',
      error: null,
    })
  })

  it('returns valid=false on Drive API error', async () => {
    extractDocId.mockReturnValue('doc123')
    getProviderToken.mockReturnValue({ access_token: 'tok', refresh_token: 'rtok', expiry: 9999999999999 })
    refreshTokenIfNeeded.mockResolvedValue({ access_token: 'tok', refresh_token: 'rtok', expiry: 9999999999999 })
    getFileMetadata.mockRejectedValue(new Error('File not found'))

    const result = await validateLink('https://docs.google.com/document/d/doc123/edit')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('File not found')
  })
})
