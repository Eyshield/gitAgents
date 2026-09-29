import { LocalCommitPanel } from "@/components/LocalCommitPanel"
import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"

import "@/styles/globals.css"

const LOG_PREFIX = "[GitAgent][n8n-content]"

console.info(`${LOG_PREFIX} content script loaded`, {
  origin: location.origin,
  isWorkflowRoute: location.pathname.startsWith("/workflow/")
})

export const config: PlasmoCSConfig = {
  matches: ["http://localhost/*", "http://127.0.0.1/*"]
}

function getWorkflowId(): string | null {
  const match = location.pathname.match(/^\/workflow\/([^/]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

function N8nLocalOverlay({ workflowId }: { workflowId: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleMessage = (message: unknown) => {
      const messageType =
        typeof message === "object" && message !== null
          ? (message as { type?: unknown }).type
          : undefined
      console.info(`${LOG_PREFIX} runtime message received`, { messageType })
      if (
        messageType === "openN8nLocalPanel"
      ) {
        console.info(`${LOG_PREFIX} panel opening requested`)
        setOpen(true)
      }
    }
    chrome.runtime.onMessage.addListener(handleMessage)
    console.info(`${LOG_PREFIX} runtime listener installed`)
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
      console.info(`${LOG_PREFIX} runtime listener removed`)
    }
  }, [])

  if (!open) return null

  return (
    <aside className="fixed right-4 top-4 z-[2147483647] w-[360px] max-w-[calc(100vw-2rem)] text-foreground">
      <div className="overflow-hidden rounded-lg border border-border bg-base">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">GitAgent Studio</p>
            <p className="truncate text-[10px] text-muted-foreground">
              n8n · Local
            </p>
          </div>
          <button
            className="rounded border border-border bg-transparent px-2 py-1 text-[10px] text-muted-foreground hover:bg-white/5 hover:text-foreground"
            onClick={() => setOpen((value) => !value)}
            type="button">
            {open ? "Collapse" : "Open"}
          </button>
        </div>
        {open && (
          <div className="max-h-[calc(100vh-5rem)] space-y-3 overflow-y-auto p-3">
            <LocalCommitPanel
              workflowId={workflowId}
            />
          </div>
        )}
      </div>
    </aside>
  )
}

function N8nLocalContentScript() {
  const [workflowId, setWorkflowId] = useState<string | null>(getWorkflowId)

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextId = getWorkflowId()
      setWorkflowId((current) => {
        if (current !== nextId) {
          console.info(`${LOG_PREFIX} workflow route changed`, {
            hadWorkflow: Boolean(current),
            hasWorkflow: Boolean(nextId)
          })
        }
        return current === nextId ? current : nextId
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  if (!workflowId) return null
  return <N8nLocalOverlay key={workflowId} workflowId={workflowId} />
}

const mountPoint = document.createElement("div")
mountPoint.id = "gitflow-studio-root"
mountPoint.dataset.gitflowStudio = "n8n-local"
document.documentElement.appendChild(mountPoint)
console.info(`${LOG_PREFIX} mount point added`)
createRoot(mountPoint).render(<N8nLocalContentScript />)
