// tests/unit/notion-provider.test.js
// HTTP-calling functions (getMetadata, createDocument) are covered via mocks in validate-link.test.js.
// This file tests only the pure functions.
import { describe, it, expect } from 'vitest'
import { extractId, validateDomain, getIdentity } from '../../src/lib/providers/notion.js'

describe('extractId', () => {
  it('extracts 32-char page ID from standard notion.so URL', () => {
    expect(extractId('https://www.notion.so/My-Page-abc123def456abc123def456abc12345'))
      .toBe('abc123def456abc123def456abc12345')
  })

  it('extracts ID from workspace-prefixed URL', () => {
    expect(extractId('https://notion.so/acme/PRD-Authentication-abc123def456abc123def456abc12345'))
      .toBe('abc123def456abc123def456abc12345')
  })

  it('handles UUID format with dashes', () => {
    expect(extractId('https://www.notion.so/abc123de-f456-abc1-23de-f456abc12345'))
      .toBe('abc123def456abc123def456abc12345')
  })

  it('returns null for URL without 32-char hex suffix', () => {
    expect(extractId('https://notion.so/workspace/')).toBeNull()
  })

  it('returns null for non-Notion URL', () => {
    expect(extractId('https://docs.google.com/document/d/abc')).toBeNull()
  })
})

describe('validateDomain', () => {
  it('returns true when workspace_name matches', () => {
    expect(validateDomain({ workspace_name: 'acme-corp', workspace_id: 'wid1' }, { allowed_workspace: 'acme-corp' }))
      .toBe(true)
  })

  it('returns true when workspace_id matches', () => {
    expect(validateDomain({ workspace_name: 'Acme Corp', workspace_id: 'wid1' }, { allowed_workspace: 'wid1' }))
      .toBe(true)
  })

  it('returns false when neither name nor id matches', () => {
    expect(validateDomain({ workspace_name: 'other', workspace_id: 'other-id' }, { allowed_workspace: 'acme-corp' }))
      .toBe(false)
  })

  it('returns false when allowed_workspace is not configured', () => {
    expect(validateDomain({ workspace_name: 'acme-corp', workspace_id: 'wid1' }, {})).toBe(false)
  })
})

describe('getIdentity', () => {
  it('extracts workspace info from token response', async () => {
    const tokenResponse = { access_token: 'tok', workspace_name: 'Acme', workspace_id: 'wid-123' }
    const identity = await getIdentity('tok', tokenResponse)
    expect(identity).toEqual({ workspace_name: 'Acme', workspace_id: 'wid-123' })
  })

  it('returns nulls when token response lacks workspace fields', async () => {
    const identity = await getIdentity('tok', {})
    expect(identity).toEqual({ workspace_name: null, workspace_id: null })
  })
})
