import type { FastifyPluginAsync } from 'fastify'
import { getDailyCosts, getFileHotspots, getOverviewStats } from '@ccview/core'

const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/analytics/tokens — split in/out per giorno
  fastify.get<{
    Querystring: { from?: string; to?: string; groupBy?: string }
  }>('/analytics/tokens', async (request) => {
    const { from, to } = request.query
    const conditions: string[] = []
    const params: Record<string, string> = {}
    if (from) { conditions.push(`started_at >= @from`); params['from'] = from }
    if (to)   { conditions.push(`started_at <= @to`);   params['to']   = to + 'T23:59:59' }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const rows = fastify.db.prepare(`
      SELECT
        DATE(started_at) as day,
        SUM(total_tokens_in)  as tokensIn,
        SUM(total_tokens_out) as tokensOut,
        COUNT(*) as sessions
      FROM sessions
      ${where}
      GROUP BY DATE(started_at)
      ORDER BY day ASC
    `).all(params) as { day: string; tokensIn: number; tokensOut: number; sessions: number }[]
    return { data: rows }
  })

  // GET /api/analytics/costs
  fastify.get<{
    Querystring: { from?: string; to?: string; groupBy?: string }
  }>('/analytics/costs', async (request) => {
    const { from, to } = request.query
    const data = getDailyCosts(
      fastify.db,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    )
    return { data }
  })

  // GET /api/analytics/files
  fastify.get<{
    Querystring: { project?: string; limit?: string }
  }>('/analytics/files', async (request) => {
    const { project, limit } = request.query
    const opts: Parameters<typeof getFileHotspots>[1] = {}
    if (project) opts.project = project
    if (limit) opts.limit = parseInt(limit, 10)
    const data = getFileHotspots(fastify.db, opts)
    return { data }
  })

  // GET /api/insights — placeholder
  fastify.get('/insights', async () => {
    return { data: [] }
  })

  // GET /api/stats/overview
  fastify.get<{
    Querystring: { from?: string; to?: string }
  }>('/stats/overview', async (request) => {
    const { from, to } = request.query
    const data = getOverviewStats(
      fastify.db,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    )
    return { data }
  })
}

export default analyticsRoutes
