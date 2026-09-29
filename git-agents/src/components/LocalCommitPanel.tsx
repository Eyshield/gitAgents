import { GitHubConnection } from "@/components/GitHubConnection"
import { PushPanel } from "@/components/PushPanel"
import { Button } from "@/components/ui/button"
import type { Commit, LocalGitStatus, StatusEntry } from "@/models/localGit"
import { createChangeDetector } from "@/services/changeDetector"
import {
  addLocalGit,
  commitLocalGit,
  listLocalGitCommits,
  readN8nWorkflow,
  refreshLocalGitStatus
} from "@/services/localGitMessaging"
import { useEffect, useMemo, useState } from "react"

import "@/styles/globals.css"

type LocalCommitPanelProps = {
  workflowId: string
}

const STATUS_LABELS: Record<LocalGitStatus, string> = {
  clean: "Up to date",
  modified: "Modified",
  staged: "Staged",
  "staged-outdated": "Staged outdated",
  untracked: "Untracked"
}

function errorMessage(error?: string): string {
  return error ?? "Unable to complete the local operation."
}

function shortId(id: string): string {
  return id.slice(0, 7)
}

function formatRelativeDate(timestamp: number): string {
  const elapsed = Math.max(0, Date.now() - timestamp)
  const minutes = Math.floor(elapsed / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return `${Math.floor(hours / 24)} days ago`
}

export function LocalCommitPanel({ workflowId }: LocalCommitPanelProps) {
  const [status, setStatus] = useState<StatusEntry | null>(null)
  const [commits, setCommits] = useState<Commit[]>([])
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pushRefreshKey, setPushRefreshKey] = useState(0)
  const [reconnectSignal, setReconnectSignal] = useState(0)

  const loadCommits = () => {
    void listLocalGitCommits(10).then((response) => {
      if (response.ok) setCommits(response.commits ?? [])
    })
  }

  const readCurrentWorkflow = async (): Promise<unknown> => {
    const response = await readN8nWorkflow(workflowId)
    if (!response.ok || response.workflow === undefined) {
      console.error("[GitAgent][n8n-content] n8n read failed", {
        code: response.code,
        error: response.error
      })
      throw new Error(response.error ?? "Unable to read the workflow from n8n.")
    }

    return response.workflow
  }

  const refresh = () => {
    setError(null)
    void readCurrentWorkflow()
      .then((workflow) => refreshLocalGitStatus(workflowId, workflow))
      .then((response) => {
        if (response.ok && response.status) setStatus(response.status)
        else setError(errorMessage(response.error))
        setLoading(false)
      })
      .catch((error: unknown) => {
        setError(
          error instanceof Error ? error.message : "Unable to read from n8n."
        )
        setLoading(false)
      })
  }

  useEffect(() => {
    setLoading(true)
    refresh()
    loadCommits()
    const detector = createChangeDetector({
      refreshStatus: async () => {
        const workflow = await readCurrentWorkflow()
        const response = await refreshLocalGitStatus(workflowId, workflow)
        if (!response.ok || !response.status) {
          throw new Error(errorMessage(response.error))
        }
        return response.status
      },
      onStatus: setStatus,
      onError: (detectorError) => {
        setError(
          detectorError instanceof Error
            ? detectorError.message
            : "Unable to check the n8n workflow."
        )
      }
    })
    detector.start()
    return () => detector.stop()
  }, [workflowId])

  const addEnabled = useMemo(
    () =>
      status?.status === "modified" ||
      status?.status === "untracked" ||
      status?.status === "staged-outdated",
    [status?.status]
  )

  const handleAdd = () => {
    setWorking(true)
    setError(null)
    setNotice(null)
    void readCurrentWorkflow()
      .then((workflow) => addLocalGit(workflowId, workflow))
      .then((response) => {
        if (!response.ok) {
          setError(errorMessage(response.error))
          return
        }
        setNotice("Change added to the local index.")
        refresh()
      })
      .catch((error: unknown) => {
        setError(
          error instanceof Error ? error.message : "Unable to add change."
        )
      })
      .finally(() => setWorking(false))
  }

  const handleCommit = () => {
    setWorking(true)
    setError(null)
    setNotice(null)
    setPushRefreshKey((value) => value + 1)
    void commitLocalGit(message)
      .then((response) => {
        if (!response.ok) {
          setError(errorMessage(response.error))
          return
        }
        setMessage("")
        setNotice(`Commit ${shortId(response.commit?.id ?? "")} created.`)
        refresh()
        loadCommits()
      })
      .catch((error: unknown) => {
        setError(
          error instanceof Error ? error.message : "Unable to create commit."
        )
      })
      .finally(() => setWorking(false))
  }

  const isUnsaved = workflowId.toLowerCase() === "new"

  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium text-foreground">
            Local versioning
          </h2>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            Save in n8n so changes can be detected.
          </p>
        </div>
        <Button onClick={refresh} size="sm" type="button" variant="outline">
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-2 border-y border-border py-2 text-xs">
        <span
          className={`size-2 rounded-full ${
            status?.status === "clean" ? "bg-success" : "bg-primary"
          }`}
        />
        <span className="text-foreground">
          {isUnsaved
            ? "Not saved"
            : loading
              ? "Checking…"
              : status
                ? STATUS_LABELS[status.status]
                : "Status unavailable"}
        </span>
      </div>

      <Button
        className="w-full"
        disabled={!addEnabled || working || isUnsaved}
        onClick={handleAdd}
        type="button">
        {working ? "Working…" : "Add"}
      </Button>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Commit message</span>
        <input
          aria-label="Commit message"
          className="h-8 w-full rounded-md border border-input bg-base px-2.5 text-xs text-foreground outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
          disabled={working}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Describe the change"
          value={message}
        />
      </label>
      <Button
        className="w-full"
        disabled={
          !status || status.status !== "staged" || !message.trim() || working
        }
        onClick={handleCommit}
        type="button">
        Commit
      </Button>

      {notice && <p className="text-xs text-success">{notice}</p>}
      {error && <p className="text-xs text-error">{error}</p>}

      <GitHubConnection
        onLinked={() => setPushRefreshKey((value) => value + 1)}
        reconnectSignal={reconnectSignal}
      />
      <PushPanel
        onReconnect={() => setReconnectSignal((value) => value + 1)}
        refreshKey={pushRefreshKey}
      />

      <div className="space-y-2 border-t border-border pt-3">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Recent commits
        </h3>
        {commits.length === 0 && (
          <p className="text-xs text-muted-foreground">No local commits.</p>
        )}
        {commits.map((commit) => (
          <div
            className="flex items-start justify-between gap-2 rounded-md border border-border bg-base p-2"
            key={commit.id}>
            <span className="min-w-0 break-words text-xs text-foreground">
              <span className="font-mono text-muted-foreground">
                {shortId(commit.id)}
              </span>{" "}
              {commit.message}
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {formatRelativeDate(commit.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
