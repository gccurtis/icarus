# Workbench shell

## Purpose

The workbench is one stable frame around every tab. It owns the top bar, object tabs, left context panel, center work surface, right inspector, floating copilot bar, and bottom status bar. Switching tabs changes all tab-owned state together; it is not route navigation.

The existing six-zone frame in `app/src/lib/views/app/app.svelte` is the baseline. This specification extends its vocabulary without changing its center-first geometry.

## Frame

```text
┌──────────────────────────── top bar ────────────────────────────┐
├──────────────────────────── tab strip ──────────────────────────┤
│ context rail + panel │       active work surface       │ inspector │
│                      │      floating copilot bar        │           │
├─────────────────────────── status bar ──────────────────────────┤
```

- Top bar: 44 px baseline.
- Tab strip: 36 px baseline.
- Context rail: fixed and always reachable; context content is independently collapsible and resizable.
- Inspector: independently collapsible and resizable.
- Work surface: receives remaining width and owns its own scrolling/zoom behavior.
- Copilot: floats above the work surface and never consumes a permanent grid row.
- Status bar: 24 px baseline for sync, evaluation, selection, and zoom summaries.

Every center surface reserves a bottom safe area equal to the dock's occupied height plus its gap. The final document page, slide notes, spreadsheet sheet tabs, and analysis controls must be scrollable above the Copilot rather than hidden behind it.

The active tab owns its context selection, panel widths, collapse states, zoom, local selection, scroll position, and screen-specific editor view state. A tab switch restores all of them. Browser reload persistence is narrower: tab targets, panel geometry, active context, and safe serializable view settings may survive; live editor selections, IME state, and exact inspection may clear. The discriminated state contract below and each screen's retained-state section replace one opaque generic options blob.

## Top bar

The top bar is global and should stay quiet. It retains Taurus Alpha's balanced hierarchy while every action is backed by a real Icarus flow:

- **Left:** project switcher with current project name, archived indicator, and switch/search menu.
- **Center:** Icarus wordmark. It is visually centered in the viewport rather than merely centered in the remaining flex space.
- **Right:** global command/search, Import, operational Export/Share actions when available, compact project presence, attention-only background state, theme/help/settings, and current-user menu.

Import opens [New Tab](new-tab.md) on its Import view. Export and Share remain absent or disabled with an honest explanation until a selected object's exporter/permission path exists; they must not be mock buttons. Selecting collaborator presence opens member detail in the inspector. Presence requires an ephemeral collaboration channel and must never be inferred from `User.lastSeenAt` or Activity.

Indexing/knowledge health may appear in the attention cluster only after a backend projection can truthfully report source/project health. Lattice nodes alone are not a complete operational health feed.

Do not put resource-specific formatting in the top bar. A document margin, chart type, or selected-element fill is not global.

## Tab strip

- Project Overview is the first permanent tab and has no close action.
- A plus button opens one New Tab launcher. Choosing a resource resolves that same tab in place rather than opening another tab beside it.
- Each canonical tab target is deduplicated. Opening something already open activates its existing tab.
- Transient resource tabs show kind icon, title, dirty/sync state when needed, and close action.
- Shift and platform-modifier selection can select a contiguous or discontiguous tab group for reorder/close actions. A grouped drag preserves relative order and uses a stable before-anchor destination.
- The tab context menu offers only real actions: Close, Close others/to the side, Reopen closed, and Duplicate when that resource kind supports duplication.
- Closing the active tab activates the nearest surviving tab; closing the last transient tab returns to Project Overview.
- The strip scrolls horizontally, does not wrap, and keeps the plus button reachable at the end.
- Tabs are workbench object buttons, not ARIA content tabs; keyboard next/previous/close commands remain globally available.

Tab identity is broader than `ResourceKind`. The proposed contract is:

```ts
type TabTarget =
  | { kind: "system"; screen: "project-overview" | "new-tab" | "context" | "templates" | "personas" | "automations" }
  | { kind: "general-resource"; resourceType: "document" | "slides" | "spreadsheet"; resourceId: string }
  | { kind: "work"; screen: "research" | "analysis"; id: string };
```

### Typed retained tab state

The shell stores serializable view state as a discriminated union, separate from editor runtimes and persisted resource bodies. The minimum first-generation contract is:

```ts
interface TabFrameState {
  contextId: string;
  contextCollapsed: boolean;
  contextWidth: number;
  inspectorCollapsed: boolean;
  inspectorWidth: number;
}

type LauncherDraft =
  | { kind: "document"; title: string; templateId?: string; paper?: string; orientation?: string }
  | { kind: "slides"; title: string; templateId?: string; aspectRatio: "16:9" | "4:3" }
  | { kind: "spreadsheet"; title: string; templateId?: string; firstSheetName: string }
  | { kind: "research"; title: string; mode: "discover" | "question" | "hypothesis"; anchorId?: string }
  | { kind: "analysis"; title: string; description?: string; initialName?: string }
  | { kind: "context" | "template" | "persona" | "automation"; name: string }
  | { kind: "import"; providerId?: string; stagedUploadIds: string[] };

type WorkbenchTabState =
  | { kind: "project-overview"; frame: TabFrameState; selection?: { kind: "resource" | "activity" | "task" | "health"; id: string }; resourceQuery: string; resourceKinds: string[]; centerScrollY: number }
  | { kind: "new-tab"; frame: TabFrameState; query: string; selected?: { kind: string; id?: string }; draft?: LauncherDraft; recentKinds: string[]; centerScrollY: number }
  | { kind: "document"; frame: TabFrameState; zoom: number; scrollAnchor?: { blockId: string; offsetPx: number }; selection?: { root: "body" | "header" | "first-header" | "footer" | "first-footer"; blockId?: string; offset?: number }; findQuery: string }
  | { kind: "slides"; frame: TabFrameState; currentSlideId: string; mode: "slide" | "layout"; selectedObjectIds: string[]; zoom: number; viewport: { x: number; y: number }; notesExpanded: boolean; notesHeight: number; newSlide?: { insertionIndex: number; selectedLayoutKey?: string; query: string } }
  | { kind: "spreadsheet"; frame: TabFrameState; currentSheetId: string; selection: { range: string }; scroll: { row: number; column: number; dx: number; dy: number }; zoom: number; formulaBarExpanded: boolean; findQuery: string }
  | { kind: "research"; frame: TabFrameState; selected?: { kind: "message" | "finding" | "source" | "tool-call" | "thread"; id: string }; paneWidths: [number, number, number]; transcriptAnchor?: string; sourceQuery: string }
  | { kind: "analysis"; frame: TabFrameState; selected?: { kind: "input" | "encoding" | "filter" | "sort" | "result-cell"; key: string }; centerScroll: { x: number; y: number }; resultZoom: number }
  | { kind: "context"; frame: TabFrameState; resourceSetId?: string; resourceQuery: string; resourceKinds: string[]; expressionFocusPath?: number[]; resolvedScrollY: number }
  | { kind: "templates"; frame: TabFrameState; templateId?: string; mode: "library" | "author"; targetFilter?: "document" | "slides" | "spreadsheet"; scopeFilter?: "global" | "project"; query: string; previewScrollY: number }
  | { kind: "personas"; frame: TabFrameState; personaId?: string; mode: "library" | "author"; scopeFilter?: "global" | "project"; query: string; draftSessionId?: string }
  | { kind: "automations"; frame: TabFrameState; automationId?: string; mode: "library" | "author"; statusFilter?: "all" | "enabled" | "disabled" | "failed"; query: string; draftSessionId?: string };
```

`draftSessionId` names a typed form runtime owned by the relevant screen; it is not an arbitrary JSON payload. The runtime declares its Persona or Automation fields and stale-write state. Editor selections are serializable bookmarks only. ProseMirror, Fabric, Univer, undo stacks, IME state, streams, pending operations, and file handles stay in the tab runtime and never enter this union. Each screen's retained-state section defines which fields it restores and which reset on reload.

Deduplication uses the complete canonical target, not `(ResourceKind, id)` for every case. External files, connectors, findings, persona threads, and agent tasks initially open in an appropriate inspector or owning screen rather than becoming additional editor kinds.

The current Icarus workbench admits only persisted resource references. Implementing New Tab therefore requires a launcher target plus `resolveLauncher(tabId, target)`; this is an explicit shell prerequisite, not behavior the current `open()` method already supplies. Resolution checks the canonical target in the same workspace transaction: if another tab already owns it, activate that tab and close the launcher after transferring any deliberate system-screen selection/draft; never create a duplicate target.

## Context panel contract

The rail answers “what else is here?” for the active tab. Its icons are stable keys with screen-specific labels and views.

- The first context listed by a screen is its default.
- Rail selection and panel width persist per tab.
- Clicking the active rail icon keeps its view selected. Collapse uses the panel's explicit collapse control or command, avoiding a surprising toggle on repeated navigation.
- Each view has one fixed header, a search/filter row only when useful, a scrollable body, and a footer only for a primary create action.
- Sections containing navigation or frequently changing lists may collapse; the current/selected section starts expanded.
- Empty states explain what belongs there and offer the next valid action.
- Context dispatch resolves by `(screenKind, contextId)`. A shared key may render differently for different screen kinds; one global `ContextId → Component` map is insufficient.

Do not use the context panel for selected-object formatting. For example, an analysis chart library belongs there; the selected chart's axis and color settings belong in the inspector.

## Inspector contract

The inspector is a selection-driven lens. Its ancestry is outermost to innermost—for example, Document → Table → Cell → Text selection—and the innermost target opens first.

Every inspection view has:

1. Breadcrumb/back path through selection ancestry.
2. Identity and status section, expanded.
3. Primary editable properties, expanded.
4. Relationships or placement, expanded only when central to the target.
5. Comments, provenance, and diagnostics, collapsed by default.
6. Destructive actions at the bottom, visually separated and permission-gated.

Nothing selected is a real state, not a blank panel. It shows resource-level properties plus valid insertion or selection guidance. Clicking the same exact object should not toggle the inspector closed.

The Copilot may temporarily take over this surface. It records the prior inspection and collapse state, and closing it restores them if the selected object still exists. An ordinary work-surface selection immediately returns the inspector to that object without stopping background AI work.

The collapsed Inspector uses a neutral Inspector/details affordance. A permanent sparkles/AI glyph would incorrectly imply that this adaptive panel belongs to the Copilot.

Reusable inspection families include:

- Resource identity and template provenance.
- Rich block, atom, mark, formula, prompt, image, table, and embed.
- Comment thread.
- Message, source, and tool call.
- Actor attribution.
- Sync/conflict diagnostics.

## Center-surface contract

- The center owns the primary task and has the largest plane.
- A compact local toolbar may contain title, mode, navigation, and high-frequency commands.
- Selection always has a non-color cue.
- Drag interactions have an equivalent menu/keyboard path.
- Context-menu-only commands are forbidden for essential actions.
- Every screen has an explicit loading, empty, read-only, archived, offline, error, and permission-denied treatment where applicable.

## Editor runtime lifetime

Switching tabs may unmount or hide a screen view, but it must not discard that tab's editor replica, buffered operations, undo state, selection mapping, or pending uploads. A tab-owned runtime outlives view mounting and is released only after the tab closes and all pending persistence has settled or been recoverably handed off. Accepted local subscriptions and remote/display-refresh transactions carry explicit origins so reconciliation cannot echo them back as new user edits.

## Status bar composition

Screens contribute status segments to one shell bar. Priority and overflow are:

1. Conflict/offline/error and typed action-required state. An unqualified `AgentTask.status: "waiting"` is labelled only Waiting.
2. Saving/rebasing/evaluating/indexing progress.
3. Current selection summary.
4. Page/sheet/slide/result position.
5. Zoom and secondary counts.

Lower-priority segments collapse into an accessible overflow menu on narrow windows. The shell never replaces an error with a word count or zoom value.

## Responsive, focus, and URL behavior

- Narrow windows collapse Inspector content first, then Context content; both rails/restore affordances remain reachable.
- The Copilot may widen into an overlay but never forces the center below its minimum usable width.
- Dialogs, menus, and temporary editor overlays use one focus/overlay host and restore focus to the invoking control.
- A project deep link activates or creates the matching tab target through the same workspace controller used by in-app Open actions, so URL and tab state converge rather than compete.

## Shared synchronization states

Document, slide-deck, and spreadsheet bodies are read from a leader snapshot plus recent change sets. Their editors show:

- **Saved** — no local changes pending.
- **Saving** — local coalesced changes are in flight.
- **Rebasing** — a remote change arrived and pending local operations are being reapplied.
- **Needs review** — the server rejected a conflicting operation; local work remains buffered.
- **Offline** — changes remain local and will retry.
- **Error** — persistence failed for a reason other than an ordinary conflict.

Conflict copy must say that the work is preserved. The client re-reads, reapplies buffered edits, and resubmits; it does not accept a partial merge silently. Undo is per user and per tab and inverts only that user's change sets. Agent edits are not included in the user's Ctrl-Z stack.

Directly edited form objects such as Project, Resource Set, Template, and Connector use revision-based stale-write rejection. Their forms preserve entered values and offer refresh/reapply rather than discarding them.

## Permissions and attribution

- Viewers can navigate, inspect, search, and read but cannot mutate project content.
- Editors can create and edit project content.
- Owners additionally manage membership, archival, deletion, and owner-only settings.
- Every material activity resolves its actor as a user, agent task, automation, connector, or system action.
- Agent attribution should show the persona and task title when available, while preserving the dispatching user in provenance detail.

## Accessibility

- Meet WCAG 2.2 AA contrast and focus requirements.
- Every rail icon, toolbar control, tab, resize handle, and status indicator has a text name.
- Resizers use the accessible separator/window-splitter pattern and support keyboard increments.
- Status never relies on color alone.
- Canvas and grid editors provide a logical keyboard selection model and a readable DOM/status representation for the current selection.
- Reduced-motion preference suppresses decorative movement without suppressing progress feedback.

## Model references

- [Project and membership](../data-models/core/project.md)
- [Actor and attribution](../data-models/core/actor.md)
- [Change conflicts](../processes/change-conflicts.md)
- [Revision and change-set overview](../data-models/revisions/README.md)
- [Comments](../data-models/collaboration/comment.md)
