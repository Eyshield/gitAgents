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

/** Retourne la référence HEAD, ou un HEAD vide (sans commit) s'il n'existe pas encore. */
function asHead(value: RefRecord | undefined): RefRecord {
  return value ?? { name: "HEAD", commitId: null }
}

/** Accès IndexedDB au dépôt Git local : blobs, index, commits, HEAD et remote « origin ». */
export class LocalGitRepository {
  /** Lit l'état courant : HEAD, commit HEAD et contenu de l'index. */
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

  /** Enregistre un blob (s'il n'existe pas déjà) et l'entrée d'index correspondante dans une même transaction. */
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

  /** Enregistre un commit, avance HEAD et vide l'index, uniquement si HEAD n'a pas changé entre-temps. */
  async commitAtomically(
    commit: Commit,
    expectedParentId: string | null
  ): Promise<void> {
    const database = await openLocalGitDatabase()
    try {
      await transactionResult(
        database,
        [
          LOCAL_GIT_STORES.commits,
          LOCAL_GIT_STORES.refs,
          LOCAL_GIT_STORES.index
        ],
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

  /** Applique un commit issu d'un pull (blobs, commit, HEAD, index, remote) après vérification que HEAD et le remote n'ont pas changé. */
  async applyPulledCommit(
    commit: Commit,
    blobs: BlobRecord[],
    expectedParentId: string | null,
    expectedRemoteHeadSha: string,
    newRemoteHeadSha: string,
    lastPushedCommitId: string | null
  ): Promise<void> {
    const database = await openLocalGitDatabase()
    try {
      await transactionResult(
        database,
        [
          LOCAL_GIT_STORES.blobs,
          LOCAL_GIT_STORES.commits,
          LOCAL_GIT_STORES.refs,
          LOCAL_GIT_STORES.index,
          LOCAL_GIT_STORES.remotes
        ],
        "readwrite",
        async (transaction) => {
          const refs = transaction.objectStore(LOCAL_GIT_STORES.refs)
          const currentHead = asHead(
            await requestResult<RefRecord | undefined>(refs.get("HEAD"))
          )
          if (currentHead.commitId !== expectedParentId) {
            throw new Error("HEAD changed during pull.")
          }

          const remotes = transaction.objectStore(LOCAL_GIT_STORES.remotes)
          const remote = await requestResult<Remote | undefined>(
            remotes.get("origin")
          )
          if (!remote || remote.remoteHeadSha !== expectedRemoteHeadSha) {
            throw new Error("The local remote changed during pull.")
          }

          const blobStore = transaction.objectStore(LOCAL_GIT_STORES.blobs)
          for (const blob of blobs) {
            const existing = await requestResult<BlobRecord | undefined>(
              blobStore.get(blob.hash)
            )
            if (!existing) blobStore.put(blob)
          }
          transaction.objectStore(LOCAL_GIT_STORES.commits).put(commit)
          refs.put({ name: "HEAD", commitId: commit.id } satisfies RefRecord)
          transaction.objectStore(LOCAL_GIT_STORES.index).clear()
          remotes.put({
            ...remote,
            remoteHeadSha: newRemoteHeadSha,
            lastPushedCommitId
          })
        }
      )
    } finally {
      database.close()
    }
  }

  /** Liste les commits les plus récents (triés du plus récent au plus ancien), limités à `limit`. */
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

  /** Récupère un blob par son hash. */
  async getBlob(hash: string): Promise<BlobRecord | undefined> {
    const database = await openLocalGitDatabase()
    try {
      return await this.readOne<BlobRecord>(
        database,
        LOCAL_GIT_STORES.blobs,
        hash
      )
    } finally {
      database.close()
    }
  }

  /** Récupère un commit par son id. */
  async getCommit(commitId: string): Promise<Commit | undefined> {
    const database = await openLocalGitDatabase()
    try {
      return await this.readOne<Commit>(
        database,
        LOCAL_GIT_STORES.commits,
        commitId
      )
    } finally {
      database.close()
    }
  }

  /** Reconstruit l'historique linéaire depuis HEAD (du plus ancien au plus récent) ; échoue si un parent est manquant. */
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

  /** Récupère le remote « origin », s'il est configuré. */
  async getRemote(): Promise<Remote | undefined> {
    const database = await openLocalGitDatabase()
    try {
      return await this.readOne<Remote>(
        database,
        LOCAL_GIT_STORES.remotes,
        "origin"
      )
    } finally {
      database.close()
    }
  }

  /** Enregistre (ou remplace) la configuration du remote. */
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

  /** Met à jour le remote après un push, si son SHA de tête n'a pas changé entre-temps. */
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
          const remote = await requestResult<Remote | undefined>(
            store.get("origin")
          )
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

  /** Met à jour le remote après un pull, si son SHA de tête n'a pas changé entre-temps. */
  async updateRemoteAfterPull(
    expectedRemoteHeadSha: string,
    remoteHeadSha: string,
    lastPushedCommitId: string | null
  ): Promise<void> {
    const database = await openLocalGitDatabase()
    try {
      await transactionResult(
        database,
        [LOCAL_GIT_STORES.remotes],
        "readwrite",
        async (transaction) => {
          const store = transaction.objectStore(LOCAL_GIT_STORES.remotes)
          const remote = await requestResult<Remote | undefined>(
            store.get("origin")
          )
          if (!remote || remote.remoteHeadSha !== expectedRemoteHeadSha) {
            throw new Error("The local remote changed during pull.")
          }
          store.put({ ...remote, remoteHeadSha, lastPushedCommitId })
        }
      )
    } finally {
      database.close()
    }
  }

  /** Lit une entrée d'un object store par sa clé. */
  private async readOne<T>(
    database: IDBDatabase,
    storeName: string,
    key: IDBValidKey
  ): Promise<T | undefined> {
    const transaction = database.transaction(storeName, "readonly")
    return requestResult(transaction.objectStore(storeName).get(key))
  }

  /** Lit toutes les entrées d'un object store. */
  private async readAll<T>(
    database: IDBDatabase,
    storeName: string
  ): Promise<T[]> {
    const transaction = database.transaction(storeName, "readonly")
    return requestResult(transaction.objectStore(storeName).getAll())
  }
}
