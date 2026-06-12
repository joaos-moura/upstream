# Contributing to upstream

Thanks for your interest. This document covers how to set up the project, understand the codebase, and ship changes.

---

## Development setup

**Requirements:** Node.js 18+, npm, [bats-core](https://github.com/bats-core/bats-core) for shell tests.

```bash
git clone https://github.com/joaos-moura/upstream
cd upstream
npm install
```

Run the full test suite:

```bash
npm test           # JS unit + integration tests (vitest)
npm run test:hook  # Shell hook tests (bats)
```

All tests must pass before submitting a pull request.

---

## Project structure

```
bin/
  upstream.js               # CLI entry point (Commander.js)
src/
  commands/
    init.js                 # upstream init
    upgrade.js              # upstream upgrade
    auth.js                 # upstream auth <provider>
  lib/
    config.js               # read upstream.config.yaml
    scaffold.js             # copy templates into target repo
    settings.js             # write .claude/settings.json MCP entry
    tokens.js               # read/write ~/.upstream/tokens.json
    auth/
      google-docs.js        # OAuth2 flow (browser → localhost callback → token exchange)
    providers/
      google-docs.js        # Drive API: extractDocId, getFileMetadata, refreshTokenIfNeeded
    mcp/
      server.js             # MCP server entry (stdio transport)
      tools/
        validate-link.js    # validate_link tool: detect provider, call API, return metadata
templates/
  hooks/
    upstream-check.sh       # UserPromptSubmit hook (bash)
  skills/
    upstream-guard.md       # orchestration skill
    upstream-prd.md         # PRD creation skill
    upstream-adr.md         # ADR creation skill
  templates/
    PRD.md                  # PRD content template
    ADR.md                  # ADR content template
    PRD-link.md             # stub for link mode
    ADR-link.md             # stub for link mode
  upstream.config.yaml      # default config template
tests/
  unit/                     # vitest unit tests
  integration/              # vitest integration tests (run CLI as subprocess)
  hook/                     # bats tests for upstream-check.sh
```

**Key design decisions:**

- **ESM throughout** — the package uses `"type": "module"`. All imports use ESM syntax (`import`/`export`). No CommonJS.
- **Zero runtime dependencies on the host** — skills and hooks work with whatever Claude Code provides. The MCP server (`upstream mcp`) is the only process that needs npm packages at runtime.
- **Config is committed, tokens are not** — `upstream.config.yaml` and OAuth `client_id`/`client_secret` belong in the repo (set by platform engineers). `~/.upstream/tokens.json` is per-developer and never committed.
- **Skills are markdown** — `upstream-guard.md`, `upstream-prd.md`, `upstream-adr.md` are instruction files for Claude Code, not code. Changes to them change Claude's behavior.

---

## Running the CLI locally

```bash
# From the repo root
node bin/upstream.js --help
node bin/upstream.js init
node bin/upstream.js auth status
```

---

## Adding a new provider

upstream currently supports Google Docs. To add Notion or Confluence:

1. **Create `src/lib/providers/<name>.js`** — implement `extractDocId(url)` and `getFileMetadata(docId, accessToken)` following the Google Docs provider as a model.

2. **Create `src/lib/auth/<name>.js`** — implement the OAuth flow. Copy the structure of `google-docs.js`: find a free port, open the browser, wait for callback, exchange code, call `setProviderToken`.

3. **Update `src/lib/mcp/tools/validate-link.js`** — add a URL detection check and call your new provider.

4. **Update `src/commands/auth.js`** — add the provider to `KNOWN_PROVIDERS` and add a dispatch case in `authCommand`.

5. **Update `templates/upstream.config.yaml`** — add a commented example for the new provider's credentials.

6. **Write tests** — unit tests for URL parsing (no network), integration test for the auth command error path (missing credentials).

---

## Modifying skill files

The files in `templates/skills/` are instruction documents that Claude Code reads at runtime. They are not parsed programmatically. When editing them:

- Keep the YAML frontmatter (`name`, `description`) — Claude Code uses it for skill registration.
- Be precise about conditions and fallbacks. Vague instructions produce inconsistent behavior.
- Test by running `upstream init` into a scratch repo and exercising the skill manually in Claude Code.

---

## Code style

- No comments unless the *why* is non-obvious — well-named identifiers are self-documenting.
- Error messages that users see go to `stderr` (`console.error`), not `stdout`.
- Validate at system boundaries (user input, external APIs). Trust internal function contracts.
- Keep functions small and named for what they do. Avoid abstraction before it's needed.

---

## Test conventions

- **Unit tests** (`tests/unit/`) — mock external I/O (network, filesystem via `UPSTREAM_TOKENS_PATH` env). Use `vitest` mocks for modules.
- **Integration tests** (`tests/integration/`) — run the CLI as a child process with `execSync`. Use real temp directories under `/tmp/`, cleaned up in `afterEach`.
- **Hook tests** (`tests/hook/`) — bats scripts that exercise `upstream-check.sh` directly with mock git state.

New tests go in the right category. Integration tests are slower but catch wiring bugs that unit tests miss — prefer them for command-level behavior.

---

## Submitting changes

1. Fork the repo and create a branch from `main`.
2. Make your changes with tests.
3. Run `npm test && npm run test:hook` — all must pass.
4. Open a pull request with a clear description of what changed and why.

For larger changes (new providers, new commands, changes to the skill behavior), open an issue first to discuss the design.
