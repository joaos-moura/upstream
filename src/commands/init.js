import chalk from 'chalk'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import { scaffoldInto } from '../lib/scaffold.js'
import { writeMcpSettings } from '../lib/settings.js'
import { runWizard, WIZARD_DEFAULTS } from '../lib/wizard.js'

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
