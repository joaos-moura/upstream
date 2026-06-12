import chalk from 'chalk'
import { join } from 'path'
import { readConfig } from '../lib/config.js'
import { authenticateGoogleDocs } from '../lib/auth/google-docs.js'
import { getProviderToken } from '../lib/tokens.js'

const KNOWN_PROVIDERS = ['google-docs', 'confluence', 'notion']

export async function authCommand(provider) {
  if (provider === 'status') return statusCommand()
  if (provider === 'google-docs') return googleDocsAuth()
  console.error(chalk.red(`Unknown provider: ${provider}`))
  console.error(`Known providers: ${KNOWN_PROVIDERS.join(', ')}`)
  process.exit(1)
}

async function googleDocsAuth() {
  const config = readConfig(join(process.cwd(), 'upstream.config.yaml'))
  const { client_id, client_secret } = config.integrations?.google_docs ?? {}

  if (!client_id || !client_secret) {
    console.error(chalk.red('upstream auth: Google Docs credentials not configured.'))
    console.error('')
    console.error('Add to upstream.config.yaml:')
    console.error('  integrations:')
    console.error('    google_docs:')
    console.error('      client_id: "xxx.apps.googleusercontent.com"')
    console.error('      client_secret: "GOCSPX-..."')
    process.exit(1)
  }

  try {
    await authenticateGoogleDocs(client_id, client_secret)
    console.log(chalk.green('✓ Google Docs connected.'))
  } catch (err) {
    console.error(chalk.red('upstream auth failed:'), err.message)
    process.exit(1)
  }
}

async function statusCommand() {
  console.log('')
  for (const provider of KNOWN_PROVIDERS) {
    const token = getProviderToken(provider)
    if (!token) {
      console.log(`  ${provider.padEnd(14)} ${chalk.red('✗')} not authenticated`)
    } else {
      const expires = new Date(token.expiry).toISOString().slice(0, 10)
      console.log(`  ${provider.padEnd(14)} ${chalk.green('✓')} authenticated (expires ${expires})`)
    }
  }
  console.log('')
}
