import { OpenLocalGitButton } from "@/components/versioning/OpenLocalGitButton"
import { WorkflowHistory } from "@/components/versioning/WorkflowHistory"
import { WorkflowViewModeSettings } from "@/components/WorkflowViewModeSettings"
import { isGitHubConnected } from "@/services/githubMessaging"
import { useEffect, useState } from "react"
import iconUrl from "url:~assets/icon.png"

import "@/styles/globals.css"

function GitHubStatus() {
  const [connected, setConnected] = useState<boolean | null>(null)

  useEffect(() => {
    void isGitHubConnected().then((response) => {
      setConnected(response.ok && response.connected === true)
    })
  }, [])

  return (
    <div className="flex items-center justify-between border-b border-border px-3.5 py-2 text-[11px]">
      <span className="text-muted-foreground">GitHub</span>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span
          className={`size-1.5 rounded-full ${connected ? "bg-success" : "bg-muted-foreground"}`}
        />
        {connected === null
          ? "Vérification…"
          : connected
            ? "Connecté"
            : "Non connecté"}
      </span>
    </div>
  )
}

export function PopupApp() {
  return (
    <div
      id="gitflow-studio-root"
      className="flex h-[560px] max-h-[600px] w-[380px] max-w-[100vw] flex-col overflow-hidden bg-base text-foreground">
      <header className="shrink-0 border-b border-border bg-surface px-3.5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              className="flex size-7 shrink-0 items-center justify-center rounded-md border border-primary/50 bg-base font-mono text-[10px] font-semibold text-primary"
              src={iconUrl}
              alt=""
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground">
                GitAgent Studio
              </h2>
              <p className="truncate text-[11px] text-muted-foreground">
                Workflow tooling
              </p>
            </div>
          </div>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            v0.0.1
          </span>
        </div>
      </header>
      <GitHubStatus />
      <main className="min-h-0 flex-1 overflow-y-auto p-3.5">
        <div className="space-y-5">
          <WorkflowViewModeSettings />
          <OpenLocalGitButton />
          <WorkflowHistory />
        </div>
      </main>
      <footer className="shrink-0 border-t border-border px-3.5 py-2 text-[10px] text-muted-foreground">
        Dark mode · local-first versioning
      </footer>
    </div>
  )
}
