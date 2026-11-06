import { LocalGitError } from "@/models/localGit"

// These fields come from n8n's editor/API response, not from the portable
// workflow definition. Keep execution data (nodes, connections, settings,
// pinData, staticData, nodeGroups, tags, and meta) intact.
export const N8N_RESPONSE_METADATA_KEYS = [
  "activeVersionId",
  "checksum",
  "createdAt",
  "homeProject",
  "isArchived",
  "scopes",
  "sharedWithProjects",
  "updatedAt",
  "usedCredentials",
  "versionId"
] as const

type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject
type JsonObject = { [key: string]: JsonValue }

/** Vérifie qu'une valeur est un objet simple (ni null, ni tableau). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Valide récursivement une valeur JSON, trie les clés des objets et retire les métadonnées n8n à la racine. */
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
  if (Array.isArray(value))
    return value.map((item) => sortValue(item, depth + 1))
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
      N8N_RESPONSE_METADATA_KEYS.some((metadataKey) => metadataKey === key)
    ) {
      continue
    }
    result[key] = sortValue(value[key], depth + 1)
  }
  return result
}

/** Sérialise une valeur en JSON indenté avec des clés triées, pour obtenir un résultat stable et comparable. */
export function stableStringify(value: unknown): string {
  const sorted = sortValue(value, 0)
  return JSON.stringify(sorted, null, 2)
}

/** Normalise un workflow n8n en JSON stable (sans métadonnées de réponse) terminé par un saut de ligne. */
export function normalizeWorkflow(workflow: unknown): string {
  if (!isPlainObject(workflow)) {
    throw new LocalGitError(
      "INVALID_JSON",
      "The n8n response does not contain valid workflow JSON."
    )
  }
  return `${stableStringify(workflow)}\n`
}

/** Calcule le hash SHA-256 (hexadécimal) d'une chaîne de caractères. */
export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")
}

/** Normalise un workflow et retourne son contenu normalisé avec son hash SHA-256. */
export async function hashWorkflow(workflow: unknown): Promise<{
  content: string
  hash: string
}> {
  const content = normalizeWorkflow(workflow)
  return { content, hash: await sha256(content) }
}
