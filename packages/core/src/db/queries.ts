import type Database from 'better-sqlite3'
import type { Session, Step, FileImpact, Project } from '../types.js'

// ── Filter / result types ──────────────────────────────────────────

export interface SessionFilters {
  project?: string
  from?: Date
  to?: Date
  model?: string
  search?: string
  limit?: number
  offset?: number
}

export interface ProjectStats {
  totalSessions: number
  totalTokens: number
  totalCost: number
  lastSessionAt: Date | null
}

export interface DailyCostRow {
  day: string
  sessions: number
  totalTokens: number
  totalCost: number
  avgSessionDuration: number
}

export interface FileHotspotRow {
  filePath: string
  projectName: string
  totalTouches: number
  totalLinesAdded: number
  totalLinesRemoved: number
  sessionsInvolved: number
}

export interface HotspotOptions {
  project?: string
  limit?: number
}

export interface OverviewStats {
  totalSessions: number
  totalTokensIn: number
  totalTokensOut: number
  totalCostUsd: number
  avgSessionDuration: number
  uniqueFilesTouched: number
  errorRate: number
  topProject: string | null
}

// ── Helpers ────────────────────────────────────────────────────────

function toISOString(d: Date): string {
  return d.toISOString()
}

function toDateOrNull(v: string | null): Date | null {
  return v ? new Date(v) : null
}

function mapSessionRow(row: Record<string, unknown>): Session {
  return {
    id: row['id'] as string,
    projectPath: (row['project_path'] as string) ?? null,
    projectName: (row['project_name'] as string) ?? null,
    startedAt: new Date(row['started_at'] as string),
    endedAt: toDateOrNull(row['ended_at'] as string | null),
    durationSeconds: (row['duration_seconds'] as number) ?? null,
    totalTokensIn: (row['total_tokens_in'] as number) ?? 0,
    totalTokensOut: (row['total_tokens_out'] as number) ?? 0,
    totalCostUsd: (row['total_cost_usd'] as number) ?? 0,
    totalSteps: (row['total_steps'] as number) ?? 0,
    toolCallCount: (row['tool_call_count'] as number) ?? 0,
    errorCount: (row['error_count'] as number) ?? 0,
    retryCount: (row['retry_count'] as number) ?? 0,
    model: (row['model'] as Session['model']) ?? null,
    summary: (row['summary'] as string) ?? null,
    rawLogPath: row['raw_log_path'] as string,
  }
}

function mapStepRow(row: Record<string, unknown>): Step {
  return {
    id: row['id'] as string,
    sessionId: row['session_id'] as string,
    stepIndex: row['step_index'] as number,
    type: row['type'] as Step['type'],
    subtype: (row['subtype'] as Step['subtype']) ?? null,
    content: (row['content'] as string) ?? null,
    contentSummary: (row['content_summary'] as string) ?? null,
    tokensIn: (row['tokens_in'] as number) ?? 0,
    tokensOut: (row['tokens_out'] as number) ?? 0,
    durationMs: (row['duration_ms'] as number) ?? null,
    toolName: (row['tool_name'] as string) ?? null,
    toolInput: (row['tool_input'] as string) ?? null,
    toolOutput: (row['tool_output'] as string) ?? null,
    isError: Boolean(row['is_error']),
    isRetry: Boolean(row['is_retry']),
    retryOfStepId: (row['retry_of_step_id'] as string) ?? null,
    createdAt: new Date(row['created_at'] as string),
  }
}

function mapFileImpactRow(row: Record<string, unknown>): FileImpact {
  return {
    id: row['id'] as number,
    sessionId: row['session_id'] as string,
    stepId: row['step_id'] as string,
    filePath: row['file_path'] as string,
    action: row['action'] as FileImpact['action'],
    linesAdded: (row['lines_added'] as number) ?? 0,
    linesRemoved: (row['lines_removed'] as number) ?? 0,
    diffContent: (row['diff_content'] as string) ?? null,
    createdAt: new Date(row['created_at'] as string),
  }
}

function mapProjectRow(row: Record<string, unknown>): Project {
  return {
    path: row['path'] as string,
    name: row['name'] as string,
    totalSessions: (row['total_sessions'] as number) ?? 0,
    totalTokens: (row['total_tokens'] as number) ?? 0,
    totalCostUsd: (row['total_cost_usd'] as number) ?? 0,
    firstSessionAt: toDateOrNull(row['first_session_at'] as string | null),
    lastSessionAt: toDateOrNull(row['last_session_at'] as string | null),
    claudeMdPath: (row['claude_md_path'] as string) ?? null,
    updatedAt: new Date(row['updated_at'] as string),
  }
}

// ── Sessions ───────────────────────────────────────────────────────

export function insertSession(db: Database.Database, session: Session): void {
  db.prepare(`
    INSERT INTO sessions (
      id, project_path, project_name, started_at, ended_at,
      duration_seconds, total_tokens_in, total_tokens_out, total_cost_usd,
      total_steps, tool_call_count, error_count, retry_count,
      model, summary, raw_log_path
    ) VALUES (
      @id, @projectPath, @projectName, @startedAt, @endedAt,
      @durationSeconds, @totalTokensIn, @totalTokensOut, @totalCostUsd,
      @totalSteps, @toolCallCount, @errorCount, @retryCount,
      @model, @summary, @rawLogPath
    )
  `).run({
    id: session.id,
    projectPath: session.projectPath,
    projectName: session.projectName,
    startedAt: toISOString(session.startedAt),
    endedAt: session.endedAt ? toISOString(session.endedAt) : null,
    durationSeconds: session.durationSeconds,
    totalTokensIn: session.totalTokensIn,
    totalTokensOut: session.totalTokensOut,
    totalCostUsd: session.totalCostUsd,
    totalSteps: session.totalSteps,
    toolCallCount: session.toolCallCount,
    errorCount: session.errorCount,
    retryCount: session.retryCount,
    model: session.model,
    summary: session.summary,
    rawLogPath: session.rawLogPath,
  })
}

export function getSessionById(db: Database.Database, id: string): Session | null {
  const row = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  return row ? mapSessionRow(row) : null
}

export function listSessions(db: Database.Database, filters: SessionFilters): Session[] {
  const conditions: string[] = []
  const params: Record<string, unknown> = {}

  if (filters.project) {
    conditions.push(`project_name = @project`)
    params['project'] = filters.project
  }
  if (filters.from) {
    conditions.push(`started_at >= @from`)
    params['from'] = toISOString(filters.from)
  }
  if (filters.to) {
    conditions.push(`started_at <= @to`)
    params['to'] = toISOString(filters.to)
  }
  if (filters.model) {
    conditions.push(`model = @model`)
    params['model'] = filters.model
  }
  if (filters.search) {
    conditions.push(`(summary LIKE @search OR project_name LIKE @search)`)
    params['search'] = `%${filters.search}%`
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0

  const rows = db
    .prepare(`SELECT * FROM sessions ${where} ORDER BY started_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset }) as Record<string, unknown>[]

  return rows.map(mapSessionRow)
}

export function sessionExistsByHash(db: Database.Database, hash: string): boolean {
  const row = db.prepare(`SELECT 1 FROM sessions WHERE log_hash = ?`).get(hash) as unknown | undefined
  return row !== undefined
}

export function updateSessionHash(db: Database.Database, logPath: string, hash: string): void {
  db.prepare(`UPDATE sessions SET log_hash = ? WHERE raw_log_path = ?`).run(hash, logPath)
}

// ── Steps ──────────────────────────────────────────────────────────

export function insertStep(db: Database.Database, step: Step): void {
  db.prepare(`
    INSERT INTO steps (
      id, session_id, step_index, type, subtype,
      content, content_summary, tokens_in, tokens_out, duration_ms,
      tool_name, tool_input, tool_output,
      is_error, is_retry, retry_of_step_id, created_at
    ) VALUES (
      @id, @sessionId, @stepIndex, @type, @subtype,
      @content, @contentSummary, @tokensIn, @tokensOut, @durationMs,
      @toolName, @toolInput, @toolOutput,
      @isError, @isRetry, @retryOfStepId, @createdAt
    )
  `).run({
    id: step.id,
    sessionId: step.sessionId,
    stepIndex: step.stepIndex,
    type: step.type,
    subtype: step.subtype,
    content: step.content,
    contentSummary: step.contentSummary,
    tokensIn: step.tokensIn,
    tokensOut: step.tokensOut,
    durationMs: step.durationMs,
    toolName: step.toolName,
    toolInput: step.toolInput,
    toolOutput: step.toolOutput,
    isError: step.isError ? 1 : 0,
    isRetry: step.isRetry ? 1 : 0,
    retryOfStepId: step.retryOfStepId,
    createdAt: toISOString(step.createdAt),
  })
}

export function listStepsBySession(db: Database.Database, sessionId: string): Step[] {
  const rows = db
    .prepare(`SELECT * FROM steps WHERE session_id = ? ORDER BY step_index ASC`)
    .all(sessionId) as Record<string, unknown>[]
  return rows.map(mapStepRow)
}

// ── FileImpacts ────────────────────────────────────────────────────

export function insertFileImpact(db: Database.Database, impact: FileImpact): void {
  db.prepare(`
    INSERT INTO file_impacts (
      session_id, step_id, file_path, action,
      lines_added, lines_removed, diff_content, created_at
    ) VALUES (
      @sessionId, @stepId, @filePath, @action,
      @linesAdded, @linesRemoved, @diffContent, @createdAt
    )
  `).run({
    sessionId: impact.sessionId,
    stepId: impact.stepId,
    filePath: impact.filePath,
    action: impact.action,
    linesAdded: impact.linesAdded,
    linesRemoved: impact.linesRemoved,
    diffContent: impact.diffContent,
    createdAt: toISOString(impact.createdAt),
  })
}

export function listFileImpactsBySession(db: Database.Database, sessionId: string): FileImpact[] {
  const rows = db
    .prepare(`SELECT * FROM file_impacts WHERE session_id = ? ORDER BY created_at ASC`)
    .all(sessionId) as Record<string, unknown>[]
  return rows.map(mapFileImpactRow)
}

// ── Projects ───────────────────────────────────────────────────────

export function upsertProject(db: Database.Database, project: Project): void {
  db.prepare(`
    INSERT INTO projects (
      path, name, total_sessions, total_tokens, total_cost_usd,
      first_session_at, last_session_at, claude_md_path, updated_at
    ) VALUES (
      @path, @name, @totalSessions, @totalTokens, @totalCostUsd,
      @firstSessionAt, @lastSessionAt, @claudeMdPath, @updatedAt
    )
    ON CONFLICT(path) DO UPDATE SET
      name = excluded.name,
      total_sessions = excluded.total_sessions,
      total_tokens = excluded.total_tokens,
      total_cost_usd = excluded.total_cost_usd,
      first_session_at = excluded.first_session_at,
      last_session_at = excluded.last_session_at,
      claude_md_path = excluded.claude_md_path,
      updated_at = excluded.updated_at
  `).run({
    path: project.path,
    name: project.name,
    totalSessions: project.totalSessions,
    totalTokens: project.totalTokens,
    totalCostUsd: project.totalCostUsd,
    firstSessionAt: project.firstSessionAt ? toISOString(project.firstSessionAt) : null,
    lastSessionAt: project.lastSessionAt ? toISOString(project.lastSessionAt) : null,
    claudeMdPath: project.claudeMdPath,
    updatedAt: toISOString(project.updatedAt),
  })
}

export function listProjects(db: Database.Database): Project[] {
  const rows = db
    .prepare(`
      SELECT
        p.path,
        p.name,
        p.first_session_at,
        p.last_session_at,
        p.claude_md_path,
        p.updated_at,
        COUNT(s.id) as total_sessions,
        COALESCE(SUM(s.total_tokens_in + s.total_tokens_out), 0) as total_tokens,
        COALESCE(SUM(s.total_cost_usd), 0) as total_cost_usd
      FROM projects p
      LEFT JOIN sessions s ON s.project_path = p.path
      GROUP BY p.path
      ORDER BY p.last_session_at DESC
    `)
    .all() as Record<string, unknown>[]
  return rows.map(mapProjectRow)
}

export function getProjectStats(db: Database.Database, projectPath: string): ProjectStats {
  const row = db.prepare(`
    SELECT
      COUNT(*) as total_sessions,
      COALESCE(SUM(total_tokens_in + total_tokens_out), 0) as total_tokens,
      COALESCE(SUM(total_cost_usd), 0) as total_cost,
      MAX(started_at) as last_session_at
    FROM sessions
    WHERE project_path = ?
  `).get(projectPath) as Record<string, unknown>

  return {
    totalSessions: (row['total_sessions'] as number) ?? 0,
    totalTokens: (row['total_tokens'] as number) ?? 0,
    totalCost: (row['total_cost'] as number) ?? 0,
    lastSessionAt: toDateOrNull(row['last_session_at'] as string | null),
  }
}

// ── Analytics ──────────────────────────────────────────────────────

export function getDailyCosts(db: Database.Database, from?: Date, to?: Date): DailyCostRow[] {
  const conditions: string[] = []
  const params: Record<string, string> = {}

  if (from) {
    conditions.push(`started_at >= @from`)
    params['from'] = toISOString(from)
  }
  if (to) {
    conditions.push(`started_at <= @to`)
    params['to'] = toISOString(to)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const rows = db.prepare(`
    SELECT
      DATE(started_at) as day,
      COUNT(*) as sessions,
      SUM(total_tokens_in + total_tokens_out) as total_tokens,
      SUM(total_cost_usd) as total_cost,
      AVG(duration_seconds) as avg_session_duration
    FROM sessions
    ${where}
    GROUP BY DATE(started_at)
    ORDER BY day DESC
  `).all(params) as Record<string, unknown>[]

  return rows.map((row) => ({
    day: row['day'] as string,
    sessions: row['sessions'] as number,
    totalTokens: (row['total_tokens'] as number) ?? 0,
    totalCost: (row['total_cost'] as number) ?? 0,
    avgSessionDuration: (row['avg_session_duration'] as number) ?? 0,
  }))
}

export function getFileHotspots(db: Database.Database, options?: HotspotOptions): FileHotspotRow[] {
  const conditions: string[] = []
  const params: Record<string, unknown> = {}

  if (options?.project) {
    conditions.push(`s.project_name = @project`)
    params['project'] = options.project
  }

  const where = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : ''
  const limit = options?.limit ?? 50

  const rows = db.prepare(`
    SELECT
      fi.file_path,
      s.project_name,
      COUNT(*) as total_touches,
      SUM(fi.lines_added) as total_lines_added,
      SUM(fi.lines_removed) as total_lines_removed,
      COUNT(DISTINCT fi.session_id) as sessions_involved
    FROM file_impacts fi
    JOIN sessions s ON fi.session_id = s.id
    WHERE fi.action IN ('create', 'edit', 'delete') ${where}
    GROUP BY fi.file_path, s.project_name
    ORDER BY total_touches DESC
    LIMIT @limit
  `).all({ ...params, limit }) as Record<string, unknown>[]

  return rows.map((row) => ({
    filePath: row['file_path'] as string,
    projectName: (row['project_name'] as string) ?? '',
    totalTouches: row['total_touches'] as number,
    totalLinesAdded: (row['total_lines_added'] as number) ?? 0,
    totalLinesRemoved: (row['total_lines_removed'] as number) ?? 0,
    sessionsInvolved: row['sessions_involved'] as number,
  }))
}

export function getOverviewStats(db: Database.Database, from?: Date, to?: Date): OverviewStats {
  const conditions: string[] = []
  const params: Record<string, string> = {}

  if (from) {
    conditions.push(`s.started_at >= @from`)
    params['from'] = toISOString(from)
  }
  if (to) {
    conditions.push(`s.started_at <= @to`)
    params['to'] = toISOString(to)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const row = db.prepare(`
    SELECT
      COUNT(*) as total_sessions,
      COALESCE(SUM(s.total_tokens_in), 0) as total_tokens_in,
      COALESCE(SUM(s.total_tokens_out), 0) as total_tokens_out,
      COALESCE(SUM(s.total_cost_usd), 0) as total_cost_usd,
      COALESCE(AVG(s.duration_seconds), 0) as avg_session_duration,
      COALESCE(SUM(s.error_count), 0) as total_errors,
      COALESCE(SUM(s.total_steps), 0) as total_steps_sum
    FROM sessions s
    ${where}
  `).get(params) as Record<string, unknown>

  const filesRow = db.prepare(`
    SELECT COUNT(DISTINCT fi.file_path) as unique_files
    FROM file_impacts fi
    JOIN sessions s ON fi.session_id = s.id
    ${where}
  `).get(params) as Record<string, unknown>

  const topProjectRow = db.prepare(`
    SELECT project_name, COUNT(*) as cnt
    FROM sessions s
    ${where}
    ${where ? 'AND' : 'WHERE'} project_name IS NOT NULL
    GROUP BY project_name
    ORDER BY cnt DESC
    LIMIT 1
  `).get(params) as Record<string, unknown> | undefined

  const totalStepsSum = (row['total_steps_sum'] as number) ?? 0
  const totalErrors = (row['total_errors'] as number) ?? 0

  return {
    totalSessions: (row['total_sessions'] as number) ?? 0,
    totalTokensIn: (row['total_tokens_in'] as number) ?? 0,
    totalTokensOut: (row['total_tokens_out'] as number) ?? 0,
    totalCostUsd: (row['total_cost_usd'] as number) ?? 0,
    avgSessionDuration: (row['avg_session_duration'] as number) ?? 0,
    uniqueFilesTouched: (filesRow['unique_files'] as number) ?? 0,
    errorRate: totalStepsSum > 0 ? totalErrors / totalStepsSum : 0,
    topProject: topProjectRow ? (topProjectRow['project_name'] as string) : null,
  }
}
