import { ConfiguredN8nClient, N8nApiError } from "@/integrations/n8n/n8nClient"
import { LocalGitError, type WorkflowSource } from "@/models/localGit"

const LOG_PREFIX = "[GitAgent][n8n-source]"

function mapN8nError(error: unknown): LocalGitError {
  if (error instanceof LocalGitError) return error
  if (error instanceof N8nApiError) {
    if (error.status === 401 || error.status === 403) {
      return new LocalGitError(
        "N8N_UNAUTHORIZED",
        "The n8n session is no longer valid. Reload the n8n page."
      )
    }
    if (error.status === 404) {
      return new LocalGitError("WORKFLOW_NOT_FOUND", "Workflow not found.")
    }
    return new LocalGitError(
      "N8N_UNREACHABLE",
      error.message
    )
  }
  return new LocalGitError(
    "N8N_UNREACHABLE",
    "Unable to reach n8n. Check that it is running and that the URL is correct."
  )
}

export class N8nWorkflowSource implements WorkflowSource {
  constructor(private readonly baseUrl = "") {}

  async getWorkflow(workflowId: string): Promise<unknown> {
    try {
      console.info(`${LOG_PREFIX} workflow read requested`)
      return await new ConfiguredN8nClient(this.baseUrl).getWorkflow(workflowId)
    } catch (error: unknown) {
      console.error(`${LOG_PREFIX} workflow read failed`, {
        error: error instanceof Error ? error.message : "unknown"
      })
      throw mapN8nError(error)
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      return await new ConfiguredN8nClient(this.baseUrl).testConnection()
    } catch (error: unknown) {
      throw mapN8nError(error)
    }
  }
}

export { mapN8nError }
