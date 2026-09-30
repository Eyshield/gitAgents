import type { WorkflowNode as WorkflowNodeData } from "@/core/workflows/types"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import {
  Blocks,
  Braces,
  Clock3,
  Cloud,
  Database,
  FileText,
  Filter,
  GitBranch,
  GitMerge,
  Globe,
  Mail,
  MessageCircle,
  MousePointerClick,
  Pencil,
  Table2,
  Timer,
  Webhook,
  Zap,
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

type NodeVisual = { icon: LucideIcon; color: string }

// Couleurs proches de celles utilisées par n8n pour ses icônes natives
const N8N_ICONS: Record<string, NodeVisual> = {
  webhook: { icon: Webhook, color: "#ff6d5a" },
  manualtrigger: { icon: MousePointerClick, color: "#909298" },
  scheduletrigger: { icon: Clock3, color: "#4a4a4a" },
  cron: { icon: Clock3, color: "#4a4a4a" },
  httprequest: { icon: Globe, color: "#2b5fd9" },
  code: { icon: Braces, color: "#ff6d5a" },
  function: { icon: Braces, color: "#ff6d5a" },
  functionitem: { icon: Braces, color: "#ff6d5a" },
  set: { icon: Pencil, color: "#2b5fd9" },
  if: { icon: GitBranch, color: "#4caf50" },
  switch: { icon: GitBranch, color: "#4caf50" },
  filter: { icon: Filter, color: "#4caf50" },
  merge: { icon: GitMerge, color: "#2b5fd9" },
  wait: { icon: Timer, color: "#ff8c42" },
  noop: { icon: Blocks, color: "#909298" },
  slack: { icon: MessageCircle, color: "#4a154b" },
  awss3: { icon: Cloud, color: "#e25444" },
  postgres: { icon: Database, color: "#336791" },
  mysql: { icon: Database, color: "#00758f" },
  mongodb: { icon: Database, color: "#47a248" },
  emailsend: { icon: Mail, color: "#ea4b71" },
  emailreadimap: { icon: Mail, color: "#ea4b71" },
  readbinaryfile: { icon: FileText, color: "#909298" },
  writebinaryfile: { icon: FileText, color: "#909298" },
  googlesheets: { icon: Table2, color: "#0f9d58" }
}

function getShortType(node: WorkflowNodeData): string {
  return (node.platformType ?? "")
    .replace(/^n8n-nodes-base\./, "")
    .replace(/^@n8n\/n8n-nodes-langchain\./, "")
    .toLowerCase()
}

function getNodeVisual(node: WorkflowNodeData): NodeVisual {
  const type = getShortType(node)
  if (N8N_ICONS[type]) return N8N_ICONS[type]

  // Fallback sur le nom si le type n'est pas connu
  const name = node.name.toLowerCase()
  if (name.includes("webhook")) return N8N_ICONS.webhook
  if (name.includes("schedule") || name.includes("cron")) {
    return N8N_ICONS.scheduletrigger
  }
  if (name.includes("http")) return N8N_ICONS.httprequest
  if (name.includes("email") || name.includes("mail"))
    return N8N_ICONS.emailsend
  return { icon: Blocks, color: "#909298" }
}

function isTrigger(node: WorkflowNodeData): boolean {
  const type = getShortType(node)
  return (
    type.includes("trigger") ||
    type === "webhook" ||
    type === "cron" ||
    type === "start"
  )
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

function BrandIcon({
  icon,
  disabled
}: {
  icon: SimpleIcon
  disabled: boolean
}) {
  return (
    <svg
      aria-label={`${icon.title} logo`}
      className={`size-10 ${disabled ? "grayscale" : ""}`}
      fill="none"
      role="img"
      viewBox="0 0 24 24">
      <path d={icon.path} fill={disabled ? "#9ca3af" : `#${icon.hex}`} />
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

const handleClass =
  "!size-3 !rounded-full !border-2 !border-surface !bg-muted-foreground"

export function WorkflowNode({ data, selected }: NodeProps) {
  const workflowNode = data as WorkflowNodeData
  const { icon: NodeIcon, color } = getNodeVisual(workflowNode)
  const brandIcon = getBrandIcon(workflowNode)
  const trigger = isTrigger(workflowNode)
  const disabled = workflowNode.metadata?.disabled === true

  return (
    <div className="flex w-24 flex-col items-center">
      <div
        className={`relative flex size-24 items-center justify-center border-2 bg-surface shadow-sm transition-colors ${
          trigger ? "rounded-l-[48px] rounded-r-xl" : "rounded-xl"
        } ${selected ? "border-accent" : "border-border"}`}>
        {trigger && (
          <Zap
            aria-label="Trigger"
            className="absolute -left-5 top-1/2 size-4 -translate-y-1/2 fill-[#ff6d5a] text-[#ff6d5a]"
          />
        )}

        {!trigger && (
          <Handle
            className={handleClass}
            position={Position.Left}
            type="target"
          />
        )}

        {brandIcon ? (
          <BrandIcon disabled={disabled} icon={brandIcon} />
        ) : (
          <NodeIcon
            aria-hidden="true"
            className="size-10"
            strokeWidth={1.75}
            style={{ color: disabled ? "#9ca3af" : color }}
          />
        )}

        <Handle
          className={handleClass}
          position={Position.Right}
          type="source"
        />
      </div>

      <p
        className={`mt-2 w-40 truncate text-center text-xs font-semibold text-foreground ${
          disabled ? "line-through opacity-60" : ""
        }`}>
        {workflowNode.name}
      </p>
      <p className="w-40 truncate text-center text-[11px] text-muted-foreground">
        {formatNodeType(workflowNode)}
      </p>
    </div>
  )
}
