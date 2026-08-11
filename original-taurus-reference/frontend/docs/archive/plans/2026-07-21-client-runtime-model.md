# Design — the client runtime model (open resources, runtimes, tabs)

**Status: implemented (2026-07-21)** — designed and landed in the same increment, per
the user's direction. The authoritative what-exists description is
[architecture/document-editor.md](../architecture/document-editor.md) plus the
[runtime.ts companion](../../src/lib/features/stages/document/runtime.ts.md); this
document keeps the model and its rationale.

## The model

Three layers, bridged by ids:

1. **Tabs** (`data/workspace.ts`) — what is open, per user per project. A resource tab
   *references* its resource (`resourceId`, a serializable string — workspace-ready);
   it holds no runtime object. The tab set is the **source of truth for what is
   open**.
2. **The open-resource registry / runtime managers** — per resource family, a manager
   owns **runtime objects** for the open resources of its kind. For documents:
   `features/stages/document/runtime.ts` — `acquireDocument(projectId, title,
   resourceId)` returns the `DocumentRuntime` for a resource (creating it on first
   ask), and a workspace watcher disposes runtimes whose tab closed (or whose project
   changed — strict isolation).
3. **Runtimes** — a `DocumentRuntime` *holds* the open document: the live
   `EditorState` (content, selection, undo history), the last-synced Omega snapshot,
   and the entire sync loop (debounce/flush/conflict-reload/prompt-resolve). It is
   **view-independent**: it keeps syncing whether or not any stage is mounted.

The stage is a **view**: it mounts a ProseMirror `EditorView` bound to the runtime and
`attach`es (receiving state pushes; taking over the `editorSession`/`activeSurface`
publications), and `detach`es on unmount — the runtime lives on until its tab closes.

## What this buys

- **Tab switches lose nothing**: content, cursor, scroll-adjacent state, and undo
  history survive (the state lives in the runtime, not the component). In-flight
  saves and prompt-resolve jobs continue in the background.
- **One resource ⇢ one tab ⇢ one runtime**: the one-tab-per-resource rule and the
  manager's keying line up (resource id, name as fallback), so there is exactly one
  sync loop per open document.
- **Scriptability**: an agent/script can `acquireDocument(...)` and use the runtime's
  `state`/`dispatch`/`actions` with **no UI at all** — the editor is an object model
  first, a view second. This is the seam AI-driven editing will use.
- **Scale path**: a sheet/slides/chat editor adds its own runtime + manager beside its
  stage, keyed the same way; the tab layer needs nothing new.

## Rules it preserves

- Dependency direction: runtimes live with their feature (`stages/document/`), import
  `data/*` and `features/shared/*`; `data/workspace` knows nothing of runtimes (the
  manager *subscribes* to it).
- Workspace-ready: tabs persist only serializable ids; runtimes are memory-only.
- One publisher: only the **attached** runtime writes `editorSession`/`activeSurface`.
- WorkSurface keys the stage by tab id, so instances never migrate between resources.

## Deliberate limits (now)

- Runtimes die with their tab (no LRU of closed documents) — reopening reloads from
  Omega, which is correct: the server is the source of truth.
- The registry is per-family (documents only today); a generic cross-family registry
  can emerge when a second family exists, from real shapes rather than speculation.
