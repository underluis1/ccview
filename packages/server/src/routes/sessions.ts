import type { FastifyPluginAsync } from 'fastify'
import { listSessions, getSessionById, listStepsBySession, listFileImpactsBySession } from '@ccview/core'
import type { SessionFilters } from '@ccview/core'

const sessionsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/sessions
  fastify.get<{
    Querystring: {
      project?: string
      from?: string
      to?: string
      model?: string
      search?: string
      limit?: string
      offset?: string
    }
  }>('/sessions', async (request, reply) => {
    const { project, from, to, model, search, limit, offset } = request.query

    const filters: SessionFilters = {}
    if (project) filters.project = project
    if (from) filters.from = new Date(from)
    if (to) filters.to = new Date(to)
    if (model) filters.model = model
    if (search) filters.search = search
    if (limit) filters.limit = parseInt(limit, 10)
    if (offset) filters.offset = parseInt(offset, 10)

    const sessions = listSessions(fastify.db, filters)
    return { data: sessions, total: sessions.length }
  })

  // GET /api/sessions/:id
  fastify.get<{ Params: { id: string } }>('/sessions/:id', async (request, reply) => {
    const session = getSessionById(fastify.db, request.params.id)
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' })
    }
    return { data: session }
  })

  // GET /api/sessions/:id/steps
  fastify.get<{ Params: { id: string } }>('/sessions/:id/steps', async (request, reply) => {
    const session = getSessionById(fastify.db, request.params.id)
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' })
    }
    const steps = listStepsBySession(fastify.db, request.params.id)
    return { data: steps }
  })

  // GET /api/sessions/:id/files
  fastify.get<{ Params: { id: string } }>('/sessions/:id/files', async (request, reply) => {
    const session = getSessionById(fastify.db, request.params.id)
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' })
    }
    const files = listFileImpactsBySession(fastify.db, request.params.id)
    return { data: files }
  })
}

export default sessionsRoutes
