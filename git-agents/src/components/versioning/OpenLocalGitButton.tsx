import { isExtensionContextValid } from "@/core/extension-context"
import { useEffect, useState } from "react"

import "@/styles/globals.css"

const LOG_PREFIX = "[GitAgent][popup]"

type ActiveWorkflow = {
  tabId: number
}

function getActiveWorkflow(tab?: chrome.tabs.Tab): ActiveWorkflow | null {
  if (!tab?.id || !tab.url) return null
  try {
    const url = new URL(tab.url)
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return null
    }
    if (!/^\/workflow\/[^/]+/.test(url.pathname)) return null
    return { tabId: tab.id }
  } catch {
    return null
  }
}

function readActiveWorkflow(): Promise<ActiveWorkflow | null> {
  return new Promise((resolve) => {
    console.info(`${LOG_PREFIX} searching for the active n8n tab`)
    if (!isExtensionContextValid() || !chrome.tabs?.query) {
      console.warn(`${LOG_PREFIX} Chrome API unavailable in popup`)
      resolve(null)
      return
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const runtimeError = chrome.runtime.lastError
      if (runtimeError) {
        console.error(`${LOG_PREFIX} tabs.query failed`, runtimeError.message)
        resolve(null)
        return
      }
      const activeWorkflow = getActiveWorkflow(tabs[0])
      console.info(`${LOG_PREFIX} tab detected`, {
        tabId: tabs[0]?.id,
        isN8nWorkflow: Boolean(activeWorkflow)
      })
      resolve(activeWorkflow)
    })
  })
}

export function OpenLocalGitButton() {
  const [workflow, setWorkflow] = useState<ActiveWorkflow | null>(null)
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    void readActiveWorkflow().then((activeWorkflow) => {
      console.info(`${LOG_PREFIX} initial state`, {
        hasWorkflow: Boolean(activeWorkflow)
      })
      setWorkflow(activeWorkflow)
      setLoading(false)
    })
  }, [])

  const openPanel = () => {
    if (!workflow) {
      console.warn(`${LOG_PREFIX} opening cancelled: no active workflow`)
      return
    }
    setOpening(true)
    setNotice(null)
    console.info(`${LOG_PREFIX} envoi openN8nLocalPanel`, {
      tabId: workflow.tabId
    })
    chrome.tabs.sendMessage(
      workflow.tabId,
      { type: "openN8nLocalPanel" },
      () => {
        const runtimeError = chrome.runtime.lastError
        if (runtimeError) {
          console.error(
            `${LOG_PREFIX} content script unreachable`,
            runtimeError.message
          )
          setNotice(`Failed: ${runtimeError.message}`)
        } else {
          console.info(`${LOG_PREFIX} message received by content script`)
          setNotice("Local Git panel opened in the n8n tab.")
        }
        setOpening(false)
      }
    )
  }

  return (
    <section className="space-y-3 border-t border-border pt-4">
      <div>
        <h2 className="text-sm font-medium text-foreground">Local n8n Git</h2>
        <p className="mt-1 text-xs leading-4 text-muted-foreground">
          Open the Add / Commit panel directly in the active n8n tab.
        </p>
      </div>
      {loading && (
        <p className="text-xs text-muted-foreground">
          Reading active tab…
        </p>
      )}
      {!loading && !workflow && (
        <p className="rounded-md border border-border bg-surface p-3 text-xs leading-4 text-muted-foreground">
          First open a local n8n workflow at
          <span className="mx-1 font-mono text-foreground">
            http://localhost:5678/workflow/&lt;id&gt;
          </span>
          .
        </p>
      )}
      {!loading && workflow && (
        <button
          className="h-8 w-full rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50"
          disabled={opening}
          onClick={openPanel}
          type="button">
          {opening ? "Opening…" : "Open local Git panel"}
        </button>
      )}
      {notice && (
        <p className="break-words text-xs text-muted-foreground">{notice}</p>
      )}
    </section>
  )
}
