import { PushError } from "@/models/localGit"
import { githubAuth, GitHubAuth } from "@/integrations/github/githubAuth"

const API_BASE_URL = "https://api.github.com"

export class GitHubApiError extends Error {
  readonly status: number
  readonly rateLimitRemaining: string | null

  constructor(status: number, rateLimitRemaining: string | null) {
    super("GitHub rejected the request.")
    this.name = "GitHubApiError"
    this.status = status
    this.rateLimitRemaining = rateLimitRemaining
  }
}

function mapNetworkError(): PushError {
  return new PushError("NETWORK_ERROR", "Unable to reach the GitHub API.")
}

export class GitHubClient {
  constructor(private readonly auth: GitHubAuth = githubAuth) {}

  async requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.request(path, init)
    try {
      return (await response.json()) as T
    } catch {
      throw new PushError("NETWORK_ERROR", "Invalid GitHub response.")
    }
  }

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    return this.requestOnce(path, init, true)
  }

  private async requestOnce(
    path: string,
    init: RequestInit,
    canRetryUnauthorized: boolean
  ): Promise<Response> {
    const token = await this.auth.getValidAccessToken()
    const headers = new Headers(init.headers)
    headers.set("Accept", "application/vnd.github+json")
    headers.set("X-GitHub-Api-Version", "2022-11-28")
    headers.set("Authorization", `Bearer ${token}`)
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json")
    }
    let response: Response
    try {
      response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
    } catch {
      throw mapNetworkError()
    }
    if (response.status === 401 && canRetryUnauthorized) {
      await this.auth.refreshAfterUnauthorized()
      return this.requestOnce(path, init, false)
    }
    if (!response.ok) {
      throw new GitHubApiError(
        response.status,
        response.headers.get("x-ratelimit-remaining")
      )
    }
    return response
  }
}

export const githubClient = new GitHubClient()
