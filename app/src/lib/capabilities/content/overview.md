# Content

The one content primitive. Anything a person authors or an agent produces is a
list of `ContentBlock`, embedded in whatever owns them.

## It has no public surface, and no table

No `api/`, no `schema.ts`, no deployment door. **Blocks are embedded values
inside the object holding them — there is no `blocks` table and there never will
be.**

They do carry ids, and those are not Convex ids: they are short strings unique
within one resource, from **one flat space per resource**, used to address a
block inside a body stored as a whole. Flat rather than nested, so a block moved
between rows keeps its identity. An id is not a row.

## The boundary

Content owns the shape of authored material and nothing about where it lives.

**No owner accepts all six variants.** A comment takes text and image; a
derived output produces exactly one. The *owner* enforces its own subset — which
is what keeps this union single rather than one per surface, and what bounds the
recursion a table cell would otherwise open.

A spreadsheet cell is not on that list at all. A cell is one value rather than
prose with formula spans in it, so it takes `Mark` and `BlockFormat` directly and
has neither atoms nor a display string.

Content deliberately does not own:

- **Rows.** A divider and a page break hold no content, take no marks, and cannot
  be searched, so they are row kinds belonging to a resource rather than blocks.
  Content and structure split there.
- **Evaluation.** A formula atom and a formula block carry the expression an
  author wrote and the row that evaluates it, plus whatever that row last
  produced. What the expression *means* is `formulas`' business, and nothing here
  resolves one.
- **Anything an id points at.** A `formulaId`, a `fileId`, a `derivedOutputId`
  and a `personaId` are real table ids, and nothing in this capability reads the
  rows behind them.

## Files

| File | Holds |
| --- | --- |
| [`types/block.ts`](types/block.ts) | `Atom`, `Mark`, `MarkLink`, `ContentBlock` and its six variants |
| [`types/format.ts`](types/format.ts) | `BlockFormat` — a block's own box |
| [`types/value.ts`](types/value.ts) | `DateValue`, `FormulaColumn`, `FormulaValue` |

## Dependency Ports

| Capability | Usage |
| --- | --- |
| [`$shared`](../shared/overview.md) | `Actor` and `ResourceRef` for a mark's link; `ResourceSelection` for a prompt block's scope |

## The union ships whole

All six variants exist at once. `prompt` names a `derivedOutputs` table and
`analytic` names an `analyses` table. Every table is declared in one
`defineSchema` and Convex allows reference cycles, so no variant waits on another
capability landing — and a later pass wires up behaviour behind a variant that
has been there all along rather than widening a union every capability imports.

## Capability Invariants

Two of these are upheld by code that does not exist yet. They are stated here
because a future change breaks them silently.

- **`display` is the atoms' text in order** — each literal's `text`, each
  formula's `lastResolvedDisplay`, concatenated, and nothing else. Upheld by
  whatever applies ops. If it breaks, marks index a string that no longer matches
  its atoms and the wrong text runs bold.
- **A marked span points at one thing.** A URL, an actor, a persona, or a
  resource — arms of one field rather than several, so there is no mark that is
  both a link and a mention.
- **Marks are UTF-16 offsets into `display`, never into `atoms`.** Someone who
  bolds `$4.2M` bolded five characters of what they saw, not the nineteen behind
  them. This is the load-bearing decision in the whole content model.
- **A block holds no newlines.** Enter ends a block and starts another, which is
  what keeps mark offsets tractable: one display string, one coordinate space.
- **Ids are unique within a resource.** Upheld by whoever mints them. If it
  breaks, a path resolves to two things.
