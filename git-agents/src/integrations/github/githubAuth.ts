import { PushError } from "@/models/localGit"

const AUTH_STORAGE_KEY = "github_auth"
const CLIENT_ID = process.env.PLASMO_PUBLIC_GITHUB_CLIENT_ID ?? ""

type GitHubAuthRecord = {
  method: "device" | "pat"
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  refreshExpiresAt?: number
}

type DeviceSession = {
  deviceCode: string
  intervalSeconds: number
  expiresAt: number
}

type TokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  refresh_token_expires_in?: number
  error?: string
}

type DeviceCodeResponse = {
  device_code?: string
  user_code?: string
  verification_uri?: string
  expires_in?: number
  interval?: number
  error?: string
}

function storageGet<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(key, (result) => {
      const runtimeError = chrome.runtime.lastError
      if (runtimeError) {
        reject(new Error(runtimeError.message))
        return
      }
      resolve(result[key] as T | undefined)
    })
  })
}

function storageSet<T>(key: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      const runtimeError = chrome.runtime.lastError
      if (runtimeError) reject(new Error(runtimeError.message))
      else resolve()
    })
  })
}

function storageRemove(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(key, () => {
      const runtimeError = chrome.runtime.lastError
      if (runtimeError) reject(new Error(runtimeError.message))
      else resolve()
    })
  })
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T
  } catch {
    return {} as T
  }
}

function mapOAuthError(error: string | undefined): PushError {
  if (error === "authorization_pending") {
    return new PushError("NETWORK_ERROR", "GitHub authorization is pending.")
  }
  if (error === "slow_down") {
    return new PushError("NETWORK_ERROR", "GitHub requested slower polling.")
  }
  if (error === "expired_token") {
    return new PushError(
      "DEVICE_CODE_EXPIRED",
      "The GitHub code expired. Restart the connection."
    )
  }
  if (error === "access_denied") {
    return new PushError("AUTH_DENIED", "GitHub authorization was denied.")
  }
  return new PushError("REAUTH_REQUIRED", "GitHub reconnection required.")
}

function ensureClientId(): void {
  if (!CLIENT_ID) {
    throw new PushError(
      "REAUTH_REQUIRED",
      "Configure PLASMO_PUBLIC_GITHUB_CLIENT_ID to use Device Flow."
    )
  }
}

export class GitHubAuth {
  private deviceSession?: DeviceSession
  private deviceAbort?: AbortController
  private refreshPromise?: Promise<string>

  async startDeviceFlow(): Promise<{
    userCode: string
    verificationUri: string
    expiresAt: number
  }> {
    ensureClientId()
    const response = await fetch("https://github.com/login/device/code", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({ client_id: CLIENT_ID }).toString()
    }).catch(() => {
      throw new PushError("NETWORK_ERROR", "Unable to reach GitHub.")
    })
    const payload = await readJson<DeviceCodeResponse>(response)
    if (!response.ok || !payload.device_code || !payload.user_code || !payload.verification_uri) {
      throw new PushError("NETWORK_ERROR", "GitHub did not provide a connection code.")
    }
    const expiresAt = Date.now() + (payload.expires_in ?? 900) * 1000
    this.deviceSession = {
      deviceCode: payload.device_code,
      intervalSeconds: Math.max(5, payload.interval ?? 5),
      expiresAt
    }
    this.deviceAbort?.abort()
    this.deviceAbort = new AbortController()
    return {
      userCode: payload.user_code,
      verificationUri: payload.verification_uri,
      expiresAt
    }
  }

  async waitForAuthorization(signal?: AbortSignal): Promise<void> {
    ensureClientId()
    const session = this.deviceSession
    if (!session) {
      throw new PushError("DEVICE_CODE_EXPIRED", "No active GitHub code.")
    }
    const abort = new AbortController()
    const abortFromCaller = () => abort.abort()
    signal?.addEventListener("abort", abortFromCaller, { once: true })
    this.deviceAbort?.signal.addEventListener("abort", abortFromCaller, { once: true })
    try {
      let intervalSeconds = session.intervalSeconds
      while (Date.now() < session.expiresAt) {
        await this.delay(intervalSeconds * 1000, abort.signal)
        const response = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            client_id: CLIENT_ID,
            device_code: session.deviceCode,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code"
          }).toString(),
          signal: abort.signal
        }).catch((error: unknown) => {
          if (abort.signal.aborted) throw error
          throw new PushError("NETWORK_ERROR", "Unable to reach GitHub.")
        })
        const payload = await readJson<TokenResponse>(response)
        if (payload.access_token) {
          await this.saveToken({
            method: "device",
            accessToken: payload.access_token,
            refreshToken: payload.refresh_token,
            expiresAt: payload.expires_in
              ? Date.now() + payload.expires_in * 1000
              : undefined,
            refreshExpiresAt: payload.refresh_token_expires_in
              ? Date.now() + payload.refresh_token_expires_in * 1000
              : undefined
          })
          this.deviceSession = undefined
          return
        }
        if (payload.error === "authorization_pending") continue
        if (payload.error === "slow_down") {
          intervalSeconds += 5
          continue
        }
        throw mapOAuthError(payload.error)
      }
      throw new PushError(
        "DEVICE_CODE_EXPIRED",
        "The GitHub code expired. Restart the connection."
      )
    } finally {
      signal?.removeEventListener("abort", abortFromCaller)
      this.deviceSession = undefined
    }
  }

  cancelDeviceFlow(): void {
    this.deviceAbort?.abort()
    this.deviceAbort = undefined
    this.deviceSession = undefined
  }

  async connectWithToken(pat: string): Promise<void> {
    if (!/^github_pat_[A-Za-z0-9_]+$/.test(pat) && !/^gh[pousr]_[A-Za-z0-9_]+$/.test(pat)) {
      throw new PushError(
        "REAUTH_REQUIRED",
        "Use a valid fine-grained GitHub Personal Access Token."
      )
    }
    await this.saveToken({ method: "pat", accessToken: pat })
  }

  async getValidAccessToken(): Promise<string> {
    const auth = await storageGet<GitHubAuthRecord>(AUTH_STORAGE_KEY)
    if (!auth?.accessToken) throw new PushError("REAUTH_REQUIRED", "GitHub connection required.")
    if (
      auth.method === "device" &&
      auth.expiresAt !== undefined &&
      auth.expiresAt - Date.now() < 5 * 60 * 1000
    ) {
      return this.refreshPromise ??= this.refresh(auth)
    }
    return auth.accessToken
  }

  async refreshAfterUnauthorized(): Promise<string> {
    const auth = await storageGet<GitHubAuthRecord>(AUTH_STORAGE_KEY)
    if (!auth || auth.method !== "device" || !auth.refreshToken) {
      throw new PushError("REAUTH_REQUIRED", "GitHub reconnection required.")
    }
    return this.refreshPromise ??= this.refresh(auth)
  }

  async isConnected(): Promise<boolean> {
    const auth = await storageGet<GitHubAuthRecord>(AUTH_STORAGE_KEY)
    return Boolean(auth?.accessToken)
  }

  async disconnect(): Promise<void> {
    this.cancelDeviceFlow()
    await storageRemove(AUTH_STORAGE_KEY)
  }

  private async refresh(auth: GitHubAuthRecord): Promise<string> {
    try {
      if (!auth.refreshToken) throw new PushError("REAUTH_REQUIRED", "GitHub reconnection required.")
      const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          grant_type: "refresh_token",
          refresh_token: auth.refreshToken
        }).toString()
      }).catch(() => {
        throw new PushError("NETWORK_ERROR", "Unable to reach GitHub.")
      })
      const payload = await readJson<TokenResponse>(response)
      if (!response.ok || !payload.access_token) {
        await storageRemove(AUTH_STORAGE_KEY)
        throw new PushError("REAUTH_REQUIRED", "GitHub reconnection required.")
      }
      const refreshed: GitHubAuthRecord = {
        method: "device",
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token,
        expiresAt: payload.expires_in
          ? Date.now() + payload.expires_in * 1000
          : undefined,
        refreshExpiresAt: payload.refresh_token_expires_in
          ? Date.now() + payload.refresh_token_expires_in * 1000
          : undefined
      }
      await this.saveToken(refreshed)
      return refreshed.accessToken
    } finally {
      this.refreshPromise = undefined
    }
  }

  private async saveToken(auth: GitHubAuthRecord): Promise<void> {
    await storageSet(AUTH_STORAGE_KEY, auth)
  }

  private delay(milliseconds: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, milliseconds)
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer)
          reject(new PushError("AUTH_DENIED", "GitHub connection cancelled."))
        },
        { once: true }
      )
    })
  }
}

export const githubAuth = new GitHubAuth()
