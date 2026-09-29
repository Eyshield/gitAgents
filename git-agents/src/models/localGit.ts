export const LOCAL_GIT_DATABASE_NAME = "gitagent-local"
export const LOCAL_GIT_DATABASE_VERSION = 2

export type LocalGitStatus =
  | "untracked"
  | "modified"
  | "staged"
  | "staged-outdated"
  | "clean"

export type LocalGitErrorCode =
  | "EMPTY_MESSAGE"
  | "NOTHING_TO_COMMIT"
  | "NOTHING_TO_ADD"
  | "SECRET_DETECTED"
  | "N8N_UNREACHABLE"
  | "N8N_UNAUTHORIZED"
  | "WORKFLOW_NOT_FOUND"
  | "WORKFLOW_UNSAVED"
  | "INVALID_JSON"
  | "STORAGE_ERROR"

export type PushErrorCode =
  | "NO_REMOTE_LINKED"
  | "NOTHING_TO_PUSH"
  | "REAUTH_REQUIRED"
  | "DEVICE_CODE_EXPIRED"
  | "AUTH_DENIED"
  | "APP_NOT_INSTALLED"
  | "NO_REPO_ACCESS"
  | "GITHUB_UNAUTHORIZED"
  | "GITHUB_FORBIDDEN"
  | "REPO_NOT_FOUND"
  | "BRANCH_NOT_FOUND"
  | "REPO_EMPTY"
  | "REMOTE_CHANGED"
  | "CONFIRMATION_REQUIRED"
  | "SECRET_DETECTED"
  | "RATE_LIMITED"
  | "NETWORK_ERROR"
  | "STORAGE_ERROR"

export type PushConfirmation = "defaultBranch" | "overwrite"

export class LocalGitError extends Error {
  readonly code: LocalGitErrorCode

  constructor(code: LocalGitErrorCode, message: string) {
    super(message)
    this.name = "LocalGitError"
    this.code = code
  }
}

export class PushError extends Error {
  readonly code: PushErrorCode
  readonly confirmation?: PushConfirmation

  constructor(
    code: PushErrorCode,
    message: string,
    confirmation?: PushConfirmation
  ) {
    super(message)
    this.name = "PushError"
    this.code = code
    this.confirmation = confirmation
  }
}

export interface WorkflowSource {
  getWorkflow(workflowId: string): Promise<unknown>
  testConnection(): Promise<boolean>
}

export type BlobRecord = {
  hash: string
  content: string
  size: number
  createdAt: number
}

export type IndexEntry = {
  workflowId: string
  filePath: string
  blobHash: string
  stagedAt: number
}

export type CommitEntry = {
  workflowId: string
  filePath: string
  blobHash: string
}

export type Commit = {
  id: string
  parentId: string | null
  message: string
  author: string
  timestamp: number
  entries: CommitEntry[]
}

export type RefRecord = {
  name: "HEAD"
  commitId: string | null
}

export type StatusEntry = {
  workflowId: string
  status: LocalGitStatus
  currentHash: string
  headHash?: string
  stagedHash?: string
  filePath?: string
}

export type AddResult = {
  workflowId: string
  filePath: string
  blobHash: string
  status: "staged"
}

export type Remote = {
  name: "origin"
  provider: "github"
  owner: string
  repo: string
  branch: string
  basePath: string
  remoteHeadSha: string
  lastPushedCommitId: string | null
  linkedAt: number
}

export type LinkConfig = {
  owner: string
  repo: string
  branch: string
  basePath: string
  authorName?: string
  authorEmail?: string
}

export type PushResult = {
  pushedCommits: number
  headSha: string
  commitUrl: string
}
