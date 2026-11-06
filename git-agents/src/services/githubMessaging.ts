import { isExtensionContextValid } from "@/core/extension-context"
import type { RepoRef } from "@/integrations/github/githubRepos"
import type {
  LinkConfig,
  PullErrorCode,
  PullResult,
  PushConfirmation,
  PushErrorCode,
  PushResult,
  Remote
} from "@/models/localGit"
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
      type: "githubPull"
      workflowId?: string
      workflow?: unknown
    }
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
  pullResult?: PullResult
  confirmation?: PushConfirmation
  conflicts?: string[]
  code?: PushErrorCode | PullErrorCode
  error?: string
}

export function isGitHubRequest(value: unknown): value is GitHubRequest {
  if (typeof value !== "object" || value === null) return false
  const request = value as Partial<GitHubRequest>
  if (typeof request.type !== "string" || !request.type.startsWith("github"))
    return false
  if (request.type === "githubConnectWithToken")
    return typeof request.token === "string"
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
    "githubPull",
    "githubPush"
  ].includes(request.type)
}

/**
 * Envoie une requête GitHub au background script via chrome.runtime.sendMessage.
 * Ne rejette jamais : en cas d'erreur (contexte invalide, service indisponible),
 * retourne `{ ok: false, error }`. Toutes les fonctions exportées ci-dessous s'appuient dessus.
 */
function sendMessage(message: GitHubRequest): Promise<GitHubResponse> {
  return new Promise((resolve) => {
    if (!isExtensionContextValid()) {
      resolve({ ok: false, error: "The extension must be reloaded." })
      return
    }
    try {
      chrome.runtime.sendMessage(message, (response?: GitHubResponse) => {
        const runtimeError = chrome.runtime.lastError
        if (runtimeError || !response) {
          resolve({ ok: false, error: "The GitHub service is unavailable." })
          return
        }
        resolve(response)
      })
    } catch {
      resolve({ ok: false, error: "The GitHub service is unavailable." })
    }
  })
}

export const startGitHubDeviceFlow = () =>
  sendMessage({ type: "githubStartDeviceFlow" })
export const waitForGitHubAuthorization = () =>
  sendMessage({ type: "githubWaitForAuthorization" })
export const cancelGitHubDeviceFlow = () =>
  sendMessage({ type: "githubCancelDeviceFlow" })
export const connectGitHubWithToken = (token: string) =>
  sendMessage({ type: "githubConnectWithToken", token })
export const disconnectGitHub = () => sendMessage({ type: "githubDisconnect" })
export const isGitHubConnected = () =>
  sendMessage({ type: "githubIsConnected" })
export const listGitHubRepositories = () =>
  sendMessage({ type: "githubListRepositories" })
export const getGitHubAuthor = () => sendMessage({ type: "githubGetAuthor" })
export const listGitHubBranches = (owner: string, repo: string) =>
  sendMessage({ type: "githubListBranches", owner, repo })
export const linkGitHubRemote = (config: LinkConfig) =>
  sendMessage({ type: "githubLinkRemote", config })
export const getGitHubPushStatus = () =>
  sendMessage({ type: "githubGetPushStatus" })
export const pullFromGitHub = (input?: {
  workflowId?: string
  workflow?: unknown
}) => sendMessage({ type: "githubPull", ...input })
export const pushToGitHub = (options?: {
  confirmedDefaultBranch?: boolean
  confirmedOverwrite?: boolean
}) => sendMessage({ type: "githubPush", options })
