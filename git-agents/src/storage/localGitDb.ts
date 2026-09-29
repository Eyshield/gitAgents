import {
  LOCAL_GIT_DATABASE_NAME,
  LOCAL_GIT_DATABASE_VERSION
} from "@/models/localGit"

export const LOCAL_GIT_STORES = {
  blobs: "blobs",
  index: "index",
  commits: "commits",
  refs: "refs",
  remotes: "remotes"
} as const

export function openLocalGitDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(
      LOCAL_GIT_DATABASE_NAME,
      LOCAL_GIT_DATABASE_VERSION
    )
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(LOCAL_GIT_STORES.blobs)) {
        database.createObjectStore(LOCAL_GIT_STORES.blobs, { keyPath: "hash" })
      }
      if (!database.objectStoreNames.contains(LOCAL_GIT_STORES.index)) {
        database.createObjectStore(LOCAL_GIT_STORES.index, {
          keyPath: "workflowId"
        })
      }
      if (!database.objectStoreNames.contains(LOCAL_GIT_STORES.commits)) {
        const store = database.createObjectStore(LOCAL_GIT_STORES.commits, {
          keyPath: "id"
        })
        store.createIndex("timestamp", "timestamp", { unique: false })
      }
      if (!database.objectStoreNames.contains(LOCAL_GIT_STORES.refs)) {
        database.createObjectStore(LOCAL_GIT_STORES.refs, { keyPath: "name" })
      }
      if (!database.objectStoreNames.contains(LOCAL_GIT_STORES.remotes)) {
        database.createObjectStore(LOCAL_GIT_STORES.remotes, { keyPath: "name" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB is unavailable."))
  })
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed."))
  })
}

export function transactionResult<T>(
  database: IDBDatabase,
  stores: string[],
  mode: IDBTransactionMode,
  operation: (transaction: IDBTransaction) => Promise<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(stores, mode)
    let result: T | undefined
    let operationError: unknown

    transaction.oncomplete = () => {
      if (operationError) {
        reject(operationError)
        return
      }
      resolve(result as T)
    }
    transaction.onerror = () =>
      reject(
        transaction.error ?? new Error("IndexedDB operation failed.")
      )
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB operation cancelled."))

    void operation(transaction)
      .then((value) => {
        result = value
      })
      .catch((error: unknown) => {
        operationError = error
        try {
          transaction.abort()
        } catch {
          // The transaction may already have completed or aborted.
        }
      })
  })
}
