import type { InternalWorkflowModel } from "@/core/workflows/types"

import type { WorkflowRemoteRef, WorkflowSnapshot } from "./types"

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value !== "object" || value === null) return value

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [key, canonicalize(nestedValue)])
  )
}

export function stableSerialize(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

function hash(value: string): string {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return (result >>> 0).toString(16).padStart(8, "0")
}

export function getWorkflowKey(
  workflow: InternalWorkflowModel,
  remote?: WorkflowRemoteRef
): string {
  if (remote) {
    return `${remote.provider}:${remote.owner}/${remote.repository}:${remote.path}`
  }
  return `${workflow.source}:${workflow.meta.name}`
}

export function createWorkflowSnapshot(
  workflow: InternalWorkflowModel,
  remote?: WorkflowRemoteRef
): WorkflowSnapshot {
  const workflowKey = getWorkflowKey(workflow, remote)
  const contentHash = hash(stableSerialize(workflow))
  return {
    // A deterministic id makes simultaneous automatic/manual saves idempotent.
    id: `snapshot-${hash(workflowKey)}-${contentHash}`,
    workflowKey,
    contentHash,
    createdAt: Date.now(),
    source: workflow.source,
    name: workflow.meta.name,
    model: workflow,
    remote
  }
}
