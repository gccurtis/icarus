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
overlay](#styling-resolves-as-an-overlay), and a spreadsheet now carries its own
style registry alongside them.

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
  ├─ styles          — style registry: named text + cell styles, Normal protected
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
  styles: SpreadsheetStyleRegistry;  // named reusable styles; Normal protected
  rowOrder: RowId[];
  columnOrder: ColumnId[];
  rows: Record<RowId, RowProperties>;
  columns: Record<ColumnId, ColumnProperties>;
  cells: Record<CellId, SpreadsheetCell>;
  /** Ordered range styling. Later regions win. */
  formatRegions: FormatRegion[];
  /** Ordered read-time style overlay. Later matching rules win. */
  conditionalFormats: ConditionalFormatRule[];
  /** Input constraints. Violations are computed on read, never stored. */
  validations: ValidationRule[];
  overlay: OverlayObject[];
}
```

### The style registry

Spreadsheet has its own registry, the same shape as Document's and Slides', with
one difference: a spreadsheet style bundles **both** text and cell properties,
because that is how cell formatting is actually chosen.

```ts
interface SpreadsheetStyleRegistry {
  defaultStyleId: string;              // applied to every cell with no styleId
  styles: SpreadsheetStyle[];
}

interface SpreadsheetStyle {
  id: string;
  name: string;
  basedOnStyleId?: string;
  systemRole?: "normal";               // the only protected role for now
  properties: CellStyleProperties;
}

interface CellStyleProperties {
  /** Text half — font, size, weight, italic, colour, and so on. */
  text?: SpreadsheetTextStyleProperties;
  /** Cell half. */
  fill?: ThemeColorValue;
  borders?: { top?: CellBorder; right?: CellBorder; bottom?: CellBorder; left?: CellBorder };
  horizontalAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  wrap?: boolean;
  numberFormat?: string;
  paddingPt?: number;
}
```

There is only one styleable kind — a cell — so the registry needs a single
`defaultStyleId` rather than Document's per-block-kind map. `Normal` is
protected: it cannot be deleted or have its role reassigned, though its name and
properties stay editable.

Cells, axes, and format regions may either reference a style by ID or carry
local `CellStyleProperties` overrides, exactly as a Document block may select a
style and still carry inline marks.

### Styling resolves as an overlay

```text
default style → column → row → format regions (in order)
              → cell style + cell overrides → conditional formats (in order)
```

Each layer contributes only the properties it sets. Rich Text inline marks stay
supplementary on top and are never rewritten when a style changes.

**Format regions are how you style a selection.** Highlight A1:D20, set a fill,
and one region records it:

```ts
interface FormatRegion {
  id: FormatRegionId;
  /** Stable axis IDs, so inserting a row inside a range widens it. */
  ranges: CellRange[];
  style: CellStyleProperties;
}
```

All three rule types — format regions, conditional formats, validations — carry
`ranges: CellRange[]` rather than a single range, because a user selects
discontiguous cells and applies one thing to them. One shape, used three ways.

**It is a set, and the reducer enforces that.** On every write the ranges are
normalized: overlapping or edge-adjacent ranges merge into the minimal
equivalent cover, and the result is sorted by start position. Two authorings
that describe the same cells therefore produce byte-identical canonical state
and the same semantic digest, which is what keeps replay exact and stops undo
from resurrecting a differently-shaped but equivalent rule. It also means a
cell can never match one rule twice.

Normalization runs over stable axis IDs against the current axis order, so
`A1:B5` and `B1:C5` merge to `A1:C5` only when they genuinely abut in the
current ordering.

This is not a convenience. Without it, styling a 100×100 block means
materializing 10,000 Cell records whose only purpose is to hold a fill colour —
which defeats sparseness, bloats every ChangeSet, and creates data that is
painful to migrate away from later. That combination — high product value, poor
reversibility — is what puts it in v1.

**Conditional formatting is a set of ranges plus a Formula lambda.** That is the
whole rule:

```ts
interface CellRange {
  start: { rowId: RowId; columnId: ColumnId };
  end:   { rowId: RowId; columnId: ColumnId };
}

interface ConditionalFormatRule {
  id: ConditionalFormatRuleId;
  ranges: CellRange[];
  /** Formula source for a one-argument lambda returning logic. */
  predicate: string;
  /** What that argument is. Defaults to the cell alone. */
  subject?: PredicateSubject;
  style: CellStyleProperties;
}

/** Resolved per evaluated cell and handed to the lambda as its one argument. */
type PredicateSubject =
  /** The lambda receives the cell's value. */
  | { kind: "cell" }
  /** The lambda receives a list of values along one axis around the cell. */
  | {
      kind: "range";
      axis: "row" | "column";
      /** Cells before the subject along that axis. Capped by config. */
      before: number;
      /** Cells after it. */
      after: number;
    };
```

### The predicate subject

**The lambda always takes exactly one argument.** What that argument *is* comes
from the declaration, not from the lambda's shape:

| `subject` | Argument | Example predicate |
|---|---|---|
| omitted, or `{ kind: "cell" }` | the cell's value | `x => x > 100` |
| `{ kind: "range", axis, before, after }` | a list of values in axis order, including the cell | `xs => sum(xs) > 1000` |

An earlier revision passed `(value, window)` on every call, with `window`
degenerating to `[value]`. That was worse: it made the common case carry a
parameter it never used, and it conflated *what the rule is about* with *how the
lambda is invoked*. Making it a sum type in the declaration puts the choice
where the author actually makes it, and keeps the simple rule simple.

The range variant is what lets a rule say something about a cell's
surroundings — "higher than the one above", "above the average of the last
four" — without reintroducing cell references into formulas. The window is
**declared structurally** and the projection materialises the values; the author
never writes `A1` anywhere, and nothing needs re-resolving when axes move
because the window is computed from current axis order at read time.

**The range is always one-dimensional.** `axis` selects a row slice or a column
slice; there is no two-axis window. A declaration that is neither is rejected at
the wire boundary rather than silently reinterpreted, and `before`/`after` are
non-negative and capped by configuration so a rule cannot demand thousands of
neighbours per cell.

Near an edge the window is simply shorter — it clips at the first or last axis
entry rather than padding, so `xs` may be smaller than `before + after + 1`.

An earlier revision proposed a closed comparison union — `equals`,
`greater-than`, `between`, `contains`. A lambda subsumes every one of them and
everything else anyone would ask for, and Formula already parses lambdas
(`LambdaNode`, `parser.ts`). Building a fixed vocabulary would mean growing it
forever.

The client is expected to offer a friendly rule builder and emit the lambda; the
backend does not need to know that a "greater than 100" chip produced
`x => x > 100`. Generality here costs nothing and removes a whole category of
future work.

**Rules are evaluated at read time, in a projection.** They are never settled
into canonical state and never mutate a Cell — a conditional format is a
question about the current values, so caching it would just be a cache to
invalidate. This is the architecture's own rule that a derived index never
becomes canonical authority, and it is why conditional formatting needs no
attempt family, no dirty tracking, and no dependency walk.

A lambda that fails to parse, or returns a non-logic value, marks the rule
broken in the projection and styles nothing. It never fails the read.

### Defining a rule and asking for formatting are two different things

Worth separating explicitly, because they look similar and behave nothing alike:

| | Defining the rule | Asking for formatting |
|---|---|---|
| Shape | a command | a query |
| Carries | ranges + predicate + style | a viewport: the set of ranges on screen |
| Effect | canonical state, versioned, undoable | computes and returns; changes nothing |

```ts
type SpreadsheetQuery =
  // …
  | { type: "sheet.formatting"; spreadsheetId: SpreadsheetId;
      revision?: number; viewport: CellRange[] }
```

The viewport is itself a **set of ranges**, normalized the same way rule ranges
are — a client showing a frozen header plus a scrolled body is looking at two
discontiguous regions and should ask once.

The result is the resolved style per cell in the viewport, plus any validation
violations for those cells, so one round trip answers "how do I draw what I can
see". Work is proportional to the viewport, not to the rules' ranges — which is
what makes a lambda over a 10,000-cell range affordable.

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

### Prompt cells

A prompt lands in **one cell**. One output, one text value, one cell. It is not
a range and never spills — spreading one output across neighbouring coordinates
is exactly the projection subsystem this design removed. Prompt output in
several cells means several prompt cells, each owning its own Derived Output.

The cell holds only the reference:

```ts
{ kind: "prompt"; output: DerivedOutputRef }   // { outputId, appliedRevision }
```

**Generated text never enters canonical state.** The snapshot stores a pointer;
`sheet.load` resolves it by calling `derivedOutputs.getRevision(outputId,
appliedRevision)` per prompt cell and returning those revisions alongside the
snapshot. This is what Document does, and it is why an old revision still reads
back the exact text it referenced.

Creation is Document's three-stage pipeline — serial freeze, concurrent compute,
serial settle — with the attempt freezing the target and the full definition so
later stages never re-read mutable inputs. One dedicated output per live prompt
cell; generic cell operations cannot inject or share a `DerivedOutputRef`.

#### The one real difference from Document: the target may not exist

Document always has a parent Row to insert a Block into. **Cells are sparse**,
so a prompt may be aimed at a coordinate holding no Cell record at all.

So `prompt.create.request` takes a stable `{ rowId, columnId }` rather than a
cell ID, and the attempt freezes that coordinate plus the CellId to materialise.
Settlement then treats three situations as **stale** rather than as errors,
exactly as Document treats a placement conflict:

- the target Row or Column was deleted while the model was running;
- the coordinate was materialised in the meantime with non-blank content;
- the coordinate is now covered by a merged span it does not anchor.

A stale settlement detaches the ownership row and stops. The output is not
attached and the cell is left as it was found. Refresh uses Document's test
unchanged — the cell still exists, is still a prompt, has the same `outputId`,
and still shows the `appliedRevision` the attempt began from.

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
  | { type: "prompt.create.request"; spreadsheetId: SpreadsheetId;
      expectedRevision: number;
      /** Stable coordinate. The cell need not exist yet. */
      target: { rowId: RowId; columnId: ColumnId };
      prompt: string; contextEntries: ContextEntry[];
      stabilisationText: string }
  | { type: "prompt.update-definition"; spreadsheetId: SpreadsheetId;
      cellId: CellId; expectedDefinitionRevision: number;
      prompt: string; contextEntries: ContextEntry[];
      stabilisationText: string }
  | { type: "prompt.refresh.request"; spreadsheetId: SpreadsheetId;
      cellId: CellId; expectedRevision: number }
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
6. One distinct dedicated Derived Output per live Prompt cell. A prompt occupies
   exactly one cell and never spills. Generated text is never stored in the
   snapshot — the cell holds a reference and readers resolve it.
7. Overlay `z` is unique and contiguous.
8. Permanent identity non-reuse; exact same-kind compensation only.

## Cell validation

Validation shares the ranged shape but **not** the lambda:

```ts
interface ValidationRule {
  id: ValidationRuleId;
  ranges: CellRange[];
  constraint: ValidationConstraint;
  message?: RichContent;
}

type ValidationConstraint =
  /** The cell's value must appear among the permitted values. */
  { kind: "one-of"; allowed: AllowedValues };

type AllowedValues =
  /** Formula source. A list, record, or table; every scalar in it is permitted. */
  | { kind: "expression"; source: string }
  /** Cells in this sheet. Every value in the ranges is permitted. */
  | { kind: "cells"; ranges: CellRange[] };
```

`expression` covers a literal list (`[1, 2, 3]`), a project binding that
resolves to a list, and a table — the value need not be a list, because "every
scalar in it" is well defined for records and tables too. `cells` covers the
most common spreadsheet case of all: a dropdown fed by a column somewhere on the
sheet.

`cells` does **not** reintroduce cell-to-cell references. `CellRange` already
holds stable axis IDs, and validation is resolved in a projection at read time,
so there is nothing to re-target when axes move and no dependency graph to
maintain — the projection simply reads whatever is in those cells now.

### Why validation is a list, not a predicate

Symmetry with conditional formatting would suggest a lambda here too. It would
be worse.

A client has to render a **dropdown**, and that needs the actual permitted
values. `x => contains([...], x)` answers "is this allowed?" but cannot be
reversed into "what is allowed?", so a lambda would force every client to
either parse the source or give up on the dropdown — which is most of what
validation is for.

So the two rule types ask genuinely different questions:

| | Question | Shape |
|---|---|---|
| Conditional formatting | *Is this cell special?* | lambda → logic |
| Validation | *What may this cell be?* | expression → list |

One `one-of` kind covers both cases worth having, because the expression is
ordinary Formula source: a literal list is `[1, 2, 3]`, and a project binding
that resolves to a list is just its name. No second mechanism for "static list"
versus "named list" — they differ only in what the author typed.

The union stays closed and single-membered so number ranges, date ranges, and
text-length constraints can be added later as members, if they turn out to be
wanted.

### Validity is computed, never stored

"Advisory" was the wrong word and it hid the real point. The mechanism is:

**A cell's validity is never recorded anywhere. It is computed on every read,
against the permitted values as they are at that moment.**

That is precisely the dependency-based behaviour the word "advisory" seemed to
deny. Nothing can go stale, because there is no stored verdict to go stale — if
the source column changes, the next read reports different violations, with no
invalidation pass, no dirty set, and no recomputation trigger.

The alternative — checking at write time and rejecting — is strictly weaker
here, and it is worth being precise about why. It cannot deliver the guarantee
it appears to:

- the permitted set is an expression or a range that changes independently, so a
  value legal when written becomes illegal later with the cell untouched. A
  write-time gate would have let it in and would never revisit it;
- formula results land in constrained ranges without passing through a cell
  write at all;
- bulk paste would fail wholesale on one bad value, and a spreadsheet that
  refuses a paste is worse than one that flags a cell.

So rejection buys a guarantee that does not hold, at the cost of a Formula
evaluation inside the serial write path. Live evaluation buys a guarantee that
does hold — *this cell is invalid right now* — for the price of computing it
when asked.

Clients get the rule set to render a dropdown and a live violation list to mark
cells. If write-time rejection is ever wanted as well, it is additive: the rules
are already stored, so it is one check at admission, and it would supplement the
projection rather than replace it.

## Inventory: what happened to each feature

Judged on **how different the product is without it** and **how reversible
adding it later is**.

| Feature | Verdict | Why |
|---|---|---|
| Format regions | **Kept** | High value, poor reversibility — the alternative is materializing cells purely to hold a fill |
| Conditional formatting | **Kept** | Ranges + a Formula lambda, evaluated in a viewport-bounded projection. No new vocabulary to grow |
| Validation | **Kept** | Same ranged shape; one `one-of` kind over an expression or cell ranges, computed live |
| Sheet default + per-axis + per-cell style | **Kept** | The baseline styling story |
| A1 authoring layer | Removed | Existed only for cell-to-cell references, which the model does not have |
| Calculation planning | Removed | One expression at a time; Formula already does this |
| Range projection subsystem | Removed | Spilling is a rendering concern |
| Multi-sheet workbooks | Removed | One sheet per resource |
| Data cells (pinned/follow-head) | Removed | A `formula` cell over a project binding already is this |
| Style registry (named styles, inheritance, protected `Normal`) | **Kept** | Same shape as Document and Slides; a spreadsheet style just bundles text *and* cell properties |
| Charts and sparklines as overlays | Deferred | Good reversibility: the overlay union is closed but extending it is additive |
| Number/date-range and text-length validation kinds | Deferred | Good reversibility: more members of a closed constraint union |
| Write-time validation rejection | Deferred | Additive: rules are stored, so it is one admission check that supplements the live projection rather than replacing it |

## Deferred

Charts and sparklines as overlay kinds, further validation constraint kinds
(number range, date range, text length), write-time validation rejection,
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
