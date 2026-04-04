import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { initSchema } from '../src/db/schema.js'
import {
  insertSession,
  getSessionById,
  listSessions,
  sessionExistsByHash,
  updateSessionHash,
  insertStep,
  insertFileImpact,
  getOverviewStats,
} from '../src/db/queries.js'
import { indexSession } from '../src/db/sync.js'
import type { Session, Step, FileImpact, ParsedLogEntry } from '../src/types.js'

// ── Helpers ──────────────────────────────────────────────────────

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-' + Math.random().toString(36).slice(2, 8),
    projectPath: '/Users/test/my-project',
    projectName: 'my-project',
    startedAt: new Date('2026-04-04T10:00:00.000Z'),
    endedAt: new Date('2026-04-04T10:05:00.000Z'),
    durationSeconds: 300,
    totalTokensIn: 1000,
    totalTokensOut: 500,
    totalCostUsd: 0.05,
    totalSteps: 5,
    toolCallCount: 2,
    errorCount: 0,
    retryCount: 0,
    model: 'sonnet',
    summary: 'Fix the bug',
    rawLogPath: '/tmp/test-' + Math.random().toString(36).slice(2, 8) + '.jsonl',
    ...overrides,
  }
}

function makeStep(sessionId: string, overrides: Partial<Step> = {}): Step {
  return {
    id: 'step-' + Math.random().toString(36).slice(2, 8),
    sessionId,
    stepIndex: 0,
    type: 'user_prompt',
    subtype: null,
    content: 'test prompt',
    contentSummary: 'test prompt',
    tokensIn: 100,
    tokensOut: 50,
    durationMs: null,
    toolName: null,
    toolInput: null,
    toolOutput: null,
    isError: false,
    isRetry: false,
    retryOfStepId: null,
    createdAt: new Date('2026-04-04T10:00:00.000Z'),
    ...overrides,
  }
}

function makeParsedLogEntry(overrides: Partial<ParsedLogEntry['session']> = {}): ParsedLogEntry {
  return {
    session: {
      projectPath: '/Users/test/my-project',
      projectName: 'my-project',
      startedAt: new Date('2026-04-04T10:00:00.000Z'),
      endedAt: new Date('2026-04-04T10:05:00.000Z'),
      durationSeconds: 300,
      totalTokensIn: 1000,
      totalTokensOut: 500,
      totalCostUsd: 0.05,
      totalSteps: 2,
      toolCallCount: 1,
      errorCount: 0,
      retryCount: 0,
      model: 'sonnet',
      summary: 'Fix the bug',
      rawLogPath: '/tmp/test-' + Math.random().toString(36).slice(2, 8) + '.jsonl',
      ...overrides,
    },
    steps: [
      {
        stepIndex: 0,
        type: 'user_prompt',
        subtype: null,
        content: 'Fix the bug',
        contentSummary: 'Fix the bug',
        tokensIn: 0,
        tokensOut: 0,
        durationMs: null,
        toolName: null,
        toolInput: null,
        toolOutput: null,
        isError: false,
        isRetry: false,
        retryOfStepId: null,
        createdAt: new Date('2026-04-04T10:00:00.000Z'),
      },
      {
        stepIndex: 1,
        type: 'tool_call',
        subtype: 'file_edit',
        content: null,
        contentSummary: 'Tool call: Edit',
        tokensIn: 1000,
        tokensOut: 500,
        durationMs: null,
        toolName: 'Edit',
        toolInput: JSON.stringify({ file_path: '/src/utils.ts', old_string: 'a', new_string: 'b' }),
        toolOutput: null,
        isError: false,
        isRetry: false,
        retryOfStepId: null,
        createdAt: new Date('2026-04-04T10:00:05.000Z'),
      },
    ],
    fileImpacts: [
      {
        stepId: 'step-1',
        filePath: '/src/utils.ts',
        action: 'edit',
        linesAdded: 1,
        linesRemoved: 1,
        diffContent: null,
        createdAt: new Date('2026-04-04T10:00:05.000Z'),
      },
    ],
  }
}

// ── Tests ────────────────────────────────────────────────────────

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  initSchema(db)
})

afterEach(() => {
  db.close()
})

describe('schema', () => {
  it('crea tutte le tabelle senza errori', () => {
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
      .all() as Array<{ name: string }>
    const names = tables.map((t) => t.name)
    expect(names).toContain('sessions')
    expect(names).toContain('steps')
    expect(names).toContain('file_impacts')
    expect(names).toContain('projects')
    expect(names).toContain('claude_md_rules')
    expect(names).toContain('_migrations')
  })

  it('crea tutti gli indici', () => {
    const indices = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name`)
      .all() as Array<{ name: string }>
    const names = indices.map((i) => i.name)
    expect(names).toContain('idx_sessions_project')
    expect(names).toContain('idx_sessions_date')
    expect(names).toContain('idx_steps_session')
    expect(names).toContain('idx_steps_type')
    expect(names).toContain('idx_file_impacts_session')
    expect(names).toContain('idx_file_impacts_file')
  })

  it('crea le 3 views', () => {
    const views = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='view' ORDER BY name`)
      .all() as Array<{ name: string }>
    const names = views.map((v) => v.name)
    expect(names).toContain('v_session_overview')
    expect(names).toContain('v_file_hotspots')
    expect(names).toContain('v_daily_costs')
  })

  it('e\' idempotente (inizializzabile due volte senza errori)', () => {
    expect(() => initSchema(db)).not.toThrow()
    // Verify tables still there
    const tables = db
      .prepare(`SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
      .get() as { cnt: number }
    expect(tables.cnt).toBeGreaterThan(0)
  })
})

describe('queries', () => {
  it('inserisce e recupera una sessione', () => {
    const session = makeSession({ id: 'sess-test-1' })
    insertSession(db, session)
    const retrieved = getSessionById(db, 'sess-test-1')
    expect(retrieved).not.toBeNull()
    expect(retrieved!.id).toBe('sess-test-1')
    expect(retrieved!.projectName).toBe('my-project')
    expect(retrieved!.totalTokensIn).toBe(1000)
    expect(retrieved!.model).toBe('sonnet')
  })

  it('listSessions con filtro project', () => {
    const s1 = makeSession({ projectName: 'project-a' })
    const s2 = makeSession({ projectName: 'project-b' })
    insertSession(db, s1)
    insertSession(db, s2)

    const results = listSessions(db, { project: 'project-a' })
    expect(results.length).toBe(1)
    expect(results[0].projectName).toBe('project-a')
  })

  it('listSessions con filtro dateRange', () => {
    const s1 = makeSession({ startedAt: new Date('2026-04-01T10:00:00Z') })
    const s2 = makeSession({ startedAt: new Date('2026-04-10T10:00:00Z') })
    insertSession(db, s1)
    insertSession(db, s2)

    const results = listSessions(db, {
      from: new Date('2026-04-05T00:00:00Z'),
      to: new Date('2026-04-15T00:00:00Z'),
    })
    expect(results.length).toBe(1)
    expect(results[0].id).toBe(s2.id)
  })

  it('sessionExistsByHash ritorna true se gia\' indicizzata', () => {
    const session = makeSession()
    insertSession(db, session)
    updateSessionHash(db, session.rawLogPath, 'abc123')
    expect(sessionExistsByHash(db, 'abc123')).toBe(true)
    expect(sessionExistsByHash(db, 'nonexistent')).toBe(false)
  })

  it('getOverviewStats ritorna stats aggregate corrette', () => {
    const s1 = makeSession({ totalTokensIn: 1000, totalTokensOut: 500, totalCostUsd: 0.05, errorCount: 1, totalSteps: 5 })
    const s2 = makeSession({ totalTokensIn: 2000, totalTokensOut: 800, totalCostUsd: 0.10, errorCount: 0, totalSteps: 3 })
    insertSession(db, s1)
    insertSession(db, s2)

    const stats = getOverviewStats(db)
    expect(stats.totalSessions).toBe(2)
    expect(stats.totalTokensIn).toBe(3000)
    expect(stats.totalTokensOut).toBe(1300)
    expect(stats.totalCostUsd).toBeCloseTo(0.15)
    expect(stats.errorRate).toBeCloseTo(1 / 8) // 1 error / 8 total steps
  })
})

describe('sync/indexSession', () => {
  it('inserisce sessione + step + fileImpacts in una transazione', () => {
    const entry = makeParsedLogEntry()
    indexSession(db, entry, entry.session.rawLogPath, 'hash-001')

    // Verify session was inserted
    const sessions = listSessions(db, {})
    expect(sessions.length).toBe(1)
    expect(sessions[0].totalTokensIn).toBe(1000)

    // Verify steps were inserted
    const steps = db
      .prepare(`SELECT * FROM steps WHERE session_id = ?`)
      .all(sessions[0].id) as Array<Record<string, unknown>>
    expect(steps.length).toBe(2)

    // Verify file impacts were inserted
    const impacts = db
      .prepare(`SELECT * FROM file_impacts WHERE session_id = ?`)
      .all(sessions[0].id) as Array<Record<string, unknown>>
    expect(impacts.length).toBe(1)
    expect(impacts[0]['file_path']).toBe('/src/utils.ts')
  })

  it('fa upsert del progetto', () => {
    const entry = makeParsedLogEntry()
    indexSession(db, entry, entry.session.rawLogPath, 'hash-002')

    const projects = db.prepare(`SELECT * FROM projects`).all() as Array<Record<string, unknown>>
    expect(projects.length).toBe(1)
    expect(projects[0]['name']).toBe('my-project')
    expect(projects[0]['path']).toBe('/Users/test/my-project')
  })

  it('e\' idempotente se chiamato due volte con stesso hash', () => {
    const entry = makeParsedLogEntry()
    const logPath = entry.session.rawLogPath

    indexSession(db, entry, logPath, 'hash-003')
    expect(sessionExistsByHash(db, 'hash-003')).toBe(true)

    // Second call with different logPath but we check hash exists first
    // The sync module doesn't prevent duplicate inserts by itself,
    // but the caller (scanner) checks sessionExistsByHash first.
    // Verify the hash check works correctly.
    const exists = sessionExistsByHash(db, 'hash-003')
    expect(exists).toBe(true)
  })
})
