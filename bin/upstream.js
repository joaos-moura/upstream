#!/usr/bin/env node
import { Command } from 'commander'
import { initCommand } from '../src/commands/init.js'
import { upgradeCommand } from '../src/commands/upgrade.js'
import { authCommand } from '../src/commands/auth.js'
import { startMcpServer } from '../src/lib/mcp/server.js'

const program = new Command()

program
  .name('upstream')
  .description('Claude Code plugin: enforce PRD/ADR before feature development')
  .version('0.2.0')

program
  .command('init')
  .description('Scaffold upstream into the current repo')
  .action(initCommand)

program
  .command('upgrade')
  .description('Regenerate skills and hook, preserve config and docs')
  .action(upgradeCommand)

program
  .command('auth <provider>')
  .description('Authenticate with a documentation provider (google-docs) or check status (status)')
  .action(authCommand)

program
  .command('mcp')
  .description('Start the upstream MCP server (called automatically by Claude Code)')
  .action(startMcpServer)

program.parse()
