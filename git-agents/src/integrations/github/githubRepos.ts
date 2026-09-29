import { githubClient, type GitHubClient } from "@/integrations/github/githubClient"

export type RepoRef = {
  id: number
  owner: string
  name: string
  fullName: string
  defaultBranch: string
  canPush: boolean
}

export type GitHubRepository = {
  owner: { login: string }
  name: string
  default_branch: string
  size: number
  permissions?: { push?: boolean }
}

export type GitHubBranch = { name: string; commit: { sha: string } }

export type GitHubContent = {
  type: "file" | "dir"
  encoding?: "base64"
  content?: string
  sha?: string
}

export type GitHubUser = {
  id: number
  login: string
  name?: string | null
  email?: string | null
}

type Installation = { id: number }
type InstallationRepositories = {
  repositories: Array<{
    id: number
    name: string
    full_name: string
    default_branch: string
    owner: { login: string }
    permissions?: { push?: boolean }
  }>
}

export class GitHubRepos {
  constructor(private readonly client: GitHubClient = githubClient) {}

  async listRepositories(): Promise<RepoRef[]> {
    const installations = await this.client.requestJson<{
      installations: Installation[]
    }>("/user/installations?per_page=100")
    const repositories = await Promise.all(
      installations.installations.flatMap((installation) =>
        this.listInstallationRepositories(installation.id)
      )
    )
    const unique = new Map<string, RepoRef>()
    for (const repository of repositories.flat()) unique.set(repository.fullName, repository)
    return Array.from(unique.values()).sort((left, right) =>
      left.fullName.localeCompare(right.fullName)
    )
  }

  async listBranches(owner: string, repo: string): Promise<string[]> {
    const branches = await this.client.requestJson<GitHubBranch[]>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`
    )
    return branches.map((branch) => branch.name)
  }

  getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return this.client.requestJson<GitHubRepository>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
    )
  }

  getBranch(owner: string, repo: string, branch: string): Promise<GitHubBranch> {
    return this.client.requestJson<GitHubBranch>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches/${encodeURIComponent(branch)}`
    )
  }

  getContent(
    owner: string,
    repo: string,
    path: string,
    branch: string
  ): Promise<GitHubContent> {
    return this.client.requestJson<GitHubContent>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path
        .split("/")
        .map(encodeURIComponent)
        .join("/")}?ref=${encodeURIComponent(branch)}`
    )
  }

  getUser(): Promise<GitHubUser> {
    return this.client.requestJson<GitHubUser>("/user")
  }

  private async listInstallationRepositories(
    installationId: number
  ): Promise<RepoRef[]> {
    const payload = await this.client.requestJson<InstallationRepositories>(
      `/user/installations/${installationId}/repositories?per_page=100`
    )
    return payload.repositories.map((repository) => ({
      id: repository.id,
      owner: repository.owner.login,
      name: repository.name,
      fullName: repository.full_name,
      defaultBranch: repository.default_branch,
      canPush: repository.permissions?.push === true
    }))
  }
}

export const githubRepos = new GitHubRepos()
