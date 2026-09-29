# GitAgent Studio

GitAgent Studio is a browser extension for visualizing and versioning n8n workflows stored in GitHub. Instead of reading a workflow as a large JSON file, you can inspect its nodes and connections in a visual canvas directly from GitHub.

The project is currently a work in progress. The features described below reflect the current prototype.

## What works today

- Detects n8n workflow JSON files on GitHub.
- Displays the workflow as a read-only visual graph with nodes and connections.
- Lets you switch back to the original JSON source.
- Saves local workflow snapshots in the browser.
- Detects changes between the current n8n workflow and its local version.
- Provides a local Git-style workflow with `Add` and `Commit` actions.
- Shows the local workflow status and recent local commits.
- Adds a local versioning panel to workflows opened from an n8n instance running on `localhost` or `127.0.0.1`.

## Demo

### Visualize an n8n workflow on GitHub

<video src="./assets/visulize%20woekflow.mp4" controls width="100%">
  Your browser does not support embedded videos. [Watch the visualization demo](./assets/visulize%20woekflow.mp4).
</video>

[Open the visualization demo](./assets/visulize%20woekflow.mp4)

### Version an n8n workflow locally

<video src="./assets/versionning.mp4" controls width="100%">
  Your browser does not support embedded videos. [Watch the versioning demo](./assets/versionning.mp4).
</video>

[Open the versioning demo](./assets/versionning.mp4)

## Current limitations

The `Connect with GitHub` button is present in the interface but is not functional yet. GitHub authentication, remote repository linking, and the complete remote synchronization workflow are still being developed. For now, the reliable workflow is the local one: inspect an n8n workflow, detect changes, add them to the local index, and create local commits.

Only n8n workflows are supported at the moment. Zapier and Make workflow formats are planned for a later stage.

## Coming next

The next versioning and collaboration features will include:

- Branch management and branch-based workflows.
- Visual diffs between workflow versions and branches.
- Pulling the latest workflow version from a remote repository.
- Pushing changes to GitHub after authentication is stable.
- Pull Request creation on GitHub.
- Merge Request creation on GitLab.
- Better conflict handling during synchronization.

## Development

This extension is built with Plasmo, React, TypeScript, Tailwind CSS, React Flow, and IndexedDB for local storage.

```bash
cd git-agents
npm install
npm run dev
```

For Chrome, load the generated development build from `git-agents/build/chrome-mv3-dev` at `chrome://extensions` with Developer mode enabled.

To create a production build:

```bash
npm run build
```

## Project status

This is an early prototype. The visual workflow viewer and local versioning flow are available for experimentation, while remote Git operations and collaboration features are still under active development.
