import type { WorkflowFormat } from "@/core/workflows/types"

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function detectWorkflowFormat(value: unknown): WorkflowFormat {
  if (!isRecord(value)) return "unknown"
  if (!Array.isArray(value.nodes)) return "unknown"

  const hasN8nNode = value.nodes.some(
    (node) =>
      isRecord(node) &&
      typeof node.name === "string" &&
      typeof node.type === "string"
  )
  const hasValidConnections =
    value.connections === undefined || isRecord(value.connections)

  return hasN8nNode && hasValidConnections ? "n8n" : "unknown"
}
