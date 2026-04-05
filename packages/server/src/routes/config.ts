import type { FastifyPluginAsync } from 'fastify'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  findSessionFiles,
  parseSession,
  indexSession,
  computeFileHash,
  sessionExistsByHash,
  listSessions,
  estimateCost,
} from '@ccview/core'

const CONFIG_DIR = path.join(os.homedir(), '.ccview')
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json')

function readConfig(): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

function writeConfig(config: Record<string, unknown>): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

const configRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/config
  fastify.get('/config', async () => {
    return { data: readConfig() }
  })

  // PUT /api/config
  fastify.put<{ Body: Record<string, unknown> }>('/config', async (request) => {
    const current = readConfig()
    const updated = { ...current, ...request.body }
    writeConfig(updated)
    return { data: updated }
  })

  // POST /api/sync
  fastify.post<{
    Body: { force?: boolean } | undefined
  }>('/sync', async (request, reply) => {
    const force = (request.body as { force?: boolean } | undefined)?.force ?? false

    try {
      const claudePath = path.join(os.homedir(), '.claude')
      const projectsDir = path.join(claudePath, 'projects')
      const sessionFiles = await findSessionFiles(projectsDir)

      let newSessions = 0
      let skipped = 0
      const errors: Array<{ filePath: string; error: string }> = []

      for (const file of sessionFiles) {
        try {
          const hash = await computeFileHash(file.filePath)
          if (!force && sessionExistsByHash(fastify.db, hash)) {
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

          indexSession(fastify.db, parsed, file.filePath, hash, force)
          newSessions++
        } catch (err) {
          errors.push({
            filePath: file.filePath,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      return {
        data: {
          sessionsFound: sessionFiles.length,
          newSessions,
          skippedSessions: skipped,
          errors,
        },
      }
    } catch (err) {
      return reply.code(500).send({
        error: 'Sync failed',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  })

  // GET /api/export
  fastify.get<{
    Querystring: { format?: string; project?: string; from?: string; to?: string }
  }>('/export', async (request, reply) => {
    const { format = 'json', project, from, to } = request.query

    const filters: Parameters<typeof listSessions>[1] = { limit: 10000 }
    if (project) filters.project = project
    if (from) filters.from = new Date(from)
    if (to) filters.to = new Date(to)
    const sessions = listSessions(fastify.db, filters)

    if (format === 'csv') {
      const header = 'id,projectName,startedAt,endedAt,durationSeconds,totalTokensIn,totalTokensOut,totalCostUsd,totalSteps,model\n'
      const rows = sessions.map((s) =>
        [
          csvEscape(s.id),
          csvEscape(s.projectName ?? ''),
          csvEscape(s.startedAt.toISOString()),
          csvEscape(s.endedAt?.toISOString() ?? ''),
          s.durationSeconds ?? '',
          s.totalTokensIn,
          s.totalTokensOut,
          s.totalCostUsd,
          s.totalSteps,
          csvEscape(s.model ?? ''),
        ].join(',')
      ).join('\n')

      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', 'attachment; filename="ccview-export.csv"')
        .send(header + rows)
    }

    return reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', 'attachment; filename="ccview-export.json"')
      .send(JSON.stringify({ data: sessions }, null, 2))
  })
}

export default configRoutes
