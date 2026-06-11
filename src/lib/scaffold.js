import { copyFile, mkdir, writeFile, access, chmod } from 'fs/promises'
import { join, dirname } from 'path'

const FILE_MAP = [
  ['hooks/upstream-check.sh',    '.claude/hooks/upstream-check.sh'],
  ['skills/upstream-guard.md',   '.claude/plugins/upstream/skills/upstream-guard.md'],
  ['skills/upstream-prd.md',     '.claude/plugins/upstream/skills/upstream-prd.md'],
  ['skills/upstream-adr.md',     '.claude/plugins/upstream/skills/upstream-adr.md'],
  ['templates/PRD.md',           '.claude/plugins/upstream/templates/PRD.md'],
  ['templates/ADR.md',           '.claude/plugins/upstream/templates/ADR.md'],
]

export const GENERATED_FILES = FILE_MAP.map(([, dest]) => dest)

async function fileExists(p) {
  try { await access(p); return true } catch { return false }
}

export async function scaffoldInto(targetDir, templatesDir) {
  for (const [src, dest] of FILE_MAP) {
    const srcPath = join(templatesDir, src)
    const destPath = join(targetDir, dest)
    await mkdir(dirname(destPath), { recursive: true })
    await copyFile(srcPath, destPath)
  }

  // Make hook executable
  await chmod(join(targetDir, '.claude/hooks/upstream-check.sh'), 0o755)

  // Config: only write if absent (never overwrite org customizations)
  const configDest = join(targetDir, 'upstream.config.yaml')
  if (!await fileExists(configDest)) {
    await copyFile(join(templatesDir, 'upstream.config.yaml'), configDest)
  }

  // Ensure docs dir exists
  const docsDir = join(targetDir, 'docs/upstream')
  await mkdir(docsDir, { recursive: true })
  const gitkeep = join(docsDir, '.gitkeep')
  if (!await fileExists(gitkeep)) {
    await writeFile(gitkeep, '')
  }
}
