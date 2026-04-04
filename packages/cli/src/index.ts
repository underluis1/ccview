#!/usr/bin/env node
import { Command } from 'commander'
import { initCommand } from './commands/init.js'
import { syncCommand } from './commands/sync.js'
import { statsCommand } from './commands/stats.js'
import { exportCommand } from './commands/export.js'
import { configCommand } from './commands/config.js'
import { serveCommand } from './commands/serve.js'

const program = new Command()

program
  .name('ccview')
  .description('Claude Code session viewer and analytics dashboard')
  .version('0.1.0')

program.addCommand(initCommand)
program.addCommand(syncCommand)
program.addCommand(statsCommand)
program.addCommand(exportCommand)
program.addCommand(configCommand)
program.addCommand(serveCommand)

// Default command (no subcommand): serve
program.action(async () => {
  await serveCommand.parseAsync(['serve'], { from: 'user' })
})

program.parse()
