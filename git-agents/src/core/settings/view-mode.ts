import {
  hasExtensionRuntimeError,
  isExtensionContextValid
} from "@/core/extension-context"

export type WorkflowViewMode = "automatic" | "manual"

const STORAGE_KEY = "workflowViewMode"

export function readWorkflowViewMode(): Promise<WorkflowViewMode> {
  return new Promise((resolve) => {
    if (!isExtensionContextValid()) {
      resolve("automatic")
      return
    }

    try {
      chrome.storage.local.get(
        { [STORAGE_KEY]: "automatic" },
        (result: { [STORAGE_KEY]?: unknown }) => {
          try {
            // Reading lastError prevents Chrome from reporting a rejected
            // callback when an old content script survives an extension reload.
            if (hasExtensionRuntimeError()) {
              resolve("automatic")
              return
            }
            resolve(result[STORAGE_KEY] === "manual" ? "manual" : "automatic")
          } catch {
            resolve("automatic")
          }
        }
      )
    } catch {
      // The extension context can be invalidated while GitHub keeps the tab.
      resolve("automatic")
    }
  })
}

export function writeWorkflowViewMode(mode: WorkflowViewMode): Promise<void> {
  return new Promise((resolve) => {
    if (!isExtensionContextValid()) {
      resolve()
      return
    }

    try {
      chrome.storage.local.set({ [STORAGE_KEY]: mode }, () => {
        try {
          // Consume lastError so a stale context does not create an uncaught
          // runtime.lastError message in the page console.
          void hasExtensionRuntimeError()
        } catch {
          // Context invalidation is safe here; the preference can be retried
          // after the extension is reloaded.
        }
        resolve()
      })
    } catch {
      resolve()
    }
  })
}
