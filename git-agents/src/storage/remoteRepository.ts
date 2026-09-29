import type { Remote } from "@/models/localGit"
import { LocalGitRepository } from "@/storage/localGitRepository"

/** IndexedDB access for the single GitHub remote named origin. */
export class RemoteRepository {
  constructor(private readonly repository = new LocalGitRepository()) {}

  get(): Promise<Remote | undefined> {
    return this.repository.getRemote()
  }

  save(remote: Remote): Promise<void> {
    return this.repository.saveRemote(remote)
  }

  updateAfterPush(
    expectedRemoteHeadSha: string,
    remoteHeadSha: string,
    lastPushedCommitId: string
  ): Promise<void> {
    return this.repository.updateRemoteAfterPush(
      expectedRemoteHeadSha,
      remoteHeadSha,
      lastPushedCommitId
    )
  }
}

export const remoteRepository = new RemoteRepository()
