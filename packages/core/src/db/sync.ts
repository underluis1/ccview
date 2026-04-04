import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import type { ParsedLogEntry, Session, Step, FileImpact, Project } from '../types.js'
import { insertSession, insertStep, insertFileImpact, upsertProject, updateSessionHash } from './queries.js'

export function indexSession(
  db: Database.Database,
  entry: ParsedLogEntry,
  logPath: string,
  hash: string,
): void {
  const sessionId = randomUUID()

  const session: Session = {
    id: sessionId,
    ...entry.session,
  }

  const steps: Step[] = entry.steps.map((s, i) => ({
    id: randomUUID(),
    sessionId,
    ...s,
  }))

  const fileImpacts: FileImpact[] = entry.fileImpacts.map((fi) => {
    // fi.stepId from the parser is a temporary id like "step-N" where N is the index
    const stepIndex = parseInt(fi.stepId.replace('step-', ''), 10)
    const matchingStep = !isNaN(stepIndex) ? steps[stepIndex] : undefined
    return {
      ...fi,
      id: 0, // auto-increment
      sessionId,
      stepId: matchingStep?.id ?? steps[0]?.id ?? sessionId,
    }
  })

  const txn = db.transaction(() => {
    insertSession(db, session)

    for (const step of steps) {
      insertStep(db, step)
    }

    for (const impact of fileImpacts) {
      insertFileImpact(db, impact)
    }

    updateSessionHash(db, logPath, hash)

    // Upsert project stats
    if (session.projectPath) {
      const projectName = session.projectName ?? session.projectPath.split('/').pop() ?? 'unknown'

      const stats = db.prepare(`
        SELECT
          COUNT(*) as total_sessions,
          COALESCE(SUM(total_tokens_in + total_tokens_out), 0) as total_tokens,
          COALESCE(SUM(total_cost_usd), 0) as total_cost,
          MIN(started_at) as first_session_at,
          MAX(started_at) as last_session_at
        FROM sessions
        WHERE project_path = ?
      `).get(session.projectPath) as Record<string, unknown>

      const project: Project = {
        path: session.projectPath,
        name: projectName,
        totalSessions: (stats['total_sessions'] as number) ?? 0,
        totalTokens: (stats['total_tokens'] as number) ?? 0,
        totalCostUsd: (stats['total_cost'] as number) ?? 0,
        firstSessionAt: stats['first_session_at'] ? new Date(stats['first_session_at'] as string) : null,
        lastSessionAt: stats['last_session_at'] ? new Date(stats['last_session_at'] as string) : null,
        claudeMdPath: null,
        updatedAt: new Date(),
      }

      upsertProject(db, project)
    }
  })

  txn()
}
