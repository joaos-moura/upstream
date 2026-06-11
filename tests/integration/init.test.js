import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync, statSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { GENERATED_FILES } from '../../src/lib/scaffold.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const TARGET = '/tmp/upstream-test-init'
const CLI = join(__dirname, '../../bin/upstream.js')

beforeEach(() => {
  mkdirSync(TARGET, { recursive: true })
  execSync('git init -q', { cwd: TARGET })
})
afterEach(() => { rmSync(TARGET, { recursive: true, force: true }) })

describe('upstream init', () => {
  it('creates all expected files', () => {
    execSync(`node ${CLI} init`, { cwd: TARGET })
    for (const f of GENERATED_FILES) {
      expect(existsSync(join(TARGET, f)), `${f} should exist`).toBe(true)
    }
    expect(existsSync(join(TARGET, 'upstream.config.yaml'))).toBe(true)
    expect(existsSync(join(TARGET, 'docs/upstream/.gitkeep'))).toBe(true)
  })

  it('makes the hook executable', () => {
    execSync(`node ${CLI} init`, { cwd: TARGET })
    const mode = statSync(join(TARGET, '.claude/hooks/upstream-check.sh')).mode
    expect(mode & 0o111).toBeGreaterThan(0)
  })

  it('exits with code 0', () => {
    expect(() => execSync(`node ${CLI} init`, { cwd: TARGET })).not.toThrow()
  })
})
