import { stableSerialize } from "./snapshot"
import type {
  ConnectionChange,
  NodeChange,
  WorkflowDiff,
  WorkflowSnapshot
} from "./types"

function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]))
}

function compareItems<T extends { id: string }>(
  beforeItems: T[],
  afterItems: T[]
): { added: T[]; removed: T[]; modified: Array<{ before: T; after: T }> } {
  const beforeById = indexById(beforeItems)
  const afterById = indexById(afterItems)
  const added: T[] = []
  const removed: T[] = []
  const modified: Array<{ before: T; after: T }> = []

  for (const [id, after] of afterById) {
    const before = beforeById.get(id)
    if (!before) {
      added.push(after)
    } else if (stableSerialize(before) !== stableSerialize(after)) {
      modified.push({ before, after })
    }
  }
  for (const [id, before] of beforeById) {
    if (!afterById.has(id)) removed.push(before)
  }

  return { added, removed, modified }
}

export function diffWorkflowSnapshots(
  before: WorkflowSnapshot,
  after: WorkflowSnapshot
): WorkflowDiff {
  const nodeChanges = compareItems(before.model.nodes, after.model.nodes)
  const connectionChanges = compareItems(
    before.model.connections,
    after.model.connections
  )
  const addedNodes: NodeChange[] = nodeChanges.added.map((afterNode) => ({
    id: afterNode.id,
    after: afterNode
  }))
  const removedNodes: NodeChange[] = nodeChanges.removed.map((beforeNode) => ({
    id: beforeNode.id,
    before: beforeNode
  }))
  const modifiedNodes: NodeChange[] = nodeChanges.modified.map(
    ({ before: beforeNode, after: afterNode }) => ({
      id: afterNode.id,
      before: beforeNode,
      after: afterNode
    })
  )
  const addedConnections: ConnectionChange[] = connectionChanges.added.map(
    (afterConnection) => ({ id: afterConnection.id, after: afterConnection })
  )
  const removedConnections: ConnectionChange[] = connectionChanges.removed.map(
    (beforeConnection) => ({
      id: beforeConnection.id,
      before: beforeConnection
    })
  )

  return {
    fromSnapshotId: before.id,
    toSnapshotId: after.id,
    addedNodes,
    removedNodes,
    modifiedNodes,
    addedConnections,
    removedConnections,
    isIdentical:
      addedNodes.length === 0 &&
      removedNodes.length === 0 &&
      modifiedNodes.length === 0 &&
      addedConnections.length === 0 &&
      removedConnections.length === 0
  }
}
