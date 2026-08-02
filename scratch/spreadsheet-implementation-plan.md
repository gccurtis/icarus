# Spreadsheet Implementation Plan

## Goal

Build Spreadsheet from [`spreadsheet-design.md`](spreadsheet-design.md) as a
regular project-scoped capability owning one editable sheet per resource.

Greenfield — no Spreadsheet code has ever existed.

## What changed from the previous design

The old `spreadsheet-design/` (5 files, ~4,100 lines) is replaced by one
document, and most of it is **gone**:

| Removed | Why |
|---|---|
| A1 formula authoring layer — tokenizer, stable-reference manifests, reserved aliases, display re-rendering | Existed only to make cell-to-cell references safe under axis moves. There are no cell-to-cell references |
| Calculation planning — dependency graph, dirty derivation, cycle detection | Same reason. Formula evaluates one expression at a time, as it does for Document |
| Range projection subsystem — spill matrices, collision arbitration | Rendering concern. A structured value settles and a client displays it |
| Multi-sheet workbooks, sheet-qualified references | One sheet per resource |
| Data cells with pinned/follow-head tracking | A `formula` cell over a project binding already is this |

**Styling is retained.** An intermediate revision also cut format regions,
conditional formatting, and validation; that was wrong. For knowledge work the
visual layer is not secondary, and format regions are specifically poorly
reversible — without them, styling a block means materializing thousands of
Cell records solely to hold a fill colour, which defeats sparseness and creates
data that is painful to migrate later.

What survives is a sheet, sparse typed cells, stable axes, merges, a print
layout, a style registry with layered resolution (default style → axis → format
regions → cell → conditional formats), live-computed validation, and an overlay
canvas.

**Cell kinds mirror Formula's value kinds**, and the literal-or-formula split is
the one Structured Data already uses. That is the reuse: no new value system, no
second formula engine.

## Settled architecture

- Layered shape; **Document as it exists now is the reference**, not its design
  doc. Read `3-capabilities/document/` before starting.
- One public import `#spreadsheet`; `POST /spreadsheet/command` (serial),
  `POST /spreadsheet/query` (concurrent).
- Strict `wire/` decoders with `exactKeys`.
- `./data/spreadsheet.db`, project-hashed prefix, Base + append-only ChangeSets.
- Freeze → compute → settle for formula settlement and Prompt cells — two
  attempt families, not four.
- Activity via local transactional outbox carrying the command `origin`.
- **No Structured Data and no Activity runtime dependency.** Structured Data
  reaches Spreadsheet only as project bindings through the Formula resolver.

## Files

```text
apps/backend/src/3-capabilities/spreadsheet/
  index.ts
  domain/    model.ts canonical.ts errors.ts grid.ts identities.ts
             inverses.ts rebase.ts reducer.ts validation.ts
  application/  createService.ts spreadsheetService.ts
  ports/     spreadsheetStore.ts derivedOutputs.ts formulaResolver.ts
             activityPublisher.ts
  persistence/  sqliteSchema.ts sqliteSpreadsheetStore.ts sqliteMappers.ts
  projections/  dependencies.ts plainText.ts styling.ts
  wire/      commandSchemas.ts operationSchemas.ts querySchemas.ts valueSchemas.ts
  docs/      (six standard files)

apps/backend/src/4-job-wiring/spreadsheet/
  registerSpreadsheetEndpoints.ts createSpreadsheetJobs.ts
  registerSpreadsheetInternalJobs.ts spreadsheetJobPayloads.ts

apps/backend/src/1-init/create/spreadsheet.ts
apps/backend/test/capabilities/spreadsheet-{domain,wire,persistence,application}.test.ts
```

Gone from the old file architecture: `formulaAuthoring.ts`, `calculation.ts`,
`projection.ts`, and `projections/grid.ts`.

## Phase 1 — Pure domain

`domain/model.ts`: `SpreadsheetHead`, `SpreadsheetSnapshot` (sheetLayout,
styles, rowOrder, columnOrder, rows, columns, cells, formatRegions,
conditionalFormats, validations, overlay), the closed `CellContent` union,
`CellRange`, `SpreadsheetStyleRegistry`, `CellStyleProperties`, `FormatRegion`,
`ConditionalFormatRule`, `PredicateSubject`, `ValidationRule`, `AllowedValues`,
`OverlayObject`, operations, history, attempts, intents.

Then:

- `grid.ts` — coordinate and span lookup over ordered axes; spans stored as
  start/end Row and Column IDs, never positions or copied membership. Also owns
  **range-set normalization**: merge overlapping and edge-adjacent ranges into
  the minimal cover and sort them, so two authorings of the same selection
  produce byte-identical canonical state and the same semantic digest. Every
  rule type runs its `ranges` through this on write, which is also what
  guarantees a cell never matches one rule twice.
- `canonical.ts`, `identities.ts`, `inverses.ts`, `rebase.ts`.
- `reducer.ts` and `validation.ts` covering the whole cell union except
  `prompt`, plus axis structure and merges.

`formula` cells are structurally valid from phase 1; their *settlement* arrives
in phase 6. A formula cell with no settlement is a legal pending state.

Gate: `spreadsheet-domain.test.ts`.

## Phase 2 — Styling

Kept separate because the overlay order is the part most likely to need
iteration, and it is self-contained:

```text
default style → column → row → format regions (in order)
              → cell style + overrides → conditional formats (in order)
```

Two pieces: the **style registry**, then the three **range-rule** types.

The registry mirrors Document's and Slides' — named styles, `basedOnStyleId`
inheritance, `Normal` protected — with one difference: a spreadsheet style
bundles both text and cell properties (fill, borders, alignment, wrap, number
format), because that is how cell formatting is chosen. There is one styleable
kind, so it carries a single `defaultStyleId` rather than a per-kind map. Cells,
axes, and format regions may reference a style by ID or carry local overrides.

All three rule types carry `ranges: CellRange[]` over stable axis IDs and run
through `grid.ts` normalization on write — one shape used three ways, which is
why building them together is much cheaper than separately. Later entries win.

- **Format regions** are pure data: ranges + `CellStyleProperties`.
- **Conditional formats** are ranges + a Formula **lambda** of exactly one
  argument returning logic, plus a style, plus an optional `PredicateSubject`
  saying what that argument is: the cell's value (default), or a list of values
  along one axis around it. No fixed predicate vocabulary to grow, and no cell
  references in formulas — the window is declared structurally and materialised
  by the projection.
- **Validations** are ranges + a `one-of` constraint whose `allowed` is either a
  Formula **expression** yielding a list, record, or table, or a set of **cell
  ranges** on this sheet. Not a lambda: a client must render a dropdown, and a
  predicate cannot be reversed into the permitted values.

Conditional formats and validations are **not** resolved in the reducer. This
phase stores and validates the rules and resolves only the static layers —
default style → column → row → format regions → cell. Keeping lambda evaluation
out of the reducer is what keeps reduction pure and replay exact; the live half
is phase 8.

Gate: static styling resolution and range-set normalization tests in
`spreadsheet-domain.test.ts`, including that two different authorings of one
selection produce the same digest.

## Phase 3 — Persistence and wire

`ports/spreadsheetStore.ts`, `persistence/`, `wire/`. Tables mirror Document:
`spreadsheets`, `bases`, `change_sets`, `command_receipts`, `create_receipts`,
`identity_ledger`, `attempts`, `stage_receipts`, `prompt_outputs`,
`activity_outbox`. `create_receipts` keyed on `request_id` with
`spreadsheet_id` for cascade only.

The wire layer owns **cell entry coercion**: a leading `=` is a `formula`,
numeric input is a `number`, `true`/`false` is `logic`, a recognised date
literal is a `date`, and anything else is `text`. A caller may instead send a
fully-formed `CellContent` to defeat coercion. Coercion lives here so the
domain only ever sees decided values and a stored ChangeSet never re-runs the
guess on replay.

Gates: `spreadsheet-persistence.test.ts`, `spreadsheet-wire.test.ts` — the
latter covering every coercion branch and the explicit-kind bypass.

## Phase 4 — Service and composition: first working slice

`createService.ts` allocating the ID and initial axes; `spreadsheetService.ts`
with `create`, `submit`, `compensate`, `delete`, and the read queries. Job
wiring, `1-init/create/spreadsheet.ts`, `startBackend`.

**End-to-end slice**: a styled sheet with sparse typed cells, merges, axis
edits, an overlay canvas, history, undo, and deletion. Formula cells can be
authored but do not yet settle.

Gate: `spreadsheet-application.test.ts` + smoke.

## Phase 5 — Overlay

Ships with phase 4 rather than later. It is a positioned list of typed objects
with `x`/`y`/`z` and an immutable General Files reference — insert, update,
move, reorder, delete. Listed separately only because it is independently
testable.

## Phase 6 — Formula settlement

Both paths, sharing one attempt family:

1. **Whole-cell `formula`** — the reducer reports cells whose `source` digest
   changed; the service creates one attempt per cell inside the mutation
   transaction, evaluates against a frozen resolver snapshot, and settles
   serially only if the cell still exists with the same source digest and
   nothing intervening touched it.
2. **Inline atoms in `text` cells** — Document's existing path, unchanged.

Needs `ports/formulaResolver.ts`. No dependency planning: each expression is
independent because nothing references another cell.

## Phase 7 — Prompt cells

Freeze → compute → settle, mirroring Document. One dedicated Derived Output per
Prompt cell; the cell stores only the `DerivedOutputRef` and `sheet.load`
resolves the text on read. Enables the `prompt` cell kind in validation. Needs
`ports/derivedOutputs.ts`.

**The one divergence from Document is the sparse target.** Document inserts a
Block into an existing Row; here the target coordinate may hold no Cell record.
So `prompt.create.request` carries a stable `{ rowId, columnId }` rather than a
cell ID, the attempt freezes that coordinate plus the CellId to materialise, and
settlement treats a deleted axis, a coordinate materialised in the meantime with
non-blank content, or a coordinate newly covered by a merged span as **stale**
rather than as an error — detaching the ownership row and leaving the cell
untouched. Refresh reuses Document's staleness test unchanged.

Worth writing the stale paths as tests first; they are the part most likely to
be got wrong and the hardest to notice when they are.

## Phase 8 — Projections, docs, hardening

`styling.ts` is the substantial one and is where conditional formats and
validations finally resolve. It backs a new query:

```ts
| { type: "sheet.formatting"; spreadsheetId: SpreadsheetId;
    revision?: number; viewport: CellRange[] }
```

**Defining a rule is a command; asking for formatting is a query.** The viewport
is itself a set of ranges — a client showing a frozen header plus a scrolled
body is looking at two discontiguous regions and should ask once — normalized
the same way rule ranges are.

For each cell in the viewport the projection layers matching conditional formats
over the static result from phase 2, evaluating each rule's lambda as
with one argument, resolved from the rule's `PredicateSubject`: the cell's value
for `{ kind: "cell" }`, or a list built along `axis` from current axis order for
`{ kind: "range" }`, clipped at the sheet edge. Validation runs the same walk:
resolve each `allowed` source — expression or cell ranges — and emit violations.

Work is proportional to the viewport, not to the rules' ranges, which is what
makes a lambda over a 10,000-cell range affordable. A lambda that fails to parse
or returns a non-logic value marks the rule broken and styles nothing; it never
fails the read.

Validity is computed here and **never stored**, so there is no invalidation
pass: if a source column changes, the next read simply reports different
violations.

Then `dependencies.ts`, `plainText.ts`, the six-file `docs/` package,
the `#spreadsheet` alias assertion.

## Verification

```bash
pnpm --filter @icarus/backend typecheck   # clean at baseline — any error is this work
pnpm --filter @icarus/backend test
```

Extend `http-smoke.mjs` from phase 4 onward.

## Deferred

Charts and sparklines as overlay kinds, further validation constraint kinds
(number range, date range, text length), write-time validation rejection,
multi-sheet resources, cross-resource references, copy/fill authoring, promoting
a range into Structured Data, and write-back through a bound cell.

Each is additive to a closed union or a new optional snapshot field, so adding
one later is: extend the union or field, add operations and exact inverses,
extend `validation.ts`, extend wire decoding. None forces a representation bump,
because an absent field reads as today's behaviour.

**Cell-to-cell references are deferred by decision, not omission.** Adding them
later needs an admission layer resolving references to stable axis IDs plus a
dependency walk. The model is compatible because spans are already stable-ID
based.

Rendering, thumbnails, rasterization, and export layout are outside the backend
boundary.
