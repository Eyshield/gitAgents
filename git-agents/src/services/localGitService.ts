import { N8nWorkflowSource } from "@/integrations/n8n/n8nWorkflowSource"
import {
  LocalGitError,
  type AddResult,
  type Commit,
  type CommitEntry,
  type LocalGitStatus,
  type StatusEntry,
  type WorkflowSource
} from "@/models/localGit"
import { LocalGitRepository } from "@/storage/localGitRepository"
import { hashWorkflow, sha256, stableStringify } from "@/services/workflowNormalizer"

export interface LocalGitService {
  refreshStatus(workflowId: string): Promise<StatusEntry>
  add(workflowId: string, filePath?: string): Promise<AddResult>
  commit(message: string, author?: string): Promise<Commit>
  listCommits(limit?: number): Promise<Commit[]>
}

export class ProvidedWorkflowSource implements WorkflowSource {
  constructor(private readonly workflow: unknown) {}

  async getWorkflow(): Promise<unknown> {
    return this.workflow
  }

  async testConnection(): Promise<boolean> {
    return true
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isSecretKey(key: string): boolean {
  return /^(api[-_]?key|token|secret|password|client[-_]?secret)$/i.test(key)
}

function resemblesKnownToken(value: string): boolean {
  const candidate = value.trim()
  return (
    /^(gh[pousr]_|github_pat_|glpat-|xox[baprs]-|sk-[A-Za-z0-9])/i.test(
      candidate
    ) ||
    /^AKIA[0-9A-Z]{16}$/.test(candidate) ||
    /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(candidate)
  )
}

function containsObviousSecret(value: unknown, key?: string): boolean {
  if (typeof value === "string") {
    return Boolean(
      (key && isSecretKey(key) && value.trim().length > 0) ||
        resemblesKnownToken(value)
    )
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsObviousSecret(item, key))
  }
  if (isObject(value)) {
    return Object.entries(value).some(([entryKey, entryValue]) =>
      containsObviousSecret(entryValue, entryKey)
    )
  }
  return false
}

export function hasObviousSecret(value: unknown): boolean {
  return containsObviousSecret(value)
}

function getWorkflowName(value: unknown): string {
  if (!isObject(value) || typeof value.name !== "string") return "workflow"
  return value.name
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "workflow"
}

function defaultFilePath(workflow: unknown, workflowId: string): string {
  const name = getWorkflowName(workflow)
  return `workflows/${slugify(name === "workflow" ? workflowId : name)}.json`
}

function statusFromHashes(
  currentHash: string,
  headHash: string | undefined,
  stagedHash: string | undefined
): LocalGitStatus {
  if (stagedHash && stagedHash !== currentHash) return "staged-outdated"
  if (stagedHash === currentHash) return "staged"
  if (!headHash) return "untracked"
  if (headHash !== currentHash) return "modified"
  return "clean"
}

function mapStorageError(error: unknown): LocalGitError {
  if (error instanceof LocalGitError) return error
  return new LocalGitError(
    "STORAGE_ERROR",
    "Unable to save the local commit. Try again."
  )
}

export class DefaultLocalGitService implements LocalGitService {
  constructor(
    private readonly source: WorkflowSource = new N8nWorkflowSource(),
    private readonly repository = new LocalGitRepository()
  ) {}

  async refreshStatus(workflowId: string): Promise<StatusEntry> {
    this.assertSavedWorkflow(workflowId)
    const workflow = await this.readWorkflow(workflowId)
    const { hash: currentHash } = await hashWorkflow(workflow)
    try {
      const state = await this.repository.getState()
      const headEntry = state.headCommit?.entries.find(
        (entry) => entry.workflowId === workflowId
      )
      const stagedEntry = state.index.find(
        (entry) => entry.workflowId === workflowId
      )
      return {
        workflowId,
        currentHash,
        headHash: headEntry?.blobHash,
        stagedHash: stagedEntry?.blobHash,
        filePath: stagedEntry?.filePath ?? headEntry?.filePath,
        status: statusFromHashes(
          currentHash,
          headEntry?.blobHash,
          stagedEntry?.blobHash
        )
      }
    } catch (error: unknown) {
      throw mapStorageError(error)
    }
  }

  async add(workflowId: string, filePath?: string): Promise<AddResult> {
    this.assertSavedWorkflow(workflowId)
    const workflow = await this.readWorkflow(workflowId)
    if (hasObviousSecret(workflow)) {
      throw new LocalGitError(
        "SECRET_DETECTED",
        "A potential secret was detected. Nothing was added."
      )
    }

    const { content, hash } = await hashWorkflow(workflow)
    try {
      const state = await this.repository.getState()
      const headEntry = state.headCommit?.entries.find(
        (entry) => entry.workflowId === workflowId
      )
      const stagedEntry = state.index.find(
        (entry) => entry.workflowId === workflowId
      )
      if (headEntry?.blobHash === hash && !stagedEntry) {
        throw new LocalGitError(
          "NOTHING_TO_ADD",
          "No changes to add."
        )
      }

      const entry = {
        workflowId,
        filePath:
          filePath?.trim() ||
          stagedEntry?.filePath ||
          headEntry?.filePath ||
          defaultFilePath(workflow, workflowId),
        blobHash: hash,
        stagedAt: Date.now()
      }
      await this.repository.addBlobAndIndex(
        {
          hash,
          content,
          size: new TextEncoder().encode(content).byteLength,
          createdAt: Date.now()
        },
        entry
      )
      return { workflowId, filePath: entry.filePath, blobHash: hash, status: "staged" }
    } catch (error: unknown) {
      throw mapStorageError(error)
    }
  }

  async commit(message: string, author?: string): Promise<Commit> {
    const trimmedMessage = message.trim()
    if (!trimmedMessage) {
      throw new LocalGitError("EMPTY_MESSAGE", "A commit message is required.")
    }

    try {
      const state = await this.repository.getState()
      if (state.index.length === 0) {
        throw new LocalGitError(
          "NOTHING_TO_COMMIT",
          "No changes are staged."
        )
      }

      const entriesByWorkflow = new Map<string, CommitEntry>(
        (state.headCommit?.entries ?? []).map((entry) => [
          entry.workflowId,
          entry
        ])
      )
      for (const entry of state.index) {
        entriesByWorkflow.set(entry.workflowId, {
          workflowId: entry.workflowId,
          filePath: entry.filePath,
          blobHash: entry.blobHash
        })
      }
      const entries = Array.from(entriesByWorkflow.values()).sort((left, right) =>
        left.workflowId.localeCompare(right.workflowId)
      )
      const timestamp = Date.now()
      const commitData = {
        parentId: state.head.commitId,
        message: trimmedMessage,
        author: author?.trim() || "Local user",
        timestamp,
        entries
      }
      const commit: Commit = {
        id: await sha256(stableStringify(commitData)),
        ...commitData
      }
      await this.repository.commitAtomically(commit, state.head.commitId)
      return commit
    } catch (error: unknown) {
      if (error instanceof LocalGitError) throw error
      throw mapStorageError(error)
    }
  }

  async listCommits(limit = 10): Promise<Commit[]> {
    try {
      return await this.repository.listCommits(Math.max(0, Math.min(limit, 100)))
    } catch (error: unknown) {
      throw mapStorageError(error)
    }
  }

  private assertSavedWorkflow(workflowId: string): void {
    if (!workflowId || workflowId.toLowerCase() === "new") {
      throw new LocalGitError(
        "WORKFLOW_UNSAVED",
        "This workflow has not been saved in n8n yet."
      )
    }
  }

  private async readWorkflow(workflowId: string): Promise<unknown> {
    try {
      return await this.source.getWorkflow(workflowId)
    } catch (error: unknown) {
      if (error instanceof LocalGitError) throw error
      throw new LocalGitError(
        "N8N_UNREACHABLE",
        "Unable to reach n8n. Check that it is running and that the URL is correct."
      )
    }
  }
}

export const localGitService = new DefaultLocalGitService()
