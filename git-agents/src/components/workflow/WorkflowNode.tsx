import type { WorkflowNode as WorkflowNodeData } from "@/core/workflows/types"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import {
  Blocks,
  Braces,
  CircleOff,
  Clock3,
  Cloud,
  Database,
  FileText,
  Filter,
  GitMerge,
  Globe,
  Mail,
  MessageCircle,
  MousePointerClick,
  Settings2,
  Table2,
  Timer,
  Webhook,
  type LucideIcon
} from "lucide-react"
import {
  siAirtable,
  siDiscord,
  siDocker,
  siGithub,
  siGitlab,
  siGmail,
  siGooglecalendar,
  siGoogledrive,
  siGooglesheets,
  siNotion,
  siStripe,
  siTelegram,
  siTrello,
  siWhatsapp,
  siZapier
} from "simple-icons"
import type { SimpleIcon } from "simple-icons"

import "@/styles/globals.css"

function getNodeIcon(node: WorkflowNodeData): LucideIcon {
  const value = `${node.platformType ?? ""} ${node.name}`.toLowerCase()

  if (value.includes("webhook")) return Webhook
  if (value.includes("manualtrigger") || value.includes("manual trigger")) {
    return MousePointerClick
  }
  if (value.includes("schedule") || value.includes("cron")) return Clock3
  if (value.includes("googlesheets") || value.includes("google sheets")) {
    return Table2
  }
  if (value.includes("awss3") || value.includes("aws s3")) return Cloud
  if (value.includes("slack")) return MessageCircle
  if (value.includes("gmail") || value.includes("email")) return Mail
  if (value.includes("httprequest") || value.includes("http request")) {
    return Globe
  }
  if (
    value.includes("postgres") ||
    value.includes("mysql") ||
    value.includes("mongo")
  ) {
    return Database
  }
  if (value.includes("filter") || value.includes("if")) return Filter
  if (value.includes("merge")) return GitMerge
  if (value.includes("wait")) return Timer
  if (value.includes("set")) return Settings2
  if (value.includes("code") || value.includes("function")) return Braces
  if (value.includes("file") || value.includes("binary")) return FileText
  return Blocks
}

function getBrandIcon(node: WorkflowNodeData): SimpleIcon | null {
  const value = `${node.platformType ?? ""} ${node.name}`.toLowerCase()

  if (value.includes("gmail")) return siGmail
  if (value.includes("googledrive") || value.includes("google drive")) {
    return siGoogledrive
  }
  if (value.includes("googlesheets") || value.includes("google sheets")) {
    return siGooglesheets
  }
  if (value.includes("googlecalendar") || value.includes("google calendar")) {
    return siGooglecalendar
  }
  if (value.includes("discord")) return siDiscord
  if (value.includes("github")) return siGithub
  if (value.includes("gitlab")) return siGitlab
  if (value.includes("notion")) return siNotion
  if (value.includes("telegram")) return siTelegram
  if (value.includes("whatsapp")) return siWhatsapp
  if (value.includes("stripe")) return siStripe
  if (value.includes("docker")) return siDocker
  if (value.includes("trello")) return siTrello
  if (value.includes("airtable")) return siAirtable
  if (value.includes("zapier")) return siZapier
  return null
}

function BrandIcon({ icon }: { icon: SimpleIcon }) {
  return (
    <svg
      aria-label={`${icon.title} logo`}
      className="size-9 rounded-md border border-border bg-surface p-1"
      fill="none"
      role="img"
      viewBox="0 0 24 24">
      <path d={icon.path} fill={`#${icon.hex}`} />
    </svg>
  )
}

function formatNodeType(node: WorkflowNodeData): string {
  return (
    node.platformType
      ?.replace(/^n8n-nodes-base\./, "")
      .replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)
      .trim() || node.type
  )
}

export function WorkflowNode({ data, selected }: NodeProps) {
  const workflowNode = data as WorkflowNodeData
  const NodeIcon = getNodeIcon(workflowNode)
  const brandIcon = getBrandIcon(workflowNode)

  return (
    <div className="flex w-32 flex-col items-center">
      <div
        className={`relative flex size-20 items-center justify-center rounded-lg border bg-surface ${selected ? "border-accent" : "border-border"}`}>
        <Handle
          className="!bg-muted-foreground"
          position={Position.Left}
          type="target"
        />
        {workflowNode.metadata?.disabled === true ? (
          <CircleOff className="size-8 text-muted-foreground" />
        ) : brandIcon ? (
          <BrandIcon icon={brandIcon} />
        ) : (
          <NodeIcon aria-hidden="true" className="size-7 text-primary" />
        )}
        <Handle
          className="!bg-primary"
          position={Position.Right}
          type="source"
        />
      </div>
      <p className="mt-2 max-w-32 truncate text-center text-xs font-medium text-foreground">
        {workflowNode.name}
      </p>
      <p className="max-w-32 truncate text-center text-xs text-muted-foreground">
        {formatNodeType(workflowNode)}
      </p>
    </div>
  )
}
