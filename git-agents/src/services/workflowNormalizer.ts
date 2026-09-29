import { LocalGitError } from "@/models/localGit"

// These keys are n8n response metadata, not workflow behavior. Keep this list
// deliberately short until it is validated against the n8n API version in use.
export const RUNTIME_METADATA_KEYS = ["updatedAt", "versionId"] as const

type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject
type JsonObject = { [key: string]: JsonValue }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function sortValue(value: unknown, depth: number): JsonValue {
  if (value === null) return null
  if (typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new LocalGitError(
        "INVALID_JSON",
        "The n8n workflow contains an invalid JSON value."
      )
    }
    return value
  }
  if (Array.isArray(value)) return value.map((item) => sortValue(item, depth + 1))
  if (!isPlainObject(value)) {
    throw new LocalGitError(
      "INVALID_JSON",
      "The n8n response does not contain valid workflow JSON."
    )
  }

  const result: JsonObject = {}
  for (const key of Object.keys(value).sort()) {
    if (
      depth === 0 &&
      RUNTIME_METADATA_KEYS.some((runtimeKey) => runtimeKey === key)
    ) {
      continue
    }
    result[key] = sortValue(value[key], depth + 1)
  }
  return result
}

export function stableStringify(value: unknown): string {
  const sorted = sortValue(value, 0)
  return JSON.stringify(sorted, null, 2)
}

export function normalizeWorkflow(workflow: unknown): string {
  if (!isPlainObject(workflow)) {
    throw new LocalGitError(
      "INVALID_JSON",
      "The n8n response does not contain valid workflow JSON."
    )
  }
  return `${stableStringify(workflow)}\n`
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")
}

export async function hashWorkflow(workflow: unknown): Promise<{
  content: string
  hash: string
}> {
  const content = normalizeWorkflow(workflow)
  return { content, hash: await sha256(content) }
}
