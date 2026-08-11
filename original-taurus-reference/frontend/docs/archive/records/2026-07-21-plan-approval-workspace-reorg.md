# Change record — 2026-07-21 — Panel design approved; workspace + reorg amendments

Docs-only. The user approved the
[panel-system design](../plans/2026-07-21-panel-system-design.md) with two amendments,
both folded into the plans (no code changed):

## 1. Workspace-ready

A backend **workspace capability** is intended: per-user storage of open tabs, panel
collapsed/width state, and active panel sections. Added:

- A **Workspace-ready** section to the design — constraints the panel system keeps so
  this stays a `data/workspace.ts`-only swap later: all persisted shell state flows
  through that one module; section ids/tab descriptors are stable serializable strings
  (never component refs); unknown persisted sections normalize safely; transient state
  (selection, drafts) is never workspace-persisted.
- [backend-requests/workspace.md](../backend-requests/workspace.md) — the ask:
  `GET/PUT /workspace` per user × selected project, whole-object replace, debounced.
- Next-steps § 6b — the follow-up when it ships.

## 2. Reorganization for growth (planned, not yet executed)

Ownership must be legible from the tree: the current `src/lib/editor/` is
document-specific (other editors are coming), stages share a flat directory, and the
shell should be fully separated. Next-steps **§ 1** is now a single structural
increment — reorg + panel migration together (they move the same files) — with the
target layout: `features/shell/` (universal only, + the contribution store),
`features/stages/{overview,new-tab,document,shared}/` (document absorbs `lib/editor/`
as its own `editor/`), `data/` staying deliberately flat (one file per Omega
capability — that *is* its organization). Plus the import rules that make violations
auditable: stages never import each other; shell never imports stages; data never
imports upward.

Design status → **approved**; plans README updated; backend-requests index gains the
workspace row.
