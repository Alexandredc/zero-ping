import "@/server/env"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import type { PgliteDatabase } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import { acquireLock } from "./lock"
import * as schema from "./schema"
import { DEMO_DATA_DIR, isDemo } from "@/server/demo/mode"

export type Database = PgliteDatabase & { $client: PGlite }

const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle")

export async function createDatabase(dataDir?: string): Promise<Database> {
  if (!dataDir) return openDatabase(new PGlite())
  await mkdir(dataDir, { recursive: true })
  const release = acquireLock(`${dataDir}.lock`)
  process.once("exit", release)
  try {
    return await openDatabase(new PGlite(dataDir))
  } catch (error) {
    release()
    throw error
  }
}

async function openDatabase(client: PGlite): Promise<Database> {
  const db: Database = drizzle({ client })
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
  return db
}

const globalForDb = globalThis as unknown as {
  __githubInboxDb?: Promise<Database>
}

/**
 * A PGlite data directory can only be opened by one instance, so the database
 * is kept on globalThis to survive Vite hot reloads.
 */
export function getDb(): Promise<Database> {
  globalForDb.__githubInboxDb ??= createDatabase(
    process.env.DATA_DIR ??
      path.resolve(process.cwd(), isDemo() ? DEMO_DATA_DIR : ".data/pglite")
  )
    .then((db) => {
      closeOnExit(db)
      return db
    })
    .catch((error: unknown) => {
      globalForDb.__githubInboxDb = undefined
      throw error
    })
  return globalForDb.__githubInboxDb
}

/** Closes PGlite before exiting so a stop never interrupts a write to disk. */
function closeOnExit(db: Database) {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void db.$client.close().finally(() => process.exit(0))
    })
  }
}

export { schema }
