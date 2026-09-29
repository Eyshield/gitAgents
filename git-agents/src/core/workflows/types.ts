export type WorkflowFormat = "n8n" | "zapier" | "make" | "unknown"

export type WorkflowNode = {
  id: string
  name: string
  type: string
  platformType?: string
  position?: { x: number; y: number }
  metadata?: Record<string, unknown>
}

export type WorkflowConnection = {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
}

export type InternalWorkflowModel = {
  source: Exclude<WorkflowFormat, "unknown">
  nodes: WorkflowNode[]
  connections: WorkflowConnection[]
  meta: { name: string; originalRaw: unknown }
}
