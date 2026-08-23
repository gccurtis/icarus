# Analysis

## Purpose

The Analysis screen authors and presents one saved analytic. It is not a
Tableau-style shelf replica and does not assume one hidden input table. It makes
the reusable output primary, then exposes the ordered table program that
produces it.

The underlying contract is documented in the
[analytic system overview](../data-models/data/analytic-system-overview.md).

## Center surface

The page is a vertical stack with three regions.

### 1. Title

- Editable analytic title.
- Compact save/materialization state beside the title.
- No second display title is introduced by the page; the nested chart can still
  have its own optional presentation title when an embed needs it.

### 2. Analytic component

The center renders the exact `AnalyticComponent` used by document blocks,
slides, and spreadsheet overlays.

- A chart remains native and interactive: bars, slices, points, axes, labels,
  legends, and added elements keep semantic selection.
- A table exposes identified columns, rows, and cells.
- The analysis page does not translate the output into a page-only model.
- Resizing the center only recalculates disposable geometry.
- A stale or failed edit preserves and labels the last complete materialization.

Selection routes to the same inspector target vocabulary regardless of the
surface hosting the component.

### 3. Chart/table customization section

The section beneath the component has a narrow vertical button rail on the left
and a generous horizontal editing grid on the right.

The buttons are output-specific:

| Output | Visible buttons |
| --- | --- |
| Table | Data |
| Pie/doughnut, funnel, treemap | Data, Labels |
| Bar, line, area, waterfall, radar | X, Y, Data, Labels |
| Scatter | X, Y, Data, Labels |
| Bubble | X, Y, Data, Size, Labels |
| Mekko, heatmap | X, Y, Data, Labels |

Required/optional status comes from the analytic customization contract. An
optional button remains available but does not show an error when empty.
Meaningless buttons are absent; pie never shows X/Y controls.

The active button's grid shows:

- its ordered input cards;
- the selected column, data row, or function that turns each input into a list;
- an Extend or Join step between every card after the first;
- compact validation state and the formula-shaped representation;
- simple, high-frequency operations relevant to that channel.

The inspector may provide more detailed settings for the selected card, join,
operation, axis, mark, or chart element. Compact and detailed editing mutate the
same model objects rather than maintaining two configurations.

## Drop and list-selection behavior

Variables from the screen's variable list can be dragged into the active
channel grid. Keyboard Add actions provide the same path.

- A list or scalar is immediately usable through its normalized `value` column.
- A table, record, resolved range, or function result remains in place and shows
  “Needs a list, not a table.”
- Selecting the warning opens the detailed choice of any body column, any data
  row, or Function.
- Function authors a lambda over the normalized table and must return a list.
- Headers name columns and are not values in the selected column.

No drop silently chooses the first column.

## Extend, join, and data relation

Within X, Y, Labels, or Size, the first card starts a relation. Every later card
has one ordered composition step:

- Extend stacks values.
- Join selects one key from the accumulated relation and one from the incoming
  table. The default is an outer/null-preserving join; inner, left, and right
  remain available.

Data names one explicit `from` relation. If X and Y were constructed from
independent sets, the Data button reports that they must be bridged before a
measure can be aggregated. A bridge can join two dimensions or extend a prior
bridge with another dimension.

The compact section can show the missing-bridge status and the selected relation
summary. The detailed join editor may live in the inspector, but its output is
the same persisted `AnalyticBridge`.

## Ordered operations

Dimension-local and Data operations execute in visible top-to-bottom order.
Supported declarations are filter, group, sort, limit, aggregate, and custom
formula where meaningful.

Reordering is a semantic edit. The interface must not reorganize operations by
kind or render separate unordered “Filters” and “Sorts” shelves. An operation
may refer only to an operation above it.

## Output type and interactions

The component supports Table plus twelve hand-built chart types:

- Bar (stacked by default; clustered/grouped is explicit)
- Line
- Area
- Scatter
- Bubble
- Pie/Doughnut
- Waterfall
- Mekko
- Funnel
- Radar
- Heatmap
- Treemap

Each type has its own visual capability boundary. For example:

- bars permit bar/segment selection and added CAGR, reference, and text lines;
- pie permits slice selection and text, but no axes or CAGR;
- point charts permit point/bubble selection and trend lines;
- custom Labels data materializes into datum labels, while value/percent/
  category/total labels remain chart-format choices where supported.

The surface owns no drag behavior inside the component. A slide, spreadsheet,
or document wrapper may make the whole component movable without taking pointer
events away from marks.

## States

- **Ready:** definition validates and the current component is materialized.
- **Incomplete:** definition warnings identify missing lists, slots, operations,
  or bridges; the last complete component remains visible.
- **Stale:** an authored edit has not completed evaluation; the last component
  is labeled as stale.
- **Error:** evaluation or component validation failed; the definition and last
  good output remain inspectable.
- **Empty:** a valid evaluation produced no rows; this is distinct from an
  error.

Issue IDs are stable so compact warnings, inspector details, and materialization
state refer to the same problem.

## Surrounding panel boundary

The Context panel owns navigation among saved analytics and the draggable list
of project variables. The Inspector owns detailed properties for the current
analytic, relation card, join, operation, table target, chart, mark, axis, or
added element.

Their exact section layouts are outside this component contract. Neither panel
may introduce a second data definition, a second chart taxonomy, or a
surface-specific selection identity.

## Retained tab view state

The `analysis` tab retains:

- active customization button;
- selected input, composition step, bridge, operation, table part, or chart
  part;
- center zoom/fit and table scroll;
- compact section scroll and disclosure state;
- panel geometry.

Inputs, dimensions, bridges, operations, outputs, component settings, and
materialization state are persisted model state, not duplicated into view
state. Drag previews and in-flight evaluation remain runtime state.

## Model coverage

- [Analytic system overview](../data-models/data/analytic-system-overview.md)
- [Analysis model](../data-models/data/analysis.md)
- [Chart system overview](../data-models/data/chart-system-overview.md)
- [Chart model](../data-models/data/chart.md)
- [Name Manager](../data-models/data/name-manager.md)
- [Formula values](../data-models/content/content-block.md)
