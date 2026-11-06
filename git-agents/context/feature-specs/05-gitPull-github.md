# Feature — Git Pull from Remote

## 1. Objective

Implement **Git Pull** in GitAgent Studio.

The extension does **not** use the local Git CLI.

GitAgent Studio already implements:

- Local Git-like versioning in IndexedDB
- blobs
- index
- local commits
- `HEAD`
- snapshots
- commit history
- GitHub authentication
- GitHub `origin` remote
- Push through the GitHub Git Data API

The existing implementation must be reused.

The Pull feature must synchronize the local IndexedDB Git repository with the GitHub `origin` repository.

The goal is:

```text
GitHub origin
     ↓
Git Data API
     ↓
Compare remote HEAD with local HEAD
     ↓
Fetch missing remote objects
     ↓
Update local Git state
     ↓
Refresh snapshots / history / workflow
```

Do **not** execute:

```bash
git pull
git fetch
git checkout
git reset
```

The extension must perform the operation through the existing GitHub API implementation and the existing local Git/IndexedDB layer.

---

# 2. Existing Architecture

Before implementing this feature, inspect and reuse the existing implementation for:

- GitHub authentication
- remote `origin`
- GitHub repository metadata
- branch/ref handling
- Git Data API requests
- local blobs
- local trees/index
- local commits
- `HEAD`
- IndexedDB stores
- snapshots
- commit history
- push

Do not create a second Git implementation.

The tracker explicitly defines the current Phase 2 architecture as local Git versioning in IndexedDB plus a GitHub `origin` and Git Data API push.

---

# 3. Expected User Workflow

When the user clicks:

```text
Pull
```

the extension performs:

```text
1. Verify GitHub connection
        ↓
2. Verify origin configuration
        ↓
3. Determine remote branch
        ↓
4. Retrieve remote branch HEAD
        ↓
5. Compare remote HEAD with local HEAD
        ↓
6. If identical → Already up to date
        ↓
7. If different → determine relationship
        ↓
8. Fetch missing Git objects
        ↓
9. Update local Git state
        ↓
10. Update snapshots/history
        ↓
11. Refresh displayed workflow
```

The operation must be read/write only against the extension's own IndexedDB state and read-only against GitHub.

---

# 4. Preconditions

Before pulling, verify:

## 4.1 GitHub authentication

The user must have a valid GitHub authentication mechanism already configured.

Reuse the existing Device Flow / PAT implementation.

Do not create another authentication flow.

If authentication is missing:

```text
GitHub connection required.
Connect GitHub before pulling.
```

---

## 4.2 Remote `origin`

Verify that a GitHub remote named `origin` exists in the existing remote configuration.

The implementation must retrieve:

```text
owner
repository
branch
remote URL
```

from the existing remote configuration.

Do not ask the user to manually enter the repository if the remote is already configured.

---

## 4.3 Local repository

Verify that the local IndexedDB Git repository has a valid state.

At minimum verify:

```text
HEAD exists
HEAD resolves to a valid local commit
repository metadata exists
origin configuration exists
```

If the local repository is empty, handle this as a separate initial-sync case rather than assuming a normal pull.

---

# 5. Determine Remote HEAD

Use the GitHub Git Data API to retrieve the remote branch reference.

Conceptually:

```text
GET remote branch ref
        ↓
refs/heads/<branch>
        ↓
remote commit SHA
```

The exact API helper should be reused from the existing GitHub implementation whenever possible.

Do not duplicate HTTP/API logic that already exists for Push.

---

# 6. Compare Local HEAD and Remote HEAD

Retrieve:

```text
local HEAD
remote HEAD
```

Then compare the commit SHAs.

### Case A — Same SHA

Example:

```text
local HEAD  = abc123
remote HEAD = abc123
```

Result:

```text
Already up to date.
```

No local data needs to be modified.

---

# 7. Remote Has New Commits

Example:

```text
local HEAD  = abc123
remote HEAD = def456
```

The implementation must determine whether the remote history can be applied directly to the local history.

The preferred case is:

```text
local HEAD
    ↓
commit A
    ↓
commit B
    ↓
remote HEAD
```

In this case, the local repository is behind the remote.

The Pull operation should:

1. Find commits missing locally.
2. Retrieve their associated trees.
3. Retrieve required tree entries/blobs.
4. Store missing objects in IndexedDB.
5. Update local commit history.
6. Move `HEAD` to the remote HEAD.
7. Update the local snapshot/workflow state.

Do not recreate objects that already exist locally.

Use SHA/object identity for deduplication.

---

# 8. Object Retrieval

Pull must fetch the Git objects required to reconstruct the remote state.

Potential objects include:

```text
commit
tree
blob
```

The implementation should reuse the existing local object model.

For every remote object:

```text
if object already exists locally:
    reuse it

else:
    download and store it
```

Do not download duplicate blobs unnecessarily.

This is especially important because the existing local Git implementation already uses blob deduplication.

---

# 9. Update Local HEAD

Only after all required objects have been successfully stored should the local `HEAD` be updated.

Correct order:

```text
Fetch objects
    ↓
Validate objects
    ↓
Persist objects
    ↓
Update commit/index state
    ↓
Update HEAD
```

Do not update `HEAD` before the remote state is completely available locally.

The operation should be atomic from the user's perspective.

If object retrieval fails halfway through:

```text
HEAD must remain unchanged.
```

Partially downloaded objects may remain only if they are safely reusable by a later pull.

---

# 10. Snapshot Synchronization

After successfully moving `HEAD`:

1. Resolve the remote tree.
2. Reconstruct the workflow state represented by the new commit.
3. Create/update the corresponding local snapshot.
4. Ensure the snapshot is available to the existing history/diff UI.

The existing project already stores workflow snapshots in IndexedDB and supports visual diffs between snapshots.

Do not create duplicate snapshots when the snapshot already exists.

---

# 11. Workflow Refresh

After a successful pull, the currently displayed workflow should reflect the pulled state.

Expected flow:

```text
Remote commit
      ↓
Remote tree
      ↓
Workflow JSON
      ↓
InternalWorkflowModel
      ↓
React Flow
```

If the user is currently viewing a GitHub workflow page, do not unexpectedly overwrite the GitHub page itself.

The Pull operation updates GitAgent Studio's local versioning state.

The existing visualizer can then refresh its local representation.

---

# 12. Local Changes / Divergence

The extension has its own local commit history.

Before moving `HEAD`, determine whether the local history and remote history diverged.

### Case A — Local is behind remote

Safe fast-forward case:

```text
A ── B ── C       remote
     ↑
   local
```

Action:

```text
Fast-forward local HEAD to C
```

No merge commit is required.

---

### Case B — Local and remote are identical

```text
A ── B ── C
         ↑
      both HEAD
```

Action:

```text
Already up to date.
```

---

### Case C — Local and remote diverged

Example:

```text
        B ── C    local
       /
A ───
       \
        D ── E    remote
```

Do **not** automatically overwrite either side.

Do **not** move local `HEAD` to the remote branch.

Do **not** delete local commits.

For the first implementation, report a basic conflict:

```text
Local and remote histories have diverged.

Your local branch contains commits that are not present on GitHub,
and GitHub contains commits that are not present locally.

No changes were applied.
```

The user's local history must remain intact.

This corresponds to the project's existing roadmap wording of:

```text
Pull depuis le repo distant (résolution de conflit basique)
```

---

# 13. Conflict Detection

The implementation must determine whether the remote HEAD is a descendant of local HEAD.

Conceptually:

```text
is remote HEAD reachable from local HEAD?
is local HEAD reachable from remote HEAD?
```

Possible results:

```text
same
↓
already up to date

remote descendant of local
↓
local is behind
↓
fast-forward

local descendant of remote
↓
local contains commits not on remote
↓
do not automatically overwrite

neither is ancestor
↓
diverged
↓
conflict
```

For the initial feature, only the fast-forward case needs automatic application.

---

# 14. Authentication and API Errors

Handle GitHub API errors explicitly.

### 401

```text
GitHub authentication has expired or is invalid.
Reconnect GitHub and try again.
```

### 403

Possible causes:

- insufficient permission
- API rate limit

Display an appropriate user-facing message.

Do not expose tokens.

### 404

Possible causes:

- repository no longer exists
- branch does not exist
- user no longer has access

Display:

```text
The remote repository or branch could not be found.
```

### Network failure

Display:

```text
Unable to reach GitHub.
Check your connection and try again.
```

The original technical error should remain available in development logs where appropriate.

---

# 15. No Destructive Operations

Pull must never:

```text
delete local commits
delete local snapshots
delete local blobs
overwrite local history
silently resolve conflicts
```

Never implement Pull as:

```text
remote → replace entire IndexedDB database
```

The local Git history must remain intact.

---

# 16. UI

Add a Pull action to the existing Git UI.

Example:

```text
Git

Branch: main

[ Pull ] [ Commit ] [ Push ]
```

While running:

```text
[ Pulling... ]
```

Disable the button while the operation is running.

Prevent duplicate concurrent Pull operations.

---

# 17. User Feedback

### Already up to date

```text
Already up to date.
```

### Fast-forward

Example:

```text
Pull completed.

3 new commits were downloaded.
Local branch updated to the latest remote commit.
```

### Conflict

```text
Pull could not be completed.

Local and remote histories have diverged.
No local changes were applied.
```

### Authentication error

```text
GitHub authentication required.
```

### API/network error

```text
Unable to pull from GitHub.
Please try again.
```

---

# 18. Data Integrity

The Pull operation must preserve the existing IndexedDB data model.

Before implementation, inspect:

- object stores
- repository metadata
- commit storage
- tree storage
- blob storage
- refs / HEAD
- snapshots
- remote configuration

Do not introduce a parallel storage system.

Use the existing transaction mechanisms where available.

Where multiple IndexedDB writes are required, use a transaction or equivalent atomic strategy.

---

# 19. Push Compatibility

After a successful Pull:

```text
Pull
 ↓
local HEAD = remote HEAD
```

A subsequent Push must continue to work normally.

The following sequence must be supported:

```text
Pull
Commit
Push
```

and:

```text
Commit
Pull
```

must correctly detect divergence if the local commit was not pushed.

Do not modify the existing Push fast-forward protection.

The current project already has GitHub Push with remote SHA/fast-forward controls.

---

# 20. Important Scope Limitation

This feature is **not** a complete implementation of:

- Git merge
- Git rebase
- interactive conflict resolution
- branch creation
- Pull Requests
- Merge Requests

Those remain separate features in the project roadmap.

The initial Pull implementation should focus on:

```text
Remote → Local synchronization
+
Fast-forward
+
Basic divergence detection
```

---

# 21. Implementation Steps for Codex

Before writing code:

### Step 1 — Inspect existing Git architecture

Find the existing implementation for:

```text
local Git / IndexedDB
GitHub authentication
origin
Push
Git Data API
HEAD
commits
trees
blobs
snapshots
```

### Step 2 — Identify reusable services

Reuse existing functions for:

```text
GitHub API requests
authentication
remote repository information
object storage
commit storage
snapshot storage
transactions
```

Do not duplicate them.

### Step 3 — Implement remote HEAD retrieval

Add the smallest abstraction necessary to retrieve:

```text
refs/heads/<branch>
```

from GitHub.

### Step 4 — Implement commit ancestry detection

Use the existing commit/tree model to determine:

```text
same
behind
ahead
diverged
```

### Step 5 — Implement fast-forward Pull

For the behind case:

```text
remote commits
↓
missing trees/blobs
↓
IndexedDB
↓
HEAD update
↓
snapshot
```

### Step 6 — Implement divergence protection

If histories diverge:

```text
do not modify HEAD
do not delete anything
return conflict status
```

### Step 7 — Connect to the UI

Add the Pull action to the existing Git UI.

### Step 8 — Refresh the workflow

After successful Pull, refresh the local workflow/snapshot representation.

---

# 22. Acceptance Criteria

The feature is complete when:

- [ ] Pull uses the existing GitHub API integration.
- [ ] Pull does not use Git CLI.
- [ ] Pull retrieves the configured remote branch HEAD.
- [ ] Local HEAD and remote HEAD are compared.
- [ ] Already-up-to-date is handled.
- [ ] Remote commits can be downloaded.
- [ ] Missing Git objects are stored in IndexedDB.
- [ ] Existing blobs are deduplicated.
- [ ] Local HEAD is updated only after successful synchronization.
- [ ] Fast-forward synchronization works.
- [ ] Diverged histories are detected.
- [ ] Diverged histories do not overwrite local data.
- [ ] Local commits are never deleted.
- [ ] Local snapshots are never silently deleted.
- [ ] Authentication errors are handled.
- [ ] GitHub API errors are handled.
- [ ] Network errors are handled.
- [ ] Pull cannot run concurrently twice.
- [ ] UI displays Pull progress/result.
- [ ] Workflow/snapshot state refreshes after successful Pull.
- [ ] Existing Commit functionality still works.
- [ ] Existing Push functionality still works.
- [ ] Pull → Commit → Push works.
- [ ] Pull after an unpushed local commit correctly detects divergence.

---

# 23. Definition of Done

The feature is finished when GitAgent Studio can perform:

```text
                 GitHub
                   │
                   │ Git Data API
                   ▼
             Remote HEAD
                   │
                   ▼
          Compare with HEAD
                   │
          ┌────────┴────────┐
          │                 │
       same             behind
          │                 │
          ▼                 ▼
   Already up-to-date   Fetch objects
                            │
                            ▼
                       IndexedDB
                            │
                            ▼
                       Update HEAD
                            │
                            ▼
                     Update snapshot
                            │
                            ▼
                     Refresh workflow
```

while preserving local commits and refusing to overwrite divergent local history.

The implementation must integrate with the existing Git/IndexedDB/GitHub architecture rather than introducing a new Git layer.
