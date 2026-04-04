import { Command } from 'commander'
import { openDatabase, getOverviewStats } from '@ccview/core'
import type { SessionFilters } from '@ccview/core'
import {
  printBox,
  printError,
  formatTokens,
  formatCost,
  formatDuration,
} from '../utils/terminal-ui.js'

function parseDateRange(opts: {
  last?: string
  today?: boolean
}): { from?: Date; to?: Date; label: string } {
  const now = new Date()

  if (opts.today) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return { from: start, to: now, label: 'Today' }
  }

  if (opts.last) {
    const match = opts.last.match(/^(\d+)d$/)
    if (!match) {
      throw new Error('Invalid --last format. Use e.g. "7d" for 7 days.')
    }
    const days = parseInt(match[1]!, 10)
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    return { from, to: now, label: `Last ${days} days` }
  }

  return { label: 'All time' }
}

export const statsCommand = new Command('stats')
  .description('Show usage statistics')
  .option('--project <name>', 'Filter by project name')
  .option('--last <Nd>', 'Show last N days (e.g. 7d)')
  .option('--today', 'Show today only')
  .action(async (opts: { project?: string; last?: string; today?: boolean }) => {
    try {
      const db = openDatabase()
      const { from, to, label } = parseDateRange(opts)

      const stats = getOverviewStats(db, from, to)

      const totalTokens = stats.totalTokensIn + stats.totalTokensOut
      const errorPct = Math.round(stats.errorRate * 100)

      const lines = [
        `Sessions:        ${stats.totalSessions}`,
        `Total tokens:    ${formatTokens(totalTokens)} (in: ${formatTokens(stats.totalTokensIn)} out: ${formatTokens(stats.totalTokensOut)})`,
        `Est. cost:       ${formatCost(stats.totalCostUsd)}`,
        `Files touched:   ${stats.uniqueFilesTouched} unique`,
        `Avg session:     ${formatDuration(stats.avgSessionDuration)}`,
        `Error rate:      ${errorPct}%`,
      ]

      if (stats.topProject) {
        lines.push(`Top project:     ${stats.topProject}`)
      }

      const title = opts.project
        ? `ccview stats \u2014 ${opts.project} \u2014 ${label}`
        : `ccview stats \u2014 ${label}`

      printBox(title, lines)

      db.close()
    } catch (err) {
      printError(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })
