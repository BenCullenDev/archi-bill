import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Add it to your environment to connect to Supabase.')
}

const useSSL = connectionString.includes('supabase.co')

declare global {
  // eslint-disable-next-line no-var
  var __drizzle: NodePgDatabase<typeof schema> | undefined
  // eslint-disable-next-line no-var
  var __drizzlePool: Pool | undefined
}

const pool = globalThis.__drizzlePool ?? new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
})

const db = globalThis.__drizzle ?? drizzle(pool, { schema })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__drizzlePool = pool
  globalThis.__drizzle = db
}

export { db, pool, schema }
