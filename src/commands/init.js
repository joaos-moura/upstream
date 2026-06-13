import chalk from 'chalk'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs'
import { confirm, input } from '@inquirer/prompts'
import yaml from 'js-yaml'
import { scaffoldInto } from '../lib/scaffold.js'
import { writeMcpSettings } from '../lib/settings.js'
import { runWizard, WIZARD_DEFAULTS, validateClientId, validateDomain } from '../lib/wizard.js'
import { runOAuthFlow } from '../lib/auth/oauth2.js'
import { PROVIDERS } from '../lib/providers/registry.js'
import { deleteProviderToken } from '../lib/tokens.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const TEMPLATES = join(__dirname, '../../templates')

function loadFromFile(filePath) {
  let raw
  try { raw = readFileSync(filePath, 'utf8') } catch {
    throw new Error(`--from: cannot read file "${filePath}"`)
  }
  try { return JSON.parse(raw) } catch {
    throw new Error(`--from: "${filePath}" is not valid JSON`)
  }
}

function ensureGoogleClientSecretEnv(target) {
  const candidates = ['.env.local', '.env']
  const ENV_KEY = 'UPSTREAM_GOOGLE_CLIENT_SECRET'

  for (const filename of candidates) {
    const envPath = join(target, filename)
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf8')
      if (content.includes(ENV_KEY)) {
        console.log(chalk.green(`✓ ${ENV_KEY} already in ${filename}`))
        return
      }
      appendFileSync(envPath, `\n# upstream: Google OAuth secret (required for upstream auth)\n${ENV_KEY}=\n`)
      console.log(chalk.green(`✓ ${ENV_KEY} added to ${filename}`))
      console.log(chalk.yellow(`  Fill in the value: ${ENV_KEY}=<your-secret>`))
      return
    }
  }

  writeFileSync(join(target, '.env'), `# upstream: Google OAuth secret (required for upstream auth)\n${ENV_KEY}=\n`)
  console.log(chalk.green(`✓ .env created with ${ENV_KEY}`))
  console.log(chalk.yellow(`  Fill in the value: ${ENV_KEY}=<your-secret>`))
}

function validateAnswers(answers) {
  if (!['local', 'link'].includes(answers.docs_storage)) {
    throw new Error(`docs_storage must be "local" or "link", got "${answers.docs_storage}"`)
  }
  if (answers.docs_storage === 'link') {
    for (const p of answers.providers ?? []) {
      if (!p.id || !p.client_id || !p.allowed_domain) {
        throw new Error(`Provider "${p.id ?? '?'}" must have id, client_id, and allowed_domain`)
      }
    }
  }
}

export async function initCommand(options) {
  const target = process.cwd()
  console.log(chalk.blue('upstream:'), 'initializing', target)

  let prefilled = {}
  try {
    if (options.from) {
      prefilled = loadFromFile(options.from)
    } else {
      if (options.docsStorage) prefilled.docs_storage = options.docsStorage
      if (options.guardian !== undefined) prefilled.guardian = options.guardian
      if (options.provider) {
        prefilled.providers = [{
          id: options.provider,
          client_id: options.clientId ?? '',
          allowed_domain: options.allowedDomain ?? '',
        }]
      }
      if (options.yes) {
        prefilled.docs_storage = prefilled.docs_storage ?? 'local'
        prefilled.docs_path = prefilled.docs_path ?? 'docs/upstream/'
        prefilled.providers = prefilled.providers ?? []
        prefilled.guardian = prefilled.guardian ?? ''
        prefilled.bypass_for = prefilled.bypass_for ?? WIZARD_DEFAULTS.bypass_for
        prefilled.prd_required_fields = prefilled.prd_required_fields ?? WIZARD_DEFAULTS.prd_required_fields
        prefilled.adr_triggers = prefilled.adr_triggers ?? WIZARD_DEFAULTS.adr_triggers
      }
    }

    if (options.from && prefilled.docs_storage) validateAnswers(prefilled)

    const answers = await runWizard(prefilled)
    validateAnswers(answers)

    await scaffoldInto(target, TEMPLATES, answers)
    writeMcpSettings(target)

    if (answers.providers?.some(p => p.id === 'google-docs')) {
      ensureGoogleClientSecretEnv(target)
    }

    if (answers.validate && answers.providers?.length > 0) {
      const provider = answers.providers[0]
      const providerDef = PROVIDERS[provider.id]
      const configPath = join(target, 'upstream.config.yaml')
      let appConfig = { client_id: provider.client_id, allowed_domain: provider.allowed_domain }

      while (true) {
        console.log('')
        console.log(chalk.blue('upstream:'), `validating ${provider.id} integration...`)
        try {
          await runOAuthFlow(provider.id, providerDef, appConfig)
          deleteProviderToken(provider.id)
          console.log(chalk.green(`✓ ${provider.id} integration validated`))
          break
        } catch (err) {
          console.error(chalk.yellow(`⚠ validation failed: ${err.message}`))
          if (!process.stdin.isTTY) break
          const fix = await confirm({ message: 'Fix credentials now?', default: true })
          if (!fix) break
          const newClientId = await input({
            message: 'client_id:',
            default: appConfig.client_id,
            validate: (v) => validateClientId(provider.id, v),
          })
          const newDomain = await input({
            message: 'allowed_domain:',
            default: appConfig.allowed_domain,
            validate: validateDomain,
          })
          appConfig = { client_id: newClientId, allowed_domain: newDomain }
          const raw = yaml.load(readFileSync(configPath, 'utf8'))
          raw.integrations[providerDef.configKey] = appConfig
          writeFileSync(configPath, yaml.dump(raw, { lineWidth: -1 }))
        }
      }
    }

    console.log('')
    console.log(chalk.green('✓ upstream.config.yaml generated'))
    if (answers.guardian) console.log(chalk.green('✓ .github/CODEOWNERS updated'))
    console.log(chalk.green('✓ .claude/ scaffolded'))
    console.log(chalk.green('✓ MCP settings written'))
    console.log('')
    console.log('Next steps:')
    if (answers.guardian) {
      console.log('  1. Enable branch protection on main (required for CODEOWNERS to be enforced)')
      console.log('  2. git add . && git commit -m "feat: add upstream"')
      console.log('  3. git push')
    } else {
      console.log('  1. git add . && git commit -m "feat: add upstream"')
      console.log('  2. git push')
    }
  } catch (err) {
    console.error(chalk.red('upstream init failed:'), err.message)
    process.exit(1)
  }
}
