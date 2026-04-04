import fp from 'fastify-plugin'
import { openDatabase, type Database } from '@ccview/core'

declare module 'fastify' {
  interface FastifyInstance {
    db: Database.Database
  }
}

export default fp(async (fastify) => {
  const db = openDatabase()
  fastify.decorate('db', db)
  fastify.addHook('onClose', () => db.close())
})
