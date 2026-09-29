import type { StatusEntry } from "@/models/localGit"

type ChangeDetectorOptions = {
  refreshStatus: () => Promise<StatusEntry>
  onStatus: (status: StatusEntry) => void
  onError?: (error: unknown) => void
  intervalMs?: number
}

export function createChangeDetector({
  refreshStatus,
  onStatus,
  onError,
  intervalMs = 5000
}: ChangeDetectorOptions) {
  let timer: ReturnType<typeof globalThis.setInterval> | undefined
  let inFlight = false
  let lastHash: string | undefined
  let lastStatus: StatusEntry["status"] | undefined

  const isVisible = () =>
    typeof document === "undefined" || document.visibilityState === "visible"

  const check = async (force = false) => {
    if (inFlight || (!force && !isVisible())) return
    inFlight = true
    try {
      const next = await refreshStatus()
      if (
        force ||
        next.currentHash !== lastHash ||
        next.status !== lastStatus
      ) {
        lastHash = next.currentHash
        lastStatus = next.status
        onStatus(next)
      }
    } catch (error: unknown) {
      onError?.(error)
    } finally {
      inFlight = false
    }
  }

  const start = () => {
    stop()
    void check(true)
    timer = globalThis.setInterval(() => void check(), intervalMs)
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange)
    }
  }

  const stop = () => {
    if (timer !== undefined) globalThis.clearInterval(timer)
    timer = undefined
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }

  const handleVisibilityChange = () => {
    if (isVisible()) void check(true)
  }

  return { start, stop, refresh: () => check(true) }
}
