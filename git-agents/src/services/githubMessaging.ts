import { isExtensionContextValid } from "@/core/extension-context"
import type {
  LinkConfig,
  PushConfirmation,
  PushErrorCode,
  PushResult,
  Remote
} from "@/models/localGit"
import type { RepoRef } from "@/integrations/github/githubRepos"
import type { PushStatus } from "@/services/pushService"

export type GitHubRequest =
  | { type: "githubStartDeviceFlow" }
  | { type: "githubWaitForAuthorization" }
  | { type: "githubCancelDeviceFlow" }
  | { type: "githubConnectWithToken"; token: string }
  | { type: "githubDisconnect" }
  | { type: "githubIsConnected" }
  | { type: "githubListRepositories" }
  | { type: "githubGetAuthor" }
  | { type: "githubListBranches"; owner: string; repo: string }
  | { type: "githubLinkRemote"; config: LinkConfig }
  | { type: "githubGetPushStatus" }
  | {
      type: "githubPush"
      options?: {
        confirmedDefaultBranch?: boolean
        confirmedOverwrite?: boolean
      }
    }

export type GitHubResponse = {
  ok: boolean
  connected?: boolean
  userCode?: string
  verificationUri?: string
  expiresAt?: number
  repositories?: RepoRef[]
  branches?: string[]
  remote?: Remote
  pushStatus?: PushStatus
  author?: { name: string; email: string }
  pushResult?: PushResult
  confirmation?: PushConfirmation
  code?: PushErrorCode
  error?: string
}

export function isGitHubRequest(value: unknown): value is GitHubRequest {
  if (typeof value !== "object" || value === null) return false
  const request = value as Partial<GitHubRequest>
  if (typeof request.type !== "string" || !request.type.startsWith("github")) return false
  if (request.type === "githubConnectWithToken") return typeof request.token === "string"
  if (request.type === "githubListBranches") {
    return typeof request.owner === "string" && typeof request.repo === "string"
  }
  if (request.type === "githubLinkRemote") {
    const config = request.config as Partial<LinkConfig>
    return (
      typeof config === "object" &&
      config !== null &&
      typeof config.owner === "string" &&
      typeof config.repo === "string" &&
      typeof config.branch === "string" &&
      typeof config.basePath === "string"
    )
  }
  return [
    "githubStartDeviceFlow",
    "githubWaitForAuthorization",
    "githubCancelDeviceFlow",
    "githubDisconnect",
    "githubIsConnected",
    "githubListRepositories",
    "githubGetAuthor",
    "githubGetPushStatus",
    "githubPush"
  ].includes(request.type)
}

function sendMessage(message: GitHubRequest): Promise<GitHubResponse> {
  return new Promise((resolve) => {
    if (!isExtensionContextValid()) {
      resolve({ ok: false, error: "The extension must be reloaded." })
      return
    }
    try {
      chrome.runtime.sendMessage(message, (response?: GitHubResponse) => {
        const runtimeError = chrome.runtime.lastError
        resolve(
          runtimeError || !response
            ? { ok: false, error: "The GitHub service is unavailable." }
            : response
        )
      })
    } catch {
      resolve({ ok: false, error: "The GitHub service is unavailable." })
    }
  })
}

export const startGitHubDeviceFlow = () => sendMessage({ type: "githubStartDeviceFlow" })
export const waitForGitHubAuthorization = () =>
  sendMessage({ type: "githubWaitForAuthorization" })
export const cancelGitHubDeviceFlow = () =>
  sendMessage({ type: "githubCancelDeviceFlow" })
export const connectGitHubWithToken = (token: string) =>
  sendMessage({ type: "githubConnectWithToken", token })
export const disconnectGitHub = () => sendMessage({ type: "githubDisconnect" })
export const isGitHubConnected = () => sendMessage({ type: "githubIsConnected" })
export const listGitHubRepositories = () =>
  sendMessage({ type: "githubListRepositories" })
export const getGitHubAuthor = () => sendMessage({ type: "githubGetAuthor" })
export const listGitHubBranches = (owner: string, repo: string) =>
  sendMessage({ type: "githubListBranches", owner, repo })
export const linkGitHubRemote = (config: LinkConfig) =>
  sendMessage({ type: "githubLinkRemote", config })
export const getGitHubPushStatus = () => sendMessage({ type: "githubGetPushStatus" })
export const pushToGitHub = (options?: {
  confirmedDefaultBranch?: boolean
  confirmedOverwrite?: boolean
}) => sendMessage({ type: "githubPush", options })
