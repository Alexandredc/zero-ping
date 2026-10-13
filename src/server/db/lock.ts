import { readFileSync, rmSync, writeFileSync } from "node:fs"
import { DEFAULT_LANGUAGE } from "@/lib/i18n/core"
import { messagesFor } from "@/lib/i18n/messages"
import type { Messages } from "@/lib/i18n/messages"

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM: the process exists but belongs to another user.
    return (error as NodeJS.ErrnoException).code === "EPERM"
  }
}

/**
 * PGlite corrupts its data directory when two processes open it. The lock file
 * next to it records the owning process; a lock left by a dead one is taken over.
 * The chosen language lives in that very database, so the error uses the default.
 */
export function acquireLock(
  lockPath: string,
  pid: number = process.pid,
  t: Messages = messagesFor(DEFAULT_LANGUAGE)
): () => void {
  try {
    writeFileSync(lockPath, String(pid), { flag: "wx" })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
    const owner = Number(readFileSync(lockPath, "utf8"))
    if (owner && owner !== pid && isAlive(owner)) {
      throw new Error(t.server.errors.dbLocked(owner))
    }
    writeFileSync(lockPath, String(pid))
  }
  return () => {
    try {
      if (Number(readFileSync(lockPath, "utf8")) === pid) rmSync(lockPath)
    } catch {
      // Already gone.
    }
  }
}
