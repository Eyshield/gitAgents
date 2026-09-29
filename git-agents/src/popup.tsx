import { PopupApp } from "@/components/PopupApp"
import { OpenLocalGitButton } from "@/components/versioning/OpenLocalGitButton"
import { WorkflowHistory } from "@/components/versioning/WorkflowHistory"
import { WorkflowViewModeSettings } from "@/components/WorkflowViewModeSettings"

import "@/styles/globals.css"

function IndexPopup() {
  return (
    <div
      id="gitflow-studio-root"
      className="flex h-[560px] max-h-[600px] w-[380px] max-w-[100vw] flex-col overflow-hidden bg-base text-foreground">
      <header className="shrink-0 border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-foreground">
              GitAgent Studio
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              GitHub workflow visualization
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-border bg-base px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Local
          </span>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          <section className="rounded-md border border-primary/40 bg-primary/5 p-3">
            <p className="text-sm font-medium text-foreground">
              Extension ready
            </p>
            <p className="mt-1 text-xs leading-4 text-muted-foreground">
              Open an n8n JSON file on GitHub to display its workflow and save
              its local history.
            </p>
          </section>
          <WorkflowViewModeSettings />
          <OpenLocalGitButton />
          <WorkflowHistory />
        </div>
      </main>
    </div>
  )
}

export default PopupApp
