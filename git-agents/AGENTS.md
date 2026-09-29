# Plasmo Extension Development

This project is built with **Plasmo**, a framework for developing browser extensions.

Do NOT assume that this project follows standard Next.js, React application, or Vite conventions.

Plasmo introduces its own conventions for:

- Extension entry points
- Background/service workers
- Content scripts
- Popup pages
- Options pages
- Messaging between extension contexts
- Manifest generation
- Permissions
- Storage
- Assets
- Build configuration
- Development and production builds

Before writing or modifying code, inspect the existing project structure and follow the conventions already established by Plasmo.

When documentation or APIs may have changed, consult the relevant documentation available in the installed dependencies or the official Plasmo documentation before implementing a solution.

Do not introduce another extension framework or manually reproduce functionality that Plasmo already provides.

---

# Application Building Context

Before implementing features or making architectural decisions, read the following files **in this exact order**:

1. `context/project-overview.md` — product definition, goals, features, target users, and project scope
2. `context/architecture-stack.md` — extension architecture, entry points, communication boundaries, storage model, permissions, and invariants
3. `context/ui-content.md` — UI theme, colors, typography, layouts, popup/options/page conventions, and reusable components
4. `context/code-standards.md` — coding conventions, TypeScript/React rules, naming conventions, and implementation standards
5. `context/ai-workflow-rules.md` — development workflow, task-scoping rules, validation requirements, and delivery approach
6. `context/tracker.md` — current development phase, completed work, known issues, open questions, and next steps

Do not begin implementation or make architectural decisions before reviewing the relevant context files.

---

# Plasmo Architecture Rules

Respect Plasmo's extension architecture.

Before adding a new entry point, determine whether the feature belongs to:

- `contents/` — content scripts injected into web pages
- `background.ts` or the project's configured background entry — background/service-worker logic
- `popup.tsx` / popup entry — browser extension popup UI
- `options.tsx` / options entry — extension settings UI
- `tabs/` or other configured pages — extension-controlled pages
- `components/` — reusable UI components
- `lib/` / `utils/` — shared application logic
- `assets/` — static extension assets

Follow the existing project structure instead of creating alternative patterns.

Do not duplicate logic across extension contexts when it can be shared safely.

---

# Extension Context Boundaries

Always distinguish between the different execution contexts of a browser extension.

Code running in:

- a content script
- the background/service worker
- the popup
- an options page
- an extension page

does not automatically share the same runtime environment.

Do not assume that:

- DOM APIs are available everywhere
- `window` exists everywhere
- `document` exists everywhere
- browser extension APIs are available from every context
- state can be directly shared between contexts
- imports behave identically across all extension entry points

When communication between contexts is required, use the project's established messaging architecture and Plasmo-supported mechanisms.

---

# Browser APIs and Permissions

Treat browser permissions as part of the architecture.

Before adding a permission:

1. Determine why it is required.
2. Check whether an existing permission already covers the use case.
3. Follow the project's permission conventions.
4. Avoid requesting broader permissions than necessary.
5. Update the relevant context documentation when the permission changes the architecture or security model.

Do not add permissions simply to make an implementation easier.

---

# Storage

Follow the storage model defined in:

`context/architecture.md`

Before introducing a new storage mechanism, determine whether the project already uses:

- Plasmo storage
- `chrome.storage`
- `browser.storage`
- local storage
- IndexedDB
- backend persistence

Do not introduce a second storage strategy without documenting the architectural reason.

Keep sensitive data out of insecure client-side storage unless explicitly required and documented.

---

# Messaging

When communication is required between extension contexts, follow the existing messaging pattern.

For example:

```text
Content Script
      ↓
Message
      ↓
Background / Service Worker
      ↓
API / Storage / Processing
      ↓
Response
      ↓
Content Script
```

Do not create ad-hoc communication mechanisms for individual features if an established messaging layer already exists.

Keep message contracts typed and explicit where possible.

---

# Content Scripts

Content scripts interact directly with third-party webpages and therefore require additional care.

When modifying content-script behavior:

- Avoid unnecessary DOM manipulation.
- Do not assume a website's DOM structure is stable.
- Isolate website-specific selectors and logic.
- Avoid polluting the global page scope.
- Handle dynamically rendered pages.
- Consider navigation changes in single-page applications.
- Avoid expensive observers or polling loops.
- Clean up listeners and observers when appropriate.

Website-specific behavior should remain isolated from generic extension logic.

---

# Background / Service Worker

Background logic should remain focused on extension-level responsibilities such as:

- API communication
- authentication coordination
- storage
- message routing
- browser events
- alarms
- tabs/windows interaction
- extension lifecycle events

Do not place large UI components or page-specific DOM logic in the background context.

Remember that service-worker/background contexts may have different lifecycle behavior from a persistent web application server.

Do not rely on in-memory state remaining available indefinitely.

---

# UI Development

Follow `context/ui-content.md` for all UI decisions.

Use the project's established:

- design system
- colors
- typography
- spacing
- component patterns
- responsive behavior
- icon system
- accessibility conventions

Do not introduce a new UI library or design system without first checking the architecture and standards.

Popup interfaces should remain lightweight and responsive because users interact with them in a constrained browser-extension surface.

---

# API and Backend Communication

When the extension communicates with an external backend:

1. Follow the API contract defined by the project.
2. Keep authentication logic centralized.
3. Do not duplicate API clients across entry points.
4. Validate responses before using them.
5. Handle network failures explicitly.
6. Avoid exposing secrets in the extension bundle.

Never assume that an API key or secret can safely be embedded in extension code.

Anything shipped to the browser should be considered potentially inspectable by the user.

---

# Security

Security is a first-class requirement for this project.

When implementing features:

- Minimize requested permissions.
- Validate messages between extension contexts.
- Validate external data.
- Avoid unsafe HTML injection.
- Avoid exposing secrets.
- Protect authentication tokens according to the architecture.
- Avoid trusting content-script input.
- Avoid trusting webpage content.
- Use HTTPS for production backend communication.
- Keep privileged operations in the appropriate extension context.

If a feature introduces a meaningful security implication, document it in:

`context/architecture-stack.md`

before proceeding.

---

# Dependencies

Before installing a new dependency:

1. Check whether the functionality already exists in Plasmo or the project.
2. Check whether an existing dependency can solve the problem.
3. Consider bundle size and extension performance.
4. Consider browser compatibility.
5. Consider whether the dependency works correctly in every extension context where it will be used.

Do not add dependencies unnecessarily.

---

# Development Workflow

For every meaningful task:

1. Read the relevant context files.
2. Understand the existing implementation.
3. Identify the smallest appropriate change.
4. Implement the change following project conventions.
5. Run the relevant validation/build commands.
6. Check for TypeScript, lint, runtime, and extension-build errors.
7. Update documentation when architecture or conventions change.
8. Update `context/tracker.md`.

Avoid unrelated refactoring while implementing a focused feature.

---

# Context File Maintenance

The context files are part of the project's development system.

If an implementation changes:

- architecture
- extension entry points
- permissions
- storage
- messaging
- API contracts
- UI conventions
- coding standards
- project scope

update the relevant context file before continuing.

Do not allow the context documentation to become inconsistent with the actual implementation.

---

# Progress Tracking

After every meaningful implementation change, update:

`context/progress-tracker.md`

The progress tracker should contain:

- Current phase
- Completed work
- Recently implemented changes
- Current architecture state
- Known issues
- Open questions
- Next recommended tasks

Keep the tracker factual and concise.

Do not mark a feature as completed unless it has been implemented and appropriately validated.

---

# Implementation Principle

Prefer:

```text
Existing Plasmo convention
        ↓
Existing project architecture
        ↓
Smallest implementation
        ↓
Validation
        ↓
Documentation update
```

over:

```text
New abstraction
        ↓
New dependency
        ↓
New architecture
        ↓
Large refactor
```

The goal is to build a maintainable browser extension while preserving the project's existing architecture and conventions.
