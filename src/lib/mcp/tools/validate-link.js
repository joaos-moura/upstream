import { extractId, getMetadata, refreshTokenIfNeeded } from '../../providers/google-docs.js'
import { getProviderToken } from '../../tokens.js'
import { readConfig } from '../../config.js'
import { join } from 'path'

async function validateGoogleDocsLink(url) {
  const docId = extractId(url)
  if (!docId) {
    return { valid: false, title: null, provider: 'google-docs', last_edited: null, error: 'Invalid Google Docs URL' }
  }

  const tokenData = getProviderToken('google-docs')
  if (!tokenData) {
    return { valid: true, title: null, provider: 'google-docs', last_edited: null, error: 'not authenticated' }
  }

  try {
    const config = readConfig(join(process.cwd(), 'upstream.config.yaml'))
    const { client_id, client_secret } = config.integrations?.google_docs ?? {}
    if (!client_id || !client_secret) {
      return { valid: true, title: null, provider: 'google-docs', last_edited: null, error: 'google_docs credentials not configured' }
    }
    const token = await refreshTokenIfNeeded(tokenData, { client_id, client_secret })
    const metadata = await getMetadata(docId, token.access_token)
    return {
      valid: true,
      title: metadata.name,
      provider: 'google-docs',
      last_edited: metadata.modifiedTime ?? null,
      error: null,
    }
  } catch (err) {
    return { valid: false, title: null, provider: 'google-docs', last_edited: null, error: err.message }
  }
}

export async function validateLink(url) {
  if (/docs\.google\.com\/document\/d\//.test(url)) {
    return validateGoogleDocsLink(url)
  }
  return { valid: true, title: null, provider: 'unknown', last_edited: null, error: null }
}
