# upstream

> A Claude Code plugin that enforces PRD and ADR documentation before feature development begins.

**upstream** installs a hook into Claude Code that detects feature work and blocks it until a Product Requirements Document (PRD) exists. If the feature introduces architectural decisions — a new external dependency, a database migration, an API contract change — it also requires an Architecture Decision Record (ADR).

This keeps your team's reasoning in the repository, not scattered across Notion pages and memory.

---

## How it works

After `upstream init`, every Claude Code session on a feature branch gets a context injection:

```
UPSTREAM: feature detected without PRD. Invoke upstream-guard before continuing.
```

Claude then runs the `upstream-guard` skill, which:

1. **Classifies the work** — feature, bug, fix, chore, or incident
2. **Checks for a PRD** — by filename or content match in `docs/upstream/`
3. **Checks for an ADR** — if the PRD describes architectural decisions
4. **Releases to development** once docs are in place

PRDs and ADRs can be created in four ways: imported from an existing document, generated through a short interview, auto-drafted from git context, or linked to an external tool (Notion, Confluence, Google Docs).

Bypass branches (`fix/`, `hotfix/`, `chore/`, `docs/`) are skipped automatically.

---

## Quick start

```bash
# Install globally
npm install -g upstream

# In your repo
cd my-project
upstream init
git add .claude/ docs/ upstream.config.yaml
git commit -m "feat: add upstream Claude Code plugin"
git push
```

Your team gets the plugin on their next `git pull`. No global install required on their machines — Claude Code picks up `.claude/` automatically.

---

## CLI reference

| Command | Description |
|---|---|
| `upstream init` | Scaffold upstream into the current repo |
| `upstream upgrade` | Regenerate skills and hook, preserve config and docs |
| `upstream auth google-docs` | Connect Google Docs via OAuth2 |
| `upstream auth status` | Show authentication status for all providers |
| `upstream mcp` | Start the upstream MCP server (called automatically by Claude Code) |

---

## Configuration

`upstream.config.yaml` is created in your repo root on `init`. All fields have defaults.

```yaml
version: 1

# Branch prefixes that bypass all checks
bypass_for:
  - fix/
  - hotfix/
  - chore/
  - docs/

# Fields that must be present in every PRD
prd_required_fields:
  - problem_statement
  - success_metrics
  - out_of_scope

# Conditions that require an ADR
adr_triggers:
  - new_external_dependency
  - database_schema_change
  - api_breaking_change
  - infrastructure_change
  - auth_change

# Directory for PRDs, ADRs, and the skip log
docs_path: docs/upstream/

# 'local': full document content in this repo
# 'link': stub file with URL; actual doc lives externally
docs_storage: local
```

---

## Link mode — external docs (Notion, Confluence, Google Docs)

If your team stores PRDs and ADRs in an external tool, set `docs_storage: link`. upstream saves a small stub file with the document URL and metadata instead of full content:

```markdown
# PRD: user-auth

- **Status:** Linked
- **Storage:** external
- **Document:** https://docs.google.com/document/d/...
- **Date:** 2026-06-12
```

### Google Docs integration

upstream can validate Google Docs links and pull the document title automatically, so developers don't need to type it.

**Setup (platform engineer, done once per org):**

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com/apis/credentials)
2. Enable the **Google Drive API**
3. Create an **OAuth 2.0 Client ID** → type: Desktop app
4. Add `http://localhost` as an authorized redirect URI
5. Add credentials to `upstream.config.yaml` and commit:

```yaml
integrations:
  google_docs:
    client_id: "xxx.apps.googleusercontent.com"
    client_secret: "GOCSPX-..."
```

**Each developer authenticates once:**

```bash
upstream auth google-docs
```

This opens a browser, completes the OAuth flow, and stores tokens in `~/.upstream/tokens.json` (never committed).

### Enforcement policy

Platform engineers can restrict which tools are accepted and require validation before a link can be saved:

```yaml
link_policy:
  allowed_providers:      # only accept links from these tools
    - google-docs
  require_validation: true  # block unvalidated links (e.g. unauthenticated)
```

---

## Skipping

If a PRD or ADR genuinely isn't needed, developers can skip with a justification. The skip is logged to `docs/upstream/SKIPS.md` and a PR snippet is generated for transparency:

```
> ⚠️ upstream skip: PRD not created for `feat/quick-fix`.
> Reason: two-line CSS change, no product decisions involved.
> Logged in: docs/upstream/SKIPS.md
```

---

## What gets committed to your repo

```
.claude/
  hooks/
    upstream-check.sh           # UserPromptSubmit hook
  plugins/upstream/
    skills/
      upstream-guard.md         # orchestration skill
      upstream-prd.md           # PRD creation skill
      upstream-adr.md           # ADR creation skill
    templates/
      PRD.md                    # PRD template
      ADR.md                    # ADR template
      PRD-link.md               # stub template for link mode
      ADR-link.md               # stub template for link mode
  settings.json                 # MCP server registration (upstream mcp)
upstream.config.yaml            # org configuration
docs/upstream/                  # your PRDs, ADRs, and skip log
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT
