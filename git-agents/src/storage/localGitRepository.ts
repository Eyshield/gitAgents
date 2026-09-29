import {
  type BlobRecord,
  type Commit,
  type IndexEntry,
  type RefRecord,
  type Remote
} from "@/models/localGit"
import {
  LOCAL_GIT_STORES,
  openLocalGitDatabase,
  requestResult,
  transactionResult
} from "@/storage/localGitDb"

export type LocalGitState = {
  head: RefRecord
  headCommit?: Commit
  index: IndexEntry[]
}

export type LocalCommitHistory = {
  head: RefRecord
  commits: Commit[]
}

function asHead(value: RefRecord | undefined): RefRecord {
  return value ?? { name: "HEAD", commitId: null }
}

export class LocalGitRepository {
  async getState(): Promise<LocalGitState> {
    const database = await openLocalGitDatabase()
    try {
      const head = asHead(
        await this.readOne<RefRecord>(database, LOCAL_GIT_STORES.refs, "HEAD")
      )
      const [headCommit, index] = await Promise.all([
        head.commitId
          ? this.readOne<Commit>(
              database,
              LOCAL_GIT_STORES.commits,
              head.commitId
            )
          : Promise.resolve(undefined),
        this.readAll<IndexEntry>(database, LOCAL_GIT_STORES.index)
      ])
      return { head, headCommit, index }
    } finally {
      database.close()
    }
  }

  async addBlobAndIndex(blob: BlobRecord, entry: IndexEntry): Promise<void> {
    const database = await openLocalGitDatabase()
    try {
      await transactionResult(
        database,
        [LOCAL_GIT_STORES.blobs, LOCAL_GIT_STORES.index],
        "readwrite",
        async (transaction) => {
          const blobs = transaction.objectStore(LOCAL_GIT_STORES.blobs)
          const existing = await requestResult<BlobRecord | undefined>(
            blobs.get(blob.hash)
          )
          if (!existing) blobs.put(blob)
          transaction.objectStore(LOCAL_GIT_STORES.index).put(entry)
        }
      )
    } finally {
      database.close()
    }
  }

  async commitAtomically(
    commit: Commit,
    expectedParentId: string | null
  ): Promise<void> {
    const database = await openLocalGitDatabase()
    try {
      await transactionResult(
        database,
        [LOCAL_GIT_STORES.commits, LOCAL_GIT_STORES.refs, LOCAL_GIT_STORES.index],
        "readwrite",
        async (transaction) => {
          const refs = transaction.objectStore(LOCAL_GIT_STORES.refs)
          const currentHead = asHead(
            await requestResult<RefRecord | undefined>(refs.get("HEAD"))
          )
          if (currentHead.commitId !== expectedParentId) {
            throw new Error("HEAD changed during commit.")
          }

          transaction.objectStore(LOCAL_GIT_STORES.commits).put(commit)
          refs.put({ name: "HEAD", commitId: commit.id } satisfies RefRecord)
          transaction.objectStore(LOCAL_GIT_STORES.index).clear()
        }
      )
    } finally {
      database.close()
    }
  }

  async listCommits(limit: number): Promise<Commit[]> {
    const database = await openLocalGitDatabase()
    try {
      const commits = await this.readAll<Commit>(
        database,
        LOCAL_GIT_STORES.commits
      )
      return commits
        .sort((left, right) => right.timestamp - left.timestamp)
        .slice(0, limit)
    } finally {
      database.close()
    }
  }

  async getBlob(hash: string): Promise<BlobRecord | undefined> {
    const database = await openLocalGitDatabase()
    try {
      return await this.readOne<BlobRecord>(database, LOCAL_GIT_STORES.blobs, hash)
    } finally {
      database.close()
    }
  }

  async getCommit(commitId: string): Promise<Commit | undefined> {
    const database = await openLocalGitDatabase()
    try {
      return await this.readOne<Commit>(database, LOCAL_GIT_STORES.commits, commitId)
    } finally {
      database.close()
    }
  }

  async getCommitHistory(): Promise<LocalCommitHistory> {
    const database = await openLocalGitDatabase()
    try {
      const head = asHead(
        await this.readOne<RefRecord>(database, LOCAL_GIT_STORES.refs, "HEAD")
      )
      const commits = await this.readAll<Commit>(
        database,
        LOCAL_GIT_STORES.commits
      )
      const byId = new Map(commits.map((commit) => [commit.id, commit]))
      const ordered: Commit[] = []
      let currentId = head.commitId
      while (currentId) {
        const commit = byId.get(currentId)
        if (!commit) throw new Error("Local Git history is inconsistent.")
        ordered.push(commit)
        currentId = commit.parentId
      }
      return { head, commits: ordered.reverse() }
    } finally {
      database.close()
    }
  }

  async getRemote(): Promise<Remote | undefined> {
    const database = await openLocalGitDatabase()
    try {
      return await this.readOne<Remote>(database, LOCAL_GIT_STORES.remotes, "origin")
    } finally {
      database.close()
    }
  }

  async saveRemote(remote: Remote): Promise<void> {
    const database = await openLocalGitDatabase()
    try {
      await transactionResult(
        database,
        [LOCAL_GIT_STORES.remotes],
        "readwrite",
        async (transaction) => {
          transaction.objectStore(LOCAL_GIT_STORES.remotes).put(remote)
        }
      )
    } finally {
      database.close()
    }
  }

  async updateRemoteAfterPush(
    expectedRemoteHeadSha: string,
    remoteHeadSha: string,
    lastPushedCommitId: string
  ): Promise<void> {
    const database = await openLocalGitDatabase()
    try {
      await transactionResult(
        database,
        [LOCAL_GIT_STORES.remotes],
        "readwrite",
        async (transaction) => {
          const store = transaction.objectStore(LOCAL_GIT_STORES.remotes)
          const remote = await requestResult<Remote | undefined>(store.get("origin"))
          if (!remote || remote.remoteHeadSha !== expectedRemoteHeadSha) {
            throw new Error("The local remote changed during push.")
          }
          store.put({ ...remote, remoteHeadSha, lastPushedCommitId })
        }
      )
    } finally {
      database.close()
    }
  }

  private async readOne<T>(
    database: IDBDatabase,
    storeName: string,
    key: IDBValidKey
  ): Promise<T | undefined> {
    const transaction = database.transaction(storeName, "readonly")
    return requestResult(transaction.objectStore(storeName).get(key))
  }

  private async readAll<T>(
    database: IDBDatabase,
    storeName: string
  ): Promise<T[]> {
    const transaction = database.transaction(storeName, "readonly")
    return requestResult(transaction.objectStore(storeName).getAll())
  }
}
