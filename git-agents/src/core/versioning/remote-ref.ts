import type { WorkflowRemoteRef } from "./types"

export function getGitHubWorkflowRef(
  url: string = location.href
): WorkflowRemoteRef | undefined {
  try {
    const parsedUrl = new URL(url)
    if (parsedUrl.hostname !== "github.com") return undefined
    const segments = parsedUrl.pathname.split("/").filter(Boolean)
    const blobIndex = segments.indexOf("blob")
    if (blobIndex !== 2 || segments.length <= blobIndex + 2) return undefined

    const owner = segments[0]
    const repository = segments[1]
    const ref = segments[blobIndex + 1]
    const path = segments.slice(blobIndex + 2).join("/")
    if (!owner || !repository || !ref || !path) return undefined

    return {
      provider: "github",
      owner,
      repository,
      path,
      ref,
      url: parsedUrl.href,
      rawUrl: `https://raw.githubusercontent.com/${owner}/${repository}/${ref}/${path}`
    }
  } catch {
    return undefined
  }
}
