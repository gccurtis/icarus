# Analysis

## Purpose

Analysis is a Tableau-like builder over project Name Manager values. The saved structured definition—inputs, joins, shelves, filters, sorts, limit, and display—is authoritative. It compiles one-way into the project formula language, evaluates on demand, and does not persist its result.

## Center surface

### Header

- Editable analysis title and optional description.
- Save/evaluation state.
- Undo/redo for unsaved local builder actions only. Analysis has revision-CAS current state, not a durable change-set history.
- Run/refresh evaluation.
- Duplicate and open compiled-formula disclosure.

### Input and join strip

- The first input is marked Root.
- Additional inputs show their alias or source name.
- Join cards connect left/right fields and display Inner, Left, Right, or Outer.
- Unresolved variable or field references remain visible as errors and preserve the definition.
- Add input and Add join actions are always available when semantically valid.

### Shelves

Shelves sit above the visualization in this order:

1. Columns.
2. Rows.
3. Filters.
4. Sorts.
5. Limit.

Fields drag from the Data context view to a shelf. Every drop also has an Add field menu and keyboard path. Placement pills show qualified field, aggregation, and label. Sort pills name the placement they target, including aggregation.

Rows and Columns accept placements with None, Sum, Count, Average, Minimum, or Maximum aggregation. Filters expose the supported operators. Type-appropriate value controls appear only after the evaluator defines a column-schema/type-inference contract for potentially heterogeneous table values. Sorts target placement IDs, never an unqualified source field.

### Visualization

- The result occupies the generous center plane as Table or any native chart:
  Bar/Column, Line, Area, Scatter, Bubble, Pie/Doughnut, Waterfall, Mekko,
  Funnel, Radar, Heatmap, or Treemap.
- Table is the safe initial display.
- Loading, evaluation progress, empty result, formula error, and incompatible chart configuration are distinct states once minimum-shelf/compatibility rules are defined per display kind.
- Selecting a mark or result row inspects its evaluated values if the evaluator exposes a stable mapping.
- Display title, legend, axes, and marks reflect the saved display definition.
- A small “Generated from current data” line communicates that the result itself is not stored.

### Compiled formula disclosure

A collapsible, read-only technical view shows the current compiled formula and evaluation details. It is diagnostic only: editing the formula would break round-tripping and is not allowed.

## Context panel

| Key | Label | Contents and organization |
| --- | --- | --- |
| `data` | Data | Default. Ordered Name Manager variables with type icons, search, table-shaped preview, and expandable fields. Functions remain visible but disabled as analysis inputs. Fields are draggable. |
| `inputs` | Inputs & joins | Root and aliased inputs followed by the join list/diagram. Unresolved entries first. Create/edit actions select the matching inspector target. |
| `display` | Chart | Table and all twelve native chart kinds as cards with active state. Compatibility guidance comes from each kind's required channels. Chart choice belongs here; detailed formatting belongs in the inspector. |
| `filters` | Filters & sorts | Active filters, active sorts, and limit. Sections are collapsible; invalid items start expanded. |
| `names` | Names | Project Name Manager access: create/edit values, definition order, lookup-name conflicts, and use as input. |

## Inspector targets

| Selection | Expanded sections | Collapsed sections |
| --- | --- | --- |
| Analysis or nothing | Identity; display summary | Authorship/revision; compiled formula and evaluation diagnostics |
| Variable | Authored name; declared type; stored value/table-shaped preview | Lookup key; definition order; creator and updated time |
| Input | Variable; alias; root status | Available fields; unresolved diagnostics |
| Field | Qualified input/field; inferred value type only when evaluator metadata supplies it | Source preview |
| Placement | Field; aggregation; label | Placement ID and source details |
| Join | Kind; left and right qualified fields | Input aliases; diagnostics |
| Filter | Field; operator; value | Type/coercion diagnostics |
| Sort | Target placement; direction | Aggregation-aware resolved label |
| Display | Kind; title; stacking; legend | X/Y labels; Y starts at zero; colors |
| Rendered mark/row | Evaluated field/value pairs | Source placement mapping |

Inspector identity and invalid-state sections remain expanded. Advanced diagnostics and the compiled formula are collapsed unless evaluation fails.

## Drag/drop and keyboard model

- Dragging a variable itself to the canvas adds it as an input when valid.
- Dragging a field to Rows or Columns creates a placement.
- Dragging to Filters creates a filter and opens its inspector.
- Dragging an existing pill reorders or moves it where semantics permit.
- Every drop target has a visible focus state and equivalent Add/Move menu.
- Removing an input that is referenced by joins/shelves requires confirmation and lists affected items.

## Display settings supported now

The current model supports:

- Display kind.
- Title.
- Stacked on/off.
- Legend position.
- X- and Y-axis labels.
- Whether the Y axis starts at zero.
- Color list.

It does not yet support independent Color, Size, Detail, Label, Tooltip, or Series encoding shelves. The first screen should not draw empty Tableau shelves for those fields. Adding them requires extending `AnalysisDefinition`. Joins, filters, and sorts also need stable IDs before the UI can promise durable selection/collaboration on each item.

## Evaluation and error behavior

- Any Name Manager value except a function can normalize to a table and serve as an input.
- Self-joins require aliases.
- Evaluation happens on demand; results are replaceable projections, not resources.
- A failed evaluation preserves the structured definition. A previous result may remain only from the current client session/cache and is labeled as such; no durable stale result exists.
- Save conflicts preserve shelf edits and offer refresh/reapply.
- Result limits are visible near the visualization so a truncated result is never mistaken for the full data.

Name Manager stores values, not formulas or source provenance. It also has no revision field, so Name edits cannot reuse Analysis's stale-write UI without a separate transactional/concurrency contract. Name-key uniqueness is still checked by the mutation.

Before compatibility badges and type-specific filters ship, the evaluator must define column inference for scalar/list/record/table normalization, heterogeneous values, and each chart kind's minimum valid Rows/Columns configuration.

## Retained tab view state

The `analysis` state retains active context, selected input/encoding/filter/sort/result cell, result-plane scroll, result zoom, and panel geometry. Shelves, encodings, display, filters, and sorts that exist in `AnalysisBody` are persisted model state, not duplicated into this view state. Evaluator caches, drag previews, and in-flight calculations remain in the tab runtime and reset safely after reload.

## Model coverage

- [Analysis](../data-models/data/analysis.md)
- [Name Manager](../data-models/data/name-manager.md)
- [Formula blocks and values](../data-models/content/content-block.md)
