# Content Types

Lives at `types/types.md`.

`types/` holds the canonical model. This capability stores nothing, so there are
no row shapes here; a block is an embedded value in whatever owns it.

Written validator-first — `v.union(…)` then `Infer<typeof …>` — because the
validator is what Convex enforces at the door and the type is generated from it.

## Files

| File | Holds |
| --- | --- |
| [`block.ts`](block.ts) | `TextAtom`, `Mark`, `ContentBlock` and its six variants |
| [`format.ts`](format.ts) | `BlockFormat` |
| [`value.ts`](value.ts) | `DateValue`, `FormulaColumn`, `FormulaValue` |

## Where the validator and the type disagree

**Two places, and a reader of the validator alone would conclude the type is
wrong.** They are the same problem with the same answer, applied twice rather
than solved twice.

**A Convex validator is a *value*, not a type, so it cannot refer to itself.**
Where a shape is genuinely recursive the validator gives up and the TypeScript
type stays honest.

| | Validator says | Type says |
| --- | --- | --- |
| `TableCell.blocks` | `v.array(v.any())` | `ContentBlock[]` |
| `FormulaValue`'s table rows | `v.array(v.array(v.any()))` | `FormulaValue[][]` |

So the `table` member of each is written **twice** — once inferred, once by hand —
and that duplication is the visible cost of the compromise.

**`v.any()` at the cell rather than JSON for the whole value.** The
[`settings`](../../settings/schema.ts) precedent encodes its value as JSON text,
and that was rejected here: the outer `kind` discriminant *is* read server-side,
and JSON text protects nothing that has to be read anyway. Keeping `v.any()` at
the cell means everything outside a cell is still checked at the door, a reader
can still branch on `kind`, and the day a recursive validator exists this tightens
with nothing to migrate.

**Accepted cost:** a malformed *nested* cell is storable, so a renderer of one
must be defensive.

**The recursion is bounded by the owner**, not by the type. No surface that
accepts a table accepts one nested in a cell. That is convention rather than
enforcement, and it was chosen over a narrower explicit union deliberately.

## A formula atom and a formula block are different things

Kept apart on purpose. A **block** has a typed `value` other formulas depend on
and either computes or errors. An **atom** produces a string span, and the
sentence around it still renders when it fails — which is why an atom carries its
own `resolved` and `state`, so `display` can be rebuilt without re-evaluating
anything.

Both hold a `formulaId` and neither holds an expression.

## A prompt block *is* a text block

Same `atoms`, same `display`, same `marks`. Splitting it out would mean a second
text editor with its own offsets to reconcile forever.

The prompt itself is not here — it lives on the derived output, because a copy
would be two prompts that can disagree. `scope` *is* here, because it is part of
what the author specified and has to survive being read back into the editor.
