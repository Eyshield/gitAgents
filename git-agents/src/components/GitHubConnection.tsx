import { Button } from "@/components/ui/button"
import type { RepoRef } from "@/integrations/github/githubRepos"
import {
  cancelGitHubDeviceFlow,
  connectGitHubWithToken,
  disconnectGitHub,
  getGitHubAuthor,
  isGitHubConnected,
  linkGitHubRemote,
  listGitHubBranches,
  listGitHubRepositories,
  startGitHubDeviceFlow,
  waitForGitHubAuthorization
} from "@/services/githubMessaging"
import { useEffect, useState } from "react"

import "@/styles/globals.css"

type GitHubConnectionProps = {
  reconnectSignal?: number
  onLinked?: () => void
}

const APP_SLUG = process.env.PLASMO_PUBLIC_GITHUB_APP_SLUG ?? ""

function errorMessage(error?: string): string {
  return error ?? "Unable to contact GitHub."
}

export function GitHubConnection({
  reconnectSignal = 0,
  onLinked
}: GitHubConnectionProps) {
  const [connected, setConnected] = useState(false)
  const [connectionMethod, setConnectionMethod] = useState<
    "device" | "pat" | null
  >(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [flowCode, setFlowCode] = useState<string | null>(null)
  const [flowExpiresAt, setFlowExpiresAt] = useState<number | null>(null)
  const [token, setToken] = useState("")
  const [repositories, setRepositories] = useState<RepoRef[]>([])
  const [selectedRepo, setSelectedRepo] = useState("")
  const [manualOwner, setManualOwner] = useState("")
  const [manualRepo, setManualRepo] = useState("")
  const [branches, setBranches] = useState<string[]>([])
  const [branch, setBranch] = useState("")
  const [basePath, setBasePath] = useState("workflows")
  const [authorName, setAuthorName] = useState("")
  const [authorEmail, setAuthorEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadRepositories = async () => {
    const response = await listGitHubRepositories()
    if (!response.ok) {
      setError(errorMessage(response.error))
      return
    }
    setRepositories(response.repositories ?? [])
    const author = await getGitHubAuthor()
    if (author.ok && author.author) {
      setAuthorName(author.author.name)
      setAuthorEmail(author.author.email)
    }
  }

  const startDeviceFlow = async () => {
    setWorking(true)
    setError(null)
    setNotice(null)
    const response = await startGitHubDeviceFlow()
    if (!response.ok || !response.userCode || !response.expiresAt) {
      setError(errorMessage(response.error))
      setWorking(false)
      return
    }
    setConnectionMethod("device")
    setFlowCode(response.userCode)
    setFlowExpiresAt(response.expiresAt)
    const authorization = await waitForGitHubAuthorization()
    if (authorization.ok) {
      setFlowCode(null)
      setFlowExpiresAt(null)
      setConnected(true)
      await loadRepositories()
    } else {
      setError(errorMessage(authorization.error))
    }
    setWorking(false)
  }

  const connectWithToken = async () => {
    setWorking(true)
    setError(null)
    const response = await connectGitHubWithToken(token.trim())
    if (!response.ok) {
      setError(errorMessage(response.error))
    } else {
      setToken("")
      setConnectionMethod("pat")
      setConnected(true)
      await loadRepositories()
    }
    setWorking(false)
  }

  const chooseRepository = async (fullName: string) => {
    setSelectedRepo(fullName)
    const repository = repositories.find((item) => item.fullName === fullName)
    if (!repository) return
    setBranch(repository.defaultBranch)
    const response = await listGitHubBranches(repository.owner, repository.name)
    if (response.ok) setBranches(response.branches ?? [])
    else setError(errorMessage(response.error))
  }

  const link = async () => {
    const repository = repositories.find(
      (item) => item.fullName === selectedRepo
    )
    const owner = repository?.owner ?? manualOwner.trim()
    const repo = repository?.name ?? manualRepo.trim()
    if (!owner || !repo || !branch.trim()) return

    setWorking(true)
    setError(null)
    const response = await linkGitHubRemote({
      owner,
      repo,
      branch: branch.trim(),
      basePath,
      authorName,
      authorEmail
    })
    if (!response.ok) {
      setError(errorMessage(response.error))
    } else {
      setNotice(`Remote origin linked to ${owner}/${repo} on ${branch.trim()}.`)
      onLinked?.()
    }
    setWorking(false)
  }

  const refreshRepositories = () => {
    setError(null)
    void loadRepositories()
  }

  const cancelFlow = () => {
    void cancelGitHubDeviceFlow()
    setFlowCode(null)
    setFlowExpiresAt(null)
    setWorking(false)
  }

  const disconnect = async () => {
    setWorking(true)
    await disconnectGitHub()
    setConnected(false)
    setConnectionMethod(null)
    setRepositories([])
    setSelectedRepo("")
    setManualOwner("")
    setManualRepo("")
    setWorking(false)
  }

  useEffect(() => {
    void isGitHubConnected().then(async (response) => {
      setConnected(response.ok && response.connected === true)
      if (response.ok && response.connected) await loadRepositories()
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (reconnectSignal > 0) void startDeviceFlow()
  }, [reconnectSignal])

  useEffect(
    () => () => {
      void cancelGitHubDeviceFlow()
    },
    []
  )

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground">
        Checking GitHub connection…
      </p>
    )
  }

  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">
            GitHub connection
          </h2>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            Step 1: connect GitHub to authorize writing local commits.
          </p>
        </div>
        {connected && (
          <Button
            disabled={working}
            onClick={disconnect}
            size="sm"
            type="button"
            variant="outline">
            Disconnect
          </Button>
        )}
      </div>

      {!connected && !flowCode && (
        <Button
          className="w-full"
          disabled={working}
          onClick={startDeviceFlow}
          type="button">
          {working ? "Connecting…" : "Connect with GitHub"}
        </Button>
      )}

      {flowCode && (
        <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3 text-xs">
          <p className="font-medium text-foreground">
            GitHub authorization pending
          </p>
          <p className="text-muted-foreground">
            Enter this code in the open GitHub tab:
          </p>
          <p className="font-mono text-lg font-semibold tracking-widest text-primary">
            {flowCode}
          </p>
          <p className="text-muted-foreground">
            {flowExpiresAt
              ? `The code expires at ${new Date(flowExpiresAt).toLocaleTimeString()}.`
              : "Waiting…"}
          </p>
          <Button
            onClick={cancelFlow}
            size="sm"
            type="button"
            variant="outline">
            Cancel
          </Button>
        </div>
      )}

      {!connected && !flowCode && (
        <details className="rounded-md border border-border p-2">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Another method: use a GitHub PAT
          </summary>
          <div className="mt-2 space-y-2">
            <p className="text-xs leading-4 text-muted-foreground">
              Use a fine-grained PAT with{" "}
              <span className="font-mono text-foreground">
                Contents: Read and write
              </span>{" "}
              on the target repository.
            </p>
            <input
              aria-label="Token GitHub"
              className="h-8 w-full rounded-md border border-input bg-base px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
              onChange={(event) => setToken(event.target.value)}
              placeholder="github_pat_…"
              type="password"
              value={token}
            />
            <Button
              disabled={working || !token.trim()}
              onClick={connectWithToken}
              size="sm"
              type="button">
              Test PAT
            </Button>
          </div>
        </details>
      )}

      {connected && (
        <div className="space-y-3 border-t border-border pt-3">
          <div className="border-b border-border pb-3 text-xs">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <span className="size-1.5 rounded-full bg-success" />
              GitHub connection active
            </p>
            <p className="mt-1 text-muted-foreground">
              {connectionMethod === "pat"
                ? "PAT verified. Enter the repository manually below."
                : "Step 2: choose a repository provided by the application."}
            </p>
          </div>

          {repositories.length > 0 && (
            <div className="space-y-2">
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">
                  Repository provided by the GitHub App
                </span>
                <select
                  className="h-8 w-full rounded-md border border-input bg-base px-2 text-xs text-foreground"
                  onChange={(event) =>
                    void chooseRepository(event.target.value)
                  }
                  value={selectedRepo}>
                  <option value="">Choose a repository</option>
                  {repositories.map((repository) => (
                    <option
                      key={repository.fullName}
                      value={repository.fullName}>
                      {repository.fullName}
                    </option>
                  ))}
                </select>
              </label>
              {selectedRepo && (
                <>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">
                      Target branch
                    </span>
                    <select
                      className="h-8 w-full rounded-md border border-input bg-base px-2 text-xs text-foreground"
                      onChange={(event) => setBranch(event.target.value)}
                      value={branch}>
                      {branches.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <LinkFields
                    authorEmail={authorEmail}
                    authorName={authorName}
                    basePath={basePath}
                    onAuthorEmailChange={setAuthorEmail}
                    onAuthorNameChange={setAuthorName}
                    onBasePathChange={setBasePath}
                  />
                  <Button
                    className="w-full"
                    disabled={working || !branch}
                    onClick={link}
                    type="button">
                    Link this repository
                  </Button>
                </>
              )}
            </div>
          )}

          {repositories.length === 0 && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <div>
                <p className="text-xs font-medium text-foreground">
                  No repositories provided automatically
                </p>
                <p className="mt-1 text-xs leading-4 text-muted-foreground">
                  This is not an error: with a PAT, enter the owner, repository,
                  and branch directly. With Device Flow, install the application
                  on the repository first.
                </p>
              </div>
              {APP_SLUG ? (
                <Button asChild size="sm" type="button" variant="outline">
                  <a
                    href={`https://github.com/apps/${APP_SLUG}/installations/new`}
                    rel="noreferrer"
                    target="_blank">
                    Install the GitHub application
                  </a>
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  The GitHub App slug is not configured.
                </p>
              )}
              <Button
                onClick={refreshRepositories}
                size="sm"
                type="button"
                variant="outline">
                Refresh repositories
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <input
                  aria-label="GitHub owner"
                  className="h-8 min-w-0 rounded-md border border-input bg-base px-2 text-xs text-foreground"
                  onChange={(event) => setManualOwner(event.target.value)}
                  placeholder="Owner"
                  value={manualOwner}
                />
                <input
                  aria-label="GitHub repository name"
                  className="h-8 min-w-0 rounded-md border border-input bg-base px-2 text-xs text-foreground"
                  onChange={(event) => setManualRepo(event.target.value)}
                  placeholder="Repository"
                  value={manualRepo}
                />
              </div>
              <input
                aria-label="GitHub branch"
                className="h-8 w-full rounded-md border border-input bg-base px-2 text-xs text-foreground"
                onChange={(event) => setBranch(event.target.value)}
                placeholder="main"
                value={branch}
              />
              <LinkFields
                authorEmail={authorEmail}
                authorName={authorName}
                basePath={basePath}
                onAuthorEmailChange={setAuthorEmail}
                onAuthorNameChange={setAuthorName}
                onBasePathChange={setBasePath}
              />
              <Button
                className="w-full"
                disabled={
                  working ||
                  !manualOwner.trim() ||
                  !manualRepo.trim() ||
                  !branch.trim()
                }
                onClick={link}
                type="button">
                Verify and link repository
              </Button>
            </div>
          )}
        </div>
      )}

      {notice && <p className="text-xs text-success">{notice}</p>}
      {error && <p className="break-words text-xs text-error">{error}</p>}
    </section>
  )
}

type LinkFieldsProps = {
  basePath: string
  authorName: string
  authorEmail: string
  onBasePathChange: (value: string) => void
  onAuthorNameChange: (value: string) => void
  onAuthorEmailChange: (value: string) => void
}

function LinkFields({
  basePath,
  authorName,
  authorEmail,
  onBasePathChange,
  onAuthorNameChange,
  onAuthorEmailChange
}: LinkFieldsProps) {
  return (
    <div className="space-y-2">
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">
          Workflow folder
        </span>
        <input
          className="h-8 w-full rounded-md border border-input bg-base px-2 text-xs text-foreground"
          onChange={(event) => onBasePathChange(event.target.value)}
          value={basePath}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <input
          aria-label="Author name"
          className="h-8 min-w-0 rounded-md border border-input bg-base px-2 text-xs text-foreground"
          onChange={(event) => onAuthorNameChange(event.target.value)}
          placeholder="Author name"
          value={authorName}
        />
        <input
          aria-label="Author email"
          className="h-8 min-w-0 rounded-md border border-input bg-base px-2 text-xs text-foreground"
          onChange={(event) => onAuthorEmailChange(event.target.value)}
          placeholder="Author email"
          value={authorEmail}
        />
      </div>
    </div>
  )
}
