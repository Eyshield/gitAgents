import type {
  InternalWorkflowModel,
  WorkflowConnection,
  WorkflowNode
} from "@/core/workflows/types"

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback
}

function parseNode(value: unknown, index: number): WorkflowNode {
  if (!isRecord(value)) throw new Error(`Node ${index + 1} is invalid.`)
  const name = getString(value.name, `Nœud ${index + 1}`)
  const position = Array.isArray(value.position) ? value.position : undefined
  const x = position?.[0]
  const y = position?.[1]
  return {
    id: getString(value.id, name),
    name,
    type: getString(value.type, "n8n-nodes-base.unknown"),
    platformType: getString(value.type, "unknown"),
    position:
      typeof x === "number" && typeof y === "number" ? { x, y } : undefined,
    metadata: {
      parameters: isRecord(value.parameters) ? value.parameters : {},
      disabled: value.disabled === true
    }
  }
}

function parseConnections(
  value: unknown,
  nodeIdByName: Map<string, string>
): WorkflowConnection[] {
  if (!isRecord(value)) return []
  const connections: WorkflowConnection[] = []
  for (const [sourceName, outputGroups] of Object.entries(value)) {
    const source = nodeIdByName.get(sourceName)
    if (!source || !isRecord(outputGroups)) continue
    for (const [outputName, branches] of Object.entries(outputGroups)) {
      if (!Array.isArray(branches)) continue
      branches.forEach((branch, branchIndex) => {
        if (!Array.isArray(branch)) return
        branch.forEach((connection, connectionIndex) => {
          if (!isRecord(connection) || typeof connection.node !== "string")
            return
          const target = nodeIdByName.get(connection.node)
          if (!target) return
          connections.push({
            id: `${source}-${outputName}-${branchIndex}-${connectionIndex}-${target}`,
            source,
            target,
            label: outputName === "main" ? undefined : outputName
          })
        })
      })
    }
  }
  return connections
}

export function parseN8nWorkflow(value: unknown): InternalWorkflowModel {
  if (
    !isRecord(value) ||
    !Array.isArray(value.nodes) ||
    (value.connections !== undefined && !isRecord(value.connections))
  ) {
    throw new Error(
      "The file does not match the structure of an n8n workflow."
    )
  }
  const nodes = value.nodes.map(parseNode)
  const nodeIdByName = new Map(
    nodes.flatMap((node) => [
      [node.name, node.id],
      [node.id, node.id]
    ])
  )
  return {
    source: "n8n",
    nodes,
    connections: parseConnections(value.connections ?? {}, nodeIdByName),
    meta: { name: getString(value.name, "Workflow n8n"), originalRaw: value }
  }
}
