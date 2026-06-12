import { describe, it, expect } from 'vitest'
import { execSync } from 'child_process'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync, rmSync, writeFileSync } from 'fs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '../../bin/upstream.js')
const TMP = '/tmp/upstream-auth-test'

describe('upstream auth', () => {
  it('shows error when google_docs credentials missing from config', () => {
    mkdirSync(TMP, { recursive: true })
    writeFileSync(join(TMP, 'upstream.config.yaml'), 'version: 1\n')

    let output = ''
    try {
      execSync(`node ${CLI} auth google-docs`, { cwd: TMP, stdio: 'pipe' })
    } catch (err) {
      output = err.stderr?.toString() || err.stdout?.toString() || ''
    }
    rmSync(TMP, { recursive: true, force: true })

    expect(output).toMatch(/client_id|credentials|configure/i)
  })

  it('upstream auth status exits 0 and shows providers', () => {
    mkdirSync(TMP, { recursive: true })
    writeFileSync(join(TMP, 'upstream.config.yaml'), 'version: 1\n')
    process.env.UPSTREAM_TOKENS_PATH = join(TMP, 'tokens.json')

    const output = execSync(`node ${CLI} auth status`, { cwd: TMP }).toString()
    rmSync(TMP, { recursive: true, force: true })
    delete process.env.UPSTREAM_TOKENS_PATH

    expect(output).toContain('google-docs')
  })
})
