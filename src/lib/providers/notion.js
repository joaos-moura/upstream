// src/lib/providers/notion.js
import https from 'https'

export function extractId(url) {
  const segment = url.split('/').pop()?.split('?')[0]
  if (!segment) return null
  const clean = segment.replace(/-/g, '')
  const match = clean.match(/([a-f0-9]{32})$/i)
  return match ? match[1] : null
}

export function exchangeCode(code, clientId, clientSecret, redirectUri) {
  const body = JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri: redirectUri })
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.notion.com',
      path: '/v1/oauth/token',
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
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

// Notion embeds workspace info in the token exchange response — no extra API call needed.
export async function getIdentity(_accessToken, tokenResponse) {
  return {
    workspace_name: tokenResponse?.workspace_name ?? null,
    workspace_id: tokenResponse?.workspace_id ?? null,
  }
}

export function validateDomain(identity, config) {
  if (!config.allowed_workspace) return false
  return (
    identity.workspace_name === config.allowed_workspace ||
    identity.workspace_id === config.allowed_workspace
  )
}

export async function getMetadata(pageId, accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname: 'api.notion.com',
      path: `/v1/pages/${pageId}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Notion-Version': '2022-06-28',
      },
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        let parsed
        try { parsed = JSON.parse(data) } catch { parsed = null }
        if (res.statusCode === 200 && parsed) {
          const titleArr =
            parsed.properties?.title?.title ??
            parsed.properties?.Name?.title ??
            []
          const title = titleArr.map(t => t.plain_text).join('') || null
          resolve({ title, last_edited: parsed.last_edited_time ?? null })
        } else {
          const msg = parsed?.message || `Notion API error ${res.statusCode}`
          const err = new Error(msg)
          err.status = res.statusCode
          reject(err)
        }
      })
    })
    req.on('error', reject)
  })
}

export async function createDocument(title, content, destination, tokenData) {
  const body = JSON.stringify({
    parent: { type: 'page_id', page_id: destination },
    properties: {
      title: { title: [{ type: 'text', text: { content: title } }] },
    },
    children: content
      ? [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content } }] } }]
      : [],
  })

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.notion.com',
      path: '/v1/pages',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        let parsed
        try { parsed = JSON.parse(data) } catch { parsed = null }
        if (res.statusCode === 200 && parsed?.url) {
          resolve({ url: parsed.url })
        } else {
          const msg = parsed?.message || `Notion API error ${res.statusCode}`
          reject(new Error(msg))
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}
