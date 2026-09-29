import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { WorkflowNode as WorkflowNodeComponent } from "@/components/workflow/WorkflowNode"
import { toFlowElements } from "@/core/workflows/layout"
import type {
  InternalWorkflowModel,
  WorkflowNode
} from "@/core/workflows/types"
import {
  Background,
  ReactFlow,
  type NodeTypes,
  type ReactFlowInstance
} from "@xyflow/react"
import { useEffect, useMemo, useRef, useState } from "react"

import "@/styles/globals.css"

type Props = { workflow: InternalWorkflowModel }
type CanvasControl = "fit-view" | "zoom-in" | "zoom-out"
const NODE_TYPES: NodeTypes = { workflowNode: WorkflowNodeComponent }
const CANVAS_PADDING = 180

export function WorkflowCanvas({ workflow }: Props) {
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null)
  const { nodes, edges } = useMemo(() => {
    const elements = toFlowElements(workflow)
    const minX = Math.min(...elements.nodes.map((node) => node.position.x), 0)
    const minY = Math.min(...elements.nodes.map((node) => node.position.y), 0)
    const offsetX = CANVAS_PADDING - minX
    const offsetY = CANVAS_PADDING - minY

    return {
      nodes: elements.nodes.map((node) => ({
        ...node,
        position: {
          x: node.position.x + offsetX,
          y: node.position.y + offsetY
        }
      })),
      edges: elements.edges
    }
  }, [workflow])
  const flowInstance = useRef<ReactFlowInstance | null>(null)
  const canvasElement = useRef<HTMLDivElement | null>(null)
  const controlsElement = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      const canvas = canvasElement.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const isInsideCanvas =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom

      if (!isInsideCanvas) return

      const instance = flowInstance.current
      if (!instance) return

      event.preventDefault()
      event.stopPropagation()
      const viewportBefore = instance.getViewport()

      const horizontalDelta =
        event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX
      const verticalDelta =
        event.shiftKey && event.deltaX === 0 ? 0 : event.deltaY
      const viewportRequested = {
        x: viewportBefore.x - horizontalDelta,
        y: viewportBefore.y - verticalDelta,
        zoom: viewportBefore.zoom
      }

      void instance.setViewport(viewportRequested).catch(() => undefined)
    }

    window.addEventListener("wheel", handleWheel, {
      capture: true,
      passive: false
    })

    return () => {
      window.removeEventListener("wheel", handleWheel, { capture: true })
    }
  }, [])

  useEffect(() => {
    const handleControlPointerDown = (event: PointerEvent) => {
      const controls = controlsElement.current
      if (!controls) return

      const button = Array.from(
        controls.querySelectorAll<HTMLButtonElement>("[data-workflow-control]")
      ).find((candidate) => {
        const rect = candidate.getBoundingClientRect()
        return (
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        )
      })
      if (!button) return

      event.preventDefault()
      event.stopImmediatePropagation()
      const control = button.dataset.workflowControl as CanvasControl
      const instance = flowInstance.current
      if (!instance) return

      if (control === "zoom-in") {
        void instance.zoomIn({ duration: 150 })
      } else if (control === "zoom-out") {
        void instance.zoomOut({ duration: 150 })
      } else {
        void instance.fitView({ padding: 0.2, minZoom: 0.05 })
      }
    }

    window.addEventListener("pointerdown", handleControlPointerDown, {
      capture: true,
      passive: false
    })

    return () => {
      window.removeEventListener("pointerdown", handleControlPointerDown, {
        capture: true
      })
    }
  }, [])

  useEffect(() => {
    const controls = controlsElement.current
    if (!controls) return

    controls.style.setProperty("cursor", "pointer", "important")
    controls
      .querySelectorAll<HTMLButtonElement>("button[data-workflow-control]")
      .forEach((button) => {
        button.style.setProperty("cursor", "pointer", "important")
      })
  }, [])

  return (
    <>
      <div
        ref={canvasElement}
        className="relative h-[700px] w-full overflow-hidden rounded-b-lg bg-base"
        style={{ pointerEvents: "auto" }}>
        <div className="relative h-full w-full">
          <ReactFlow
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            defaultEdgeOptions={{
              style: { stroke: "var(--subtle)", strokeWidth: 1.5 }
            }}
            edges={edges}
            maxZoom={2.5}
            minZoom={0.2}
            nodes={nodes}
            nodesConnectable={false}
            nodesDraggable={false}
            nodeTypes={NODE_TYPES}
            onNodeClick={(_, node) =>
              setSelectedNode(node.data as WorkflowNode)
            }
            onInit={(instance) => {
              flowInstance.current = instance
            }}
            panOnDrag
            preventScrolling={false}
            style={{ pointerEvents: "auto" }}
            zoomOnDoubleClick={false}
            zoomOnPinch
            zoomOnScroll={false}>
            <Background color="var(--subtle)" gap={20} />
          </ReactFlow>
        </div>
        <div className="pointer-events-none absolute inset-0 z-50">
          <div
            ref={controlsElement}
            className="pointer-events-auto absolute left-4 top-4 flex gap-1 rounded-md border border-border bg-surface p-1"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            style={{ pointerEvents: "auto", zIndex: 50 }}>
            <Button
              aria-label="Zoomer"
              data-workflow-control="zoom-in"
              className="!pointer-events-auto !cursor-pointer h-7 w-7 border-border bg-surface p-0 text-sm text-foreground hover:border-primary hover:bg-white/5"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void flowInstance.current?.zoomIn({ duration: 150 })
              }}
              type="button"
              variant="outline">
              +
            </Button>
            <Button
              aria-label="Zoom out"
              data-workflow-control="zoom-out"
              className="!pointer-events-auto !cursor-pointer h-7 w-7 border-border bg-surface p-0 text-sm text-foreground hover:border-primary hover:bg-white/5"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void flowInstance.current?.zoomOut({ duration: 150 })
              }}
              type="button"
              variant="outline">
              −
            </Button>
            <Button
              aria-label="Fit view"
              data-workflow-control="fit-view"
              className="!pointer-events-auto !cursor-pointer h-7 border-border bg-surface px-2 text-[11px] text-foreground hover:border-primary hover:bg-white/5"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void flowInstance.current?.fitView({
                  padding: 0.2,
                  minZoom: 0.05
                })
              }}
              type="button"
              variant="outline">
              Fit view
            </Button>
          </div>
        </div>
      </div>
      <Dialog
        onOpenChange={(open) => !open && setSelectedNode(null)}
        open={selectedNode !== null}>
        <DialogContent className="max-h-[80vh] overflow-y-auto border-border bg-surface text-foreground">
          <DialogHeader>
            <DialogTitle>{selectedNode?.name}</DialogTitle>
          </DialogHeader>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Type</dt>
              <dd>{selectedNode?.platformType}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Parameters</dt>
              <dd className="mt-1 overflow-x-auto rounded-md bg-base p-3 font-mono text-xs">
                {JSON.stringify(
                  selectedNode?.metadata?.parameters ?? {},
                  null,
                  2
                )}
              </dd>
            </div>
          </dl>
        </DialogContent>
      </Dialog>
    </>
  )
}
