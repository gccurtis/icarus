# Spreadsheet Capability — Design

Replaces `spreadsheet-design/` (5 files, ~4,100 lines). That design was
substantially over-engineered in one specific direction: it rebuilt computation
the platform already provides. Removed are the A1 formula authoring layer, the
calculation-planning subsystem with dependency graphs and cycle detection, the
structured range-projection subsystem with collision arbitration, multi-sheet
workbooks, and Data cells with pinned/follow-head tracking.

**Styling was kept.** An intermediate revision of this document also cut format
regions, conditional formatting, and validation. That was wrong: for knowledge
work the visual layer is not secondary, and format regions in particular are
poorly reversible — see [Styling resolves as an
overlay](#styling-resolves-as-an-overlay). Named cell styles with inheritance
remain deferred, because a sheet-level default plus regions covers the same
ground with far less machinery.

## What the backend is for

The backend stores and persists data, and computes on it when asked. It does
**no rendering.** It holds formatting and styling data, because that is data.
State is canonical and revisioned so concurrent clients on one project converge.

Document is the reference implementation, and Spreadsheet mirrors it: one
aggregate, one layout block carrying dimensions, one default styling block, a
sparse container of content, and content that is Rich Content.

## The data model

```text
Spreadsheet (one sheet)
  ├─ title, lifecycle, revision
  ├─ sheetLayout     — print/page dimensions (the analogue of pageLayout)
  ├─ cellStyle       — the sheet's default cell styling
  ├─ rowOrder + columnOrder   — stable axis identities
  ├─ cells           — sparse: only materialized coordinates exist
  └─ overlay         — image objects with x / y / z and their own fields
```

**One sheet per Spreadsheet resource.** The aggregate *is* a sheet, exactly as
the Document aggregate is one document. There is no `sheetOrder`, no
sheet-qualified reference, and no cross-sheet anything. More spreadsheets means
more resources.

```ts
interface SpreadsheetHead {
  id: SpreadsheetId;
  title: string;
  lifecycle: SpreadsheetLifecycle;   // active | archived | trashed
  revision: number;
  baseSeq: number;
  semanticDigest: string;
  createdAt: string;
  updatedAt: string;
}

interface SpreadsheetSnapshot {
  representationVersion: 1;
  revision: number;
  title: string;
  lifecycle: SpreadsheetLifecycle;
  sheetLayout: SheetLayout;
  cellStyle: CellStyleProperties;    // the sheet default; cells override locally
  rowOrder: RowId[];
  columnOrder: ColumnId[];
  rows: Record<RowId, RowProperties>;
  columns: Record<ColumnId, ColumnProperties>;
  cells: Record<CellId, SpreadsheetCell>;
  /** Ordered range styling. Later regions win. */
  formatRegions: FormatRegion[];
  /** Ordered read-time style overlay. Later matching rules win. */
  conditionalFormats: ConditionalFormatRule[];
  /** Advisory input constraints; stored and reported, never enforced. */
  validations: ValidationRule[];
  overlay: OverlayObject[];
}
```

### Styling resolves as an overlay

```text
sheet cellStyle → column → row → format regions (in order)
               → cell.style → conditional formats (in order)
```

Each layer contributes only the properties it sets. Rich Text inline marks stay
supplementary on top and are never rewritten when a style changes.

**Format regions are how you style a selection.** Highlight A1:D20, set a fill,
and one region records it:

```ts
interface FormatRegion {
  id: FormatRegionId;
  /** Stable axis IDs, so inserting a row inside the range widens it. */
  start: { rowId: RowId; columnId: ColumnId };
  end:   { rowId: RowId; columnId: ColumnId };
  style: CellStyleProperties;
}
```

This is not a convenience. Without it, styling a 100×100 block means
materializing 10,000 Cell records whose only purpose is to hold a fill colour —
which defeats sparseness, bloats every ChangeSet, and creates data that is
painful to migrate away from later. That combination — high product value, poor
reversibility — is what puts it in v1.

**Conditional formatting** is an ordered list of rules evaluated at read time.
It never mutates a Cell:

```ts
interface ConditionalFormatRule {
  id: ConditionalFormatRuleId;
  start: { rowId: RowId; columnId: ColumnId };
  end:   { rowId: RowId; columnId: ColumnId };
  predicate: ConditionalPredicate;      // comparison against a literal
  style: CellStyleProperties;
}
```

The predicate is a closed comparison union — `is-empty`, `equals`,
`greater-than`, `between`, `contains`, and similar — over a literal operand, not
a formula. That keeps rules deterministic from an immutable revision with no
evaluation pass, and it is what people actually use conditional formatting for.
Formula-valued predicates are deferred; the union is closed, so adding one is
additive.

### Sheet layout is print data, not a projection subsystem

```ts
interface SheetLayout {
  page: { widthPt: number; heightPt: number;
          orientation: "portrait" | "landscape" };
  margins: { topPt: number; rightPt: number; bottomPt: number; leftPt: number };
  defaultRowHeightPt: number;
  defaultColumnWidthPt: number;
  /** Optional stable boundary IDs for a frozen header region. */
  freeze?: { lastFrozenRowId?: RowId; lastFrozenColumnId?: ColumnId };
}
```

This is the whole of it: the dimensional data a client needs to paginate or
print, held as data. `RowProperties`/`ColumnProperties` carry a per-axis size
override and hidden flag. What a renderer does with any of it is not our
concern.

### Sparse cells

A coordinate with nothing to say has no Cell record. A Cell exists when it has
something worth storing:

```ts
interface SpreadsheetCell {
  id: CellId;
  rowId: RowId;
  columnId: ColumnId;
  content: CellContent;
  style?: CellStyleProperties;       // local override of the sheet default
  /** Present when this cell anchors a merged span. */
  merge?: { endRowId: RowId; endColumnId: ColumnId };
}

/**
 * Cell kinds mirror Formula's scalar value kinds, and the literal-or-formula
 * split is the one Structured Data already uses (`CellValue = CellLiteral |
 * CellFormula`). Nothing here is a new value system.
 */
type CellContent =
  | { kind: "blank" }
  | { kind: "text";    content: RichContent }
  | { kind: "number";  value: number }
  | { kind: "logic";   value: boolean }
  | { kind: "date";    value: string }              // ISO-8601
  | { kind: "formula"; source: string; settlement?: CellFormulaSettlement }
  | { kind: "prompt";  output: DerivedOutputRef };

type CellFormulaSettlement =
  | { status: "ok"; value: FormulaWireValue;
      dependencyDigest: string; evaluationDigest: string }
  | { status: "error"; diagnostic: FormulaDiagnostic };
```

### Why these kinds

Formula's wire values are `null | number | text | logic | list | record |
table`. The scalar ones map straight across, which is what makes a `formula`
cell able to hand its result to a `number` or `text` cell's renderer without
translation.

A **`formula` cell is the whole cell** — one expression over project bindings,
settled to a `FormulaWireValue`. This is the direct analogue of Structured
Data's `CellFormula`, and it goes straight to the Formula engine.

A **`text` cell holds Rich Content**, which is the reuse that matters: inline
marks, links, and *formula atoms* all arrive for free. A text cell containing a
formula atom is prose with an inline computed value — Document's exact pattern —
and is a different thing from a formula cell, which is a computed value with no
prose around it. Both are legitimate; neither duplicates the other.

**On the overhead of Rich Content per cell.** Atoms and marks do carry stable
IDs, and Document's identity ledger tracks `rich-text-atom` and
`rich-text-mark`. But a text atom covers a whole *run* of text, not a
character — a cell holding `Revenue` is one atom and zero marks. Combined with
sparse cells, and with numbers, dates, logic, and formula cells carrying no Rich
Content at all, a large sheet lands in the same order of magnitude as a few
pages of Document prose. It is fluff, not a scaling concern, and it buys inline
formulas and formatting. Keep it.

**`date` is Spreadsheet-only.** Formula has no date kind, so a date cell enters
a formula as ISO text. Storing it as a distinct kind is still worth it: it
records the author's intent, which a bare string cannot, and it lets a client
format it without guessing. The alternative — a numeric serial-date convention —
is an Excel compatibility artefact and would leak a representation choice into
Formula/v1.

`list`, `record`, and `table` values are deliberately absent as cell kinds. A
formula returning one settles as that value, and a client displays a summary; it
does not spill into neighbouring coordinates, because spilling is what the
removed projection subsystem existed for.

### What typing into a cell produces

The familiar spreadsheet contract, and it is the **wire layer's** job, not the
domain's:

| Input | Cell kind |
|---|---|
| `=revenue * 2` | `formula` — a leading `=` always means formula |
| `1234`, `-0.5` | `number` |
| `true` / `false` | `logic` |
| a recognised date literal | `date` |
| anything else | `text` |
| empty input on a cell that must persist (a merge anchor, a styled blank) | `blank` |

So text is the fallback, numbers are recognised, and `=` is the escape into
Formula — exactly what a user expects. A caller that wants to defeat coercion
sends the kind explicitly; the decoder accepts a fully-formed `CellContent` as
well as a raw input string, and only the raw-input path coerces.

Coercion lives at the wire boundary so the domain sees only decided values,
which keeps the reducer pure and makes replay exact — a stored ChangeSet never
re-runs the guess.

**A merged cell is worth storing even with no value.** Being merged is itself a
reason to exist — the span is real structural data — so a merge anchor with
`{ kind: "blank" }` content is a normal, expected record.

Ranges and merges store **stable Row and Column IDs**, never A1 text and never
copied membership arrays. Inserting an axis between two endpoints widens a span
naturally. A1 labels are rendered from current axis positions by whoever is
displaying them; they are never canonical identity.

### Formulas: the platform already has them

There are two ways a formula reaches a cell, and **both reuse existing
platform code**. Spreadsheet writes no formula engine, no parser, and no
resolver.

| Path | Cell kind | Analogue |
|---|---|---|
| The whole cell is one expression | `formula` | Structured Data's `CellFormula` |
| An expression inline in prose | `text`, via a Rich Text formula atom | Document's formula atoms |

Both are evaluated by the Formula platform against the existing project
resolver snapshot. The first settles into `CellFormulaSettlement`; the second
settles into the Rich Text atom exactly as Document does.

**There is no A1 authoring layer, no dependency graph, and no calculation
planner**, because there are no cell-to-cell references. A formula references
project bindings — Structured Data names — and nothing else. Structured Data is
where shared, referenceable values already live; a spreadsheet cell that needs a
computed value reads it from there.

The concrete consequence, stated plainly so nobody is surprised: `=SUM(A1:A10)`
is not expressible. A cell cannot read another cell. Everything the old design
built — the tokenizer, the stable-reference manifests, the reserved aliases, the
dirty-set planning, cycle detection — existed only to make cell-to-cell
references safe under axis moves, and all of it goes.

Evaluation follows Document exactly: the reducer reports changed formula atoms,
the service creates one durable attempt per atom inside the mutation
transaction, computes concurrently against a frozen resolver snapshot, and
settles serially only if the atom still exists with the same expression digest
and nothing intervening touched it.

### Overlay objects

A sheet carries an overlay canvas of positioned objects, independent of the
grid:

```ts
interface OverlayObject {
  id: OverlayObjectId;
  kind: "image";
  /** Position on the sheet, in points, with z ordering back to front. */
  x: number;
  y: number;
  z: number;
  widthPt: number;
  heightPt: number;
  source: ImageSnapshotRef;          // immutable General Files reference
  altText: string;
  locked: boolean;
  hidden: boolean;
}
```

This is small and ships in v1 — it is a positioned list of typed objects, not a
subsystem. The union is closed so chart and other overlay kinds are additive
later without a representation change.

## Commands and queries

```ts
interface SpreadsheetCommandRequest {
  requestId: string;
  origin: "user" | "agent" | "automation" | "system";
  command: SpreadsheetCommand;
}

type SpreadsheetCommand =
  | { type: "spreadsheet.create"; title: string }
  | { type: "spreadsheet.submit"; spreadsheetId: SpreadsheetId;
      expectedRevision: number; operations: SpreadsheetOperation[] }
  | { type: "spreadsheet.compensate"; spreadsheetId: SpreadsheetId;
      targetChangeSetId: string; intent: "undo" | "redo";
      expectedRevision: number }
  | { type: "spreadsheet.delete"; spreadsheetId: SpreadsheetId;
      expectedRevision: number }
  | { type: "prompt.create.request"; /* … as Document */ }
  | { type: "prompt.update-definition"; /* … */ }
  | { type: "prompt.refresh.request"; /* … */ }
  | { type: "formula.evaluate.request"; spreadsheetId: SpreadsheetId;
      target: RichContentTarget; formulaAtomId: string };
```

Operations cover sheet metadata and layout, default cell style, axis
insert/move/resize/hide/delete, cell set/clear/style, merge/unmerge, overlay
insert/update/move/delete, and `rich-text.apply`.

`spreadsheet.create` allocates the ID, the initial axes, and returns the head.
`spreadsheet.delete` is terminal, distinct from `set-lifecycle → trashed`.

Two endpoints as everywhere else: `POST /spreadsheet/command` (serial),
`POST /spreadsheet/query` (concurrent).

## Persistence

`./data/spreadsheet.db`, project-hashed prefix, Base + append-only ChangeSets,
identity ledger, command and create receipts, attempts and stage receipts for
formula and prompt work, and an Activity outbox carrying the command `origin`.
Document's schema shape throughout.

## Invariants

1. One sheet, one layout, one default cell style, at least one Row and Column.
2. `rowOrder` and `columnOrder` are the sole axis-ordering authorities; A1
   labels are never canonical.
3. Ranges and merges reference stable axis IDs, never positions.
4. A merged span covers only coordinates that are unmaterialized or blank; the
   anchor keeps its content.
5. Every text-bearing field holds valid normalized Rich Content.
6. One distinct dedicated Derived Output per live Prompt cell.
7. Overlay `z` is unique and contiguous.
8. Permanent identity non-reuse; exact same-kind compensation only.

## Cell validation

Validation rules are stored as data on the sheet, in the same ranged shape as
conditional formats:

```ts
interface ValidationRule {
  id: ValidationRuleId;
  start: { rowId: RowId; columnId: ColumnId };
  end:   { rowId: RowId; columnId: ColumnId };
  constraint: ValidationConstraint;    // one-of list | number range | date range | text length
  message?: RichContent;
}
```

**Enforcement is advisory in v1.** The backend stores the rules and reports
violations through a projection; it does not reject a write that breaks one.
That is deliberate: hard enforcement interacts badly with formula results
landing in a constrained range and with bulk paste, and a spreadsheet that
refuses a paste is worse than one that flags it. Clients get what they need —
the rule set to render a dropdown, and a violation list to mark cells.

Upgrading to hard enforcement later is additive: the rules are already there, so
it is a validation-pass change with no representation impact.

## Inventory: what happened to each feature

Judged on **how different the product is without it** and **how reversible
adding it later is**.

| Feature | Verdict | Why |
|---|---|---|
| Format regions | **Kept** | High value, poor reversibility — the alternative is materializing cells purely to hold a fill |
| Conditional formatting | **Kept** | Expected in any spreadsheet; a read-time overlay with a closed predicate union is small |
| Validation (advisory) | **Kept** | Same ranged shape as CF, so it is nearly free once that exists |
| Sheet default + per-axis + per-cell style | **Kept** | The baseline styling story |
| A1 authoring layer | Removed | Existed only for cell-to-cell references, which the model does not have |
| Calculation planning | Removed | One expression at a time; Formula already does this |
| Range projection subsystem | Removed | Spilling is a rendering concern |
| Multi-sheet workbooks | Removed | One sheet per resource |
| Data cells (pinned/follow-head) | Removed | A `formula` cell over a project binding already is this |
| Named cell styles with inheritance | Deferred | Good reversibility: an additive registry plus one more overlay layer |
| Charts and sparklines as overlays | Deferred | Good reversibility: the overlay union is closed but extending it is additive |
| Formula-valued CF predicates | Deferred | Good reversibility: one more member of a closed predicate union |
| Hard validation enforcement | Deferred | Good reversibility: rules already stored |

## Deferred

Named reusable cell styles with inheritance, charts and sparklines as overlay
kinds, formula-valued conditional predicates, hard validation enforcement,
multi-sheet resources, cross-resource references, copy/fill authoring, promoting
a range into Structured Data, and write-back through a bound cell.

**Cell-to-cell references are deferred by decision, not by omission.** Adding
them later requires an admission layer that resolves references to stable axis
IDs plus a dependency walk; the model above is compatible with that addition
because ranges are already stable-ID based.

Rendering, thumbnails, rasterization, and export layout are outside the backend
boundary.

## Implementation

See [`spreadsheet-implementation-plan.md`](spreadsheet-implementation-plan.md).
