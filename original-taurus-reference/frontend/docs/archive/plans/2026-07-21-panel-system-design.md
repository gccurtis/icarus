# Design — the panel system (context + inspector across many surfaces)

**Status: implemented (2026-07-21; context ownership refined 2026-07-23)** — approved
with amendments (workspace-ready + directory reorg), then landed the same day as
next-steps § 1. Three execution
refinements: the contribution store lives at `features/shared/surface.ts` (neutral
cross-feature spot), and `WorkSurface` is the one sanctioned shell→stages import (the
stage router). A later refinement makes a surface's context contribution the complete
left-rail set rather than appending it to project context; inspector contributions
retain the original merge behavior. The authoritative description of what exists is now
[architecture/document-editor.md](../architecture/document-editor.md) (§ 2) and the
`surface.ts` companion; this document remains as the design rationale. Describes how
the side panels evolve so every surface (document editor, sheet, slides, chat,
Overview…) can bring its own context and inspector content without reshaping the shell
each time.

## The question

The shell reference gives the two rails permanent cognitive jobs — left = **the map**
(what exists around this work), right = **the lens** (what can I change about the
current selection). Different surfaces genuinely need different maps: a document wants
document context and a block lens; a sheet will want a sheet map and cell lens; Overview
wants project-level context. The design question: **where do sections and their content
come from, so adding a surface never means editing the shell?**

## What existed pre-migration (v1 — the honest assessment that motivated this)

Built in the panels increment (since migrated; kept as rationale):

- `AppShell` **hardcodes two global section sets**: context = Properties / Outline /
  Resources / History / Personas; inspector = Details / Quarterback (`ai`).
- Two shell components render all content by switching on section id:
  `ContextPanelContent`, `InspectorPanelContent`.
- The **editor session** (then `src/lib/editor/session.ts`, now under the document
  feature) is the one real seam: the
  document stage publishes `{metadata, outline, selection, actions}`; panel content
  reads it; `null` → intentional defaults. Panels know nothing of ProseMirror.
- `QuarterbackDock` focus → inspector's `ai` section (reference behavior).

**What's right:** the session store is exactly the decoupling we want — stage-published
state + actions, shell-rendered. The section *vocabulary* matches the reference. The
stale-section normalization in AppShell means section sets can change safely.

**What won't scale:** the section sets are global (every stage shows Outline, even a
future sheet); the two content components accumulate per-surface branches (document
logic already lives in shell code); and a new surface can't add a section without
editing `AppShell` + both content components. That's the growth problem this design
fixes.

## The design — surface-contributed panels

One concept: the active stage may publish a **surface contribution**. Its context set
replaces the project-context fallback; its inspector sections merge with the permanent
shell sections.

```ts
// src/lib/features/shared/surface.ts
export type PanelSection = {
  id: string;             // unique within its rail
  label: string;
  icon: Component;
  content?: Component;    // implemented view; reads its surface's session store
  placeholder?: string;   // explicit holding copy while a view is being designed
};
export type SurfaceContribution = {
  /** Stable id, e.g. 'document:<docId>' — lets the shell reset per surface. */
  id: string;
  /** Complete left-rail section set; replaces the project-context fallback. */
  context?: PanelSection[];
  /** Sections for the right rail; the first is the surface's "Details" lens. */
  inspector?: PanelSection[];
};
export const activeSurface = writable<SurfaceContribution | null>(null);
```

Rules:

1. **Project context is the shell-owned left-rail fallback.** Properties, Resources,
   History, and Personas appear when no surface claims context (notably Overview).
   Right — the inspector's **permanent** sections *(amended 2026-07-21)*:
   **Details** (always first, **the default**; a shell fallback renders until the
   surface overrides it) and **Quarterback** (`ai`, always last, opened by the bar).
2. **A surface's context sections replace project context** so a resource editor owns
   its entire map. On the right, a contributed section with id **`details` replaces
   the universal Details content** (that's how a surface installs its lens) and other
   contributed sections sit between the two permanents. **The lens follows the click**:
   pointer-down in the
   work jumps the inspector to Details (section only, never the collapsed state);
   focusing the Quarterback bar jumps to `ai`.
3. **An implemented section's `content` is owned by the surface's feature directory**
   (e.g. `features/stages/document/panels/OutlinePanel.svelte`), not by the shell. It
   reads its own session store (`editorSession` for documents). A named view whose
   contract is not designed yet carries explicit placeholder copy. The shell renders
   either form blind.
4. **One writer**: the active stage publishes on mount/update and clears on destroy —
   the same discipline `editorSession` already follows. Tab switches swap contributions
   naturally because stages mount/unmount.
5. **Persistence unchanged**: the workspace store keeps per-rail active-section ids;
   AppShell's normalization (unknown id → rail's first section) already handles
   contributions appearing/disappearing.
6. **The Quarterback rule stays shell-level**: bar focus opens `ai` regardless of
   surface.

## Workspace-ready (amendment)

A backend **workspace capability** is planned on Omega: per-user storage of shell
state — which tabs are open (and active), each panel's width/collapsed state, and the
active panel section (see
[backend-requests/workspace.md](../archive/backend-requests/workspace.md)). The panel system
must not fight that. Constraints it therefore keeps:

- **All persisted shell state flows through one boundary module** —
  `src/lib/data/workspace.ts` — and nothing else. It already holds exactly the shape
  the backend would store: `{ tabs, activeTabId, context: { width, collapsed,
  section }, inspector: { width, collapsed, section } }`, JSON-serializable, keyed
  per project (and, once real, per user by the session). Swapping localStorage for
  Omega endpoints is a change to `workspace.ts` **only** — load/persist becomes
  fetch/PUT (debounced), the shell and the panel system don't change.
- **Section ids and tab descriptors are stable, serializable strings** — never
  runtime-generated, never component references. Contributed sections carry their
  component *locally*; only the id is ever persisted.
- **A persisted section id may reference a contribution that isn't mounted** (the user
  last looked at a document panel, then reloads onto Overview). The normalization rule
  (unknown id → rail's first section) makes that safe; when the surface mounts again,
  reselecting its section is a UX nicety, not a correctness need.
- **Session-only state stays out of the workspace**: selection, prompt drafts,
  hover/gutter state, resolving flags — per the shell reference, transient
  selection/focus is never pretended to be canonical backend data.

### Migration from v1 (mechanical, no behavior change)

| Today | Target owner |
| --- | --- |
| `AppShell` section arrays | Project context stays as a fallback; a document contributes its complete context vocabulary plus the Details block/prompt lens |
| `ContextPanelContent` properties/outline branches | Project Properties stays in the fallback; document Info metadata + Outline become document-owned panel components |
| `ContextPanelContent` resources/history/personas | Stay in the project-context fallback rather than leaking into resource editors |
| `InspectorPanelContent` details lens | Becomes the document's contributed inspector section (component moves under the document feature) |
| `InspectorPanelContent` `ai` section | Stays universal (shell) |
| `editorSession` | Unchanged — remains the document surface's session store |

The refactor is file moves + the small `activeSurface` store + AppShell selecting
surface context or the project fallback and merging inspector sections. No data-layer
or editor changes.

### Why this survives growth

- **A new editor** (sheet, slides, chat) ships entirely inside its feature directory:
  its stage, its session store, its panel components, one `activeSurface.set(...)`.
  Zero shell edits.
- **Overview** becomes a surface too: it can contribute, say, an Activity context
  section and a selection lens for the resource table — same mechanism, nothing
  special-cased.
- **The shell stays the frame**: rails, persistence, resize/collapse, normalization,
  Quarterback behavior — none of it grows with the number of surfaces.
- **Companions/architecture stay honest**: each surface's panels are documented beside
  the surface that owns them.

## Alternatives considered

- **Keep the global switch components** (v1 forever): every surface bloats two shell
  files; shell becomes a coupling point for all features. Rejected — it's the exact
  failure the question names.
- **Full per-stage panel replacement** (each stage renders whole rails): loses the
  universal-sections-in-predictable-positions guarantee and duplicates rail chrome.
  Rejected.
- **A central static registry** (map of tab kind → sections in one shell file): better
  than v1 but still requires a shell edit per surface and can't carry live state as
  naturally as a stage-published store. Rejected in favor of the contribution store.

## Decision

**Approved 2026-07-21** with the workspace amendment above and the requirement that the
migration land together with the directory reorganization (clear per-editor/per-stage
ownership — `editor/` machinery becomes document-owned, stages stop sharing files, the
shell fully separated). The combined increment is specified in
[2026-07-21-next-steps.md](2026-07-21-next-steps.md) § 1.
