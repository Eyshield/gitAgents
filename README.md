# GitAgent Studio

**Visualize, inspect, and version n8n workflows directly from your browser.**

GitAgent Studio is a browser extension that brings a visual workflow experience to n8n workflows stored on GitHub or opened from a local n8n instance.

Instead of working with large and difficult-to-read JSON files, GitAgent Studio turns n8n workflow definitions into an interactive visual graph, while providing a local Git-style versioning workflow directly in the browser.

> **Status:** Early prototype — the visual viewer and local versioning workflow are currently functional. Remote GitHub synchronization is still under development.

---

## ✨ Features

### 🔎 Visualize n8n workflows

When an n8n workflow JSON file is opened on GitHub, GitAgent Studio can detect it and replace the raw JSON experience with a visual representation.

* Detect n8n workflow JSON files on GitHub
* Visualize nodes and connections
* Inspect workflow structure through a graph-based interface
* Switch between the visual workflow and the original JSON
* Read-only visualization to prevent accidental modifications

### 🗂️ Local workflow versioning

GitAgent Studio provides a lightweight Git-style workflow directly in the browser.

* Create local workflow snapshots
* Detect changes between workflow versions
* Add modified workflows to the local index
* Create local commits
* View local workflow status
* Browse recent local commits
* Store version history locally using IndexedDB

### 🧩 Local n8n support

The extension can also detect workflows opened from an n8n instance running locally.

Supported local addresses include:

* `localhost`
* `127.0.0.1`

This allows you to work on an n8n workflow locally while keeping a lightweight version history directly in the browser.

---

# 🎥 Demo

## Visualize an n8n workflow

GitAgent Studio detects an n8n workflow JSON file on GitHub and transforms it into a visual workflow graph.

<video src="./assets/visulize%20woekflow.mp4" controls width="100%">
  Your browser does not support embedded videos.
</video>

[▶ Watch the visualization demo](./assets/visulize%20woekflow.mp4)

---

## Version an n8n workflow locally

The local versioning workflow allows you to detect changes, add them to the local index, and create local commits.

<video src="./assets/versionning.mp4" controls width="100%">
  Your browser does not support embedded videos.
</video>

[▶ Watch the versioning demo](./assets/versionning.mp4)

---

# 🔄 Current Workflow

The current prototype focuses on a **local-first versioning workflow**:

```text
Open n8n Workflow
        │
        ▼
Detect Workflow Changes
        │
        ▼
Compare with Local Version
        │
        ▼
       Add
        │
        ▼
     Commit
        │
        ▼
Local Version History
```

The goal is to provide familiar version-control concepts without requiring a full Git client inside the browser.

---

# 🚧 Current Limitations

GitAgent Studio is still under active development.

### GitHub integration

The **Connect with GitHub** interface is already present, but remote Git operations are not fully implemented yet.

The following features are currently under development:

* GitHub authentication
* Remote repository linking
* Fetching remote workflow versions
* Pushing workflow changes
* Remote synchronization
* Pull Request creation

For now, the reliable workflow is the **local versioning flow**.

### Workflow support

Currently, GitAgent Studio supports:

* ✅ n8n

Planned:

* ⏳ Zapier
* ⏳ Make

---

# 🛣️ Roadmap

The next stages of GitAgent Studio will focus on remote collaboration and more advanced version control.

### Version Control

* [ ] Branch management
* [ ] Branch-based workflow versions
* [ ] Visual diffs between workflow versions
* [ ] Visual diffs between branches
* [ ] Improved conflict detection
* [ ] Conflict resolution

### GitHub

* [ ] GitHub authentication
* [ ] Connect repositories
* [ ] Pull latest workflow versions
* [ ] Push workflow changes
* [ ] Create Pull Requests
* [ ] Remote synchronization

### GitLab

* [ ] GitLab authentication
* [ ] Repository integration
* [ ] Push workflow changes
* [ ] Create Merge Requests

### Workflow Formats

* [x] n8n
* [ ] Zapier
* [ ] Make
* [ ] Additional workflow formats

---

# 🧱 Tech Stack

GitAgent Studio is built with:

| Technology       | Purpose                     |
| ---------------- | --------------------------- |
| **Plasmo**       | Browser extension framework |
| **React**        | User interface              |
| **TypeScript**   | Application logic           |
| **Tailwind CSS** | Styling                     |
| **React Flow**   | Workflow visualization      |
| **IndexedDB**    | Local workflow storage      |

---

# 🚀 Getting Started

## Prerequisites

Make sure you have:

* Node.js
* npm
* Google Chrome or another Chromium-based browser

## Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd git-agents
npm install
```

## Start the development build

```bash
npm run dev
```

Plasmo will generate a development build.

For Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select:

```text
git-agents/build/chrome-mv3-dev
```

The extension should now be available in your browser.

---

# 📦 Production Build

To create a production build:

```bash
npm run build
```

The generated extension can then be packaged and distributed through the appropriate browser extension store or loaded manually.

---

# 🗂️ Project Structure

The project is organized around the browser extension architecture provided by Plasmo.

```text
git-agents/
├── assets/
├── context/
├── src/
│   ├── ...
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

The architecture is evolving as the project moves from the visualization prototype toward a complete workflow version-control platform.

---

# 🎯 Vision

GitAgent Studio aims to make **workflow development and version control easier to understand and use**.

n8n workflows are powerful, but their JSON representation is not designed for quickly understanding changes, structure, or history.

The long-term goal is to provide a workflow-centric development experience where developers can:

**Visualize → Compare → Version → Collaborate**

without constantly switching between the workflow editor, raw JSON, and Git tooling.

---

# 📌 Project Status

GitAgent Studio is currently an **early-stage prototype**.

### Available today

* ✅ n8n workflow detection on GitHub
* ✅ Visual workflow visualization
* ✅ JSON ↔ visual view
* ✅ Local workflow snapshots
* ✅ Change detection
* ✅ Local `Add` / `Commit` workflow
* ✅ Local commit history
* ✅ Local n8n workflow support

### In development

* 🚧 GitHub authentication
* 🚧 Remote repository synchronization
* 🚧 Branch management
* 🚧 Visual diffs
* 🚧 Pull Requests
* 🚧 GitLab integration
* 🚧 Conflict resolution

The current focus is validating the workflow visualization and local versioning experience before expanding into remote collaboration.

