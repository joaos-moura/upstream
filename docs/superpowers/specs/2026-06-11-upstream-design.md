# upstream — Design Spec
**Date:** 2026-06-11
**Status:** Approved

## Problem

Teams adopting AI — especially PMs and PDs entering the development workflow — tend to skip documentation and go straight to implementation. This creates a pattern where code exists without a clear problem statement, success metrics, or architectural rationale.

`upstream` is a Claude Code plugin that solves a problem *before* development: ensuring PRD and ADR exist before any line of code is written.

---

## Architecture Overview

Two parts ship together:

**1. CLI (`npx upstream init` / `npx upstream upgrade`)**
- Run once per repo by the platform engineer
- Scaffolds skills, hook, templates, and config into the repo
- No global install required — always fetches latest via npx
- Updates: `npx upstream upgrade` regenerates skills/hook, platform engineer commits diff

**2. Artefacts generated in the org's repo**
```
.claude/
├── hooks/
│   └── upstream-check.sh         # UserPromptSubmit hook
├── plugins/upstream/
│   ├── skills/
│   │   ├── upstream-guard.md     # main skill: classify + validate
│   │   ├── upstream-prd.md       # PRD creation skill
│   │   └── upstream-adr.md       # ADR creation skill
│   └── templates/
│       ├── PRD.md                # customizable org template
│       └── ADR.md
docs/upstream/                    # PRDs, ADRs, and skip log live here
upstream.config.yaml              # org-level configuration
```

---

## Configuration (`upstream.config.yaml`)

```yaml
version: 1
bypass_for:
  - fix/
  - hotfix/
  - chore/
  - docs/
prd_required_fields:
  - problem_statement
  - success_metrics
  - out_of_scope
adr_triggers:
  - new_external_dependency
  - database_schema_change
  - api_breaking_change
  - infrastructure_change
  - auth_change
docs_path: docs/upstream/
```

`bypass_for` lists branch prefixes (or label patterns) that never require a PRD — bugs, hotfixes, chores, etc.

---

## Components

### Hook (`upstream-check.sh`)

Runs on every `UserPromptSubmit`. No LLM involved — pure shell logic:

1. Check `upstream.config.yaml` exists — if not, exit silently (repo not upstream-enabled)
2. Read `bypass_for` from config
3. Check current branch against bypass patterns — if match, exit silently
4. Search `docs/upstream/` for a PRD referencing this branch/feature
5. If PRD not found → inject into context:
   `"UPSTREAM: feature detected without PRD. Invoke upstream-guard before continuing."`
6. If PRD found → exit silently, development proceeds

### Skill: `upstream-guard`

Entry point skill. Runs in sequence:

**Step 1 — Classification**
- Signals analyzed: user prompt, branch name, recent commit messages
- Output: `feature` | `bug` | `fix` | `incident` | `chore` | `ambiguous`
- If `ambiguous` → asks user for explicit confirmation before proceeding

**Step 2 — PRD validation (features only)**
- Searches `docs/upstream/` for existing PRD
- If found → validates required fields from config; lists missing fields and blocks until complete
- If not found → presents three paths:
  - "I have an external document to import"
  - "Guide me through an interactive interview"
  - "Generate an auto-draft from available context"

**Step 3 — ADR check**
- Evaluates org-defined `adr_triggers` from config against the PRD content
- Claude also proactively analyzes PRD for architectural decisions outside the configured triggers
- If ADR needed → checks existence, invokes `upstream-adr` if missing

**Step 4 — Release**
- Confirms all required docs are present and valid
- Signals development can proceed

### Skill: `upstream-prd`

Invoked by `upstream-guard` or directly. Three creation modes:

- **Import:** user pastes or describes external doc → skill maps content to template fields, fills gaps
- **Interactive interview:** skill asks one question at a time, builds PRD incrementally
- **Auto-draft:** skill generates full draft from prompt + branch context + recent commits → user reviews

Saves to `docs/upstream/PRD-<slug>.md`.

### Skill: `upstream-adr`

Same three creation modes as `upstream-prd`. Saves to `docs/upstream/ADR-<number>-<slug>.md`.

---

## Skip Flow

When a developer requests to skip PRD or ADR creation:

1. `upstream-guard` acknowledges the request and requires a written justification
2. Justification is appended to `docs/upstream/SKIPS.md` with: timestamp, branch, doc type skipped, and reason
3. Skill generates a ready-to-use PR description snippet documenting the skip — developer can paste directly into PR body or run `gh pr comment` with the generated text
4. Development proceeds

This ensures every skip is traceable in git history and visible to tech leads and reviewers at PR review time.

---

## Happy Path Flow

```
Dev: "add OAuth authentication"
         │
         ▼
[Hook] branch: feat/oauth-login
       → not a bypass branch
       → no PRD found in docs/upstream/
       → injects: UPSTREAM: feature without PRD detected
         │
         ▼
[upstream-guard]
       → classifies: feature (high confidence)
       → offers 3 paths → dev chooses interactive interview
         │
         ▼
[upstream-prd]
       → conducts interview, fills template
       → saves docs/upstream/PRD-oauth-login.md
         │
         ▼
[upstream-guard resumes]
       → reads generated PRD
       → evaluates ADR: detects auth_change + new external dependency
       → ADR required → invokes upstream-adr
       → saves docs/upstream/ADR-001-oauth-provider.md
         │
         ▼
→ "Docs complete. Development can proceed."
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| `upstream.config.yaml` absent | Hook exits silently — repo not upstream-enabled |
| PRD incomplete (missing required fields) | Guard lists missing fields, blocks until complete |
| Dev imports malformed external doc | Guard validates required fields, asks for missing content |
| Ambiguous branch name (`update-stuff`) | Guard asks explicitly: feature, fix, or other? |
| Dev requests PRD or ADR skip | Guard requires justification → logs to SKIPS.md → generates PR snippet |

---

## Testing

### CLI
- Unit: correct file generation per config variation
- Integration: run `init` against a temp repo, validate generated structure

### Hook
- Tested with `bats` or `shunit2`
- Scenarios: bypass match, PRD found, PRD absent, config absent

### Skills
- Tested via Claude Code with fixture repos (with/without docs, varied configs)
- Manual checklist per scenario: new feature, bug, ambiguous, external import, skip flow

---

## Distribution

- `npx upstream init` — no permanent install, always fetches latest CLI
- Generated artefacts committed to git — all devs receive via `git pull`, zero per-dev setup
- Updates: platform engineer runs `npx upstream upgrade`, commits diff, team pulls
