import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { scaffoldInto, GENERATED_FILES } from '../../src/lib/scaffold.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const TARGET = '/tmp/upstream-test-scaffold'
const FIXTURES = join(__dirname, '../fixtures/templates')

beforeEach(() => { mkdirSync(TARGET, { recursive: true }) })
afterEach(() => { rmSync(TARGET, { recursive: true, force: true }) })

describe('scaffoldInto', () => {
  it('creates all GENERATED_FILES in the target', async () => {
    await scaffoldInto(TARGET, FIXTURES)
    for (const f of GENERATED_FILES) {
      expect(existsSync(join(TARGET, f)), `${f} should exist`).toBe(true)
    }
  })

  it('creates docs/upstream/.gitkeep', async () => {
    await scaffoldInto(TARGET, FIXTURES)
    expect(existsSync(join(TARGET, 'docs/upstream/.gitkeep'))).toBe(true)
  })

  it('creates upstream.config.yaml when absent', async () => {
    await scaffoldInto(TARGET, FIXTURES)
    expect(existsSync(join(TARGET, 'upstream.config.yaml'))).toBe(true)
  })

  it('preserves existing upstream.config.yaml', async () => {
    const configPath = join(TARGET, 'upstream.config.yaml')
    const original = 'version: 1\ncustom: true\n'
    writeFileSync(configPath, original)
    await scaffoldInto(TARGET, FIXTURES)
    expect(readFileSync(configPath, 'utf8')).toBe(original)
  })

  it('makes the hook executable', async () => {
    await scaffoldInto(TARGET, FIXTURES)
    const { statSync } = await import('fs')
    const mode = statSync(join(TARGET, '.claude/hooks/upstream-check.sh')).mode
    expect(mode & 0o111).toBeGreaterThan(0)
  })
})
