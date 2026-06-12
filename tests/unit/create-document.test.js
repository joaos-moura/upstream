import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/lib/tokens.js', () => ({
  getProviderToken: vi.fn(),
}))

vi.mock('../../src/lib/config.js', () => ({
  readConfig: vi.fn(() => ({
    integrations: {
      notion: { client_id: 'ncid', client_secret: 'ncsec', allowed_workspace: 'acme' },
    },
  })),
}))

vi.mock('../../src/lib/providers/google-docs.js', () => ({
  extractId: vi.fn(), exchangeCode: vi.fn(), getIdentity: vi.fn(),
  getMetadata: vi.fn(), validateDomain: vi.fn(), refreshTokenIfNeeded: vi.fn(),
  createDocument: vi.fn(),
}))

vi.mock('../../src/lib/providers/notion.js', () => ({
  extractId: vi.fn(), exchangeCode: vi.fn(), getIdentity: vi.fn(),
  getMetadata: vi.fn(), validateDomain: vi.fn(), createDocument: vi.fn(),
}))

vi.mock('../../src/lib/providers/confluence.js', () => ({
  extractId: vi.fn(), exchangeCode: vi.fn(), getIdentity: vi.fn(), validateDomain: vi.fn(),
  enrichToken: vi.fn(), getMetadata: vi.fn(), refreshTokenIfNeeded: vi.fn(), createDocument: vi.fn(),
}))

import { getProviderToken } from '../../src/lib/tokens.js'
import { createDocument as notionCreateDocument } from '../../src/lib/providers/notion.js'
import { createDocument } from '../../src/lib/mcp/tools/create-document.js'

beforeEach(() => vi.clearAllMocks())

describe('createDocument', () => {
  it('throws for unknown provider', async () => {
    await expect(createDocument({ provider: 'foobar', title: 'T', content: '', destination: 'dest' }))
      .rejects.toThrow(/Unknown provider: foobar/)
  })

  it('throws when not authenticated', async () => {
    getProviderToken.mockReturnValue(null)
    await expect(createDocument({ provider: 'notion', title: 'T', content: '', destination: 'dest' }))
      .rejects.toThrow(/Not authenticated with notion/)
  })

  it('calls provider createDocument and returns url', async () => {
    const token = { access_token: 'tok', refresh_token: null, expiry: null }
    getProviderToken.mockReturnValue(token)
    notionCreateDocument.mockResolvedValue({ url: 'https://notion.so/new-page-abc123' })

    const result = await createDocument({ provider: 'notion', title: 'My PRD', content: 'content', destination: 'page-id-123' })
    expect(result).toEqual({ url: 'https://notion.so/new-page-abc123' })
    expect(notionCreateDocument).toHaveBeenCalledWith('My PRD', 'content', 'page-id-123', token)
  })

  it('wraps provider errors with context', async () => {
    const token = { access_token: 'tok', refresh_token: null, expiry: null }
    getProviderToken.mockReturnValue(token)
    notionCreateDocument.mockRejectedValue(new Error('API rate limit exceeded'))

    await expect(createDocument({ provider: 'notion', title: 'T', content: '', destination: 'dest' }))
      .rejects.toThrow(/create_document failed \(notion\): API rate limit exceeded/)
  })
})
