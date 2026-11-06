import type { Remote } from "@/models/localGit"
import { LocalGitRepository } from "@/storage/localGitRepository"

/** IndexedDB access for the single GitHub remote named origin. */
export class RemoteRepository {
  constructor(private readonly repository = new LocalGitRepository()) {}

  /** Récupère le remote « origin », s'il est configuré. */
  get(): Promise<Remote | undefined> {
    return this.repository.getRemote()
  }

  /** Enregistre (ou remplace) la configuration du remote. */
  save(remote: Remote): Promise<void> {
    return this.repository.saveRemote(remote)
  }

  /** Met à jour le remote après un push (nouveau SHA de tête et dernier commit poussé), si son SHA n'a pas changé entre-temps. */
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

  /** Met à jour le remote après un pull (nouveau SHA de tête et dernier commit poussé), si son SHA n'a pas changé entre-temps. */
  updateAfterPull(
    expectedRemoteHeadSha: string,
    remoteHeadSha: string,
    lastPushedCommitId: string | null
  ): Promise<void> {
    return this.repository.updateRemoteAfterPull(
      expectedRemoteHeadSha,
      remoteHeadSha,
      lastPushedCommitId
    )
  }
}

export const remoteRepository = new RemoteRepository()
