import { Button } from "@/components/ui/button"
import { diffWorkflowSnapshots } from "@/core/versioning/diff"
import { listWorkflowSnapshots } from "@/core/versioning/messaging"
import type { WorkflowDiff, WorkflowSnapshot } from "@/core/versioning/types"
import { useEffect, useMemo, useState } from "react"

import "@/styles/globals.css"

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(timestamp)
}

function DiffSummary({ diff }: { diff: WorkflowDiff }) {
  if (diff.isIdentical) {
    return <p className="text-xs text-muted-foreground">No differences.</p>
  }

  return (
    <div className="space-y-2 text-xs">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded border border-border bg-base p-2">
          <p className="text-muted-foreground">Added</p>
          <p className="mt-1 text-sm text-success">+{diff.addedNodes.length}</p>
        </div>
        <div className="rounded border border-border bg-base p-2">
          <p className="text-muted-foreground">Modified</p>
          <p className="mt-1 text-sm text-primary">
            ~{diff.modifiedNodes.length}
          </p>
        </div>
        <div className="rounded border border-border bg-base p-2">
          <p className="text-muted-foreground">Removed</p>
          <p className="mt-1 text-sm text-error">-{diff.removedNodes.length}</p>
        </div>
      </div>
      <p className="text-muted-foreground">
        Connections: +{diff.addedConnections.length} / -
        {diff.removedConnections.length}
      </p>
      {(diff.addedNodes.length > 0 ||
        diff.removedNodes.length > 0 ||
        diff.modifiedNodes.length > 0) && (
        <ul className="space-y-1 rounded border border-border bg-base p-2">
          {diff.addedNodes.map((change) => (
            <li className="text-success" key={`added-${change.id}`}>
              + {change.after?.name ?? change.id}
            </li>
          ))}
          {diff.modifiedNodes.map((change) => (
            <li className="text-primary" key={`modified-${change.id}`}>
              ~ {change.after?.name ?? change.id}
            </li>
          ))}
          {diff.removedNodes.map((change) => (
            <li className="text-error" key={`removed-${change.id}`}>
              - {change.before?.name ?? change.id}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function WorkflowHistory() {
  const [snapshots, setSnapshots] = useState<WorkflowSnapshot[]>([])
  const [fromId, setFromId] = useState("")
  const [toId, setToId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSnapshots = () => {
    setLoading(true)
    setError(null)
    void listWorkflowSnapshots()
      .then((response) => {
        if (!response.ok || !response.snapshots) {
          setError(
            response.error ?? "Unable to load local history."
          )
          setLoading(false)
          return
        }
        setSnapshots(response.snapshots)
        setFromId((current) => current || response.snapshots?.[1]?.id || "")
        setToId((current) => current || response.snapshots?.[0]?.id || "")
        setLoading(false)
      })
      .catch(() => {
        setError("The local service is unavailable. Reload the extension.")
        setLoading(false)
      })
  }

  useEffect(() => {
    loadSnapshots()
  }, [])

  const diff = useMemo(() => {
    const from = snapshots.find((snapshot) => snapshot.id === fromId)
    const to = snapshots.find((snapshot) => snapshot.id === toId)
    return from && to ? diffWorkflowSnapshots(from, to) : null
  }, [fromId, snapshots, toId])

  return (
    <section className="space-y-3 border-t border-border pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-foreground">
            Local history
          </h3>
          <p className="break-words text-xs leading-4 text-muted-foreground">
            Versions remain independent from Git commits.
          </p>
        </div>
        <Button
          onClick={loadSnapshots}
          size="sm"
          type="button"
          variant="outline">
          Refresh
        </Button>
      </div>

      {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
      {!loading && error && <p className="text-xs text-error">{error}</p>}
      {!loading && !error && snapshots.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No snapshots. Open a GitHub workflow to create the first version.
        </p>
      )}
      {!loading && !error && snapshots.length > 0 && (
        <>
          <div className="space-y-2">
            {snapshots.slice(0, 5).map((snapshot) => (
              <div
                className="rounded-md border border-border bg-surface p-2.5"
                key={snapshot.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm leading-5 text-foreground">
                      {snapshot.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(snapshot.createdAt)} ·{" "}
                      {snapshot.model.nodes.length} nodes
                    </p>
                  </div>
                  <span className="max-w-[76px] shrink-0 truncate font-mono text-[10px] text-muted-foreground">
                    {snapshot.contentHash}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {snapshots.length > 1 && (
            <div className="space-y-3 rounded-md border border-border bg-surface p-3">
              <div>
                <p className="text-xs font-medium text-foreground">
                  Compare two versions
                </p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                  Choose a starting version and an ending version.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  aria-label="Starting version"
                  className="block min-w-0 w-full truncate rounded-md border border-border bg-base px-2 py-2 text-xs text-foreground"
                  onChange={(event) => setFromId(event.target.value)}
                  value={fromId}>
                  {snapshots.map((snapshot) => (
                    <option key={snapshot.id} value={snapshot.id}>
                      {formatDate(snapshot.createdAt)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Ending version"
                  className="block min-w-0 w-full truncate rounded-md border border-border bg-base px-2 py-2 text-xs text-foreground"
                  onChange={(event) => setToId(event.target.value)}
                  value={toId}>
                  {snapshots.map((snapshot) => (
                    <option key={snapshot.id} value={snapshot.id}>
                      {formatDate(snapshot.createdAt)}
                    </option>
                  ))}
                </select>
              </div>
              {diff && <DiffSummary diff={diff} />}
            </div>
          )}
        </>
      )}
    </section>
  )
}
