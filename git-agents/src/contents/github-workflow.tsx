import { Button } from "@/components/ui/button"
import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas"
import {
  hasExtensionRuntimeError,
  isExtensionContextValid
} from "@/core/extension-context"
import {
  readWorkflowViewMode,
  type WorkflowViewMode
} from "@/core/settings/view-mode"
import { saveWorkflowSnapshot } from "@/core/versioning/messaging"
import { getGitHubWorkflowRef } from "@/core/versioning/remote-ref"
import { createWorkflowSnapshot } from "@/core/versioning/snapshot"
import { parseWorkflow } from "@/core/workflows/parse-workflow"
import type { InternalWorkflowModel } from "@/core/workflows/types"
import type { PlasmoCSConfig } from "plasmo"
import type { MouseEvent, ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { createRoot, type Root } from "react-dom/client"

import "@/styles/globals.css"
import "@xyflow/react/dist/style.css"

export const config: PlasmoCSConfig = {
  matches: ["https://github.com/*/*/blob/*"]
}

type WorkflowViewProps = {
  workflow: InternalWorkflowModel
  onShowSource: () => void
}

function WorkflowView({ workflow, onShowSource }: WorkflowViewProps) {
  const [snapshotStatus, setSnapshotStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle")
  const remote = useMemo(() => getGitHubWorkflowRef(), [])

  const saveLocalSnapshot = () => {
    setSnapshotStatus("saving")
    void saveWorkflowSnapshot(createWorkflowSnapshot(workflow, remote)).then(
      (response) => setSnapshotStatus(response.ok ? "saved" : "error")
    )
  }

  useEffect(() => {
    saveLocalSnapshot()
  }, [workflow, remote])

  const handleShowSource = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onShowSource()
  }

  return (
    <section className="relative isolate z-0 overflow-hidden rounded-lg border border-border bg-surface text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3.5 py-2.5">
        <div>
          <p className="text-sm font-medium">{workflow.meta.name}</p>
          <p className="text-xs text-muted-foreground">n8n · Read-only</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="relative z-10 !pointer-events-auto cursor-pointer"
            data-gitflow-action="save-snapshot"
            disabled={snapshotStatus === "saving"}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              saveLocalSnapshot()
            }}
            size="sm"
            type="button"
            variant="outline">
            {snapshotStatus === "saving"
              ? "Saving…"
              : "Save locally"}
          </Button>
          <Button
            className="relative z-10 !pointer-events-auto cursor-pointer"
            data-gitflow-action="show-source"
            onClick={handleShowSource}
            size="sm"
            type="button"
            variant="outline">
            View JSON
          </Button>
        </div>
      </header>
      <div className="border-b border-border px-3.5 py-2 text-[11px] text-muted-foreground">
        {snapshotStatus === "saved" && "Local version saved."}
        {snapshotStatus === "error" &&
          "Unable to save the local version."}
      </div>
      <WorkflowCanvas workflow={workflow} />
    </section>
  )
}

function WorkflowLoading() {
  return (
    <section className="flex h-[700px] w-full items-center justify-center bg-base text-foreground">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="size-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
        Analyzing workflow…
      </div>
    </section>
  )
}

function WorkflowError({ onShowSource }: { onShowSource: () => void }) {
  const handleShowSource = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onShowSource()
  }

  return (
    <section className="flex h-[700px] w-full items-center justify-center bg-base text-foreground">
      <div className="max-w-md space-y-3 rounded-lg border border-border bg-surface p-6 text-center">
        <p className="text-sm font-medium">
          Unable to visualize this workflow.
        </p>
        <p className="text-xs text-muted-foreground">
          The JSON file could not be interpreted as a valid n8n workflow.
        </p>
        <Button
          className="relative z-10 !pointer-events-auto cursor-pointer"
          data-gitflow-action="show-source"
          onClick={handleShowSource}
          size="sm"
          type="button"
          variant="outline">
          View JSON
        </Button>
      </div>
    </section>
  )
}

function ManualWorkflowPrompt({ onOpen }: { onOpen: () => void }) {
  const handleOpen = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onOpen()
  }

  return (
    <div className="flex w-full items-center justify-between gap-4 border border-border bg-surface px-4 py-3 text-foreground">
      <div>
        <p className="text-sm font-medium">n8n workflow detected</p>
        <p className="text-xs text-muted-foreground">
          The JSON file is preserved. Open the graph view when needed.
        </p>
      </div>
      <Button
        className="relative z-10 !pointer-events-auto cursor-pointer"
        data-gitflow-action="open-workflow"
        onClick={handleOpen}
        size="sm"
        type="button">
        View as graph
      </Button>
    </div>
  )
}

function getCodeElement(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(".react-code-lines") ??
    document.querySelector<HTMLElement>("td.blob-code")?.closest("table") ??
    document.querySelector<HTMLElement>("table.js-file-line-container") ??
    document.querySelector<HTMLElement>("[data-testid='code-viewer-container']")
  )
}

function getSourceText(codeElement: HTMLElement): string {
  const lines = codeElement.querySelectorAll<HTMLElement>(
    ".react-code-text, td.blob-code"
  )
  return lines.length > 0
    ? Array.from(lines, (line) => line.innerText).join("\n")
    : codeElement.innerText
}

function isWorkflowCandidate(codeElement: HTMLElement): boolean {
  if (/\.json(?:$|[?#])/i.test(location.pathname)) return true
  return /^[\[{]/.test(getSourceText(codeElement).trimStart())
}

function parseJsonText(source: string): unknown {
  const text = source.replace(/^\uFEFF/, "").trim()
  try {
    return JSON.parse(text) as unknown
  } catch {
    const start = text.indexOf("{")
    const end = text.lastIndexOf("}")
    if (start < 0 || end <= start) throw new Error("JSON not found")
    return JSON.parse(text.slice(start, end + 1)) as unknown
  }
}

function getRawUrl(): string | null {
  const rawLink = document.querySelector<HTMLAnchorElement>(
    "a#raw-url, a[data-testid='raw-button']"
  )

  if (rawLink?.href) {
    const rawUrl = new URL(rawLink.href)
    if (rawUrl.hostname === "raw.githubusercontent.com") return rawUrl.href
    const rawPath = rawUrl.pathname.split("/").filter(Boolean)
    const rawIndex = rawPath.indexOf("raw")
    if (rawIndex === 2 && rawPath.length > rawIndex + 1) {
      return `https://raw.githubusercontent.com/${rawPath[0]}/${rawPath[1]}/${rawPath.slice(rawIndex + 1).join("/")}`
    }
  }

  const path = new URL(location.href).pathname.split("/").filter(Boolean)
  const blobIndex = path.indexOf("blob")
  if (path.length >= 5 && blobIndex === 2) {
    return `https://raw.githubusercontent.com/${path[0]}/${path[1]}/${path.slice(blobIndex + 1).join("/")}`
  }

  return null
}

async function readWorkflowValue(codeElement: HTMLElement): Promise<unknown> {
  try {
    const localValue = parseJsonText(getSourceText(codeElement))
    if (parseWorkflow(localValue)) return localValue
  } catch {
    // GitHub may virtualize the DOM, so try the Raw source.
  }

  const rawUrl = getRawUrl()
  if (rawUrl) {
    try {
      const backgroundValue = await fetchRawFromBackground(rawUrl)
      if (backgroundValue !== null) return parseJsonText(backgroundValue)

      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 8000)
      const response = await fetch(rawUrl, {
        credentials: "include",
        signal: controller.signal
      })
      window.clearTimeout(timeout)
      if (response.ok) return parseJsonText(await response.text())
    } catch {
      // Private GitHub or unavailable network: local rendering remains usable.
    }
  }
  return parseJsonText(getSourceText(codeElement))
}

function fetchRawFromBackground(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (!isExtensionContextValid()) {
      resolve(null)
      return
    }

    try {
      globalThis.chrome.runtime.sendMessage(
        { type: "fetchRawWorkflow", url },
        (response?: { ok?: boolean; text?: string }) => {
          try {
            // Reading lastError is required by Chrome for failed message
            // callbacks, including tabs kept alive through back/forward cache.
            if (
              !isExtensionContextValid() ||
              hasExtensionRuntimeError() ||
              !response?.ok ||
              !response.text
            ) {
              resolve(null)
              return
            }
            resolve(response.text)
          } catch {
            // A service-worker restart/reload invalidates this content script.
            resolve(null)
          }
        }
      )
    } catch {
      resolve(null)
    }
  })
}

type WorkflowMount = {
  render: (content: ReactNode) => void
  hideSource: () => void
  showSource: () => void
  restore: () => void
}

function mountWorkflow(
  codeElement: HTMLElement,
  hideSource = true
): WorkflowMount {
  const mountPoint = document.createElement("div")
  mountPoint.id = "gitflow-studio-root"
  mountPoint.dataset.gitflowStudio = "workflow"
  mountPoint.style.pointerEvents = "auto"
  mountPoint.style.width = "100%"
  const viewerElement =
    codeElement.closest<HTMLElement>(
      "[data-testid='code-viewer-container'], .js-file-content, .Box"
    ) ??
    codeElement.parentElement ??
    codeElement
  viewerElement.before(mountPoint)
  let restored = false
  const hideViewer = () => {
    viewerElement.style.display = "none"
  }
  const showViewer = () => {
    viewerElement.style.removeProperty("display")
  }
  if (hideSource) hideViewer()
  const root: Root = createRoot(mountPoint)
  const restoreSource = () => {
    if (restored) return
    restored = true
    root.unmount()
    mountPoint.remove()
    showViewer()
  }
  return {
    render: (content) => root.render(content),
    hideSource: hideViewer,
    showSource: showViewer,
    restore: restoreSource
  }
}

async function tryInject(
  mode: WorkflowViewMode,
  onSourceRequested: () => void
): Promise<(() => void) | null> {
  if (document.querySelector("[data-gitflow-studio='workflow']")) return null
  const codeElement = getCodeElement()
  if (!codeElement) return null
  if (!isWorkflowCandidate(codeElement)) return null

  if (mode === "manual") {
    try {
      const workflow = parseWorkflow(await readWorkflowValue(codeElement))
      if (!workflow) return null
      const mount = mountWorkflow(codeElement, false)
      const renderManualPrompt = () => {
        mount.showSource()
        mount.render(
          <ManualWorkflowPrompt
            onOpen={() => {
              mount.hideSource()
              mount.render(
                <WorkflowView
                  onShowSource={renderManualPrompt}
                  workflow={workflow}
                />
              )
            }}
          />
        )
      }
      renderManualPrompt()
      return mount.restore
    } catch {
      return null
    }
  }

  const mount = mountWorkflow(codeElement)
  mount.render(<WorkflowLoading />)
  try {
    const workflow = parseWorkflow(await readWorkflowValue(codeElement))
    if (!workflow) {
      mount.restore()
      return null
    }
    const renderSourcePrompt = () => {
      mount.showSource()
      mount.render(
        <ManualWorkflowPrompt
          onOpen={() => {
            mount.hideSource()
            mount.render(
              <WorkflowView
                onShowSource={renderSourcePrompt}
                workflow={workflow}
              />
            )
          }}
        />
      )
    }
    mount.render(
      <WorkflowView onShowSource={renderSourcePrompt} workflow={workflow} />
    )
    return mount.restore
  } catch {
    mount.render(
      <WorkflowError
        onShowSource={() => {
          onSourceRequested()
          mount.restore()
        }}
      />
    )
    return mount.restore
  }
}

function ContentScript() {
  useEffect(() => {
    const handleButtonPointerDown = (event: PointerEvent) => {
      const eventTarget = event.target
      if (
        eventTarget instanceof Element &&
        eventTarget.closest("button[data-gitflow-action]")
      ) {
        return
      }

      const buttons = Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          "button[data-gitflow-action]"
        )
      )
      const button = buttons.find((candidate) => {
        const rect = candidate.getBoundingClientRect()
        return (
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        )
      })

      if (!button) return

      event.preventDefault()
      event.stopImmediatePropagation()
      button.click()
    }

    window.addEventListener("pointerdown", handleButtonPointerDown, {
      capture: true,
      passive: false
    })

    return () => {
      window.removeEventListener("pointerdown", handleButtonPointerDown, {
        capture: true
      })
    }
  }, [])

  useEffect(() => {
    let cleanup: (() => void) | null = null
    let timer: number | undefined
    let inFlight = false
    let sourceRequested = false
    let mode: WorkflowViewMode = "automatic"
    let ready = false
    let lastUrl = location.href
    const hasMount = () =>
      Boolean(document.querySelector("[data-gitflow-studio='workflow']"))
    const attempt = () => {
      if (!ready || inFlight || cleanup || sourceRequested || hasMount()) return
      inFlight = true
      void tryInject(mode, () => {
        sourceRequested = true
      })
        .then((result) => {
          cleanup = result
        })
        .finally(() => {
          inFlight = false
        })
    }

    void readWorkflowViewMode().then((storedMode) => {
      mode = storedMode
      ready = true
      attempt()
    })
    const retryTimers = [100, 350, 900, 1800].map((delay) =>
      window.setTimeout(attempt, delay)
    )
    const observer = new MutationObserver(() => {
      const hasNavigated = location.href !== lastUrl
      if (hasNavigated) {
        lastUrl = location.href
        sourceRequested = false
        cleanup?.()
        cleanup = null
      }
      if (cleanup && !hasMount()) {
        cleanup()
        cleanup = null
      }
      if (cleanup || hasMount()) return
      window.clearTimeout(timer)
      timer = window.setTimeout(attempt, 150)
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
      retryTimers.forEach((retryTimer) => window.clearTimeout(retryTimer))
      cleanup?.()
    }
  }, [])
  return null
}

export default ContentScript
