import { Button } from "@/components/ui/button"
import type { PushConfirmation } from "@/models/localGit"
import {
  getGitHubPushStatus,
  pullFromGitHub,
  pushToGitHub
} from "@/services/githubMessaging"
import { readN8nWorkflow } from "@/services/localGitMessaging"
import { useEffect, useState } from "react"

import "@/styles/globals.css"

type PushPanelProps = {
  refreshKey?: number
  onReconnect?: () => void
  workflowId?: string
  onPulled?: () => void
}

export function PushPanel({
  refreshKey = 0,
  onReconnect,
  workflowId,
  onPulled
}: PushPanelProps) {
  const [status, setStatus] =
    useState<Awaited<ReturnType<typeof getGitHubPushStatus>>["pushStatus"]>(
      undefined
    )
  const [confirmation, setConfirmation] = useState<PushConfirmation | null>(
    null
  )
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<string[]>([])
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
    setConflicts([])
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

  const pull = () => {
    setWorking(true)
    setError(null)
    setConflicts([])
    setNotice(null)
    const request = workflowId
      ? readN8nWorkflow(workflowId).then((response) => {
          if (!response.ok) {
            throw new Error(
              response.error ?? "Unable to read the current workflow."
            )
          }
          return pullFromGitHub({
            workflowId,
            workflow: response.workflow
          })
        })
      : pullFromGitHub()
    void request
      .then((response) => {
        if (!response.ok) {
          if (response.code === "MERGE_CONFLICT") {
            setConflicts(response.conflicts ?? [])
            setError("Pull stopped because of merge conflicts. Resolve them, then commit the merge.")
          } else if (response.code === "LOCAL_CHANGES") {
            setError(
              response.error ??
                "Pull could not be completed. Commit or stash your local changes before pulling."
            )
          } else {
            setError(response.error ?? "Pull failed.")
          }
          return
        }
        const result = response.pullResult
        if (result?.status === "up-to-date") {
          setNotice("Already up to date.")
        } else if (result?.status === "merged") {
          setNotice(
            `Pull completed successfully. Remote changes were merged into the current branch${result.updatedFiles ? ` (${result.updatedFiles} file(s) updated)` : ""}.`
          )
        } else {
          setNotice(
            `Pull completed successfully.${result?.updatedFiles ? ` ${result.updatedFiles} file(s) updated.` : ""}`
          )
        }
        refresh()
        onPulled?.()
      })
      .catch((pullError: unknown) => {
        setError(
          pullError instanceof Error ? pullError.message : "Pull failed."
        )
      })
      .finally(() => setWorking(false))
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
      <div className="grid grid-cols-2 gap-2">
        <Button
          disabled={!status?.linked || working || Boolean(confirmation)}
          onClick={pull}
          type="button"
          variant="outline">
          {working ? "Pulling…" : "Pull"}
        </Button>
        <Button
          disabled={
            !status?.linked ||
            status.ahead === 0 ||
            working ||
            Boolean(confirmation)
          }
          onClick={() => push()}
          type="button">
          {working ? "Working…" : "Push"}
        </Button>
      </div>
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
      {conflicts.length > 0 && (
        <div
          aria-live="assertive"
          className="rounded-md border border-error/40 bg-error/5 p-2 text-xs text-error"
          role="alert">
          <p className="font-medium">Conflicted files:</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 break-all">
            {conflicts.map((file) => <li key={file}>{file}</li>)}
          </ul>
        </div>
      )}
      {error && <p className="break-words text-xs text-error">{error}</p>}
    </section>
  )
}
