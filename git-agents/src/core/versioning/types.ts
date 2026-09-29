import type {
  InternalWorkflowModel,
  WorkflowConnection,
  WorkflowNode
} from "@/core/workflows/types"

export type WorkflowProvider = "github" | "gitlab" | "unknown"

export type WorkflowRemoteRef = {
  provider: WorkflowProvider
  owner: string
  repository: string
  path: string
  ref: string
  url: string
  rawUrl?: string
}

export type WorkflowSnapshot = {
  id: string
  workflowKey: string
  contentHash: string
  createdAt: number
  source: InternalWorkflowModel["source"]
  name: string
  model: InternalWorkflowModel
  remote?: WorkflowRemoteRef
}

export type NodeChange = {
  id: string
  before?: WorkflowNode
  after?: WorkflowNode
}

export type ConnectionChange = {
  id: string
  before?: WorkflowConnection
  after?: WorkflowConnection
}

export type WorkflowDiff = {
  fromSnapshotId: string
  toSnapshotId: string
  addedNodes: NodeChange[]
  removedNodes: NodeChange[]
  modifiedNodes: NodeChange[]
  addedConnections: ConnectionChange[]
  removedConnections: ConnectionChange[]
  isIdentical: boolean
}
