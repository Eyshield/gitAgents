import { isExtensionContextValid } from "@/core/extension-context"
import type {
  AddResult,
  Commit,
  LocalGitErrorCode,
  PushErrorCode,
  StatusEntry
} from "@/models/localGit"

const LOG_PREFIX = "[GitAgent][messaging]"
export type LocalGitRequest =
  | { type: "refreshLocalGitStatus"; workflowId: string; workflow: unknown }
  | { type: "addLocalGit"; workflowId: string; workflow: unknown; filePath?: string }
  | { type: "commitLocalGit"; message: string; author?: string }
  | { type: "listLocalGitCommits"; limit?: number }

export type LocalGitResponse = {
  ok: boolean
  status?: StatusEntry
  addResult?: AddResult
  commit?: Commit
  commits?: Commit[]
  code?: LocalGitErrorCode | PushErrorCode | "INVALID_SETTINGS"
  error?: string
}

export type N8nWorkflowRequest = {
  type: "readN8nWorkflow"
  workflowId: string
}

export type N8nWorkflowResponse = {
  ok: boolean
  workflow?: unknown
  code?: LocalGitErrorCode
  error?: string
}

export function isN8nWorkflowRequest(
  value: unknown
): value is N8nWorkflowRequest {
  if (typeof value !== "object" || value === null) return false
  const request = value as Partial<N8nWorkflowRequest>
  return (
    request.type === "readN8nWorkflow" &&
    typeof request.workflowId === "string" &&
    request.workflowId.length > 0
  )
}

export function isLocalGitRequest(
  value: unknown
): value is LocalGitRequest {
  if (typeof value !== "object" || value === null) return false
  const request = value as Partial<LocalGitRequest>
  if (
    request.type === "refreshLocalGitStatus" ||
    request.type === "addLocalGit"
  ) {
    return (
      typeof request.workflowId === "string" &&
      typeof request.workflow === "object" &&
      request.workflow !== null &&
      (request.type !== "addLocalGit" ||
        request.filePath === undefined ||
        typeof request.filePath === "string")
    )
  }
  if (request.type === "commitLocalGit") {
    return typeof request.message === "string"
  }
  return request.type === "listLocalGitCommits"
}

function sendMessage(message: LocalGitRequest): Promise<LocalGitResponse> {
  return new Promise((resolve) => {
    console.info(`${LOG_PREFIX} sending`, { type: message.type })
    if (!isExtensionContextValid()) {
      console.error(`${LOG_PREFIX} invalid extension context`)
      resolve({
        ok: false,
        error: "The local service is unavailable. Reload the extension."
      })
      return
    }

    try {
      chrome.runtime.sendMessage(message, (response?: LocalGitResponse) => {
        const runtimeError = chrome.runtime.lastError
        if (runtimeError || !response) {
          console.error(`${LOG_PREFIX} response unavailable`, {
            type: message.type,
            error: runtimeError?.message
          })
          resolve({
            ok: false,
            error: "The local service is unavailable. Reload the extension."
          })
          return
        }
        console.info(`${LOG_PREFIX} response`, {
          type: message.type,
          ok: response.ok,
          code: response.code
        })
        resolve(response)
      })
    } catch {
      console.error(`${LOG_PREFIX} sendMessage exception`, {
        type: message.type
      })
      resolve({
        ok: false,
        error: "The local service is unavailable. Reload the extension."
      })
    }
  })
}

export const refreshLocalGitStatus = (workflowId: string, workflow: unknown) =>
  sendMessage({ type: "refreshLocalGitStatus", workflowId, workflow })

export const addLocalGit = (
  workflowId: string,
  workflow: unknown,
  filePath?: string
) => sendMessage({ type: "addLocalGit", workflowId, workflow, filePath })

export const commitLocalGit = (message: string, author?: string) =>
  sendMessage({ type: "commitLocalGit", message, author })

export const listLocalGitCommits = (limit = 10) =>
  sendMessage({ type: "listLocalGitCommits", limit })

export function readN8nWorkflow(
  workflowId: string
): Promise<N8nWorkflowResponse> {
  return new Promise((resolve) => {
    const message: N8nWorkflowRequest = { type: "readN8nWorkflow", workflowId }
    console.info(`${LOG_PREFIX} sending`, { type: message.type })
    if (!isExtensionContextValid()) {
      console.error(`${LOG_PREFIX} invalid extension context`)
      resolve({
        ok: false,
        code: "N8N_UNREACHABLE",
        error: "The local service is unavailable. Reload the extension."
      })
      return
    }

    try {
      chrome.runtime.sendMessage(message, (response?: N8nWorkflowResponse) => {
        const runtimeError = chrome.runtime.lastError
        if (runtimeError || !response) {
          console.error(`${LOG_PREFIX} n8n read unavailable`, {
            error: runtimeError?.message
          })
          resolve({
            ok: false,
            code: "N8N_UNREACHABLE",
            error: "Unable to read the workflow from n8n."
          })
          return
        }
        console.info(`${LOG_PREFIX} response`, {
          type: message.type,
          ok: response.ok,
          code: response.code
        })
        resolve(response)
      })
    } catch {
      console.error(`${LOG_PREFIX} exception while reading n8n`)
      resolve({
        ok: false,
        code: "N8N_UNREACHABLE",
        error: "Unable to read the workflow from n8n."
      })
    }
  })
}
