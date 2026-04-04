import type { FastifyPluginAsync } from 'fastify'
import { listProjects, getProjectStats } from '@ccview/core'
import type Database from 'better-sqlite3'

function findProjectPathByName(db: Database.Database, name: string): string | null {
  const row = db.prepare(`SELECT path FROM projects WHERE name = ? LIMIT 1`).get(name) as { path: string } | undefined
  return row?.path ?? null
}

interface ModelBreakdownRow {
  project_path: string
  model: string
  tokensIn: number
  tokensOut: number
  costUsd: number
}

const projectsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/projects
  fastify.get('/projects', async () => {
    const projects = listProjects(fastify.db)

    // Breakdown per modello per ogni progetto
    const breakdownRows = fastify.db.prepare(`
      SELECT
        project_path,
        COALESCE(model, 'unknown') as model,
        SUM(total_tokens_in)  as tokensIn,
        SUM(total_tokens_out) as tokensOut,
        SUM(total_cost_usd)   as costUsd
      FROM sessions
      WHERE project_path IS NOT NULL
      GROUP BY project_path, model
    `).all() as ModelBreakdownRow[]

    // Indicizza per project_path
    const breakdownMap = new Map<string, { model: string; tokensIn: number; tokensOut: number; costUsd: number }[]>()
    for (const row of breakdownRows) {
      const list = breakdownMap.get(row.project_path) ?? []
      list.push({ model: row.model, tokensIn: row.tokensIn, tokensOut: row.tokensOut, costUsd: row.costUsd })
      breakdownMap.set(row.project_path, list)
    }

    const enriched = projects.map((p: any) => ({
      ...p,
      modelBreakdown: breakdownMap.get(p.path) ?? [],
    }))

    return { data: enriched }
  })

  // GET /api/projects/:name/stats
  fastify.get<{
    Params: { name: string }
  }>('/projects/:name/stats', async (request, reply) => {
    const projectPath = findProjectPathByName(fastify.db, request.params.name)
    if (!projectPath) {
      return reply.code(404).send({ error: 'Project not found' })
    }
    const stats = getProjectStats(fastify.db, projectPath)
    return { data: stats }
  })
}

export default projectsRoutes
