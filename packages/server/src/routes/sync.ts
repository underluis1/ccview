import type { FastifyPluginAsync } from 'fastify'
import { join } from 'node:path'
import { homedir } from 'node:os'
import {
  findSessionFiles,
  parseSession,
  indexSession,
  estimateCost,
} from '@ccview/core'
import { DEFAULT_PRICING } from '@ccview/core'

interface SyncResult {
  added: number
  updated: number
  skipped: number
  errors: Array<{ filePath: string; error: string }>
}

const syncRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/sync', async (_request, _reply) => {
    const db = fastify.db
    const projectsDir = join(homedir(), '.claude', 'projects')

    // Mappa logPath -> log_hash delle sessioni già indicizzate
    const existing = db
      .prepare(`SELECT raw_log_path, log_hash FROM sessions WHERE raw_log_path IS NOT NULL`)
      .all() as Array<{ raw_log_path: string; log_hash: string | null }>
    const existingMap = new Map(existing.map((r) => [r.raw_log_path, r.log_hash]))

    const sessionFiles = await findSessionFiles(projectsDir)

    const result: SyncResult = { added: 0, updated: 0, skipped: 0, errors: [] }

    for (const file of sessionFiles) {
      const existingHash = existingMap.get(file.filePath)

      if (existingHash === file.hash) {
        result.skipped++
        continue
      }

      const isUpdate = existingMap.has(file.filePath)

      try {
        if (isUpdate) {
          db.prepare(`DELETE FROM sessions WHERE raw_log_path = ?`).run(file.filePath)
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

        if (isUpdate) result.updated++
        else result.added++
      } catch (err) {
        result.errors.push({
          filePath: file.filePath,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return { data: result }
  })
}

export default syncRoutes
