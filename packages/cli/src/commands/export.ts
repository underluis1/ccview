import { Command } from 'commander'
import { writeFile } from 'node:fs/promises'
import {
  openDatabase,
  listSessions,
  listStepsBySession,
} from '@ccview/core'
import type { SessionFilters, Session, Step } from '@ccview/core'
import { printError, printSuccess } from '../utils/terminal-ui.js'

function sessionsToCSV(sessions: Session[]): string {
  const headers = [
    'id', 'project_name', 'started_at', 'ended_at',
    'duration_seconds', 'tokens_in', 'tokens_out', 'cost_usd',
    'total_steps', 'tool_calls', 'errors', 'model', 'summary',
  ]
  const rows = sessions.map((s) => [
    csvEscape(s.id),
    csvEscape(s.projectName ?? ''),
    csvEscape(s.startedAt.toISOString()),
    csvEscape(s.endedAt?.toISOString() ?? ''),
    String(s.durationSeconds ?? ''),
    String(s.totalTokensIn),
    String(s.totalTokensOut),
    String(s.totalCostUsd),
    String(s.totalSteps),
    String(s.toolCallCount),
    String(s.errorCount),
    csvEscape(s.model ?? ''),
    csvEscape(s.summary ?? ''),
  ])

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

function stepsToCSV(steps: Step[]): string {
  const headers = [
    'id', 'session_id', 'step_index', 'type', 'subtype',
    'tokens_in', 'tokens_out', 'duration_ms', 'tool_name',
    'is_error', 'created_at',
  ]
  const rows = steps.map((s) => [
    csvEscape(s.id),
    csvEscape(s.sessionId),
    String(s.stepIndex),
    csvEscape(s.type),
    csvEscape(s.subtype ?? ''),
    String(s.tokensIn),
    String(s.tokensOut),
    String(s.durationMs ?? ''),
    csvEscape(s.toolName ?? ''),
    String(s.isError),
    csvEscape(s.createdAt.toISOString()),
  ])

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

export const exportCommand = new Command('export')
  .description('Export session data as JSON or CSV')
  .option('--format <fmt>', 'Output format: json or csv', 'json')
  .option('--sessions-only', 'Export sessions only (no steps)')
  .option('--project <name>', 'Filter by project name')
  .option('--output <path>', 'Write to file instead of stdout')
  .action(async (opts: {
    format: string
    sessionsOnly?: boolean
    project?: string
    output?: string
  }) => {
    try {
      const db = openDatabase()

      const filters: SessionFilters = { limit: 10000 }
      if (opts.project) filters.project = opts.project

      const sessions = listSessions(db, filters)

      let output: string

      if (opts.format === 'csv') {
        if (opts.sessionsOnly) {
          output = sessionsToCSV(sessions)
        } else {
          const allSteps: Step[] = []
          for (const session of sessions) {
            const steps = listStepsBySession(db, session.id)
            allSteps.push(...steps)
          }
          output = sessionsToCSV(sessions) + '\n\n--- Steps ---\n\n' + stepsToCSV(allSteps)
        }
      } else {
        if (opts.sessionsOnly) {
          output = JSON.stringify(sessions, null, 2)
        } else {
          const data = sessions.map((session) => ({
            ...session,
            steps: listStepsBySession(db, session.id),
          }))
          output = JSON.stringify(data, null, 2)
        }
      }

      if (opts.output) {
        await writeFile(opts.output, output, 'utf-8')
        printSuccess(`Exported to ${opts.output}`)
      } else {
        process.stdout.write(output + '\n')
      }

      db.close()
    } catch (err) {
      printError(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })
