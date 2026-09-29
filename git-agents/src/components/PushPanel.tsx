import { Button } from "@/components/ui/button"
import type { PushConfirmation } from "@/models/localGit"
import { getGitHubPushStatus, pushToGitHub } from "@/services/githubMessaging"
import { useEffect, useState } from "react"

import "@/styles/globals.css"

type PushPanelProps = {
  refreshKey?: number
  onReconnect?: () => void
}

export function PushPanel({ refreshKey = 0, onReconnect }: PushPanelProps) {
  const [status, setStatus] =
    useState<Awaited<ReturnType<typeof getGitHubPushStatus>>["pushStatus"]>(
      undefined
    )
  const [confirmation, setConfirmation] = useState<PushConfirmation | null>(
    null
  )
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = () => {
    void getGitHubPushStatus().then((response) => {
      if (response.ok) setStatus(response.pushStatus)
      else setError(response.error ?? "Unable to read push status.")
    })
  }

  useEffect(() => {
    refresh()
  }, [refreshKey])

  const push = (options?: {
    confirmedDefaultBranch?: boolean
    confirmedOverwrite?: boolean
  }) => {
    setWorking(true)
    setError(null)
    setNotice(null)
    void pushToGitHub(options)
      .then((response) => {
        if (!response.ok) {
          if (
            response.code === "CONFIRMATION_REQUIRED" &&
            response.confirmation
          )
            setConfirmation(response.confirmation)
          else setError(response.error ?? "Push failed.")
          return
        }
        const result = response.pushResult
        setConfirmation(null)
        setNotice(
          result
            ? `${result.pushedCommits} commit(s) pushed.`
            : "Push complete."
        )
        refresh()
      })
      .finally(() => setWorking(false))
  }

  const confirm = () => {
    if (confirmation === "defaultBranch") push({ confirmedDefaultBranch: true })
    if (confirmation === "overwrite")
      push({ confirmedDefaultBranch: true, confirmedOverwrite: true })
  }

  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-foreground">Push GitHub</h2>
          {status?.linked ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              origin → {status.owner}/{status.repo} ({status.branch})
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              No GitHub remote linked.
            </p>
          )}
        </div>
        <Button onClick={refresh} size="sm" type="button" variant="outline">
          Refresh
        </Button>
      </div>
      {status?.linked && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          ↑ {status.ahead} commit(s) to push
        </p>
      )}
      {confirmation && (
        <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-2 text-xs text-foreground">
          <p>
            {confirmation === "defaultBranch"
              ? `Commits will be pushed directly to ${status?.branch}.`
              : "The file already exists on GitHub and will be overwritten."}
          </p>
          <div className="flex gap-2">
            <Button
              disabled={working}
              onClick={confirm}
              size="sm"
              type="button">
              Continue
            </Button>
            <Button
              onClick={() => setConfirmation(null)}
              size="sm"
              type="button"
              variant="outline">
              Cancel
            </Button>
          </div>
        </div>
      )}
      <Button
        className="w-full"
        disabled={
          !status?.linked ||
          status.ahead === 0 ||
          working ||
          Boolean(confirmation)
        }
        onClick={() => push()}
        type="button">
        {working ? "Pushing…" : "Push"}
      </Button>
      {error === "GitHub reconnection required." ||
      error?.includes("GitHub reconnection") ? (
        <Button
          className="w-full"
          onClick={onReconnect}
          type="button"
          variant="outline">
          Reconnect
        </Button>
      ) : null}
      {notice && <p className="break-words text-xs text-success">{notice}</p>}
      {error && <p className="break-words text-xs text-error">{error}</p>}
    </section>
  )
}
