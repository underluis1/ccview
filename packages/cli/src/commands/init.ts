import { Command } from 'commander'
import ora from 'ora'
import {
  scanClaudeDirectory,
  parseSession,
  openDatabase,
  indexSession,
  computeFileHash,
  sessionExistsByHash,
} from '@ccview/core'
import { DEFAULT_PRICING } from '@ccview/core'
import { estimateCost } from '@ccview/core'
import { printBox, printError, printSuccess } from '../utils/terminal-ui.js'

export const initCommand = new Command('init')
  .description('Scan ~/.claude/ and index all sessions')
  .action(async () => {
    const spinner = ora('Scanning ~/.claude/...').start()

    try {
      const db = openDatabase()
      const result = await scanClaudeDirectory({
        forceRescan: true,
        onProgress(current, total) {
          spinner.text = `Indexing session ${current}/${total}...`
        },
      })

      spinner.succeed('Scan complete')

      // Now actually index sessions by re-scanning and indexing each
      const { findSessionFiles } = await import('@ccview/core')
      const { join } = await import('node:path')
      const { homedir } = await import('node:os')

      const projectsDir = join(homedir(), '.claude', 'projects')
      const files = await findSessionFiles(projectsDir)

      let indexed = 0
      let skipped = 0
      const errors: string[] = []

      const indexSpinner = ora('Indexing sessions...').start()

      for (let i = 0; i < files.length; i++) {
        const file = files[i]!
        indexSpinner.text = `Indexing ${i + 1}/${files.length}...`

        try {
          if (sessionExistsByHash(db, file.hash)) {
            skipped++
            continue
          }

          const parsed = await parseSession(file.filePath)

          if (parsed.session.model) {
            const pricing = DEFAULT_PRICING[parsed.session.model]
            parsed.session.totalCostUsd = estimateCost(
              parsed.session.totalTokensIn,
              parsed.session.totalTokensOut,
              pricing,
            )
          }

          indexSession(db, parsed, file.filePath, file.hash)
          indexed++
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err))
        }
      }

      indexSpinner.succeed('Indexing complete')

      printBox('ccview init — Results', [
        `Sessions found:    ${files.length}`,
        `Sessions indexed:  ${indexed}`,
        `Sessions skipped:  ${skipped}`,
        `Errors:            ${errors.length}`,
      ])

      if (errors.length > 0) {
        for (const e of errors.slice(0, 5)) {
          printError(e)
        }
        if (errors.length > 5) {
          printError(`...and ${errors.length - 5} more errors`)
        }
      }

      db.close()
      printSuccess('Database initialized at ~/.ccview/ccview.db')
    } catch (err) {
      spinner.fail('Init failed')
      printError(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })
