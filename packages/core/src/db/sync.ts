import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import type { ParsedLogEntry, Session, Step, FileImpact } from '../types.js'
import {
  insertSession,
  insertStep,
  insertFileImpact,
  upsertProject,
  updateSessionHash,
  getSessionByLogPath,
  deleteSessionById,
} from './queries.js'

export function indexSession(
  db: Database.Database,
  entry: ParsedLogEntry,
  logPath: string,
  hash: string,
): void {
  // Deduplication: check if a session with the same raw_log_path already exists
  const existing = getSessionByLogPath(db, logPath)
  if (existing) {
    if (existing.logHash === hash) {
      // Same file, same content — skip re-indexing
      return
    }
    // Same path but different hash (file was updated) — delete old and re-index
    deleteSessionById(db, existing.id)
  }

  const sessionId = randomUUID()

  const session: Session = {
    id: sessionId,
    ...entry.session,
  }

  const steps: Step[] = entry.steps.map((s) => ({
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

    // Upsert project (only identity fields — aggregates are computed at read time via JOIN)
    if (session.projectPath) {
      const projectName = session.projectName ?? session.projectPath.split('/').pop() ?? 'unknown'

      upsertProject(db, {
        path: session.projectPath,
        name: projectName,
        claudeMdPath: null,
        updatedAt: new Date(),
      })
    }
  })

  txn()
}
