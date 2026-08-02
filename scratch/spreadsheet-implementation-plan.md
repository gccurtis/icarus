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
| Named cell styles with inheritance | A sheet default plus format regions covers the same ground with far less machinery |
| Data cells with pinned/follow-head tracking | A `formula` cell over a project binding already is this |

**Styling is retained.** An intermediate revision also cut format regions,
conditional formatting, and validation; that was wrong. For knowledge work the
visual layer is not secondary, and format regions are specifically poorly
reversible — without them, styling a block means materializing thousands of
Cell records solely to hold a fill colour, which defeats sparseness and creates
data that is painful to migrate later.

What survives is a sheet, sparse typed cells, stable axes, merges, a print
layout, layered styling (sheet default → axis → format regions → cell →
conditional formats), advisory validation, and an overlay canvas.

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
cellStyle, rowOrder, columnOrder, rows, columns, cells, formatRegions,
conditionalFormats, validations, overlay), the closed `CellContent` union,
`FormatRegion`, `ConditionalFormatRule`, `ValidationRule`, `OverlayObject`,
operations, history, attempts, intents.

Then:

- `grid.ts` — coordinate and span lookup over ordered axes; spans stored as
  start/end Row and Column IDs, never positions or copied membership.
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
sheet cellStyle → column → row → format regions (in order)
               → cell.style → conditional formats (in order)
```

Format regions and conditional-format rules are both ordered lists of
stable-ID ranges; later entries win. CF predicates are a closed comparison
union over literal operands — no evaluation pass, so a rule is deterministic
from an immutable revision. Validation rules share the same ranged shape and
are **advisory**: stored and reported, never enforced against a write.

Doing these three together is much cheaper than separately — they are one
range-rule shape used three ways.

Gate: styling resolution tests in `spreadsheet-domain.test.ts`.

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
Prompt cell. Enables the `prompt` cell kind in validation. Needs
`ports/derivedOutputs.ts`.

## Phase 8 — Projections, docs, hardening

`dependencies.ts`, `plainText.ts`, `styling.ts`, the six-file `docs/` package,
the `#spreadsheet` alias assertion.

## Verification

```bash
pnpm --filter @icarus/backend typecheck   # clean at baseline — any error is this work
pnpm --filter @icarus/backend test
```

Extend `http-smoke.mjs` from phase 4 onward.

## Deferred

Named reusable cell styles with inheritance, charts and sparklines as overlay
kinds, formula-valued conditional predicates, hard validation enforcement,
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
