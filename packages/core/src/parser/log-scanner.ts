import { readdir, stat, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { ScanOptions, ScanResult, ScanError } from '../types.js'
import { parseSession } from './session-parser.js'
import { estimateCost } from './token-estimator.js'
import { DEFAULT_PRICING } from '../types.js'

interface SessionFileInfo {
  filePath: string
  hash: string
  projectSlug: string
  sessionId: string
}

interface SessionMeta {
  session_id: string
  project_path: string
  start_time: string
  duration_minutes: number
  input_tokens: number
  output_tokens: number
  first_prompt: string
  tool_counts: Record<string, number>
}

async function computeFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

async function findSessionFiles(
  projectsDir: string,
): Promise<SessionFileInfo[]> {
  const results: SessionFileInfo[] = []

  let projectDirs: string[]
  try {
    projectDirs = await readdir(projectsDir)
  } catch {
    return results
  }

  for (const projectSlug of projectDirs) {
    const projectPath = join(projectsDir, projectSlug)
    let projectStat
    try {
      projectStat = await stat(projectPath)
    } catch {
      continue
    }
    if (!projectStat.isDirectory()) continue

    let entries: string[]
    try {
      entries = await readdir(projectPath)
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.endsWith('.jsonl')) continue
      // Session ID is the filename without .jsonl
      const sessionId = entry.slice(0, -6)
      // Validate it looks like a UUID
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(sessionId)) {
        continue
      }

      const filePath = join(projectPath, entry)
      const hash = await computeFileHash(filePath)

      results.push({ filePath, hash, projectSlug, sessionId })
    }
  }

  return results
}

async function loadSessionMeta(
  claudePath: string,
  sessionId: string,
): Promise<SessionMeta | null> {
  const metaPath = join(claudePath, 'usage-data', 'session-meta', `${sessionId}.json`)
  try {
    const content = await readFile(metaPath, 'utf-8')
    return JSON.parse(content) as SessionMeta
  } catch {
    return null
  }
}

export async function scanClaudeDirectory(
  options: ScanOptions = {},
): Promise<ScanResult> {
  const claudePath = options.claudePath ?? join(homedir(), '.claude')
  const projectsDir = join(claudePath, 'projects')

  const errors: ScanError[] = []
  let sessionsFound = 0
  let newSessions = 0
  let skippedSessions = 0

  const sessionFiles = await findSessionFiles(projectsDir)
  sessionsFound = sessionFiles.length

  const total = sessionFiles.length

  for (let i = 0; i < sessionFiles.length; i++) {
    const file = sessionFiles[i]!
    options.onProgress?.(i + 1, total)

    try {
      // Try fast path first
      const meta = await loadSessionMeta(claudePath, file.sessionId)
      if (meta && !options.forceRescan) {
        // Session meta exists — we could use pre-aggregated data
        // For now we still parse the full JSONL for complete step data
        // but this is where incremental scanning would skip unchanged files
      }

      const parsed = await parseSession(file.filePath)

      // Apply cost estimation
      if (parsed.session.model) {
        const pricing = DEFAULT_PRICING[parsed.session.model]
        parsed.session.totalCostUsd = estimateCost(
          parsed.session.totalTokensIn,
          parsed.session.totalTokensOut,
          pricing,
        )
      }

      newSessions++
    } catch (err) {
      errors.push({
        filePath: file.filePath,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return {
    sessionsFound,
    newSessions,
    skippedSessions,
    errors,
  }
}

export { findSessionFiles, loadSessionMeta, computeFileHash }
export type { SessionFileInfo, SessionMeta }
