# Change record — 2026-07-21 — The client runtime model (runtimes, manager, tab↔resource bridge)

Implements the user-directed architecture: tabs and open resources are **two bridged
registries**, and each open document is a **runtime object** owned by a **documents
manager** — not state trapped inside a component. Design + rationale:
[plans/2026-07-21-client-runtime-model.md](../plans/2026-07-21-client-runtime-model.md).

## What changed

- **`data/workspace.ts`** — `Tab.resourceId` (serializable, workspace-ready): a
  resource tab now *references* its resource. `openTab`/`resolveTab` accept the id;
  one-tab-per-resource matches by id first, title as the legacy fallback.
- **`data/resources.ts`** — `addResource` returns the created `Resource`, so every
  create path can link the tab to the resource id.
- **NEW `features/stages/document/runtime.ts`** — the extraction: `DocumentRuntime`
  holds the live `EditorState`, the snapshot, and the whole sync loop (debounce, flush
  with inspector-queued ops, 409 conflict reload with cursor restore, retry, prompt
  resolve polling), plus session/surface publication (gated on *attached*) and all
  inspector actions — everything the stage used to own, now **view-independent**. The
  **documents manager**: `acquireDocument()` (one runtime per open resource, keyed by
  resource id / name-fallback per project) + a workspace watcher that flushes and
  disposes runtimes when their tab closes or the project switches — **the tab set is
  the source of truth for what is open**.
- **`DocumentStage.svelte`** — now a view: mounts the `EditorView` bound to
  `runtime.state` with `runtime.dispatch` as its transaction sink, attaches
  (state pushes / gutter re-measure / focus hooks), detaches on unmount. Page chrome
  and gutters unchanged. **WorkSurface keys the stage by tab id** so switching between
  two document tabs never reuses an instance across resources.
- Callers thread ids: Overview (create/open/import/activity), New-tab (create/
  template/AI/import/table), the shell Resources panel.

## Why (the user's framing, delivered)

An object of open resources ↔ an object of open tabs, bridged by ids; a tab says which
resource it shows; the resource's runtime holds the data and manages the sync; the
manager provides documents to whoever asks. Concretely gained: **tab switches keep
content, selection, and undo history and syncing continues in the background**; and
the editor is now scriptable — `acquireDocument(...)` gives AI/scripts the same object
the UI uses, no view required.

## Verification

`pnpm check` → 0 errors / 0 warnings (the two intentional initial-capture warnings
resolved via the tab-keyed instances + an annotated ignore); `pnpm build` → clean.
Behavior-level checks ride on the previously live-verified sync paths (unchanged op
generation — the runtime is a relocation, not a rewrite of the loop).
