// src/lib/providers/confluence.js
import https from 'https'
import { URL } from 'url'
import { setProviderToken } from '../tokens.js'

export function extractId(url) {
  if (!url || typeof url !== 'string') return null
  const baseUrl = url.match(/(https?:\/\/[^/]+)/)?.[1] ?? null
  const pathMatch = url.match(/\/pages\/(\d+)/)
  if (pathMatch) return { id: pathMatch[1], baseUrl }
  const queryMatch = url.match(/[?&]pageId=(\d+)/)
  if (queryMatch) return { id: queryMatch[1], baseUrl }
  return null
}

export function exchangeCode(code, clientId, clientSecret, redirectUri) {
  const body = JSON.stringify({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  })

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'auth.atlassian.com',
      path: '/oauth/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(data)) } catch { reject(new Error('Token exchange: invalid JSON response')) }
        } else reject(new Error(`Token exchange failed (${res.statusCode}): ${data}`))
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

export function getIdentity(accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname: 'api.atlassian.com',
      path: '/oauth/token/accessible-resources',
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        let parsed
        try { parsed = JSON.parse(data) } catch { parsed = null }
        if (res.statusCode === 200 && Array.isArray(parsed)) {
          resolve({ sites: parsed.map(s => ({ url: s.url, name: s.name, id: s.id })) })
        } else {
          reject(new Error(`Failed to get Atlassian accessible resources (${res.statusCode})`))
        }
      })
    })
    req.on('error', reject)
  })
}

export function validateDomain(identity, config) {
  if (!config.allowed_domain || !identity) return false
  return identity.sites?.some(s => s.url.includes(config.allowed_domain)) ?? false
}

// Store the matched site's URL in the token so createDocument knows the base URL.
export function enrichToken(tokenData, identity, config) {
  const site = identity.sites?.find(s => s.url.includes(config.allowed_domain))
  return { ...tokenData, base_url: site?.url ?? null }
}

export function getMetadata({ id, baseUrl }, accessToken) {
  const host = new URL(baseUrl).hostname
  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname: host,
      path: `/wiki/api/v2/pages/${id}?fields=title,version`,
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        let parsed
        try { parsed = JSON.parse(data) } catch { parsed = null }
        if (res.statusCode === 200 && parsed) {
          resolve({ title: parsed.title ?? null, last_edited: parsed.version?.createdAt ?? null })
        } else {
          const msg = parsed?.message || `Confluence API error ${res.statusCode}`
          const err = new Error(msg)
          err.status = res.statusCode
          reject(err)
        }
      })
    })
    req.on('error', reject)
  })
}

export async function refreshTokenIfNeeded(tokenData, appConfig) {
  if (tokenData.expiry && tokenData.expiry - Date.now() > 5 * 60 * 1000) return tokenData

  const body = JSON.stringify({
    grant_type: 'refresh_token',
    refresh_token: tokenData.refresh_token,
    client_id: appConfig.client_id,
    client_secret: appConfig.client_secret,
  })

  const newTokenData = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'auth.atlassian.com',
      path: '/oauth/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(data)) } catch { reject(new Error('Token refresh: invalid JSON response')) }
        } else reject(new Error(`Token refresh failed (${res.statusCode}): ${data}`))
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })

  const updated = {
    ...tokenData,
    access_token: newTokenData.access_token,
    expiry: Date.now() + newTokenData.expires_in * 1000,
  }
  setProviderToken('confluence', updated)
  return updated
}

// destination format: "SPACE_KEY" or "SPACE_KEY:parent_page_id"
export async function createDocument(title, content, destination, tokenData) {
  if (!destination) throw new Error('Confluence createDocument requires a destination (SPACE_KEY or SPACE_KEY:parent_page_id)')
  if (!tokenData?.base_url) throw new Error('Confluence createDocument requires base_url in token data (re-run: upstream auth confluence)')

  const [spaceKey, ancestorId] = destination.split(':')
  const host = new URL(tokenData.base_url).hostname

  const pageBody = {
    type: 'page',
    title,
    space: { key: spaceKey },
    body: { storage: { value: content || '', representation: 'storage' } },
    ...(ancestorId ? { ancestors: [{ id: ancestorId }] } : {}),
  }
  const bodyStr = JSON.stringify(pageBody)

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host,
      path: '/wiki/rest/api/content',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        let parsed
        try { parsed = JSON.parse(data) } catch { parsed = null }
        if ((res.statusCode === 200 || res.statusCode === 201) && parsed?._links?.webui) {
          resolve({ url: `${tokenData.base_url}${parsed._links.webui}` })
        } else {
          const msg = parsed?.message || `Confluence API error ${res.statusCode}`
          reject(new Error(msg))
        }
      })
    })
    req.on('error', reject)
    req.write(bodyStr)
    req.end()
  })
}
