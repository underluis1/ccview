import Database from 'better-sqlite3'
import { initSchema } from './schema.js'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

const DEFAULT_DB_PATH = path.join(os.homedir(), '.ccview', 'ccview.db')

export function openDatabase(dbPath = DEFAULT_DB_PATH): Database.Database {
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const tableExists = db
    .prepare<[], { cnt: number }>(
      `SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name='sessions'`
    )
    .get()

  if (!tableExists || tableExists.cnt === 0) {
    initSchema(db)
  }

  return db
}

export { Database }
export { initSchema } from './schema.js'
export { SCHEMA_SQL } from './schema.js'
export * from './queries.js'
export * from './sync.js'
