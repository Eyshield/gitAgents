import type { WorkflowSnapshot } from "./types"

const DATABASE_NAME = "gitflow-studio"
const DATABASE_VERSION = 1
const SNAPSHOT_STORE = "snapshots"

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (database.objectStoreNames.contains(SNAPSHOT_STORE)) return
      const store = database.createObjectStore(SNAPSHOT_STORE, {
        keyPath: "id"
      })
      store.createIndex("workflowKey", "workflowKey", { unique: false })
      store.createIndex("createdAt", "createdAt", { unique: false })
      store.createIndex("contentHash", ["workflowKey", "contentHash"], {
        unique: false
      })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB is unavailable."))
  })
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB failed."))
  })
}

export async function saveSnapshot(
  snapshot: WorkflowSnapshot
): Promise<WorkflowSnapshot> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(SNAPSHOT_STORE, "readwrite")
    transaction.objectStore(SNAPSHOT_STORE).put(snapshot)
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () =>
        reject(
          transaction.error ?? new Error("Local save failed.")
        )
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Local save cancelled."))
    })
    return snapshot
  } finally {
    database.close()
  }
}

export async function listSnapshots(
  workflowKey?: string
): Promise<WorkflowSnapshot[]> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(SNAPSHOT_STORE, "readonly")
    const store = transaction.objectStore(SNAPSHOT_STORE)
    const request = workflowKey
      ? store.index("workflowKey").getAll(workflowKey)
      : store.getAll()
    const snapshots = await requestResult(request)
    return snapshots.sort((left, right) => right.createdAt - left.createdAt)
  } finally {
    database.close()
  }
}

export async function findSnapshotByHash(
  workflowKey: string,
  contentHash: string
): Promise<WorkflowSnapshot | undefined> {
  const snapshots = await listSnapshots(workflowKey)
  return snapshots.find((snapshot) => snapshot.contentHash === contentHash)
}

export async function deleteSnapshot(snapshotId: string): Promise<void> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(SNAPSHOT_STORE, "readwrite")
    transaction.objectStore(SNAPSHOT_STORE).delete(snapshotId)
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () =>
        reject(
          transaction.error ?? new Error("Local deletion failed.")
        )
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Local deletion cancelled."))
    })
  } finally {
    database.close()
  }
}
