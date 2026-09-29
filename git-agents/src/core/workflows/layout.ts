import type { InternalWorkflowModel } from "@/core/workflows/types"
import type { Edge, Node } from "@xyflow/react"
import dagre from "dagre"

const NODE_WIDTH = 128
const NODE_HEIGHT = 128

export function toFlowElements(workflow: InternalWorkflowModel): {
  nodes: Node[]
  edges: Edge[]
} {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({
    rankdir: "LR",
    nodesep: 80,
    ranksep: 110,
    marginx: 80,
    marginy: 60
  })
  workflow.nodes.forEach((node) =>
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  )
  workflow.connections.forEach((connection) =>
    graph.setEdge(connection.source, connection.target)
  )
  dagre.layout(graph)
  return {
    nodes: workflow.nodes.map((node) => {
      const position = graph.node(node.id)
      return {
        id: node.id,
        type: "workflowNode",
        // n8n coordinates are reference points, not React Flow dimensions.
        // Dagre provides suitable spacing for our cards and prevents overlaps.
        position: {
          x: position.x - NODE_WIDTH / 2,
          y: position.y - NODE_HEIGHT / 2
        },
        data: node
      }
    }),
    edges: workflow.connections.map((connection) => ({
      id: connection.id,
      source: connection.source,
      target: connection.target,
      label: connection.label,
      type: "smoothstep"
    }))
  }
}
