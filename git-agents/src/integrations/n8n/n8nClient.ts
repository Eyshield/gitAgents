function normalizeN8nBaseUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new N8nApiError("The n8n tab URL is invalid.")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new N8nApiError("The n8n tab URL is invalid.")
  }
  return url.toString().replace(/\/$/, "")
}

const LOG_PREFIX = "[GitAgent][n8n-client]"

export class N8nApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = "N8nApiError"
    this.status = status
  }
}

export interface N8nClient {
  getWorkflow(workflowId: string): Promise<unknown>
  testConnection(): Promise<boolean>
}

function toApiError(status?: number): N8nApiError {
  if (status === 401 || status === 403) {
    return new N8nApiError("The n8n session is no longer valid.", status)
  }
  if (status === 404) {
    return new N8nApiError("Workflow not found.", status)
  }
  return new N8nApiError(
    "Unable to reach n8n. Check that it is running and that the URL is correct.",
    status
  )
}

function unwrapWorkflowResponse(value: unknown): unknown {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "data" in value
  ) {
    const data = (value as { data?: unknown }).data
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      return data
    }
  }
  return value
}

export class ConfiguredN8nClient implements N8nClient {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = normalizeN8nBaseUrl(baseUrl)
  }

  async getWorkflow(workflowId: string): Promise<unknown> {
    return this.request(`/rest/workflows/${encodeURIComponent(workflowId)}`)
  }

  async testConnection(): Promise<boolean> {
    await this.request("/rest/workflows?limit=1")
    return true
  }

  private async request(path: string): Promise<unknown> {
    const endpoint = path.startsWith("/rest/workflows/")
      ? "workflow"
      : "workflows"
    console.info(`${LOG_PREFIX} request`, { endpoint })
    const controller = new AbortController()
    const timeout = globalThis.setTimeout(() => controller.abort(), 10000)
    try {
      let response: Response
      try {
        response = await fetch(`${this.baseUrl}${path}`, {
          headers: {
            Accept: "application/json"
          },
          credentials: "include",
          signal: controller.signal
        })
      } catch {
        throw toApiError()
      }

      if (!response.ok) throw toApiError(response.status)
      console.info(`${LOG_PREFIX} HTTP response`, {
        endpoint,
        status: response.status
      })
      try {
        return unwrapWorkflowResponse((await response.json()) as unknown)
      } catch {
        console.error(`${LOG_PREFIX} invalid JSON response`, { endpoint })
        throw new N8nApiError(
          "n8n returned an invalid JSON response.",
          response.status
        )
      }
    } finally {
      globalThis.clearTimeout(timeout)
    }
  }
}
