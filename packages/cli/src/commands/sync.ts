import { Command } from 'commander'
import ora from 'ora'
import { watch } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import {
  openDatabase,
  findSessionFiles,
  parseSession,
  indexSession,
  sessionExistsByHash,
  computeFileHash,
  estimateCost,
} from '@ccview/core'
import { printBox, printError, printSuccess, printInfo } from '../utils/terminal-ui.js'

async function syncSessions(opts: { rebuild: boolean }): Promise<void> {
  const db = openDatabase()

  if (opts.rebuild) {
    printInfo('Rebuilding database...')
    db.exec('DELETE FROM file_impacts')
    db.exec('DELETE FROM steps')
    db.exec('DELETE FROM sessions')
    db.exec('DELETE FROM projects')
  }

  const projectsDir = join(homedir(), '.claude', 'projects')
  const files = await findSessionFiles(projectsDir)

  let indexed = 0
  let skipped = 0
  const errors: string[] = []

  const spinner = ora('Syncing sessions...').start()

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!
    spinner.text = `Syncing ${i + 1}/${files.length}...`

    try {
      if (!opts.rebuild && sessionExistsByHash(db, file.hash)) {
        skipped++
        continue
      }

      const parsed = await parseSession(file.filePath)

      const totalCacheReadTokens = parsed.steps.reduce((sum, s) => sum + (s.cacheReadTokens ?? 0), 0)
      parsed.session.totalCostUsd = estimateCost(
        parsed.session.totalTokensIn,
        parsed.session.totalTokensOut,
        parsed.session.model,
        totalCacheReadTokens,
      )

      indexSession(db, parsed, file.filePath, file.hash)
      indexed++
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  spinner.succeed('Sync complete')

  printBox('ccview sync — Results', [
    `Sessions found:    ${files.length}`,
    `New indexed:       ${indexed}`,
    `Skipped:           ${skipped}`,
    `Errors:            ${errors.length}`,
  ])

  if (errors.length > 0) {
    for (const e of errors.slice(0, 5)) {
      printError(e)
    }
  }

  db.close()
}

async function watchForChanges(): Promise<void> {
  const projectsDir = join(homedir(), '.claude', 'projects')
  printInfo(`Watching ${projectsDir} for new sessions...`)

  const watcher = watch(projectsDir, { recursive: true }, async (_event, filename) => {
    if (!filename || !filename.endsWith('.jsonl')) return

    printInfo(`Detected change: ${filename}`)
    try {
      const db = openDatabase()
      const filePath = join(projectsDir, filename)
      const hash = await computeFileHash(filePath)

      if (sessionExistsByHash(db, hash)) {
        db.close()
        return
      }

      const parsed = await parseSession(filePath)

      const totalCacheReadTokens = parsed.steps.reduce((sum, s) => sum + (s.cacheReadTokens ?? 0), 0)
      parsed.session.totalCostUsd = estimateCost(
        parsed.session.totalTokensIn,
        parsed.session.totalTokensOut,
        parsed.session.model,
        totalCacheReadTokens,
      )

      indexSession(db, parsed, filePath, hash)
      printSuccess(`Indexed new session from ${filename}`)
      db.close()
    } catch (err) {
      printError(`Failed to index ${filename}: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  process.on('SIGINT', () => {
    watcher.close()
    printInfo('Watch mode stopped')
    process.exit(0)
  })

  // Keep process alive
  await new Promise(() => {})
}

export const syncCommand = new Command('sync')
  .description('Sync new sessions from ~/.claude/')
  .option('--watch', 'Watch for new sessions after initial sync')
  .option('--rebuild', 'Delete and rebuild the entire database')
  .action(async (opts: { watch?: boolean; rebuild?: boolean }) => {
    try {
      if (opts.rebuild) {
        const readline = await import('node:readline')
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        })
        const answer = await new Promise<string>((resolve) => {
          rl.question('This will delete all indexed data. Continue? [y/N] ', resolve)
        })
        rl.close()
        if (answer.toLowerCase() !== 'y') {
          printInfo('Aborted')
          return
        }
      }

      await syncSessions({ rebuild: opts.rebuild ?? false })

      if (opts.watch) {
        await watchForChanges()
      }
    } catch (err) {
      printError(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })
