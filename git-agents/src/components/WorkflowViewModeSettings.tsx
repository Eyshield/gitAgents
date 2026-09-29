import {
  readWorkflowViewMode,
  writeWorkflowViewMode,
  type WorkflowViewMode
} from "@/core/settings/view-mode"
import { useEffect, useState } from "react"

import "@/styles/globals.css"

export function WorkflowViewModeSettings() {
  const [mode, setMode] = useState<WorkflowViewMode>("automatic")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void readWorkflowViewMode().then(setMode)
  }, [])

  const selectMode = (nextMode: WorkflowViewMode) => {
    setMode(nextMode)
    setSaved(false)
    void writeWorkflowViewMode(nextMode).then(() => setSaved(true))
  }

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Workflow display
      </legend>
      <label className="group flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface p-2.5 transition-colors hover:border-primary has-[:checked]:border-primary">
        <input
          checked={mode === "automatic"}
          className="peer sr-only"
          name="workflow-view-mode"
          onChange={() => selectMode("automatic")}
          type="radio"
        />
        <span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border border-muted-foreground transition-colors peer-checked:border-primary peer-checked:bg-primary">
          <span className="size-1.5 rounded-full bg-white opacity-0 group-has-[input:checked]:opacity-100" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-medium leading-5 text-foreground">
            Automatic
          </span>
          <span className="block break-words text-[11px] leading-4 text-muted-foreground">
            Automatically replaces JSON with the canvas.
          </span>
        </span>
      </label>
      <label className="group flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface p-2.5 transition-colors hover:border-primary has-[:checked]:border-primary">
        <input
          checked={mode === "manual"}
          className="peer sr-only"
          name="workflow-view-mode"
          onChange={() => selectMode("manual")}
          type="radio"
        />
        <span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border border-muted-foreground transition-colors peer-checked:border-primary peer-checked:bg-primary">
          <span className="size-1.5 rounded-full bg-white opacity-0 group-has-[input:checked]:opacity-100" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-medium leading-5 text-foreground">
            Manual
          </span>
          <span className="block break-words text-[11px] leading-4 text-muted-foreground">
            Keeps the JSON and displays a button to open the canvas.
          </span>
        </span>
      </label>
      {saved && <p className="text-xs text-success">Preference saved.</p>}
    </fieldset>
  )
}
