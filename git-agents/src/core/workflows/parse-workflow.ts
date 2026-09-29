import { detectWorkflowFormat } from "@/core/workflows/detector"
import { parseN8nWorkflow } from "@/core/workflows/n8n-parser"
import type { InternalWorkflowModel } from "@/core/workflows/types"

export function parseWorkflow(value: unknown): InternalWorkflowModel | null {
  return detectWorkflowFormat(value) === "n8n" ? parseN8nWorkflow(value) : null
}
