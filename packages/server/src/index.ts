import Fastify from 'fastify'
import cors from '@fastify/cors'
import staticFiles from '@fastify/static'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import dbPlugin from './plugins/db.js'
import sessionsRoutes from './routes/sessions.js'
import projectsRoutes from './routes/projects.js'
import analyticsRoutes from './routes/analytics.js'
import configRoutes from './routes/config.js'

const DEFAULT_PORT = 3200

export async function createServer(port = DEFAULT_PORT) {
  const fastify = Fastify({ logger: false })

  await fastify.register(cors, { origin: ['http://localhost:5173', 'http://localhost:3200'] })
  await fastify.register(dbPlugin)
  await fastify.register(sessionsRoutes, { prefix: '/api' })
  await fastify.register(projectsRoutes, { prefix: '/api' })
  await fastify.register(analyticsRoutes, { prefix: '/api' })
  await fastify.register(configRoutes, { prefix: '/api' })

  // Serve la React app buildata (se esiste)
  // In npm package: web-dist/ è dentro @ccview/server/
  // In monorepo dev:  packages/web/dist/
  const serverDir = path.dirname(fileURLToPath(import.meta.url))
  const webDistNpm = path.join(serverDir, '../web-dist')
  const webDistDev = path.join(serverDir, '../../web/dist')
  const webDistPath = fs.existsSync(webDistNpm) ? webDistNpm : webDistDev
  if (fs.existsSync(webDistPath)) {
    await fastify.register(staticFiles, { root: webDistPath, prefix: '/' })
    fastify.setNotFoundHandler((req, reply) => {
      void reply.sendFile('index.html')
    })
  }

  return fastify
}

// Entry point diretto
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = parseInt(process.env['PORT'] ?? String(DEFAULT_PORT))
  const server = await createServer(port)
  await server.listen({ port, host: '127.0.0.1' })
  console.log(`ccview server running at http://localhost:${port}`)
}
