# Plan — next increments (document workflow + shell)

**Status: living** — the ordered queue after the panels increment. Each item is one
reviewable change with the usual gates (companions, records, check 0/0 + build; live
verification where the backend is involved).

## 0. Review gates (user)

- ~~Approve (or amend) the [panel-system design](2026-07-21-panel-system-design.md).~~
  **Approved 2026-07-21** with amendments: workspace-ready + reorg (folded into § 1).
- Try the current build: the paper page, the panels (block lens, new-block type picker,
  prompt instruction + Resolve), Quarterback-bar → inspector.
- A real prompt **resolve with live intelligence** needs an OpenRouter key and spends
  real tokens — run when ready; the UI states (Resolving… → Resolved/Insufficient/
  Contradiction + evidence) are wired and the job plumbing is verified, but the happy
  path hasn't been exercised end-to-end with a model.

## 1. Reorganization + panel-system migration — **done (2026-07-21)**

Landed as specified, with refinements discovered in execution: the contribution
store lives at `features/shared/surface.ts` (the neutral cross-feature spot — putting
it in `shell/` would have forced stages to import the shell), and **WorkSurface is the
one sanctioned shell→stages import** (the stage router; someone must mount stages —
that's its whole job). On 2026-07-23, document context became a complete
surface-owned set rather than an append to project context; the inspector merge remains
unchanged. Everything below was the original layout spec:

The approved panel migration lands together with the directory reorg, since they move
the same files. Goal: **the tree itself says what owns what** — every stage is its own
directory, editor machinery belongs to its editor, the shell is fully separated, and
adding a new editor touches only its own directory.

Target layout (`src/lib/`):

```text
components/                    UI primitives (unchanged; companion-exempt)
data/                          THE Omega boundary — deliberately flat, one file per
                               backend capability (api, session, projects, resources,
                               documents, workspace, transfer). Stays flat: it mirrors
                               Omega's capabilities, and that IS its organization.
features/
  shared/                      Cross-feature contracts, including the implemented
                               surface.ts contribution store.
  shell/                       The workspace shell, fully separated: AppShell, bars,
                               tab strip, SidePanel, QuarterbackDock, StatusBar,
                               the project-context fallback, and the permanent
                               inspector sections. No
                               stage-specific code, ever.
  stages/
    overview/                  OverviewStage + its pieces (PurposeStatement,
                               CreateColumn, ActivityFeed, ActivityActor) — shared with
                               no other stage.
    new-tab/                   NewTabStage + NewResourcePanel, TemplatesCarousel,
                               AiCreateDialog.
    document/                  The document editor, whole: DocumentStage + its panel
                               components (Info metadata, Outline, Details lens) and
                               editor/ (schema.ts, bridge.ts, session.ts — moved from
                               the former src/lib/editor/ because it is document-
                               specific; other editors get their own).
    shared/                    Only what stages genuinely share by design: kinds.ts,
                               ResourceTable + its dialogs (used by overview AND
                               new-tab). Anything here must justify itself.
```

Rules the reorg enforces: stages never import from each other (only from `shared/`,
`components/`, `data/`); the shell never imports from `stages/` (it renders
contributions blind); `data/` never imports upward. Imports are the audit: a
cross-stage import is a smell that something belongs in `shared/` or the design is
wrong.

**Exit:** identical behavior; shell has zero document-specific code; `git log --follow`
preserves file history (moves via `git mv`); every companion moves with its file;
architecture docs updated to the new paths.

## 2. Selection styling (marks) — **done (2026-07-21)**

Landed: char→byte anchoring (`charToAnchor`), mark extraction from PM nodes, and
**rewrite-whole reconciliation** in the differ (remove all → re-add desired, removals
ordered before atom ops — the ordering that the server provably 409s without);
`toggleMark`/`setLink` actions + Mod-B/I/U keymaps; the range lens's style toggles and
link row. Exit criteria met: styling syncs and survives reload; plain text edits
preserve marks (re-added from the PM node's truth rather than made atom-aware — same
outcome, simpler differ). Live-verified against Omega including multibyte anchors.
Remaining for later: styling at the cursor (stored marks) and a floating toolbar.

## 3. Prompt-block polish

Stale detection (compare `PromptData.sources` sync times when knowledge lands),
explicit Refresh vs Reload actions, a resolving state on the block's right-gutter
indicator, and the block's `Inferred` styling in the page.
**Exit:** prompt lifecycle legible entirely from the page + inspector.

## 4. Drag reorder on the gutter anchor

Drag the left anchor to move blocks; differ gains move detection (today a move would
read as delete + insert, losing block identity).
**Exit:** reorder persists; block ids stable across moves.

## 5. Overview as a surface

Overview contributes its own panels via the new mechanism (e.g. Activity context;
a resource-table selection lens).
**Exit:** Overview's rails feel designed, not defaulted.

## 6. Real resource ids — **done (2026-07-22)**

The real Resource catalog shipped. Current resource tabs carry `resourceId` and
`resourceKind`; a document resource id is its Omega document id, and
`DocumentRuntime.load()` reads it directly. Name matching remains only as a
compatibility fallback for tabs persisted before ids existed.

## 6b. Workspace persistence (backend-dependent)

When [backend-requests/workspace.md](../backend-requests/workspace.md) ships: swap
`data/workspace.ts`'s localStorage load/persist for the per-user endpoints (debounced
writes). By design (see the workspace-ready amendment) this touches **only**
`workspace.ts` — tabs, panel geometry, and active sections follow the user across
devices with no shell changes.

## 7. Quarterback conversation (backend-dependent)

The `ai` inspector section becomes the real conversation/config surface once a
generation endpoint exists ([backend-requests/ai-generation.md](../backend-requests/ai-generation.md));
the bar's submit stops being inert.

---

Current queue: 3–4 deepen the document workflow; 5 exercises the panel system's
generality; 6b and 7 remain blocked on Omega. Increments 1, 2, and 6 are complete.
