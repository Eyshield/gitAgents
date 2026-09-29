import { githubClient, type GitHubClient } from "@/integrations/github/githubClient"

export type GitTreeEntry = {
  path: string
  mode: "100644"
  type: "blob"
  sha: string
}

export type GitHubGitCommit = {
  sha: string
  html_url: string
}

export class GitHubGitData {
  constructor(private readonly client: GitHubClient = githubClient) {}

  async createBlob(owner: string, repo: string, content: string): Promise<string> {
    const payload = await this.client.requestJson<{ sha: string }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs`,
      { method: "POST", body: JSON.stringify({ content, encoding: "utf-8" }) }
    )
    return payload.sha
  }

  async createTree(
    owner: string,
    repo: string,
    baseTree: string,
    tree: GitTreeEntry[]
  ): Promise<string> {
    const payload = await this.client.requestJson<{ sha: string }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees`,
      { method: "POST", body: JSON.stringify({ base_tree: baseTree, tree }) }
    )
    return payload.sha
  }

  async createCommit(
    owner: string,
    repo: string,
    input: {
      message: string
      tree: string
      parentSha: string
      author: { name: string; email: string; date: string }
    }
  ): Promise<GitHubGitCommit> {
    return this.client.requestJson<GitHubGitCommit>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits`,
      {
        method: "POST",
        body: JSON.stringify({
          message: input.message,
          tree: input.tree,
          parents: [input.parentSha],
          author: input.author,
          committer: input.author
        })
      }
    )
  }

  async updateBranch(
    owner: string,
    repo: string,
    branch: string,
    sha: string
  ): Promise<void> {
    await this.client.requestJson(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs/heads/${encodeURIComponent(branch)}`,
      { method: "PATCH", body: JSON.stringify({ sha, force: false }) }
    )
  }
}

export const githubGitData = new GitHubGitData()
