import {
  hasExtensionRuntimeError,
  isExtensionContextValid
} from "@/core/extension-context"

import type { WorkflowSnapshot } from "./types"

type SnapshotMessage =
  | { type: "saveWorkflowSnapshot"; snapshot: WorkflowSnapshot }
  | { type: "listWorkflowSnapshots"; workflowKey?: string }
  | { type: "deleteWorkflowSnapshot"; snapshotId: string }

type SnapshotResponse = {
  ok: boolean
  snapshot?: WorkflowSnapshot
  snapshots?: WorkflowSnapshot[]
  error?: string
}

function sendMessage(message: SnapshotMessage): Promise<SnapshotResponse> {
  return new Promise((resolve) => {
    if (!isExtensionContextValid()) {
      resolve({
        ok: false,
        error: "The extension context is no longer available."
      })
      return
    }

    try {
      chrome.runtime.sendMessage(message, (response?: SnapshotResponse) => {
        if (hasExtensionRuntimeError() || !response) {
          resolve({
            ok: false,
            error: "The local versioning service is unavailable."
          })
          return
        }
        resolve(response)
      })
    } catch {
      resolve({
        ok: false,
        error: "The local versioning service is unavailable."
      })
    }
  })
}

export function saveWorkflowSnapshot(
  snapshot: WorkflowSnapshot
): Promise<SnapshotResponse> {
  return sendMessage({ type: "saveWorkflowSnapshot", snapshot })
}

export function listWorkflowSnapshots(
  workflowKey?: string
): Promise<SnapshotResponse> {
  return sendMessage({ type: "listWorkflowSnapshots", workflowKey })
}

export function deleteWorkflowSnapshot(
  snapshotId: string
): Promise<SnapshotResponse> {
  return sendMessage({ type: "deleteWorkflowSnapshot", snapshotId })
}
