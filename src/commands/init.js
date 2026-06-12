import chalk from 'chalk'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { scaffoldInto } from '../lib/scaffold.js'
import { writeMcpSettings } from '../lib/settings.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const TEMPLATES = join(__dirname, '../../templates')

export async function initCommand() {
  const target = process.cwd()
  console.log(chalk.blue('upstream:'), 'scaffolding into', target)

  try {
    await scaffoldInto(target, TEMPLATES)
    writeMcpSettings(target)
    console.log(chalk.green('✓ upstream initialized'))
    console.log('')
    console.log('Next steps:')
    console.log('  1. Review and customize upstream.config.yaml')
    console.log('  2. git add .claude/ docs/ upstream.config.yaml')
    console.log('  3. git commit -m "feat: add upstream Claude Code plugin"')
    console.log('  4. Push — your team pulls it with the next git pull')
  } catch (err) {
    console.error(chalk.red('upstream init failed:'), err.message)
    process.exit(1)
  }
}
