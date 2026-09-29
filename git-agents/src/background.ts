import {
  deleteSnapshot,
  findSnapshotByHash,
  listSnapshots,
  saveSnapshot
} from "@/core/versioning/snapshot-db"
import {
  isN8nWorkflowRequest,
  isLocalGitRequest,
  type LocalGitRequest,
  type LocalGitResponse,
  type N8nWorkflowRequest,
  type N8nWorkflowResponse
} from "@/services/localGitMessaging"
import {
  isGitHubRequest,
  type GitHubRequest,
  type GitHubResponse
} from "@/services/githubMessaging"
import { githubAuth } from "@/integrations/github/githubAuth"
import { pushService } from "@/services/pushService"
import {
  DefaultLocalGitService,
  localGitService,
  ProvidedWorkflowSource
} from "@/services/localGitService"
import type { WorkflowSnapshot } from "@/core/versioning/types"

const LOG_PREFIX = "[GitAgent][background]"

type RawWorkflowRequest = {
  type: "fetchRawWorkflow"
  url: string
}

type RawWorkflowResponse = {
  ok: boolean
  text?: string
  error?: string
}

type SnapshotRequest =
  | { type: "saveWorkflowSnapshot"; snapshot: WorkflowSnapshot }
  | { type: "listWorkflowSnapshots"; workflowKey?: string }
  | { type: "deleteWorkflowSnapshot"; snapshotId: string }

type SnapshotResponse = {
  ok: boolean
  snapshot?: WorkflowSnapshot
  snapshots?: WorkflowSnapshot[]
  error?: string
}

type BackgroundResponse =
  | RawWorkflowResponse
  | SnapshotResponse
  | LocalGitResponse
  | N8nWorkflowResponse
  | GitHubResponse

type PageWorkflowResult = {
  ok: boolean
  status: number
  payload?: unknown
  source?: "n8n-store" | "rest"
}

async function fetchWorkflowInPage(workflowId: string): Promise<PageWorkflowResult> {
  const readLoadedWorkflow = (): unknown => {
    const roots = [
      document.querySelector("#app"),
      document.querySelector("#n8n-app"),
      document.querySelector("[data-v-app]")
    ].filter(Boolean) as Array<HTMLElement & { __vue_app__?: unknown }>
    const root = roots.find((candidate) => candidate.__vue_app__)
    const app = root?.__vue_app__ as {
      config?: { globalProperties?: { $pinia?: unknown } }
    } | undefined
    const pinia = app?.config?.globalProperties?.$pinia as {
      _s?: Map<string, {
        getSnapshot?: () => unknown
      }>
    } | undefined
    if (!pinia?._s) return undefined

    for (const [storeId, store] of pinia._s) {
      if (!storeId.includes(workflowId) || typeof store.getSnapshot !== "function") {
        continue
      }
      try {
        const snapshot = store.getSnapshot()
        if (
          typeof snapshot === "object" &&
          snapshot !== null &&
          !Array.isArray(snapshot) &&
          (snapshot as { id?: unknown }).id === workflowId &&
          Array.isArray((snapshot as { nodes?: unknown }).nodes)
        ) {
          return JSON.parse(JSON.stringify(snapshot)) as unknown
        }
      } catch {
        // The n8n store can be in transition while the SPA changes routes.
      }
    }
    return undefined
  }

  const loadedWorkflow = readLoadedWorkflow()
  if (loadedWorkflow !== undefined) {
    return { ok: true, status: 200, payload: loadedWorkflow, source: "n8n-store" }
  }

  const response = await fetch(
    `/rest/workflows/${encodeURIComponent(workflowId)}`,
    {
      credentials: "include",
      headers: { Accept: "application/json" }
    }
  )
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    payload = undefined
  }
  return { ok: response.ok, status: response.status, payload, source: "rest" }
}

function unwrapWorkflowPayload(value: unknown): unknown {
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

async function handleN8nWorkflowRequest(
  request: N8nWorkflowRequest,
  sender: chrome.runtime.MessageSender
): Promise<N8nWorkflowResponse> {
  const tabId = sender.tab?.id
  if (tabId === undefined) {
    return {
      ok: false,
      code: "N8N_UNREACHABLE",
      error: "n8n reads must be requested from an n8n tab."
    }
  }

  console.info(`${LOG_PREFIX} reading n8n in page`, { tabId })
  try {
    const execution = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: fetchWorkflowInPage,
      args: [request.workflowId]
    })
    const result = execution[0]?.result
    if (!result) {
      return {
        ok: false,
        code: "N8N_UNREACHABLE",
        error: "n8n did not return a result."
      }
    }
    console.info(`${LOG_PREFIX} n8n page response`, {
      tabId,
      status: result.status,
      source: result.source
    })
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        return {
          ok: false,
          code: "N8N_UNAUTHORIZED",
          error: "The n8n session is invalid. Reload n8n and reconnect."
        }
      }
      if (result.status === 404) {
        return {
          ok: false,
          code: "WORKFLOW_NOT_FOUND",
          error: "Workflow not found in n8n."
        }
      }
      return {
        ok: false,
        code: "N8N_UNREACHABLE",
          error: `Unable to read the n8n workflow (HTTP ${result.status}).`
      }
    }
    const workflow = unwrapWorkflowPayload(result.payload)
    if (typeof workflow !== "object" || workflow === null || Array.isArray(workflow)) {
      return {
        ok: false,
        code: "INVALID_JSON",
        error: "n8n returned an invalid workflow."
      }
    }
    return { ok: true, workflow }
  } catch (error: unknown) {
    console.error(`${LOG_PREFIX} n8n page read failed`, {
      tabId,
      error: error instanceof Error ? error.message : "unknown"
    })
    return {
      ok: false,
      code: "N8N_UNREACHABLE",
      error: "Unable to read n8n from the page."
    }
  }
}

function isRawWorkflowRequest(value: unknown): value is RawWorkflowRequest {
  if (typeof value !== "object" || value === null) return false
  const request = value as Partial<RawWorkflowRequest>
  return request.type === "fetchRawWorkflow" && typeof request.url === "string"
}

function isAllowedRawUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      (url.hostname === "raw.githubusercontent.com" ||
        url.hostname === "github.com")
    )
  } catch {
    return false
  }
}

function isSnapshotRequest(value: unknown): value is SnapshotRequest {
  if (typeof value !== "object" || value === null) return false
  const request = value as Partial<SnapshotRequest>
  if (request.type === "listWorkflowSnapshots") return true
  if (request.type === "deleteWorkflowSnapshot") {
    return typeof request.snapshotId === "string"
  }
  if (request.type === "saveWorkflowSnapshot") {
    return isWorkflowSnapshot(request.snapshot)
  }
  return false
}

function isWorkflowSnapshot(value: unknown): value is WorkflowSnapshot {
  if (typeof value !== "object" || value === null) return false
  const snapshot = value as Partial<WorkflowSnapshot>
  return (
    typeof snapshot.id === "string" &&
    typeof snapshot.workflowKey === "string" &&
    typeof snapshot.contentHash === "string" &&
    typeof snapshot.createdAt === "number" &&
    typeof snapshot.name === "string" &&
    typeof snapshot.model === "object" &&
    snapshot.model !== null
  )
}

async function handleSnapshotRequest(
  request: SnapshotRequest
): Promise<SnapshotResponse> {
  try {
    if (request.type === "saveWorkflowSnapshot") {
      const existing = await findSnapshotByHash(
        request.snapshot.workflowKey,
        request.snapshot.contentHash
      )
      if (existing) return { ok: true, snapshot: existing }
      return { ok: true, snapshot: await saveSnapshot(request.snapshot) }
    }
    if (request.type === "listWorkflowSnapshots") {
      return { ok: true, snapshots: await listSnapshots(request.workflowKey) }
    }
    await deleteSnapshot(request.snapshotId)
    return { ok: true }
  } catch (error: unknown) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Local versioning failed."
    }
  }
}

function localGitErrorResponse(error: unknown): LocalGitResponse {
  if (error instanceof Error && "code" in error) {
    const code = (error as { code?: LocalGitResponse["code"] }).code
    return { ok: false, code, error: error.message }
  }
  return { ok: false, code: "STORAGE_ERROR", error: "The local service is unavailable." }
}

function githubErrorResponse(error: unknown): GitHubResponse {
  if (error instanceof Error && "code" in error) {
    const typed = error as { code?: GitHubResponse["code"]; confirmation?: GitHubResponse["confirmation"] }
    return {
      ok: false,
      code: typed.code,
      confirmation: typed.confirmation,
      error: error.message
    }
  }
  return { ok: false, code: "NETWORK_ERROR", error: "The GitHub service is unavailable." }
}

async function handleGitHubRequest(request: GitHubRequest): Promise<GitHubResponse> {
  try {
    if (request.type === "githubStartDeviceFlow") {
      const flow = await githubAuth.startDeviceFlow()
      void chrome.tabs.create({ url: flow.verificationUri })
      return { ok: true, ...flow }
    }
    if (request.type === "githubWaitForAuthorization") {
      await githubAuth.waitForAuthorization()
      return { ok: true, connected: true }
    }
    if (request.type === "githubCancelDeviceFlow") {
      githubAuth.cancelDeviceFlow()
      return { ok: true }
    }
    if (request.type === "githubConnectWithToken") {
      await githubAuth.connectWithToken(request.token)
      try {
        await pushService.getAuthor()
      } catch (error: unknown) {
        await githubAuth.disconnect()
        throw error
      }
      return { ok: true, connected: true }
    }
    if (request.type === "githubDisconnect") {
      await githubAuth.disconnect()
      return { ok: true }
    }
    if (request.type === "githubIsConnected") {
      return { ok: true, connected: await githubAuth.isConnected() }
    }
    if (request.type === "githubListRepositories") {
      return { ok: true, repositories: await pushService.listRepositories() }
    }
    if (request.type === "githubGetAuthor") {
      return { ok: true, author: await pushService.getAuthor() }
    }
    if (request.type === "githubListBranches") {
      return {
        ok: true,
        branches: await pushService.listBranches(request.owner, request.repo)
      }
    }
    if (request.type === "githubLinkRemote") {
      return { ok: true, remote: await pushService.linkRemote(request.config) }
    }
    if (request.type === "githubGetPushStatus") {
      return { ok: true, pushStatus: await pushService.getPushStatus() }
    }
    return { ok: true, pushResult: await pushService.push(request.options) }
  } catch (error: unknown) {
    return githubErrorResponse(error)
  }
}

async function handleLocalGitRequest(
  request: LocalGitRequest
): Promise<LocalGitResponse> {
  console.info(`${LOG_PREFIX} local request`, { type: request.type })
  try {
    if (request.type === "refreshLocalGitStatus") {
      const service = new DefaultLocalGitService(
        new ProvidedWorkflowSource(request.workflow)
      )
      return {
        ok: true,
        status: await service.refreshStatus(request.workflowId)
      }
    }
    if (request.type === "addLocalGit") {
      const service = new DefaultLocalGitService(
        new ProvidedWorkflowSource(request.workflow)
      )
      return {
        ok: true,
        addResult: await service.add(
          request.workflowId,
          request.filePath
        )
      }
    }
    if (request.type === "commitLocalGit") {
      return {
        ok: true,
        commit: await localGitService.commit(request.message, request.author)
      }
    }
    return {
      ok: true,
      commits: await localGitService.listCommits(request.limit)
    }
  } catch (error: unknown) {
    console.error(`${LOG_PREFIX} local request failed`, {
      type: request.type,
      error: error instanceof Error ? error.message : "unknown"
    })
    return localGitErrorResponse(error)
  }
}

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender,
    sendResponse: (response: BackgroundResponse) => void
  ) => {
    if (typeof message === "object" && message !== null) {
      console.info(`${LOG_PREFIX} message received`, {
        type: (message as { type?: unknown }).type
      })
    }
    if (isSnapshotRequest(message)) {
      void handleSnapshotRequest(message).then(sendResponse)
      return true
    }

    if (isN8nWorkflowRequest(message)) {
      void handleN8nWorkflowRequest(message, _sender).then(sendResponse)
      return true
    }

    if (isLocalGitRequest(message)) {
      void handleLocalGitRequest(message).then(sendResponse)
      return true
    }

    if (isGitHubRequest(message)) {
      void handleGitHubRequest(message).then(sendResponse)
      return true
    }

    if (!isRawWorkflowRequest(message) || !isAllowedRawUrl(message.url)) {
      return false
    }

    void fetch(message.url, { redirect: "follow" })
      .then(async (response) => {
        if (!response.ok) {
          sendResponse({ ok: false, error: `HTTP ${response.status}` })
          return
        }
        sendResponse({ ok: true, text: await response.text() })
      })
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          error:
            error instanceof Error ? error.message : "Download failed"
        })
      })

    return true
  }
)
