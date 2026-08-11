---
title: "Interface - Spreadsheet Editor Inspector Panel Lenses"
notion_page_id: "3acb6410e50281e4b8cdce47084bc8af"
notion_url: "https://app.notion.com/3acb6410e50281e4b8cdce47084bc8af"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 01:38:01Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Interface - Spreadsheet Editor Inspector Panel Lenses

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="🔎" color="blue_bg">
	**Implementation-facing Taurus Yesod specification.** This page defines every meaningful Spreadsheet editor selection and the adaptive inspector lens shown for it. Spreadsheet is the resource; there is no workbook or nested-sheet inspector layer.
</callout>
# Decision
The Spreadsheet inspector is one adaptive right-side lens resolved from the active grid, cell/range, axis, named range, spill, overlay, rule, or nested formula/prompt detail selection. It is not a fixed context-lens registry and never becomes a generic formatting/settings bin.
This page is the canonical selection taxonomy and implementation contract for the fields, actions, states, and typed operation boundary of each selection lens.
The context panel maps the Spreadsheet, templates, navigator, names, dependencies, overlays, rules, references, comments, tasks, and history. Inspector answers **“What can I change about this selected target?”**.
AI Quarterback focus may temporarily own the inspector for mode, scope, persona, verification, result target, and response history. Returning restores the stable Spreadsheet selection if it still resolves.
# Inspector shell
```plain text
┌────────────────────────────────────────────┐
│ [kind icon] SELECTION LABEL       [⋯] [×] │
│ A1 projection · stable identity · status   │
├────────────────────────────────────────────┤
│ value / expression / binding / primary data│
│────────────────────────────────────────────│
│ Presentation / Structure / Rules / Evidence│
│ Dependencies / Accessibility / Advanced    │
│────────────────────────────────────────────│
│ secondary actions                          │
│ destructive actions, separated and last    │
└────────────────────────────────────────────┘
```
- Preferred width is 320px, with a 260px minimum and 440px maximum.
- A1 addresses are friendly revision-specific projections. Stable RowID/ColumnID, CellID, RangeRef, NamedRangeID, SpillID, OverlayID, and RuleID are mutation identities.
- The panel is one continuous surface using labelled rows, restrained dividers, progressive disclosure, and compact status.
- Celestial and Night differ only chromatically. Geometry, hierarchy, focus, motion, and disclosure remain invariant.
- Fields show canonical accepted state and explicit local drafts. Stale conflicts never erase the draft.
- Mixed, inherited/default, derived, last-good, pending, stale, error, read-only, hidden, locked, and inaccessible values are labelled in text.
- Destructive actions are separated and last.
# Stable selection contract
```typescript
type StableCellRef = { rowId: RowID; columnId: ColumnID };

type SpreadsheetInspectorSelection =
  | { kind: 'none' }
  | { kind: 'spreadsheet'; spreadsheetId: SpreadsheetID }
  | { kind: 'cell'; spreadsheetId: SpreadsheetID; ref: StableCellRef }
  | { kind: 'range'; spreadsheetId: SpreadsheetID; range: StableRangeRef }
  | { kind: 'rows'; spreadsheetId: SpreadsheetID; rowIds: RowID[] }
  | { kind: 'columns'; spreadsheetId: SpreadsheetID; columnIds: ColumnID[] }
  | { kind: 'named-range'; spreadsheetId: SpreadsheetID; namedRangeId: NamedRangeID }
  | { kind: 'spill'; spreadsheetId: SpreadsheetID; spillId: SpillID }
  | { kind: 'overlay'; spreadsheetId: SpreadsheetID; overlayId: OverlayID }
  | { kind: 'overlays'; spreadsheetId: SpreadsheetID; overlayIds: OverlayID[] }
  | { kind: 'rule'; spreadsheetId: SpreadsheetID; ruleId: RuleID }
  | { kind: 'formula'; spreadsheetId: SpreadsheetID; ref: StableCellRef }
  | { kind: 'prompt'; spreadsheetId: SpreadsheetID; ref: StableCellRef };
```
An absent sparse Cell is still selectable through RowID + ColumnID. CellID is added when canonical state creates one; the inspector never invents a temporary durable CellID.
Range selection stores stable inclusive corners plus the revision at which its A1 projection was resolved. Axis reordering may change the displayed A1 range without changing the selected stable cells. If structural changes make a rectangular stable range non-rectangular in current order, the inspector reports that fact and requires explicit re-resolution for order-dependent commands.
# Selection taxonomy
<table header-row="true">
<tr>
<td>Kind</td>
<td>Icon</td>
<td>How selected</td>
<td>Inspector responsibility</td>
</tr>
<tr>
<td>`none`</td>
<td>`MousePointer2`</td>
<td>No target</td>
<td>Instructional empty state only.</td>
</tr>
<tr>
<td>`spreadsheet`</td>
<td>`Sheet`</td>
<td>Resource title/details action</td>
<td>Identity, calculation, freeze, default presentation, health.</td>
</tr>
<tr>
<td>`cell`</td>
<td>`Square`</td>
<td>Single grid cell</td>
<td>Literal/formula/prompt value, presentation, evidence, revisions.</td>
</tr>
<tr>
<td>`formula`</td>
<td>`FunctionSquare`</td>
<td>Formula field/result/status inside a Cell</td>
<td>Expression, dependencies, state, diagnostic, recalculate/convert.</td>
</tr>
<tr>
<td>`prompt`</td>
<td>`MessageSquareText`</td>
<td>Prompt field/result/status inside a Cell</td>
<td>Prompt RichContent, generated value, state, evidence, refresh.</td>
</tr>
<tr>
<td>`range`</td>
<td>`Grid2X2Check`</td>
<td>Contiguous cell rectangle</td>
<td>Mixed values/presentation, fill/paste/clear, rules and names.</td>
</tr>
<tr>
<td>`rows`</td>
<td>`Rows3`</td>
<td>One or more row headers</td>
<td>Rank/order, height, hidden state, insert/move/delete.</td>
</tr>
<tr>
<td>`columns`</td>
<td>`Columns3`</td>
<td>One or more column headers</td>
<td>Rank/order, width, hidden state, insert/move/delete.</td>
</tr>
<tr>
<td>`named-range`</td>
<td>`Tag`</td>
<td>Name chip, outline, or Names result</td>
<td>Name, stable RangeRef, uses, rename/repoint/delete.</td>
</tr>
<tr>
<td>`spill`</td>
<td>`UnfoldVertical`</td>
<td>Derived spill cell/border or Dependencies result</td>
<td>Source, derived rectangle, blockers, materialization.</td>
</tr>
<tr>
<td>`overlay:chart`</td>
<td>`ChartColumn`</td>
<td>Chart overlay or Overlays result</td>
<td>Binding, ChartSpec, geometry, z-order, alt text, render state.</td>
</tr>
<tr>
<td>`overlay:image`</td>
<td>`Image`</td>
<td>Image overlay or Overlays result</td>
<td>File, crop, fit, geometry, z-order, alt text.</td>
</tr>
<tr>
<td>`overlays`</td>
<td>`Layers3`</td>
<td>Multiple overlays</td>
<td>Mixed lock/hidden/z-order and bulk geometry/actions.</td>
</tr>
<tr>
<td>`rule`</td>
<td>`ListChecks`</td>
<td>Rule badge, cell indicator, or Rules result</td>
<td>Type, scope, predicate/configuration, priority, effect, lifecycle.</td>
</tr>
</table>
Discontiguous grid selections, mixed row+column selection, and simultaneous cell+overlay selection are excluded from v1. A future multi-range selection must receive a new explicit selection kind rather than overloading `range`.
# Selection lens specifications
## Nothing selected
**Icon:** `MousePointer2`
```plain text
Nothing selected
Select a cell, range, row, column, name,
spill, overlay, rule, formula, or prompt.
```
A single **Inspect Spreadsheet** route explicitly selects the resource. No disabled wall of global settings appears.
## Spreadsheet lens
**Icon:** `Sheet`
### Displays
- Spreadsheet name, stable ID on demand, project, creator, timestamps, revision/base sequence, lifecycle, sync/collaboration state.
- Row, column, persisted-cell, formula, prompt, name, spill, overlay, rule, evidence, stale/error, and task counts.
- Calculation policy, freeze pane, and default CellPresentation with inherited/default labelling.
### Controls and actions
- Rename via `rename_spreadsheet`.
- Edit calculation policy and freeze pane through `set_calculation_policy` and `set_freeze_pane`.
- Edit default presentation only after a typed Spreadsheet-level operation exists.
- Save the entire Spreadsheet as a named Template Library asset; open history/export/import status.
- Resource lifecycle actions remain separated, last, and Resource-owned.
### Behavior
Changing calculation policy previews the affected dependency closure/job behavior. Freeze is a view-affecting canonical preference only if the model intentionally shares it; otherwise it must move to per-user workspace state rather than be ambiguously persisted.
## Cell lens
**Icon:** `Square`
### Composition
```plain text
Cell B7 · stable row/column IDs on demand
Kind       Literal / Formula / Prompt
Value      accepted / last-good
Status     ready / evaluating / error / stale
[Edit value or open Formula/Prompt details]
Presentation
Evidence · dependencies · rules · names
Value rev · display rev
────────
Clear cell
```
### Displays
- Current A1 projection at accepted revision, RowID, ColumnID, optional CellID, and sparse/default status.
- Kind; exact typed CellValue; last-good value; Formula/Prompt binding summary; display projection; presentation; evidence; value/display revisions.
- Value-kind-aware preview for null, exact number, text, logic, list, record, table, and function. Exact numbers are never rendered from float64.
- Precedents/dependents, intersecting named ranges/rules/spills, overlay bindings, comments, and task counts as routes—not duplicated management surfaces.
### Controls and actions
- Set literal, formula, or prompt via `set_cell_literal`, `set_cell_formula`, or `set_cell_prompt`.
- Clear canonical value/binding through `clear_cells` with a choice to preserve or clear presentation.
- Edit presentation through a one-cell `set_range_presentation`.
- Open Formula or Prompt detail; copy stable/A1 reference; create named range/rule/chart from the Cell.
### Behavior
Switching kind previews which binding/value/evidence fields will be replaced. A failed formula/prompt keeps LastGoodValue visible with an error state. Editing a derived spill cell redirects to the Spill lens and explains why the cell is read-only.
## Formula lens
**Icon:** `FunctionSquare`
### Composition
```plain text
Formula · Cell B7
[expression editor                         ]
State · evaluated time · token
Accepted value / last-good value
Dependencies
  cells / named ranges / Formula names
Diagnostic
[Recalculate] [Convert to literal]
```
### Displays
Expression, accepted typed result, LastGoodValue, state, diagnostic, evaluated time, evaluation token, value/display revisions, dependency snapshot, Formula Name Manager versions/hashes, and spill projection if any.
### Controls and actions
- Edit through `set_cell_formula`.
- Recalculate the smallest safe dependency closure or enqueue a durable job.
- Navigate to precedent/dependent/name; copy expression.
- Convert the accepted result to a literal with an explicit `set_cell_literal` replacement after preview.
### Behavior
Formula owns parsing/evaluation/value semantics/names; Spreadsheet owns the binding, dependency metadata, accepted result, and spill. A result applies only when token, source revision, and dependency snapshot match. Function values retain source plus language version.
## Prompt lens
**Icon:** `MessageSquareText`
### Composition
```plain text
Prompt · Cell B7
RichContent editor
State · generated time · token
Accepted value / last-good value
Evidence / diagnostic
[Refresh] [Save prompt asset] [Convert to literal]
```
### Displays
Spreadsheet-owned Prompt RichContent, accepted and LastGood CellValue, state, diagnostic, evaluation token, generated time, evidence, source/display revisions, and spill projection when the value is structured.
### Controls and actions
- Edit through `set_cell_prompt`; refresh through the bounded inline or durable Prompt job path.
- Save Prompt content as a reusable Prompt Library asset without changing the historical/current Cell binding.
- Open evidence; convert accepted output to literal after preview.
### Behavior
Refresh never clears last-good display. A late result cannot overwrite a newer prompt, dependency snapshot, display edit, or materialized spill. Reusable Prompt Library metadata remains a separate authority.
## Range lens
**Icon:** `Grid2X2Check`
### Composition
```plain text
Range B7:F22 · stable corners
16 × 5 · 80 projected cells
Kinds / non-empty / formulas / prompts / errors
Presentation      shared / Mixed
Names / rules / spills / overlay bindings
[Fill] [Paste] [Format] [Create name] [Create rule]
────────
Clear values / presentation
```
### Displays
- Current A1 rectangle, stable inclusive RangeRef, revision, row/column count, canonical/derived/empty cell counts, value-kind distribution, formula/prompt/error/stale counts.
- Shared/mixed presentation; intersecting named ranges, rules, spills, overlays, evidence, comments, and dependencies.
- Estimated operation/cell/payload size before bulk edits.
### Controls and actions
- `paste_range`, `fill_range`, `set_range_presentation`, `clear_range_presentation`, and bounded `clear_cells`.
- Create a named range, rule, or chart overlay from the stable range.
- Copy/export values with an explicit choice for formulas versus accepted values.
### Behavior
Mixed means genuinely mixed. Editing a mixed presentation field writes only that field. Bulk commands expand to bounded canonical operations; oversized work routes to a durable import/job path. Derived spill cells are excluded or require materialization—never overwritten silently.
## Rows lens
**Icon:** `Rows3`
### Displays
Selected RowIDs in accepted order, current ordinals, ranks, shared/mixed heights, hidden state, non-empty/formula/prompt/spill counts, named-range/rule/overlay intersections, and collaborators.
### Controls and actions
Insert before/after, move, resize, hide/show, or delete through typed row operations. Copy stable references; set presentation across the selected full-row range where bounded.
### Behavior
Delete previews canonical cells, names, rules, spills, overlay-anchor clamping, and stale operations. Ordinals are never submitted without RowIDs and resolution revision.
## Columns lens
**Icon:** `Columns3`
### Displays
Selected ColumnIDs in accepted order, current letters/ordinals, ranks, shared/mixed widths, hidden state, value/formula/prompt/spill counts, names/rules/overlays, and collaborators.
### Controls and actions
Insert before/after, move, resize, hide/show, delete, and apply bounded full-column presentation through typed operations.
### Behavior
Axis edits preserve stable semantic overlay anchors. Delete previews data loss and anchor/range effects; current column letters are not identity.
## Named-range lens
**Icon:** `Tag`
```plain text
Named range
[Name                         ]
Ref      B7:F22 · stable corners
Used by  formulas / charts / rules / prompts
[Select range] [Edit reference]
────────
Delete name
```
### Displays
NamedRangeID, project-visible name, normalized stable RangeRef, current A1 projection, creation/update metadata if available, and every known dependent formula/overlay/rule/prompt.
### Controls and actions
`rename_named_range`, `set_named_range_ref`, select/navigate, copy reference, or `delete_named_range` after impact preview.
### Behavior
A name is durable identity plus mutable label/reference. Rename should preserve NameID references. Delete never silently rewrites dependents; it must reject, invalidate with explicit diagnostics, or apply an explicit reviewed policy.
## Spill lens
**Icon:** `UnfoldVertical`
### Displays
SpillID, source CellID, anchor, stable rectangle, current A1 projection, dimensions, derived cells/value kinds, source revision, evaluation token linkage, blocking cell/spill, and diagnostic.
### Controls and actions
Navigate to source Formula/Prompt, copy accepted derived values, or `materialize_spill` into canonical literal cells after a complete preview.
### Behavior
Derived cells are read-only and do not own independent history. Materialization is one ChangeSet that creates ordinary cells and removes the spill. If canonical content blocks the rectangle, LastGoodValue remains and the obstruction is named.
# Overlay common lens
Every overlay lens begins with OverlayID, kind, stable GridBounds with offsets, current A1 projection, ZRank, locked/hidden state, selected source revision where relevant, and renderer/preview health.
Common actions use `move_overlay`, `reorder_overlay`, `update_overlay`, and `delete_overlay`. Multi-overlay operations expand to deterministic typed operations after a reviewed mixed-value summary.
## Chart-overlay lens
**Icon:** `ChartColumn`
### Displays
Chart binding kind (cell/range/named range), stable source and revision, ChartSpec, derived render/snapshot freshness, alt text, geometry/offsets, errors, and accessibility state.
### Controls and actions
Edit binding/spec/alt text, open source, refresh render, move/resize/reorder, lock/hide when typed operations support them, duplicate, or delete.
### Behavior
The chart never owns cell values. Rendering is derived and accepted only for the binding/source revision it used.
## Image-overlay lens
**Icon:** `Image`
### Displays
FileID/status and permitted metadata, fit, crop, alt text, stable bounds/offsets, ZRank, lock/hidden state, and preview freshness.
### Controls and actions
Replace File reference, crop/reset, choose fit, edit alt text, move/resize/reorder, open File, duplicate, or delete.
### Boundary
Removing or replacing an overlay does not delete the underlying File.
## Multi-overlay lens
**Icon:** `Layers3`
### Displays and actions
Count/kinds, common/mixed bounds properties, lock/hidden state, Z-order span, source/error counts; align/distribute, move, reorder, set common supported state, duplicate, or delete. Locked/incompatible overlays are reported before commit; partial silent application is forbidden.
## Rule lens
**Icon:** `ListChecks`
### Composition
```plain text
Rule · type / enabled / priority
Scope      stable RangeRef / name
Condition  predicate or validation config
Effect     allowed input / message / presentation
Applies to N cells · violations N
[Edit] [Duplicate]
────────
Delete rule
```
### Displays
RuleID, type, enabled state, priority/rank, stable scope, current A1 projection, normalized condition/configuration, resulting validation/presentation behavior, violation/unknown counts, and dependencies.
### Controls and actions
Create/update/delete through `create_rule`, `update_rule`, and `delete_rule`; change scope; test against a preview value/range; navigate to violations; duplicate with a fresh ID.
### Behavior
Rules are canonical, typed, bounded, and revisioned. Validation does not silently coerce values unless a rule type explicitly defines reviewed coercion. Presentation effects are resolved projections and remain distinguishable from direct CellPresentation.
# Resolver registry
```typescript
export const spreadsheetInspectorResolvers: InspectorResolverMap<SpreadsheetInspectorSelection> = {
  none: NothingSelectedPanel,
  spreadsheet: SpreadsheetDetailsPanel,
  cell: CellInspectorPanel,
  formula: FormulaInspectorPanel,
  prompt: PromptInspectorPanel,
  range: RangeInspectorPanel,
  rows: RowsInspectorPanel,
  columns: ColumnsInspectorPanel,
  'named-range': NamedRangeInspectorPanel,
  spill: SpillInspectorPanel,
  overlay: ({ overlay }) =>
    overlay.kind === 'chart' ? ChartOverlayInspectorPanel : ImageOverlayInspectorPanel,
  overlays: MultiOverlayInspectorPanel,
  rule: RuleInspectorPanel
};
```
# Mutation and concurrency contract
```typescript
interface SpreadsheetInspectorCommand<T extends SpreadsheetOperationData> {
  projectId: ProjectID;
  spreadsheetId: SpreadsheetID;
  expectedRevision: number;
  submissionId: string;
  actor: ActorRef;
  selection: SpreadsheetInspectorSelection;
  operation: T;
}
```
- Local drafts do not mutate the aggregate. Enter/Apply commits; Escape restores accepted state. Blur commits only low-risk, unambiguous scalar edits.
- A1 input is resolved against `expectedRevision` and converted to stable IDs before submission. The response returns the canonical accepted revision and projection.
- Optimistic updates require reconciliation or full rollback. Stale work is retried only when footprints prove safety.
- Formula/Prompt/import/render jobs are at-least-once and use tokens, source/dependency snapshots, and deterministic submission IDs.
- Structural/destructive actions preview affected stable entities and commit atomically when partial success would violate intent.
# Cross-capability boundaries
- Formula owns parsing, evaluation, the eight-value algebra, and Formula Name Manager.
- Prompt Library owns reusable Prompt assets; a Cell owns its submitted Spreadsheet-rich Prompt binding snapshot.
- File owns image bytes and lifecycle.
- Template Library owns whole-Spreadsheet template assets/versions; Spreadsheet owns materialized state.
- Annotation owns comments; Agent owns tasks/approvals/side effects; Resource/Search/Activity own their projections.
- Inspector routes to these authorities through project-scoped adapters and never copies their mutation logic into Spreadsheet.
# Required model alignment
The runtime page references several types that must be made concrete before the corresponding controls ship:
- `GridRule`, including stable ID, type discriminator, scope, priority/rank, configuration, effect, and validation.
- `FreezePane`, `CalculationPolicy`, `CellDisplay`, `CellPresentation`, and Spreadsheet default-presentation operations.
- `ChartBinding`, `ChartSpec`, `OverlayData`, `PointPX`, `Crop`, and field-typed overlay update payloads.
- Row/column move/resize/hide payloads, range paste/fill/presentation payloads, spill materialization payload, and rule payloads in the closed operation union.
- Prompt request inputs/provenance if Prompt cells need reusable asset attribution or resource-context configuration beyond `PromptBinding.Source`.
No generic map patch may substitute for typed/versioned contracts.
# Deliberate exclusions
- No workbook or nested sheet/tab aggregate.
- No merge/unmerge control until merged-cell identity, copy/paste, range, and conflict semantics exist.
- No arbitrary selected-range template in v1; the template unit is the whole Spreadsheet.
- No direct edit of derived spill cells.
- No discontiguous multi-range selection in v1.
- No File deletion, Formula-name mutation, Agent approval logic, or Template Library editing inside Spreadsheet-owned operations.
# Loading, empty, error, and permission states
- Skeleton the resolved lens rather than showing a generic panel spinner.
- An absent sparse Cell is a valid empty state, not a load failure.
- Missing/inaccessible names, Files, resources, or template provenance retain stable identity and an honest label.
- Unsupported value kinds/config versions remain round-trippable and read-only.
- If a selected axis/cell/overlay/rule disappears, show the orphaned selection before clearing or moving to a surviving parent.
# Accessibility and keyboard contract
- Announce selection kind, A1 projection, and relevant stable-status changes without relying on color.
- Exact numbers expose readable display plus exact source spelling.
- Mixed/default/derived/last-good/error states have semantic text.
- Tab follows visible order; collapsed sections are unfocusable.
- Escape exits Formula/Prompt/crop/rule detail mode before clearing the grid/overlay selection.
- Range/axis selections report dimensions and bounds. Hidden rows/columns and locked overlays remain reachable from context/navigation surfaces.
- Geometry and size fields expose units, bounds, and accessible increment controls.
# Acceptance checklist
- [ ] Every selectable Spreadsheet entity resolves to exactly one stable selection kind and typed panel.
- [ ] A1 is always a revision-specific projection; operations use stable IDs.
- [ ] Empty sparse Cells are selectable without fabricated durable IDs.
- [ ] Cell lens faithfully exposes literal, Formula, and Prompt kinds plus accepted/last-good state.
- [ ] Structured values and spills preserve typed semantics.
- [ ] Derived spill cells are read-only and materialize only through an explicit ChangeSet.
- [ ] Range and multi-selection show mixed values honestly and preview bounded operation size.
- [ ] Row/column deletion previews cell, name, rule, spill, and overlay effects.
- [ ] Named ranges preserve ID across rename/repoint and protect dependents on delete.
- [ ] Chart/image overlays preserve stable grid anchors and File/Formula boundaries.
- [ ] Rules remain typed, scoped, revisioned, and distinguish direct from rule-derived presentation.
- [ ] Formula, Prompt, Template Library, File, Annotation, Agent, Search, Activity, and Resource authority boundaries are explicit.
- [ ] Unsupported model fields do not receive fake generic controls.
- [ ] Destructive actions are separated, last, and consequence-labelled.
- [ ] Celestial and Night differ only chromatically.
- [ ] Keyboard/focus/assistive-technology behavior is complete.
# Sources
- <mention-page url="https://app.notion.com/p/3abb6410e5028179a844c0af77b21ffe"/>
- <mention-page url="https://app.notion.com/p/3acb6410e502814584bad00b5c03397f"/>
- <mention-page url="https://app.notion.com/p/e12b6939dbc444698aca18d4162bab10"/>
- <mention-page url="https://app.notion.com/p/39ab6410e50281798739fa3a9e8931ac"/>

