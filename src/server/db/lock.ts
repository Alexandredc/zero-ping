import { readFileSync, rmSync, writeFileSync } from "node:fs"

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
 */
export function acquireLock(
  lockPath: string,
  pid: number = process.pid
): () => void {
  try {
    writeFileSync(lockPath, String(pid), { flag: "wx" })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
    const owner = Number(readFileSync(lockPath, "utf8"))
    if (owner && owner !== pid && isAlive(owner)) {
      throw new Error(
        `La base locale est déjà ouverte par une autre instance de l'app (PID ${owner}). Arrête-la (inbox stop, ou Ctrl+C dans son terminal) avant d'en lancer une autre.`
      )
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
