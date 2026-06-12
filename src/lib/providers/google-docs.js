import https from 'https'
import { setProviderToken, getProviderToken } from '../tokens.js'

export function extractDocId(url) {
  const match = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

export async function getFileMetadata(docId, accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname: 'www.googleapis.com',
      path: `/drive/v3/files/${docId}?fields=name,modifiedTime`,
      headers: { Authorization: `Bearer ${accessToken}` },
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        const parsed = JSON.parse(data)
        if (res.statusCode === 200) resolve(parsed)
        else {
          const msg = parsed?.error?.message || `Drive API error ${res.statusCode}`
          const err = new Error(msg)
          err.status = res.statusCode
          reject(err)
        }
      })
    })
    req.on('error', reject)
  })
}

export async function refreshTokenIfNeeded(tokenData, clientId, clientSecret) {
  // Token is still valid (more than 5 minutes left)
  if (tokenData.expiry - Date.now() > 5 * 60 * 1000) return tokenData

  const body = new URLSearchParams({
    refresh_token: tokenData.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  }).toString()

  const newTokenData = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        if (res.statusCode === 200) resolve(JSON.parse(data))
        else reject(new Error(`Token refresh failed (${res.statusCode}): ${data}`))
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
  setProviderToken('google-docs', updated)
  return updated
}
