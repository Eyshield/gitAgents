import { detectWorkflowFormat } from "@/core/workflows/detector"
import { githubAuth, type GitHubAuth } from "@/integrations/github/githubAuth"
import {
  GitHubApiError,
  githubClient,
  type GitHubClient
} from "@/integrations/github/githubClient"
import {
  githubGitData,
  type GitHubGitData,
  type GitTreeEntry
} from "@/integrations/github/githubGitData"
import {
  githubRepos,
  type GitHubBranch,
  type GitHubContent,
  type GitHubRepos,
  type GitHubRepository,
  type GitHubUser,
  type RepoRef
} from "@/integrations/github/githubRepos"
import {
  PullError,
  PushError,
  type BlobRecord,
  type Commit,
  type LinkConfig,
  type PullResult,
  type PushConfirmation,
  type PushResult,
  type Remote
} from "@/models/localGit"
import { hasObviousSecret } from "@/services/localGitService"
import {
  hashWorkflow,
  sha256,
  stableStringify
} from "@/services/workflowNormalizer"
import { LocalGitRepository } from "@/storage/localGitRepository"
import { remoteRepository, RemoteRepository } from "@/storage/remoteRepository"

export type PushStatus = {
  linked: boolean
  ahead: number
  branch?: string
  owner?: string
  repo?: string
}

export type PullInput = {
  workflowId?: string
  workflow?: unknown
}

export interface PushService {
  getAuthor(): Promise<{ name: string; email: string }>
  listRepositories(): Promise<RepoRef[]>
  listBranches(owner: string, repo: string): Promise<string[]>
  linkRemote(config: LinkConfig): Promise<Remote>
  getPushStatus(): Promise<PushStatus>
  push(options?: {
    confirmedDefaultBranch?: boolean
    confirmedOverwrite?: boolean
  }): Promise<PushResult>
  pull(input?: PullInput): Promise<PullResult>
}

/** Convertit une erreur quelconque en `PullError` (codes 401/403/404 GitHub, erreurs de stockage, réseau). */
export function mapPullError(
  error: unknown,
  fallback: "repo" | "branch" | "network" = "network"
): PullError {
  if (error instanceof PullError) return error
  if (error instanceof GitHubApiError) {
    if (error.status === 401) {
      return new PullError("REAUTH_REQUIRED", "GitHub reconnection required.")
    }
    if (error.status === 403) {
      return new PullError(
        "GITHUB_FORBIDDEN",
        "GitHub denied the requested access. Check repository permissions."
      )
    }
    if (error.status === 404) {
      if (fallback === "branch") {
        return new PullError("BRANCH_NOT_FOUND", "GitHub branch not found.")
      }
      if (fallback === "repo") {
        return new PullError("REPO_NOT_FOUND", "GitHub repository not found.")
      }
    }
  }
  if (
    error instanceof Error &&
    error.message === "The local remote changed during pull."
  ) {
    return new PullError("STORAGE_ERROR", error.message)
  }
  if (error instanceof Error && error.message === "HEAD changed during pull.") {
    return new PullError("STORAGE_ERROR", error.message)
  }
  return new PullError("NETWORK_ERROR", "Unable to complete the GitHub pull.")
}

/** Convertit une erreur quelconque en `PushError` (401, 403 avec rate limit, 404, erreurs de stockage, réseau). */
export function mapGitHubError(
  error: unknown,
  fallback: "repo" | "branch" | "network" = "network"
): PushError {
  if (error instanceof PushError) return error
  if (error instanceof GitHubApiError) {
    if (error.status === 401) {
      return new PushError("REAUTH_REQUIRED", "GitHub reconnection required.")
    }
    if (error.status === 403) {
      return new PushError(
        error.rateLimitRemaining === "0" ? "RATE_LIMITED" : "GITHUB_FORBIDDEN",
        error.rateLimitRemaining === "0"
          ? "The GitHub rate limit has been reached. Try again later."
          : "GitHub denied the requested access. Check repository permissions."
      )
    }
    if (error.status === 404) {
      if (fallback === "branch")
        return new PushError("BRANCH_NOT_FOUND", "GitHub branch not found.")
      if (fallback === "repo")
        return new PushError("REPO_NOT_FOUND", "GitHub repository not found.")
    }
  }
  if (
    error instanceof Error &&
    error.message === "The local remote changed during push."
  ) {
    return new PushError(
      "STORAGE_ERROR",
      "The local remote changed during push."
    )
  }
  return new PushError(
    "NETWORK_ERROR",
    "Unable to complete the GitHub operation."
  )
}

/** Nettoie le dossier cible (slashs de début/fin) et rejette les segments vides, `.` ou `..`. */
function normalizeBasePath(value: string): string {
  const path = value.trim().replace(/^\/+|\/+$/g, "")
  if (
    path
      .split("/")
      .some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new PushError("STORAGE_ERROR", "The target folder is invalid.")
  }
  return path
}

/** Construit le chemin distant d'un fichier `.json` à partir du dossier cible, avec validation du chemin. */
function remotePath(basePath: string, filePath: string): string {
  const cleanFilePath = filePath.replace(/^\/+/, "")
  if (
    !cleanFilePath.endsWith(".json") ||
    cleanFilePath
      .split("/")
      .some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new PushError("STORAGE_ERROR", "The workflow path is invalid.")
  }
  return basePath ? `${basePath}/${cleanFilePath}` : cleanFilePath
}

/** Indexe les entrées d'un commit par `workflowId`. */
function entriesByWorkflow(
  commit: Commit | undefined
): Map<string, Commit["entries"][number]> {
  return new Map(
    (commit?.entries ?? []).map((entry) => [entry.workflowId, entry])
  )
}

/** Retourne les entrées du commit nouvelles ou modifiées (hash ou chemin) par rapport au commit précédent. */
function changedEntries(
  commit: Commit,
  previous: Commit | undefined
): Commit["entries"] {
  const previousEntries = entriesByWorkflow(previous)
  return commit.entries.filter((entry) => {
    const previousEntry = previousEntries.get(entry.workflowId)
    return (
      !previousEntry ||
      previousEntry.blobHash !== entry.blobHash ||
      previousEntry.filePath !== entry.filePath
    )
  })
}

/** Décode le contenu base64 d'un fichier GitHub en texte UTF-8. */
function decodeGitHubContent(content: GitHubContent): string | undefined {
  if (content.type !== "file" || !content.content) return undefined
  const normalized = content.content.replace(/\s/g, "")
  const bytes = Uint8Array.from(atob(normalized), (character) =>
    character.charCodeAt(0)
  )
  return new TextDecoder().decode(bytes)
}

/** Lit un fichier distant à une référence donnée ; retourne `undefined` s'il n'existe pas (404). */
async function getExistingContent(
  repositories: GitHubRepos,
  remote: Remote,
  path: string,
  ref = remote.branch
): Promise<string | undefined> {
  try {
    const content = await repositories.getContent(
      remote.owner,
      remote.repo,
      path,
      ref
    )
    return decodeGitHubContent(content)
  } catch (error: unknown) {
    if (error instanceof GitHubApiError && error.status === 404)
      return undefined
    throw error
  }
}

type RemoteFile = {
  path: string
  content: string
  hash: string
}

/** Lit un workflow distant, valide son JSON et retourne son contenu normalisé avec son hash. */
async function readRemoteFile(
  repositories: GitHubRepos,
  remote: Remote,
  path: string,
  ref: string
): Promise<RemoteFile | undefined> {
  const content = await getExistingContent(repositories, remote, path, ref)
  if (content === undefined) return undefined
  let workflow: unknown
  try {
    workflow = JSON.parse(content) as unknown
  } catch {
    throw new PullError(
      "STORAGE_ERROR",
      `The remote file ${path} does not contain valid workflow JSON.`
    )
  }
  const normalized = await hashWorkflow(workflow)
  return { path, content: normalized.content, hash: normalized.hash }
}

/** Indexe les entrées d'un commit par chemin de fichier. */
function entriesByPath(
  commit: Commit | undefined
): Map<string, Commit["entries"][number]> {
  return new Map(
    (commit?.entries ?? []).map((entry) => [entry.filePath, entry])
  )
}

/** Liste triée des chemins avec des changements locaux en attente (index + workflow courant modifié). */
function hasLocalChanges(
  index: Array<{ filePath: string }>,
  workflowPath: string | undefined,
  workflowChanged: boolean
): string[] {
  const paths = new Set(index.map((entry) => entry.filePath))
  if (workflowChanged && workflowPath) paths.add(workflowPath)
  return Array.from(paths).sort()
}

/** Extrait l'id du workflow depuis son JSON, ou utilise le chemin du fichier à défaut. */
function getRemoteWorkflowId(content: string, path: string): string {
  try {
    const parsed = JSON.parse(content) as { id?: unknown }
    if (typeof parsed.id === "string" && parsed.id.trim()) return parsed.id
  } catch {
    // readRemoteFile already validates the JSON before this helper is called.
  }
  return path
}

function workflowNodeCount(value: unknown): number | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !("nodes" in value)
  ) {
    return undefined
  }
  return Array.isArray(value.nodes) ? value.nodes.length : undefined
}

/** Service de synchronisation GitHub : liaison du dépôt, push des commits locaux et pull avec détection de conflits. */
export class DefaultPushService implements PushService {
  constructor(
    private readonly auth: GitHubAuth = githubAuth,
    private readonly client: GitHubClient = githubClient,
    private readonly repositories: GitHubRepos = githubRepos,
    private readonly gitData: GitHubGitData = githubGitData,
    private readonly localRepository = new LocalGitRepository(),
    private readonly remotes: RemoteRepository = remoteRepository
  ) {}

  /** Liste les dépôts GitHub accessibles à l'utilisateur. */
  listRepositories(): Promise<RepoRef[]> {
    return this.repositories.listRepositories().catch((error: unknown) => {
      throw mapGitHubError(error, "repo")
    })
  }

  /** Liste les branches d'un dépôt GitHub. */
  listBranches(owner: string, repo: string): Promise<string[]> {
    return this.repositories
      .listBranches(owner, repo)
      .catch((error: unknown) => {
        throw mapGitHubError(error, "branch")
      })
  }

  /** Lie le workflow local à un dépôt/branche GitHub (vérifie l'accès en écriture) et enregistre le remote « origin ». */
  async linkRemote(config: LinkConfig): Promise<Remote> {
    const owner = config.owner.trim()
    const repo = config.repo.trim()
    const branch = config.branch.trim()
    if (!owner || !repo || !branch) {
      throw new PushError(
        "REPO_NOT_FOUND",
        "Repository and branch are required."
      )
    }
    const basePath = normalizeBasePath(config.basePath)
    try {
      const repository = await this.repositories.getRepository(owner, repo)
      if (repository.permissions?.push !== true) {
        throw new PushError(
          "NO_REPO_ACCESS",
          "You do not have write access to this repository."
        )
      }
      let branchData: GitHubBranch
      try {
        branchData = await this.repositories.getBranch(owner, repo, branch)
      } catch (error: unknown) {
        throw mapGitHubError(error, "branch")
      }
      const user = await this.repositories.getUser()
      const author = {
        name: config.authorName?.trim() || user.name?.trim() || user.login,
        email:
          config.authorEmail?.trim() ||
          user.email?.trim() ||
          `${user.id}+${user.login}@users.noreply.github.com`
      }
      await this.saveAuthor(author)
      const remote: Remote = {
        name: "origin",
        provider: "github",
        owner,
        repo,
        branch,
        basePath,
        remoteHeadSha: branchData.commit.sha,
        lastPushedCommitId: null,
        linkedAt: Date.now()
      }
      await this.remotes.save(remote)
      return remote
    } catch (error: unknown) {
      if (error instanceof PushError) throw error
      throw mapGitHubError(error, "repo")
    }
  }

  /** Récupère l'auteur (nom, email) depuis le compte GitHub et le sauvegarde localement. */
  async getAuthor(): Promise<{ name: string; email: string }> {
    try {
      const user = await this.repositories.getUser()
      const author = {
        name: user.name?.trim() || user.login,
        email:
          user.email?.trim() ||
          `${user.id}+${user.login}@users.noreply.github.com`
      }
      await this.saveAuthor(author)
      return author
    } catch (error: unknown) {
      throw mapGitHubError(error)
    }
  }

  /** Retourne l'état du remote : lié ou non, et nombre de commits locaux en avance. */
  async getPushStatus(): Promise<PushStatus> {
    const remote = await this.remotes.get()
    if (!remote) return { linked: false, ahead: 0 }
    const history = await this.localRepository.getCommitHistory()
    return {
      linked: true,
      ahead: this.commitsAfter(history.commits, remote.lastPushedCommitId)
        .length,
      branch: remote.branch,
      owner: remote.owner,
      repo: remote.repo
    }
  }

  /** Pousse les commits locaux vers GitHub (contrôles de secrets, de format et de confirmation avant toute écriture). */
  async push(
    options: {
      confirmedDefaultBranch?: boolean
      confirmedOverwrite?: boolean
    } = {}
  ): Promise<PushResult> {
    const remote = await this.remotes.get()
    if (!remote)
      throw new PushError("NO_REMOTE_LINKED", "Link a GitHub repository first.")
    const history = await this.localRepository.getCommitHistory()
    const commits = this.commitsAfter(
      history.commits,
      remote.lastPushedCommitId
    )
    if (commits.length === 0)
      throw new PushError(
        "NOTHING_TO_PUSH",
        "There are no new commits to push."
      )

    console.log(
      "[push] remote",
      remote.owner,
      remote.repo,
      remote.branch,
      remote.basePath,
      remote.remoteHeadSha
    )
    console.log(
      "[push] commits à pousser",
      commits.map((commit) => ({
        id: commit.id,
        message: commit.message,
        entries: commit.entries.length
      }))
    )

    try {
      const branchData = await this.repositories.getBranch(
        remote.owner,
        remote.repo,
        remote.branch
      )
      if (branchData.commit.sha !== remote.remoteHeadSha) {
        throw new PushError(
          "REMOTE_CHANGED",
          "The remote repository changed. Pull the remote changes before pushing again."
        )
      }
      const repository = await this.repositories.getRepository(
        remote.owner,
        remote.repo
      )
      if (
        remote.branch === repository.default_branch &&
        !options.confirmedDefaultBranch
      ) {
        throw new PushError(
          "CONFIRMATION_REQUIRED",
          `Commits will be pushed directly to ${remote.branch}.`,
          "defaultBranch"
        )
      }

      const previousCommit = remote.lastPushedCommitId
        ? history.commits.find(
            (commit) => commit.id === remote.lastPushedCommitId
          )
        : undefined
      const plans: Array<{ commit: Commit; entries: Commit["entries"] }> = []
      let previousLocalCommit = previousCommit
      for (const commit of commits) {
        plans.push({
          commit,
          entries: changedEntries(commit, previousLocalCommit)
        })
        previousLocalCommit = commit
      }
      console.log(
        "[push] plans",
        plans.map((plan) => ({
          commit: plan.commit.id,
          files: plan.entries.map((entry) => entry.filePath)
        }))
      )

      const normalizedContents = new Map<string, string>()
      for (const plan of plans) {
        for (const entry of plan.entries) {
          const blob = await this.localRepository.getBlob(entry.blobHash)
          if (!blob)
            throw new PushError("STORAGE_ERROR", "Local blob not found.")
          let workflow: unknown
          try {
            workflow = JSON.parse(blob.content) as unknown
          } catch {
            throw new PushError(
              "STORAGE_ERROR",
              `The workflow ${entry.filePath} contains invalid JSON and was not pushed.`
            )
          }
          if (detectWorkflowFormat(workflow) !== "n8n") {
            throw new PushError(
              "STORAGE_ERROR",
              `The file ${entry.filePath} is not a valid n8n workflow and was not pushed.`
            )
          }
          const normalized = await hashWorkflow(workflow)
          console.log("[push] validate", entry.filePath, {
            blobHash: entry.blobHash,
            normalizedHash: normalized.hash,
            rawLength: blob.content.length,
            normalizedLength: normalized.content.length,
            rawNodes: workflowNodeCount(workflow),
            normalizedNodes: workflowNodeCount(
              JSON.parse(normalized.content) as unknown
            )
          })
          normalizedContents.set(entry.blobHash, normalized.content)
          if (hasObviousSecret(workflow) || hasObviousSecret(blob.content)) {
            throw new PushError(
              "SECRET_DETECTED",
              "A potential secret was detected. Push is blocked before any write."
            )
          }
        }
      }

      const author = await this.getAuthor()
      const firstCommit = commits[0]
      if (!remote.lastPushedCommitId && !options.confirmedOverwrite) {
        for (const entry of firstCommit.entries) {
          const blob = await this.localRepository.getBlob(entry.blobHash)
          if (!blob)
            throw new PushError("STORAGE_ERROR", "Local blob not found.")
          const path = remotePath(remote.basePath, entry.filePath)
          const existing = await getExistingContent(
            this.repositories,
            remote,
            path
          )
          const content = normalizedContents.get(entry.blobHash) ?? blob.content
          if (existing !== undefined && existing !== content) {
            throw new PushError(
              "CONFIRMATION_REQUIRED",
              `The file ${path} already exists on GitHub and will be overwritten.`,
              "overwrite"
            )
          }
        }
      }

      let parentSha = remote.remoteHeadSha
      // Git Trees API expects a tree SHA here, not the parent commit SHA.
      // Passing the commit SHA can make subsequent pushes build from an invalid
      // base tree and drop files that were already present on the branch.
      let baseTreeSha = await this.gitData.getCommitTree(
        remote.owner,
        remote.repo,
        parentSha
      )
      let latestSha = parentSha
      for (const plan of plans) {
        const { commit, entries } = plan
        const tree: GitTreeEntry[] = []
        for (const entry of entries) {
          const blob = await this.localRepository.getBlob(entry.blobHash)
          if (!blob)
            throw new PushError("STORAGE_ERROR", "Local blob not found.")
          const content = normalizedContents.get(entry.blobHash) ?? blob.content
          const blobSha = await this.gitData.createBlob(
            remote.owner,
            remote.repo,
            content
          )
          console.log(
            "[push] createBlob",
            remotePath(remote.basePath, entry.filePath),
            blobSha,
            content.length
          )
          tree.push({
            path: remotePath(remote.basePath, entry.filePath),
            mode: "100644",
            type: "blob",
            sha: blobSha
          })
        }
        const treeSha = await this.gitData.createTree(
          remote.owner,
          remote.repo,
          baseTreeSha,
          tree
        )
        console.log("[push] createTree", {
          baseTreeSha,
          treeSha,
          entries: tree.length
        })
        const created = await this.gitData.createCommit(
          remote.owner,
          remote.repo,
          {
            message: commit.message,
            tree: treeSha,
            parentSha,
            author: {
              name: author.name,
              email: author.email,
              date: new Date(commit.timestamp).toISOString()
            }
          }
        )
        console.log("[push] createCommit", created.sha, "parent", parentSha)
        latestSha = created.sha
        parentSha = created.sha
        baseTreeSha = treeSha
      }

      await this.gitData.updateBranch(
        remote.owner,
        remote.repo,
        remote.branch,
        latestSha
      )
      console.log("[push] updateBranch", latestSha)
      await this.remotes.updateAfterPush(
        remote.remoteHeadSha,
        latestSha,
        history.head.commitId!
      )
      return {
        pushedCommits: commits.length,
        headSha: latestSha,
        commitUrl: `https://github.com/${remote.owner}/${remote.repo}/commit/${latestSha}`
      }
    } catch (error: unknown) {
      if (error instanceof PushError) throw error
      if (error instanceof GitHubApiError && error.status === 422) {
        throw new PushError(
          "REMOTE_CHANGED",
          "The remote repository changed. Pull the remote changes before pushing again."
        )
      }
      throw mapGitHubError(error)
    }
  }

  /** Récupère les changements distants, les fusionne (base/local/distant) et crée un commit local, ou échoue en cas de conflit. */
  async pull(input: PullInput = {}): Promise<PullResult> {
    const remote = await this.remotes.get()
    if (!remote) {
      throw new PullError(
        "NO_REMOTE_LINKED",
        'No Git remote named "origin" is configured.'
      )
    }

    try {
      let branchData: GitHubBranch
      try {
        branchData = await this.repositories.getBranch(
          remote.owner,
          remote.repo,
          remote.branch
        )
      } catch (error: unknown) {
        throw mapPullError(error, "branch")
      }
      const remoteHeadSha = branchData.commit.sha
      if (remoteHeadSha === remote.remoteHeadSha) {
        return {
          status: "up-to-date",
          updatedFiles: 0,
          remoteHeadSha,
          conflicts: []
        }
      }

      const state = await this.localRepository.getState()
      const headEntries = state.headCommit?.entries ?? []
      const baseCommit = remote.lastPushedCommitId
        ? await this.localRepository.getCommit(remote.lastPushedCommitId)
        : undefined
      const baseEntries = entriesByPath(baseCommit)
      const headEntriesByFile = entriesByPath(state.headCommit)
      const trackedPaths = new Set<string>([
        ...headEntries.map((entry) => entry.filePath),
        ...state.index.map((entry) => entry.filePath),
        ...Array.from(baseEntries.keys())
      ])

      let currentWorkflowHash: string | undefined
      let currentWorkflowPath: string | undefined
      let currentWorkflowChanged = false
      if (input.workflow !== undefined) {
        const current = await hashWorkflow(input.workflow)
        currentWorkflowHash = current.hash
        const currentEntry = input.workflowId
          ? headEntries.find((entry) => entry.workflowId === input.workflowId)
          : undefined
        currentWorkflowPath = currentEntry?.filePath
        currentWorkflowChanged = currentEntry?.blobHash !== current.hash
        if (currentWorkflowPath) trackedPaths.add(currentWorkflowPath)
      }

      if (trackedPaths.size === 0) {
        await this.remotes.updateAfterPull(
          remote.remoteHeadSha,
          remoteHeadSha,
          remote.lastPushedCommitId
        )
        return {
          status: "updated",
          updatedFiles: 0,
          remoteHeadSha,
          conflicts: []
        }
      }

      const remoteFiles = new Map<string, RemoteFile | undefined>()
      const baseFiles = new Map<string, RemoteFile | undefined>()
      for (const path of trackedPaths) {
        remoteFiles.set(
          path,
          await readRemoteFile(
            this.repositories,
            remote,
            remotePath(remote.basePath, path),
            remote.branch
          )
        )
        baseFiles.set(
          path,
          await readRemoteFile(
            this.repositories,
            remote,
            remotePath(remote.basePath, path),
            remote.remoteHeadSha
          )
        )
      }

      const pendingPaths = hasLocalChanges(
        state.index,
        currentWorkflowPath,
        currentWorkflowChanged
      )
      const conflicts = new Set<string>()
      const mergedEntries = new Map<string, Commit["entries"][number]>()
      const blobs = new Map<string, BlobRecord>()
      let updatedFiles = 0

      for (const path of trackedPaths) {
        const localEntry = headEntriesByFile.get(path)
        const baseEntry = baseEntries.get(path)
        const remoteFile = remoteFiles.get(path)
        const baseFile = baseFiles.get(path)
        const localHash = localEntry?.blobHash
        // The remote file at the last known remote head is the source of truth
        // for the pushed baseline. Older local commits may still contain n8n
        // API response metadata that is stripped when the workflow is pushed.
        const baseHash = baseFile?.hash ?? baseEntry?.blobHash
        const remoteHash = remoteFile?.hash
        const localChanged = localHash !== baseHash
        const remoteChanged = remoteHash !== baseHash

        if (localChanged && remoteChanged && localHash !== remoteHash) {
          conflicts.add(path)
        }
        if (remoteChanged && localHash !== remoteHash) updatedFiles += 1

        if (remoteFile) {
          if (remoteChanged) {
            const workflowId =
              localEntry?.workflowId ??
              getRemoteWorkflowId(remoteFile.content, path)
            mergedEntries.set(path, {
              workflowId,
              filePath: path,
              blobHash: remoteFile.hash
            })
            blobs.set(remoteFile.hash, {
              hash: remoteFile.hash,
              content: remoteFile.content,
              size: new TextEncoder().encode(remoteFile.content).byteLength,
              createdAt: Date.now()
            })
          } else if (localEntry) {
            mergedEntries.set(path, localEntry)
          }
        } else if (!remoteChanged && localEntry) {
          mergedEntries.set(path, localEntry)
        }
      }

      for (const path of pendingPaths) {
        const remoteFile = remoteFiles.get(path)
        const localEntry = headEntriesByFile.get(path)
        const currentHash =
          path === currentWorkflowPath
            ? currentWorkflowHash
            : localEntry?.blobHash
        if (remoteFile?.hash !== currentHash) conflicts.add(path)
      }

      if (conflicts.size > 0) {
        const conflictList = Array.from(conflicts).sort()
        throw new PullError(
          "MERGE_CONFLICT",
          `Pull stopped because of merge conflicts. Conflicted files: ${conflictList.join(", ")}`,
          conflictList
        )
      }
      if (pendingPaths.length > 0) {
        throw new PullError(
          "LOCAL_CHANGES",
          "Pull could not be completed. Commit or stash your local changes before pulling."
        )
      }

      const merged = Array.from(mergedEntries.values()).sort((left, right) =>
        left.filePath.localeCompare(right.filePath)
      )
      const current = [...headEntries].sort((left, right) =>
        left.filePath.localeCompare(right.filePath)
      )
      const entriesChanged =
        stableStringify(merged) !== stableStringify(current)
      const localAhead = state.head.commitId !== remote.lastPushedCommitId

      if (!entriesChanged) {
        await this.remotes.updateAfterPull(
          remote.remoteHeadSha,
          remoteHeadSha,
          remote.lastPushedCommitId
        )
        return {
          status: localAhead ? "merged" : "updated",
          updatedFiles,
          remoteHeadSha,
          conflicts: []
        }
      }

      const timestamp = Date.now()
      const commitData = {
        parentId: state.head.commitId,
        message: `Pull origin/${remote.branch}`,
        author: "GitHub",
        timestamp,
        entries: merged
      }
      const commit: Commit = {
        id: await sha256(stableStringify(commitData)),
        ...commitData
      }
      await this.localRepository.applyPulledCommit(
        commit,
        Array.from(blobs.values()),
        state.head.commitId,
        remote.remoteHeadSha,
        remoteHeadSha,
        localAhead ? remote.lastPushedCommitId : commit.id
      )
      return {
        status: localAhead ? "merged" : "updated",
        updatedFiles,
        remoteHeadSha,
        conflicts: []
      }
    } catch (error: unknown) {
      if (error instanceof PullError) throw error
      throw mapPullError(error, "network")
    }
  }

  /** Retourne les commits situés après le dernier commit poussé (tous si rien n'a encore été poussé). */
  private commitsAfter(
    commits: Commit[],
    lastPushedCommitId: string | null
  ): Commit[] {
    if (!lastPushedCommitId) return commits
    const index = commits.findIndex(
      (commit) => commit.id === lastPushedCommitId
    )
    if (index < 0)
      throw new PushError(
        "STORAGE_ERROR",
        "Local remote history is inconsistent."
      )
    return commits.slice(index + 1)
  }

  /** Sauvegarde l'auteur GitHub dans `chrome.storage.local`. */
  private async saveAuthor(author: {
    name: string
    email: string
  }): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      chrome.storage.local.set({ github_author: author }, () => {
        const error = chrome.runtime.lastError
        if (error) reject(new Error(error.message))
        else resolve()
      })
    })
  }
}

export const pushService = new DefaultPushService()
