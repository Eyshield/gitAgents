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
  type GitHubRepository,
  type GitHubUser,
  type RepoRef,
  type GitHubRepos
} from "@/integrations/github/githubRepos"
import {
  PushError,
  type Commit,
  type LinkConfig,
  type PushConfirmation,
  type PushResult,
  type Remote
} from "@/models/localGit"
import { remoteRepository, RemoteRepository } from "@/storage/remoteRepository"
import { LocalGitRepository } from "@/storage/localGitRepository"
import { hasObviousSecret } from "@/services/localGitService"

export type PushStatus = {
  linked: boolean
  ahead: number
  branch?: string
  owner?: string
  repo?: string
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
}

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
      if (fallback === "branch") return new PushError("BRANCH_NOT_FOUND", "GitHub branch not found.")
      if (fallback === "repo") return new PushError("REPO_NOT_FOUND", "GitHub repository not found.")
    }
  }
  if (error instanceof Error && error.message === "The local remote changed during push.") {
    return new PushError("STORAGE_ERROR", "The local remote changed during push.")
  }
  return new PushError("NETWORK_ERROR", "Unable to complete the GitHub operation.")
}

function normalizeBasePath(value: string): string {
  const path = value.trim().replace(/^\/+|\/+$/g, "")
  if (path.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    throw new PushError("STORAGE_ERROR", "The target folder is invalid.")
  }
  return path
}

function remotePath(basePath: string, filePath: string): string {
  const cleanFilePath = filePath.replace(/^\/+/, "")
  if (
    !cleanFilePath.endsWith(".json") ||
    cleanFilePath.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new PushError("STORAGE_ERROR", "The workflow path is invalid.")
  }
  return basePath ? `${basePath}/${cleanFilePath}` : cleanFilePath
}

function entriesByWorkflow(commit: Commit | undefined): Map<string, Commit["entries"][number]> {
  return new Map((commit?.entries ?? []).map((entry) => [entry.workflowId, entry]))
}

function changedEntries(commit: Commit, previous: Commit | undefined): Commit["entries"] {
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

function decodeGitHubContent(content: GitHubContent): string | undefined {
  if (content.type !== "file" || !content.content) return undefined
  const normalized = content.content.replace(/\s/g, "")
  const bytes = Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

async function getExistingContent(
  repositories: GitHubRepos,
  remote: Remote,
  path: string
): Promise<string | undefined> {
  try {
    const content = await repositories.getContent(
      remote.owner,
      remote.repo,
      path,
      remote.branch
    )
    return decodeGitHubContent(content)
  } catch (error: unknown) {
    if (error instanceof GitHubApiError && error.status === 404) return undefined
    throw error
  }
}

export class DefaultPushService implements PushService {
  constructor(
    private readonly auth: GitHubAuth = githubAuth,
    private readonly client: GitHubClient = githubClient,
    private readonly repositories: GitHubRepos = githubRepos,
    private readonly gitData: GitHubGitData = githubGitData,
    private readonly localRepository = new LocalGitRepository(),
    private readonly remotes: RemoteRepository = remoteRepository
  ) {}

  listRepositories(): Promise<RepoRef[]> {
    return this.repositories.listRepositories().catch((error: unknown) => {
      throw mapGitHubError(error, "repo")
    })
  }

  listBranches(owner: string, repo: string): Promise<string[]> {
    return this.repositories.listBranches(owner, repo).catch((error: unknown) => {
      throw mapGitHubError(error, "branch")
    })
  }

  async linkRemote(config: LinkConfig): Promise<Remote> {
    const owner = config.owner.trim()
    const repo = config.repo.trim()
    const branch = config.branch.trim()
    if (!owner || !repo || !branch) {
      throw new PushError("REPO_NOT_FOUND", "Repository and branch are required.")
    }
    const basePath = normalizeBasePath(config.basePath)
    try {
      const repository = await this.repositories.getRepository(owner, repo)
      if (repository.permissions?.push !== true) {
        throw new PushError("NO_REPO_ACCESS", "You do not have write access to this repository.")
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

  async getAuthor(): Promise<{ name: string; email: string }> {
    try {
      const user = await this.repositories.getUser()
      const author = {
        name: user.name?.trim() || user.login,
        email:
          user.email?.trim() || `${user.id}+${user.login}@users.noreply.github.com`
      }
      await this.saveAuthor(author)
      return author
    } catch (error: unknown) {
      throw mapGitHubError(error)
    }
  }

  async getPushStatus(): Promise<PushStatus> {
    const remote = await this.remotes.get()
    if (!remote) return { linked: false, ahead: 0 }
    const history = await this.localRepository.getCommitHistory()
    return {
      linked: true,
      ahead: this.commitsAfter(history.commits, remote.lastPushedCommitId).length,
      branch: remote.branch,
      owner: remote.owner,
      repo: remote.repo
    }
  }

  async push(options: {
    confirmedDefaultBranch?: boolean
    confirmedOverwrite?: boolean
  } = {}): Promise<PushResult> {
    const remote = await this.remotes.get()
    if (!remote) throw new PushError("NO_REMOTE_LINKED", "Link a GitHub repository first.")
    const history = await this.localRepository.getCommitHistory()
    const commits = this.commitsAfter(history.commits, remote.lastPushedCommitId)
    if (commits.length === 0) throw new PushError("NOTHING_TO_PUSH", "There are no new commits to push.")

    try {
      const branchData = await this.repositories.getBranch(remote.owner, remote.repo, remote.branch)
      if (branchData.commit.sha !== remote.remoteHeadSha) {
        throw new PushError(
          "REMOTE_CHANGED",
          "The remote repository changed. A pull will be required (coming soon)."
        )
      }
      const repository = await this.repositories.getRepository(remote.owner, remote.repo)
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
        ? history.commits.find((commit) => commit.id === remote.lastPushedCommitId)
        : undefined
      const plans: Array<{ commit: Commit; entries: Commit["entries"] }> = []
      let previousLocalCommit = previousCommit
      for (const commit of commits) {
        plans.push({ commit, entries: changedEntries(commit, previousLocalCommit) })
        previousLocalCommit = commit
      }

      for (const plan of plans) {
        for (const entry of plan.entries) {
          const blob = await this.localRepository.getBlob(entry.blobHash)
          if (!blob) throw new PushError("STORAGE_ERROR", "Local blob not found.")
          let parsed: unknown
          try {
            parsed = JSON.parse(blob.content)
          } catch {
            parsed = blob.content
          }
          if (hasObviousSecret(parsed) || hasObviousSecret(blob.content)) {
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
          if (!blob) throw new PushError("STORAGE_ERROR", "Local blob not found.")
          const path = remotePath(remote.basePath, entry.filePath)
          const existing = await getExistingContent(this.repositories, remote, path)
          if (existing !== undefined && existing !== blob.content) {
            throw new PushError(
              "CONFIRMATION_REQUIRED",
              `The file ${path} already exists on GitHub and will be overwritten.`,
              "overwrite"
            )
          }
        }
      }

      let parentSha = remote.remoteHeadSha
      let latestSha = parentSha
      for (const plan of plans) {
        const { commit, entries } = plan
        const tree: GitTreeEntry[] = []
        for (const entry of entries) {
          const blob = await this.localRepository.getBlob(entry.blobHash)
          if (!blob) throw new PushError("STORAGE_ERROR", "Local blob not found.")
          const blobSha = await this.gitData.createBlob(remote.owner, remote.repo, blob.content)
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
          parentSha,
          tree
        )
        const created = await this.gitData.createCommit(remote.owner, remote.repo, {
          message: commit.message,
          tree: treeSha,
          parentSha,
          author: {
            name: author.name,
            email: author.email,
            date: new Date(commit.timestamp).toISOString()
          }
        })
        latestSha = created.sha
        parentSha = created.sha
      }

      await this.gitData.updateBranch(
        remote.owner,
        remote.repo,
        remote.branch,
        latestSha
      )
      await this.remotes.updateAfterPush(remote.remoteHeadSha, latestSha, history.head.commitId!)
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
          "The remote repository changed. A pull will be required (coming soon)."
        )
      }
      throw mapGitHubError(error)
    }
  }

  private commitsAfter(commits: Commit[], lastPushedCommitId: string | null): Commit[] {
    if (!lastPushedCommitId) return commits
    const index = commits.findIndex((commit) => commit.id === lastPushedCommitId)
    if (index < 0) throw new PushError("STORAGE_ERROR", "Local remote history is inconsistent.")
    return commits.slice(index + 1)
  }

  private async saveAuthor(author: { name: string; email: string }): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      chrome.storage.local.set(
        { github_author: author },
        () => {
          const error = chrome.runtime.lastError
          if (error) reject(new Error(error.message))
          else resolve()
        }
      )
    })
  }
}

export const pushService = new DefaultPushService()
