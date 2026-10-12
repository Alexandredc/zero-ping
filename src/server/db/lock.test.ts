import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { acquireLock } from "./lock"

const lockFile = () =>
  path.join(mkdtempSync(path.join(tmpdir(), "lock-")), "pglite.lock")

describe("acquireLock", () => {
  it("records the owner and releases the lock", () => {
    const file = lockFile()
    const release = acquireLock(file, process.pid)
    expect(readFileSync(file, "utf8")).toBe(String(process.pid))
    release()
    expect(existsSync(file)).toBe(false)
  })

  it("refuses a database already opened by a live process", () => {
    const file = lockFile()
    // The parent process is alive for the whole test run.
    writeFileSync(file, String(process.ppid))
    expect(() => acquireLock(file, process.pid)).toThrow(`PID ${process.ppid}`)
  })

  it("takes over a lock left by a dead process", () => {
    const file = lockFile()
    writeFileSync(file, "999999")
    acquireLock(file, process.pid)
    expect(readFileSync(file, "utf8")).toBe(String(process.pid))
  })

  it("lets the owning process reopen its own database", () => {
    const file = lockFile()
    acquireLock(file, process.pid)
    expect(() => acquireLock(file, process.pid)).not.toThrow()
  })
})
