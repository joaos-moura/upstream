import http from 'http'
import https from 'https'
import { URL } from 'url'
import open from 'open'
import { setProviderToken } from '../tokens.js'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const SCOPE = 'https://www.googleapis.com/auth/drive.metadata.readonly'

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer()
    srv.listen(0, () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

function waitForCallback(port) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, `http://localhost:${port}`)
      const code = u.searchParams.get('code')
      const error = u.searchParams.get('error')

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html><body><h2>upstream: Authentication complete. You can close this tab.</h2></body></html>')
      srv.close()

      if (error) reject(new Error(`OAuth cancelled: ${error}`))
      else if (code) resolve(code)
      else reject(new Error('No authorization code received'))
    })

    srv.listen(port)
    srv.on('error', reject)

    // Time out after 5 minutes
    setTimeout(() => { srv.close(); reject(new Error('Authentication timed out after 5 minutes')) }, 5 * 60 * 1000)
  })
}

function exchangeCode(code, clientId, clientSecret, redirectUri) {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  }).toString()

  return new Promise((resolve, reject) => {
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

export async function authenticateGoogleDocs(clientId, clientSecret) {
  const port = await findFreePort()
  const redirectUri = `http://localhost:${port}/callback`

  const authUrl = new URL(GOOGLE_AUTH_URL)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', SCOPE)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')

  console.log('Opening browser for Google authentication...')
  console.log(`If browser doesn't open, visit:\n  ${authUrl.toString()}`)

  try { await open(authUrl.toString()) } catch { /* user has URL in console */ }

  const code = await waitForCallback(port)
  const tokenResponse = await exchangeCode(code, clientId, clientSecret, redirectUri)

  setProviderToken('google-docs', {
    access_token: tokenResponse.access_token,
    refresh_token: tokenResponse.refresh_token,
    expiry: Date.now() + tokenResponse.expires_in * 1000,
  })
}
