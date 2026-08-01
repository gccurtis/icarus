# Spreadsheet Capability — Design

## Summary

Spreadsheet is a project-scoped regular capability
(`3-capabilities/spreadsheet/`) that owns editable Workbooks: ordered Sheets,
stable Row and Column axes, sparse Cells, merged spans, formulas, accepted
calculation values, range projections, workbook styling, validation,
Conditional Formatting, typed Chart/Image/Sparkline overlays, history, and
calculation state.

Its canonical unit is one `WorkbookSnapshot`. The snapshot embeds every design
resource and accepted external/computed value needed to replay that exact
revision. Project ID selects the runtime and database at construction; no
Workbook value or command is user-scoped.

```text
WorkbookSnapshot
  ├─ Theme, typed tokens, protected Normal Cell Style, named Cell Styles
  ├─ sheetOrder + Sheet records
  │    ├─ rowOrder + stable Row records
  │    ├─ columnOrder + stable Column records
  │    ├─ sparse Cell records
  │    │    ├─ blank | literal | RichContent
  │    │    ├─ admitted whole-Cell Formula + exact settlement
  │    │    ├─ project Data binding + exact settlement
  │    │    └─ dedicated Prompt Content DerivedOutputRef
  │    ├─ ordered Conditional Formatting rules
  │    └─ typed Chart, Image, and Sparkline overlays
  ├─ metadata
  └─ automatic | manual calculation mode
```

## Central design decisions

### Stable grid identity, one ordering authority

Sheet, Row, Column, Cell, Style, Format Region, rule, and overlay IDs are stable
and never reused. `sheetOrder`, `rowOrder`, and `columnOrder` are the sole axis
ordering authorities; there are no parallel fractional ranks. A1 labels are
rendered from current axis positions and are never canonical identity.

Stable ranges store start/end Row and Column IDs rather than copied membership
arrays. Inserting an axis between the endpoints expands the range naturally.
Freeze panes likewise store stable boundary IDs instead of counts.

### Sparse does not mean content-only

An entirely default blank coordinate has no Cell record. Row, Column, and
ordered range Format Regions style blank coordinates without materializing
them. A blank that carries Cell-local Style, validation, references, or a
merged span is a materialized Cell with `{kind: "blank"}` content. This keeps
the grid sparse without making it impossible to format or validate empty space.

### One closed Cell content union

A Cell has one compatible content variant:

- `blank`
- `literal` for exact number, logic, date, and date-time values
- `rich-content` for all authored text
- `formula` for one grid-aware whole-Cell formula and its settlement
- `data` for one stable project Formula binding and its settlement
- `prompt-content` for one exact dedicated Derived Output revision

There is no independent `source` plus `accepted` cross-product. That older
shape allowed impossible combinations such as a literal source with a stale
structured Formula result. There is also no `empty` source/accepted pair;
unmaterialized coordinates and materialized blank Cells are distinct concepts.

### Rich Content owns authored text and inline formulas

Cell prose, validation messages and list options, Chart titles, axis titles,
and authored series names are `RichContent`. Rich Text owns atoms, marks,
links, references, `{{ ... }}` conversion, Formula atoms, normalization, and
exact inverse operations.

Rich Content Formula atoms use ordinary Formula/v1 project bindings and settle
through the Document-style durable compute/settle workflow. They do not support
A1 or range syntax in representation v1 because shared Rich Text has no place
to persist Spreadsheet's stable grid-reference manifest.

### Whole-Cell formulas have a Spreadsheet authoring layer

Raw `{source: string}` is not sufficient for a spreadsheet formula. A1 text is
positional; persisting it alone silently retargets when axes move.

Spreadsheet therefore admits whole-Cell formulas before reducer entry:

1. Parse Spreadsheet authoring syntax, including A1, `$` absolute axes,
   ranges, and sheet-qualified references.
2. Resolve grid references to stable Sheet/Row/Column IDs.
3. Resolve project symbolic names to stable Formula resolver binding IDs.
4. Replace grid references with reserved Formula/v1 aliases.
5. Persist exact authored text, normalized Formula/v1 source, the stable
   binding manifest, and a source digest.
6. Ask Formula to parse/validate and later evaluate the normalized source.

Axis moves re-render the visible A1 text without retargeting. Deleted axes
produce a broken-reference diagnostic. Copy/fill translates only references
whose authored row/column mode is relative. Project binding identity also
remains stable across rename; a new declaration under an old name cannot
capture an existing formula.

Formula-based validation and Conditional Formatting use the same admitted
authoring family but a narrower grid-rule variant. Rule formulas reject project
bindings and may use only stable grid references, builtins, and one reserved
candidate/current-Cell local. They are therefore deterministic from an
immutable Workbook revision, and their grid references bind once in v1 rather
than being implicitly rebound relative to each target Cell.

### Formula settlement is durable and conditional

Spreadsheet injects Formula plus the project Formula resolver. For a frozen
Workbook revision it builds a composite immutable resolver snapshot containing
the captured project bindings and Workbook-local Cell/range aliases. It then:

1. Persists a calculation attempt and freezes source/reference digests.
2. Plans the Workbook dependency graph and detects cycles.
3. Evaluates independent work concurrently through Formula.
4. Settles serially only when the Cell and source digest still match.
5. Stores the exact `FormulaWireValue`, dependency identities, resolver digest,
   and evaluation digest—or a typed error.

Formula owns language parsing and evaluation. Spreadsheet owns A1 authoring,
Workbook-local binding construction, dirty planning, accepted values, and
projection into the grid. Dependency graphs and calculation plans are
rebuildable, not canonical. There is no semantic `acceptedAt` timestamp.
Dependency changes derive `dirty` from stored digests without rewriting every
dependent Cell; the last accepted value remains visible until replacement.
`pending` means the current formula source has never settled.

### Data Cells use the project Formula resolver

A Data Cell attaches to a stable project Formula `bindingId`, not directly to a
Structured Data runtime and not by a mutable display name. Any wire-serializable
non-function binding is valid:

- scalar bindings display in the anchor Cell;
- list, record, and table bindings use an explicit projection orientation.

Attach/refresh freezes a resolver snapshot and conditionally stores the exact
accepted value, owner revision, and value digest. Pinned Cells retain that
binding revision; follow-head Cells are eligible for refresh. Historical
Workbook revisions never consult today's project state.

Representation v1 does not promote a range into Structured Data or write back
through a Data Cell. Such cross-database mutation would require a separate
durable delegated workflow.

### Every Prompt Content Cell owns one Derived Output

Prompt Content follows the settled Document/Slides boundary:

- a specialized create workflow declares a fresh Derived Output;
- each live Prompt Content Cell has its own output ID;
- the Cell stores only the exact `{outputId, appliedRevision}` reference;
- definition, Context scope, stabilization text, evidence, freshness, and
  generated string belong to Derived Outputs;
- generic Cell operations cannot inject or share a Derived Output reference;
- refresh and definition changes use freeze → concurrent work → serial settle;
- replacing/deleting Prompt Content makes its ownership row historical;
- Spreadsheet never deletes or garbage-collects a Derived Output.

The same Cell ID may hold Prompt Content more than once over its lifetime, but
each new Prompt instance receives a fresh output. One pending replacement and
one currently attached ownership may coexist; settlement swaps them atomically
and failure preserves the previous attachment.

### Projections are derived, collision-safe grid views

An accepted Formula/Data list, record, or table may spill from its anchor Cell.
The `RangeProjection` is rebuilt from the accepted wire value, projection
orientation, anchor, and current axes; it is not embedded in settlement and
its projected coordinates are not canonical Cells.

Projection never invents Row/Column IDs. Insufficient axis capacity blocks it.
The anchor itself is not a collision, but another canonical Cell, merged span,
or projection is. When projections overlap, every participant is blocked—map
iteration order never chooses a winner. The anchor displays the top-left value
of the deterministic header/value matrix; subsequent coordinates are projected
paths. Materialization applies that same mapping with caller-supplied permanent
Cell IDs.

### Workbook styling is reusable and deterministic

The old “no Theme; styling is per-cell” boundary was too weak for professional
workbooks. A Workbook now embeds:

- typed color, font, and length tokens;
- palette and typography defaults;
- exactly one protected, editable Normal Cell Style;
- optional named reusable Cell Styles with acyclic inheritance;
- typed local Style overrides on Sheet defaults, Columns, Rows, and Cells;
- ordered stable range Format Regions for compact arbitrary-range formatting.

Style resolution overlays Theme/Normal → Sheet → Column → Row → Format Region
→ Cell → Conditional Formatting. Rich Text inline marks remain supplementary
and are never rewritten when a reusable Style changes. Conditional Formatting
is a read-time presentation overlay, not destructive Cell formatting.

### Merged Cells remain one Cell

A merged region is one Cell with an anchor and stable bottom-right span
endpoint. V1 merge requires all covered non-anchor coordinates to be empty and
unmaterialized. A caller that wants to discard contents must delete them
explicitly in the same batch. Unmerge preserves the anchor Cell and releases
the rest. There is no implicit discard or unmodeled “preserve as reference”
state.

### Overlays are typed backend objects, not rendering payloads

Sheets may own closed Chart, Image, and Sparkline overlay variants. Each has a
stable Cell anchor, point offset/dimensions, and canonical `zIndex`. Charts bind
stable ranges and use Rich Content for authored labels. Images hold immutable
General Files snapshot references and plain accessibility alternative text.
There is no `data: Record<string, unknown>` escape hatch.

Spreadsheet owns these authored definitions, not their pixels. Rendering,
thumbnails, chart rasterization, browser geometry, export layout, and render
caches are outside the backend capability boundary.

## Capability boundaries and runtime dependencies

| Dependency | Spreadsheet uses it for |
|---|---|
| Rich Text | Validate, normalize, mutate, clone, and settle embedded `RichContent`. |
| Formula | Parse/validate normalized expressions and evaluate against immutable resolver snapshots. |
| Project Formula resolver | Supply stable project bindings; Spreadsheet composes Workbook-local grid bindings over a frozen view. |
| Derived Outputs | Declare/update/refresh the dedicated output behind Prompt Content. |
| Job runtime and dual queues | Serial admission/settlement, concurrent reads/evaluation/external work. |
| Logger | Structured boundary outcomes and diagnostics. |

Spreadsheet has no direct Structured Data or Activity runtime dependency.
Structured Data contributes project bindings through the Formula resolver.
Accepted mutations write a Spreadsheet-owned activity fact to its transactional
outbox; a future Activity service consumes those facts and requests undo/redo
through Spreadsheet's compensation command.

## Primary flows

```text
Edit authored text
  → RichText operation against a closed SpreadsheetRichContentTarget
  → persist Workbook ChangeSet
  → create/evaluate/settle affected Rich Text Formula atoms

Enter a whole-Cell formula
  → Spreadsheet formula admission resolves stable grid + project bindings
  → persist Formula Cell as pending
  → concurrent Formula evaluation against a frozen composite resolver
  → serial exact settlement
  → derive scalar display or structured range projection

Attach project Data
  → freeze project resolver snapshot and stable binding ID
  → reject function/non-wire values
  → serially settle exact binding revision/value
  → derive scalar display or structured range projection

Create Prompt Content
  → freeze target Cell and durable creation attempt
  → declare + first refresh one dedicated Derived Output
  → serially attach exact output revision if target still matches
```

## Documents in this design set

- [Canonical model](canonical-model.md) defines exact Workbook, design-system,
  Cell, formula-manifest, settlement, projection, validation, and overlay types.
- [Operations](operations.md) defines reversible operations, specialized staged
  commands, endpoints, jobs, rebase footprints, and compensation.
- [Store](store.md) defines project-scoped SQLite persistence, Bases,
  ChangeSets, attempts, ownership, receipts, compaction, and activity outbox.
- [File architecture](file-architecture.md) defines module ownership,
  dependencies, runtime construction, job wiring, and removal boundaries.

## Questions that materially change implementation

1. Should `follow-head` Data Cells refresh only on explicit request initially,
   or should Spreadsheet subscribe to project-binding invalidations from day
   one?
2. Do Formula-based validation and Conditional Formatting need Excel-style
   relative-per-target reference templates in v1, or is stable bind-once plus a
   reserved current-value local sufficient?
3. Should date/date-time literals enter Formula as ISO text, or should the
   Spreadsheet authoring layer define a numeric serial-date convention?
4. Are the initial Chart contracts (stable range series, Theme palette, titles,
   axes, legend) sufficient, or must formula-driven series definitions exist in
   v1?
