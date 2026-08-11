---
title: "Interface - Spreadsheet Editor Context Panel Lenses"
notion_page_id: "3acb6410e502814584bad00b5c03397f"
notion_url: "https://app.notion.com/3acb6410e502814584bad00b5c03397f"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 00:48:22Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Interface - Spreadsheet Editor Context Panel Lenses

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="🧭" color="blue_bg">
	**Implementation-facing Taurus Yesod specification.** This page defines the complete context-panel lens set for the Spreadsheet editor. It describes what every lens looks like, displays, and does; selection-specific formatting remains in the inspector.
</callout>
# Decision
Spreadsheet contributes a complete, Yesod-owned left-rail lens registry. Every lens has a stable serializable ID, a semantically matched Lucide icon, and a component that reads a Spreadsheet-owned session/read model. The shell renders the registry without knowing Spreadsheet domain details.
The left panel answers **“What exists around this work?”** (<mention-page url="https://app.notion.com/p/e12b6939dbc444698aca18d4162bab10"/>). The contract is defined by Yesod product and runtime requirements and remains independent of any current editor implementation.
# Context versus inspector
The context panel is the Spreadsheet map. It may navigate, filter, reveal relationships, and invoke resource-level commands. It does not become the formatting surface for the current selection.
Selecting a cell, range, axis, named range, spill, overlay, or rule updates selection-aware summaries in Navigator, Dependencies, Rules, Comments, and AI Tasks without moving the active context lens. Value, formula, prompt, presentation, axis, and overlay-detail controls stay in the inspector.
The right inspector continues to answer **“What can I change about this selection?”**. Focusing the universal AI Quarterback still opens the right-side AI lens; the left-side **AI Tasks** lens is the durable task/status map and does not duplicate prompt composition.
Companion selection and inspector contract: <mention-page url="https://app.notion.com/p/3acb6410e50281e4b8cdce47084bc8af"/>.
# Shared shell and visual contract
```plain text
┌──────── icon rail ────────┬──────── expanded content rail ────────┐
│ 32 × 32 lens button       │ ACTIVE LENS LABEL                     │
│   16 × 16 Lucide icon     │ primary control / summary             │
│   tooltip on hover/focus  │ filters or grouped sections           │
│   active tint + color     │ scrollable content                    │
│                           │ honest loading / empty / error state   │
│ collapse control at foot  │                                        │
└───────────────────────────┴────────────────────────────────────────┘
```
- The preferred content width is 280px, with a 220px minimum and 380px maximum.
- Verify each icon export against the target application dependency before implementation; do not substitute a semantically weaker glyph merely because it is already imported elsewhere.
- The icon rail remains visible when collapsed. Selecting a different icon selects that lens and expands the panel; selecting the active icon while expanded collapses it.
- The open rail displays the active lens label in the fixed header. Icons never carry meaning without the tooltip and open-state label.
- Active treatment uses the action color at restrained opacity; inactive icons use muted color and receive an elevated hover/focus surface. Celestial and Night change colors only.
- Lens order is stable. The persisted value is the stable ID, never a component reference. An unknown or retired ID repairs to `info`.
- Each editor instance remembers its selected lens. Tab changes restore the lens for that resource without persisting transient selection, query text, drafts, hover, or loading state.
- The content rail uses one continuous surface, dividers, compact rows, and restrained badges. It does not place every row in a floating card.
- If the icon set exceeds available height, only the lens list scrolls; the collapse control stays fixed at the bottom.
# Lens registry
<table header-row="true">
<tr>
<td>Order</td>
<td>Stable ID</td>
<td>Label</td>
<td>Lucide icon</td>
<td>Primary job</td>
</tr>
<tr>
<td>1</td>
<td>`info`</td>
<td>Info</td>
<td>`Info` — a circled information mark; spreadsheet identity</td>
<td>Summarize the sparse grid, calculation health, and resource metadata.</td>
</tr>
<tr>
<td>2</td>
<td>`search`</td>
<td>Search</td>
<td>`Search` — a magnifying glass; grid-wide rescue</td>
<td>Find values, formulas, prompts, names, rules, overlays, comments, or templates.</td>
</tr>
<tr>
<td>3</td>
<td>`templates`</td>
<td>Templates</td>
<td>`SquareStack` — stacked sheets; reusable Spreadsheet models</td>
<td>Create or extend a Spreadsheet from a complete, versioned Spreadsheet template.</td>
</tr>
<tr>
<td>4</td>
<td>`navigator`</td>
<td>Navigator</td>
<td>`Grid3X3` — a three-by-three grid; the spreadsheet spatial map</td>
<td>Make a large sparse grid traversable without creating nested sheets.</td>
</tr>
<tr>
<td>5</td>
<td>`names`</td>
<td>Names</td>
<td>`Tags` — a pair of tags; named ranges and Formula names</td>
<td>Manage stable spreadsheet named ranges and understand Formula names used by the grid.</td>
</tr>
<tr>
<td>6</td>
<td>`dependencies`</td>
<td>Dependencies</td>
<td>`Workflow` — connected directional nodes; precedents, dependents, and lineage</td>
<td>Explain what the selected cell/range depends on and what depends on it.</td>
</tr>
<tr>
<td>7</td>
<td>`overlays`</td>
<td>Overlays</td>
<td>`Layers3` — stacked layers; charts and images above the grid</td>
<td>Map chart and image overlays, their bindings, anchors, and stacking order.</td>
</tr>
<tr>
<td>8</td>
<td>`rules`</td>
<td>Rules</td>
<td>`ListChecks` — a checked list; grid rules and their scopes</td>
<td>Expose validation, presentation, and other GridRules applied across the spreadsheet.</td>
</tr>
<tr>
<td>9</td>
<td>`references`</td>
<td>References</td>
<td>`BookOpenText` — an open book with text; cross-resource and file relationships</td>
<td>Show external resources and files used by or referring to the spreadsheet.</td>
</tr>
<tr>
<td>10</td>
<td>`comments`</td>
<td>Comments</td>
<td>`MessageSquareText` — a speech bubble with text; collaborative grid annotations</td>
<td>Review discussion anchored to cells, ranges, overlays, rules, or the spreadsheet.</td>
</tr>
<tr>
<td>11</td>
<td>`ai-tasks`</td>
<td>AI Tasks</td>
<td>`ListTodo` — a checklist; durable agent work scoped to spreadsheet targets</td>
<td>Track agent work over the spreadsheet, ranges, cells, rules, or overlays.</td>
</tr>
<tr>
<td>12</td>
<td>`history`</td>
<td>History</td>
<td>`Clock` — a clock face; spreadsheet ChangeSet history</td>
<td>Explain grid changes and support targeted operation-level undo or redo.</td>
</tr>
</table>
# Lens specifications
## Info lens
**Stable ID:** `info`  
**Icon:** Lucide `Info` — a circled information mark; spreadsheet identity.  
**Outcome:** Summarize the sparse grid, calculation health, and resource metadata.
### Default composition
```plain text
[SPREADSHEET NAME · double-click to rename]
Created / updated / creator / collaborators
Used cells | Rows | Columns | Named ranges
Formulas | Prompt cells | Spills | Overlays
Calculation / errors / revision / sync
```
### Displays
- Name, creator, created/updated time, revision, lifecycle, collaboration, and sync state.
- Resolved row/column counts, used-range bounds, canonical cell count, formula cells, prompt cells, named ranges, spills, overlays, rules, hidden axes, and freeze state.
- Calculation policy and health counts for evaluating, stale, failed, blocked spills, missing files, comments, and active tasks.
### Actions
- Rename through `rename_spreadsheet`; open calculation/freeze defaults in the spreadsheet inspector; filter the grid to errors or derived work.
- Copy a resource link or jump to the used range.
### Behavior and states
- Counts distinguish sparse canonical cells from projected spill cells.
- Formula/prompt health preserves last-good values and links to the source cell.
- Empty spreadsheets show zero-state structure without pretending an infinite populated grid.
**Boundary:** Cell/range formatting and value editing remain in the inspector/grid; Info controls spreadsheet-level metadata only.
## Search lens
**Stable ID:** `search`  
**Icon:** Lucide `Search` — a magnifying glass; grid-wide rescue.  
**Outcome:** Find values, formulas, prompts, names, rules, overlays, and comments.
### Default composition
```plain text
[Search this spreadsheet…] [Replace ▾]
Scope / kind / case / whole word / regex
N matches grouped by region
A1 projection + stable target + value/formula excerpt
Go to / Replace this / Replace all eligible
```
### Displays
- Matches across literal values, formula source, prompt source, rendered text, named ranges, rule labels/messages, overlay names/alt text, and comments.
- Filters for current selection/used range/all, literal/formula/prompt, errors, names, overlays, rules, case, whole word, regex, and hidden axes.
- A1 address at searched revision plus stable row/column/cell/overlay/rule IDs so results remain honest after structural edits.
### Actions
- Navigate and select the exact cell/range/overlay/rule; open Dependencies or Names for the target.
- Replace eligible literal text or formula source after preview; skip derived spill cells, locked content, and incompatible value kinds with an explanation.
- Copy a revision-qualified link.
### Behavior and states
- If row/column structure changes, stale A1 projections are re-resolved from stable IDs or explicitly rejected.
- Large result sets paginate/virtualize and group by contiguous region.
- No results distinguish no match from excluded derived or inaccessible content.
**Boundary:** Replace never edits displayed formula results, spill projections, prompt results, or non-text values as if they were strings.
## Templates lens
**Icon:** `SquareStack`
### Default composition
```plain text
Templates
[ Search templates…                       ]

Recommended
  Financial plan · v4                [Preview]
  Project tracker · v7               [Preview]

Use
  [Create new Spreadsheet] [Add at selection]
```
### Displays
- Named, versioned Spreadsheet templates with description, owner, tags, preview image, supported locale, and compatibility requirements.
- A template is a complete Spreadsheet model: axes, sparse cells, formulas, prompt bindings, named ranges, grid rules, overlays, freeze state, calculation policy, and default presentation.
- A structural preview and summary of cells, formulas, names, rules, overlays, and external requirements before materialization.
- Whether the template can initialize a new Spreadsheet or be added to the current Spreadsheet at the active anchor.
### Actions
- **Create new Spreadsheet** materializes the template with fresh Spreadsheet, axis, cell, range, rule, overlay, and related entity IDs.
- **Add at selection** treats the template as a model brought into the current Spreadsheet. It previews the affected extent and requires an explicit policy for collisions: skip, rename, relocate, or replace.
- Save the entire current Spreadsheet as a new template or a new version of an existing template, subject to template-library permissions.
- Open, copy, favorite, or select a specific template version.
- Start large materializations as durable, idempotent jobs and surface progress in AI Tasks or a dedicated job status surface.
### Behavior and states
- In v1, an arbitrary selected range is not a Spreadsheet template. The template unit is the whole Spreadsheet, even when it is positioned inside an existing Spreadsheet.
- The import preview reports new axes/cells, names, rules, overlays, dependencies, external requirements, and every detected collision before submission.
- Relative references are rebased to the target anchor. Absolute and external references remain explicit and require validation.
- Canonical formula and prompt expressions are copied; calculated values and spill projections are recomputed and are never copied as authoritative state.
- Template materialization returns through normal Spreadsheet ChangeSets, preserving revision checks, validation, audit, undo, and collaboration behavior.
- The Template Library owns template metadata, versions, previews, and permissions. Spreadsheet owns the materialized canonical state.
- Empty state distinguishes “no templates match” from “template service unavailable” and offers **Save current Spreadsheet as template** only when permitted.
## Navigator lens
**Stable ID:** `navigator`  
**Icon:** Lucide `Grid3X3` — a three-by-three grid; the spreadsheet spatial map.  
**Outcome:** Make a large sparse grid traversable without creating nested sheets.
### Default composition
```plain text
Used range mini-map
Current viewport + selection
Bookmarks / recent ranges
Hidden rows / columns · freeze panes
Errors / spills / overlays markers
```
### Displays
- A compact minimap of the used range, current viewport, selection, frozen panes, hidden axes, named-range markers, spill extents, overlay bounds, and error hotspots.
- Quick lists for recent selections, bookmarked ranges, and structural regions. There are no workbook tabs because Spreadsheet is one grid.
- Addresses display in A1 for recognition but retain stable axis IDs and revision internally.
### Actions
- Pan/jump the viewport; select a marked range; reveal a hidden axis after confirmation; open a named range, spill source, overlay, or error in its owning lens.
- Create/remove a local bookmark without turning it into canonical spreadsheet content.
### Behavior and states
- The minimap samples or tiles large grids instead of rendering every cell.
- Structural edits smoothly reconcile markers to accepted axis order.
- An empty grid centers the first editable region and offers paste/import.
**Boundary:** Navigator changes location and local bookmarks. Canonical axis edits and freeze settings belong to inspector commands.
## Names lens
**Stable ID:** `names`  
**Icon:** Lucide `Tags` — a pair of tags; named ranges and Formula names.  
**Outcome:** Manage stable spreadsheet named ranges and understand Formula names used by the grid.
### Default composition
```plain text
[+ New named range] [Search names…]
Spreadsheet named ranges
  name · A1 projection · stable range
Formula names used here
  type · value preview · dependents
```
### Displays
- Spreadsheet-owned named ranges with stable ID, name, stable RangeRef, current A1 projection, size, dependents, and validity.
- Formula Name Manager entries referenced by cells, with type/value preview, version/hash, and usage count. The two authorities are visibly separated.
- Broken, shadowed, stale, inaccessible, or invalid references.
### Actions
- Create, rename, retarget, and delete spreadsheet named ranges through typed operations; navigate/select the range; filter dependents.
- Open a Formula name in the Formula capability or insert a name into the active formula editor.
- Preview deletion impact before removing a named range.
### Behavior and states
- A1 labels update after axis changes while stable refs remain authoritative.
- Formula names are read through an adapter and are not copied into the Spreadsheet aggregate.
- Deletion conflicts list dependent cells, charts, rules, or prompts rather than silently breaking them.
**Boundary:** This lens owns spreadsheet named-range lifecycle; Formula name evaluation and project-wide definitions remain Formula-owned.
## Dependencies lens
**Stable ID:** `dependencies`  
**Icon:** Lucide `Workflow` — connected directional nodes; precedents, dependents, and lineage.  
**Outcome:** Explain what the selected cell/range depends on and what depends on it.
### Default composition
```plain text
Selection summary
Precedents ← selected → Dependents
Formula / name / prompt / resource edges
Spill source and extent
Fresh / evaluating / stale / error
```
### Displays
- Direct and expandable transitive precedents/dependents for selected cells or named ranges, including cells, names, prompts, resource context, and chart/rule consumers.
- Spill source-to-derived-cell lineage, evaluation token/source revision, and last-good/error state.
- Cross-resource edges reveal only authorized metadata and selectors.
### Actions
- Navigate to a precedent/dependent; expand one level; trace a path; open a Formula name or resource; recalculate the bounded dependency closure; materialize an eligible spill after confirmation.
- Pin a trace locally while comparing two regions.
### Behavior and states
- Cycles, blocked spills, stale snapshots, missing evidence, and broad recalculation jobs have explicit diagnostics.
- No selection explains what to select; multi-range selection gives a union summary before expensive expansion.
- Broad graphs virtualize and cap expansion with a continue action.
**Boundary:** Dependencies is primarily explanatory. Formula/value editing stays in the inspector; recalculation uses the capability job boundary.
## Overlays lens
**Stable ID:** `overlays`  
**Icon:** Lucide `Layers3` — stacked layers; charts and images above the grid.  
**Outcome:** Map chart and image overlays, their bindings, anchors, and stacking order.
### Default composition
```plain text
[+ Chart] [+ Image]
Overlay · kind · visibility / lock
Bound range/name · captured revision
Grid bounds · z-order
Alt text / missing / stale snapshot
```
### Displays
- All chart and image overlays with name, kind, stable bounds, z-rank, locked/hidden state, binding, revision, alt-text status, and rendering health.
- Grouping by current viewport or all overlays; markers show when an overlay is off-screen.
- Chart bindings distinguish cell, range, and named-range sources.
### Actions
- Navigate/select; create; rename; move in z-order; toggle visibility/lock; duplicate/delete; relink a missing file; refresh a chart projection.
- Open the bound range/name or selected overlay inspector.
### Behavior and states
- Axis deletion/clamping reports the accepted new bound rather than silently drifting.
- Rendering is derived; a stale or failed snapshot preserves the last-good view and the binding remains authoritative.
- Overlays never occupy cells or block spills.
**Boundary:** The lens manages overlay identity, navigation, visibility, lock, and ordering. Geometry, crop, chart spec, and styling are inspector controls.
## Rules lens
**Stable ID:** `rules`  
**Icon:** Lucide `ListChecks` — a checked list; grid rules and their scopes.  
**Outcome:** Expose validation, presentation, and other GridRules applied across the spreadsheet.
### Default composition
```plain text
[+ New rule] [filter]
Rule name · kind · enabled
Scope: range/name @ revision
Priority / conflicts / affected cells
Edit / duplicate / delete
```
### Displays
- Rule ID/name, kind, enabled state, priority/order, stable scope, current A1 projection, condition summary, presentation/message summary, affected-cell count, and diagnostics.
- Filters for rule kind, enabled/disabled, conflict, current selection, and invalid scope.
- Overlapping/conflicting rule explanations and selected-cell effective-rule trace.
### Actions
- Create, edit, duplicate, enable/disable, reorder, retarget, and delete through typed rule operations; navigate to the scope; inspect affected cells.
- Preview scope and impact before broad changes.
### Behavior and states
- Rules with deleted/invalid axes become explicit invalid-scope rows rather than disappearing.
- Large affected-cell counts are estimated or job-backed and labelled.
- A stale rule edit conflicts on the stable RuleID/footprint.
**Boundary:** Rules govern resource-wide scoped behavior. One-off cell/range presentation remains in the inspector.
## References lens
**Stable ID:** `references`  
**Icon:** Lucide `BookOpenText` — an open book with text; cross-resource and file relationships.  
**Outcome:** Show external resources and files used by or referring to the spreadsheet.
### Default composition
```plain text
This spreadsheet uses
  Prompt context / image file / external source
  cell/range/overlay selector @ revision
Used by
  Resource → range/name/overlay
```
### Displays
- Outgoing prompt context/evidence, file-backed images, imported-source provenance, and authorized external data references with target cells/ranges/overlays.
- Incoming resources that refer to the spreadsheet, named range, stable range selector, cell, or overlay.
- Captured revisions, selector, freshness, missing/access state, and usage counts.
### Actions
- Open source or consumer at its selector; navigate to affected cell/range/overlay; compare captured/current revision; relink eligible missing files; copy stable reference.
- Filter inbound/outbound, kind, stale, missing, or unauthorized.
### Behavior and states
- Spreadsheet-internal formula dependencies stay in Dependencies, not References.
- Protected resources preserve safe tombstones without leaking titles or values.
- Import/render projections remain distinct from canonical reference state.
**Boundary:** References maps cross-capability relationships; it does not become a second dependency graph.
## Comments lens
**Stable ID:** `comments`  
**Icon:** Lucide `MessageSquareText` — a speech bubble with text; collaborative grid annotations.  
**Outcome:** Review discussion anchored to cells, ranges, overlays, rules, or the spreadsheet.
### Default composition
```plain text
[Comment on selection…]
Open | All
Author · age · A1 projection
Anchor excerpt / thread
Reply · Resolve · Go to
```
### Displays
- Open/all threads with author, time, stable anchor, current A1 projection, target preview, replies, mentions, and resolved status.
- Anchors for spreadsheet, cell, stable range, named range, overlay, or rule; structural edits update projections without changing identity.
- Orphaned or inaccessible anchors with preserved thread history.
### Actions
- Add on current eligible selection, reply, resolve/reopen, mention, navigate/select the anchor, or filter by author/range/status.
### Behavior and states
- A range comment follows stable axis IDs rather than frozen A1 text.
- Spill-cell comments resolve to the source or require explicit materialization policy; they do not attach to an unstable projection silently.
- Read-only users retain navigation and thread visibility.
**Boundary:** Comments are annotation-capability state, not cell content.
## AI Tasks lens
**Stable ID:** `ai-tasks`  
**Icon:** Lucide `ListTodo` — a checklist; durable agent work scoped to spreadsheet targets.  
**Outcome:** Track agent work over the spreadsheet, ranges, cells, rules, or overlays.
### Default composition
```plain text
[New task from selection]
Active | All
Task · persona · status
Scope: range / cells / overlay / rule
Approvals · result · affected revision
```
### Displays
- Tasks with stable spreadsheet target/selector, persona, origin, status, approvals, affected revision, concise result, and timestamps.
- Active/all filters plus scope and outcome categories.
- Clear separation between agent tasks, formula recalculation jobs, prompt-cell jobs, imports, and chart rendering jobs.
### Actions
- Create from spreadsheet or current selection; open task; navigate/select scope; review approval/result; open accepted changes in History.
- Create follow-up or compensating tasks instead of treating history undo as reversal of external effects.
### Behavior and states
- A structural edit re-resolves stable task targets or marks them unavailable; it never trusts stale A1 alone.
- Active tasks update live; completed items settle.
- Agent outage does not hide saved spreadsheet state.
**Boundary:** Agent owns task execution. Spreadsheet accepts mutations only as authorized typed operations.
## History lens
**Stable ID:** `history`  
**Icon:** Lucide `Clock` — a clock face; spreadsheet ChangeSet history.  
**Outcome:** Explain grid changes and support targeted operation-level undo or redo.
### Default composition
```plain text
Filters: actor / area / region / date
Revision · actor · operation
A1 projection + stable target
Before / after / footprint
Undo / redo eligibility
```
### Displays
- Accepted ChangeSets across metadata, axes, cells, ranges, names, spills, overlays, rules, and derived results.
- Actor, time, revision, operation summary, stable targets, at-revision A1 projection, semantic footprint, and before/after detail.
- System formula/prompt/import result operations remain distinguishable from human and agent edits.
### Actions
- Open detail; navigate/select the affected stable target; append inverse/reapply operations; filter by actor/area/region; copy revision link.
### Behavior and states
- Historical A1 labels use the operation revision and may also show current projection.
- Undo conflicts identify overlapping cells/ranges/axes/rules/overlays.
- Pruned details remain unavailable without inventing reconstruction.
**Boundary:** History is append-only; rebase compacts persistence without altering logical revision or visible history.
# Shared data and command boundary
Every lens reads from a Spreadsheet context snapshot and calls typed actions. It does not import editor internals, mutate stores directly, or write persistence records.
# Implementation registry
```typescript
import { Info, Search, SquareStack, Grid3X3, Tags, Workflow, Layers3, ListChecks, BookOpenText, MessageSquareText, ListTodo, Clock } from '@lucide/svelte';

export const spreadsheetContextSections: PanelSection[] = [
  { id: 'info', label: 'Info', icon: Info, content: SpreadsheetInfoPanel },
  { id: 'search', label: 'Search', icon: Search, content: SpreadsheetSearchPanel },
  { id: 'templates', label: 'Templates', icon: SquareStack, content: SpreadsheetTemplatesPanel },
  { id: 'navigator', label: 'Navigator', icon: Grid3X3, content: SpreadsheetNavigatorPanel },
  { id: 'names', label: 'Names', icon: Tags, content: SpreadsheetNamesPanel },
  { id: 'dependencies', label: 'Dependencies', icon: Workflow, content: SpreadsheetDependenciesPanel },
  { id: 'overlays', label: 'Overlays', icon: Layers3, content: SpreadsheetOverlaysPanel },
  { id: 'rules', label: 'Rules', icon: ListChecks, content: SpreadsheetRulesPanel },
  { id: 'references', label: 'References', icon: BookOpenText, content: SpreadsheetReferencesPanel },
  { id: 'comments', label: 'Comments', icon: MessageSquareText, content: SpreadsheetCommentsPanel },
  { id: 'ai-tasks', label: 'AI Tasks', icon: ListTodo, content: SpreadsheetAiTasksPanel },
  { id: 'history', label: 'History', icon: Clock, content: SpreadsheetHistoryPanel }
];
```
Rules:
- Every command includes project scope, resource ID, expected revision, stable target IDs, actor, and an idempotent submission ID.
- Navigation-only actions may stay client-side; canonical edits use the resource capability’s ChangeSet path.
- Loading, stale, derived, estimated, local-only, and failed data are labeled honestly. A locally interactive control cannot imply persistence that Omega does not implement.
- A lens may optimistically update only when it can reconcile the accepted revision or restore the prior projection on rejection.
- Search results, templates, references, comments, tasks, and history paginate or virtualize rather than growing the rail without bound.
- Template-library reads and writes use the Template Library boundary; materialization into a Spreadsheet uses the Spreadsheet ChangeSet and durable-job paths.
# Interaction rules
- Opening a resource begins on `info` unless a valid lens ID was restored for that same resource.
- Changing editor selection does not automatically steal the user’s chosen context lens. Selection-aware lenses update their content in place.
- Clicking a search result, structure item, reference, comment, task source, or history target navigates the work surface and keeps the originating lens open.
- Destructive commands require a named target, confirmation proportional to reversibility, and placement at the end of the action group.
- Undo and redo append canonical inverse/reapply operations; they do not rewrite history.
- Live statuses update without global spinners. Preserve readable last-good content while derived work refreshes.
# Loading, empty, error, and permission states
- **Loading:** retain the lens header and controls; use quiet skeleton rows or compact status copy in the content region.
- **Empty:** explain what would appear here and give one primary next action when the user can resolve the empty state.
- **No results:** retain the query and filters, report zero matches, and offer a clear-filters action.
- **Error:** preserve cached or last-good rows when safe, name what failed, and provide retry. Do not replace the whole panel with a generic failure.
- **Offline:** allow navigation over cached data and mark commands that will queue or are unavailable.
- **Read-only:** show the same map and provenance while disabling mutation with a concise permission explanation.
- **Conflict:** keep the user’s draft, show the accepted current state, and offer retry, compare, or reapply when the operation contract permits it.
# Accessibility and keyboard contract
- Each icon button has `aria-label`, `title`, and `aria-pressed`; the content region is labelled by the visible lens heading.
- The icon rail supports Tab plus arrow-key movement without forcing the panel to expand until activation.
- Status is communicated through text and icon in addition to color. Counts use descriptive accessible names.
- Search/result rows, tree nodes, disclosure controls, and reordering controls expose correct roles, expanded/selected state, and keyboard equivalents.
- Navigation moves editor focus to the destination only after announcing it. The user can return to the originating lens without losing query or expansion state.
- At 200% zoom the rail and content remain operable; at 400% the content becomes a single scroll region without horizontal dependence.
- Reduced motion changes transitions, not behavior or spatial organization.
# Required cross-capability dependencies
- Formula supplies parsing, evaluation, value semantics, and the Formula Name Manager through a narrow adapter.
- File and Resource resolution supply overlay files, prompt context, import provenance, and cross-resource relationship metadata.
- Agent supplies task execution and approval truth; a shared Annotation capability supplies comment threads and stable anchors.
- Search/indexing and activity/history projections may accelerate views but cannot become competing canonical spreadsheet state.
These adapters do not move Formula, File, Resource, Agent, Search, or Annotation authority into Spreadsheet.
# Deliberate exclusions
- No sheet-tab or workbook lens exists. The resource is Spreadsheet and owns exactly one grid.
- Spills do not receive their own permanent lens; Navigator shows their geometry and Dependencies shows their lineage.
- Formula Name Manager entries remain Formula-owned and are shown read-only or linked from Names; Spreadsheet owns only named ranges.
- Cell/range formatting, validation details, row/column sizing, freeze settings, and overlay geometry remain inspector controls.
# Acceptance checklist
- [ ] Every registered lens has the exact stable ID, label, icon, tooltip, open-state heading, implemented content component, and accessible name defined here.
- [ ] Lens order, collapse behavior, width, restoration, and unknown-ID repair match the shared shell contract.
- [ ] Every lens has useful loading, empty, no-results, error, offline, read-only, and permission behavior.
- [ ] Navigation actions focus the correct stable resource target and preserve the open lens.
- [ ] Canonical mutations go through typed operations with expected revision and conflict handling.
- [ ] Mock or locally projected behavior is visibly identified and cannot masquerade as saved capability.
- [ ] Celestial and Night preserve identical layout, iconography, ordering, and motion.
- [ ] Keyboard, screen-reader, forced-color, reduced-motion, 200% zoom, and 400% zoom tests pass.
- [ ] Realistic large-resource fixtures prove pagination or virtualization and do not make the rail jank.
# Sources
## Governing Yesod sources
- <mention-page url="https://app.notion.com/p/3abb6410e5028179a844c0af77b21ffe"/>
- <mention-page url="https://app.notion.com/p/e12b6939dbc444698aca18d4162bab10"/>
- <mention-page url="https://app.notion.com/p/39ab6410e50281798739fa3a9e8931ac"/>

