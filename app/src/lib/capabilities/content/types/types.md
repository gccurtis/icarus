# Content Types

Lives at `types/types.md`.

The whole of this capability. Nothing here is a stored row shape, because nothing
here is a row: a block is embedded in whatever owns it.

| File | Holds |
| --- | --- |
| [`block.ts`](block.ts) | `blockValidator`, the text and formula variants, `textAtomValidator`, `markValidator` |
| [`format.ts`](format.ts) | `blockFormatValidator` — the block's own box, on every variant |
| [`value.ts`](value.ts) | `formulaValueValidator`, `dateValueValidator`, and the `FormulaValue` type |

Three files rather than one because they are read at different times: a renderer
opens `format.ts`, a resolver opens `value.ts`, and only an editor needs
`block.ts`. Each validator is the source and its type is inferred from it — with
one exception, below.

## A `FormulaValue` is recursive and a validator is not

A formula can return a table, and a cell of that table can be a table. The
recursion is real: a grouped aggregate returns exactly that. But a Convex
validator is a **value**, not a type, so `formulaValueValidator` cannot refer to
itself while it is being built. There is no recursive validator to write.

Three ways out were on the table.

| | What it costs |
| --- | --- |
| **Bound the recursion at a fixed depth** | The definition is written N times, and a legitimate value one level deeper is refused at the door with nothing the author can do about it. N is a guess. |
| **Encode the value as JSON text** | What [settings](../../settings/schema.ts) does, for a reason that does not hold here: a setting's value is opaque to the server *and* has an author-controlled key space. A formula value's keys are ours, and `kind` is read server-side by anything resolving a dependency. Encoding it hides the part we can check along with the part we cannot, and unwinding it later means rewriting every stored block. |
| **`v.any()` at the cell** | A malformed nested cell is stored, so a renderer of one is defensive. |

**The cell is `v.any()`.** Everything outside a cell — the `kind` discriminant,
`columns`, the fact that rows are rows — is still checked at the door, and the
stored bytes are the honest shape, so the day a recursive validator exists this
tightens with nothing to migrate. The other two both store something other than
what the model says, which is the cost that does not go away.

`FormulaValue` is therefore hand-written for its `table` member and inferred for
the other five. That one member is the only fact stated twice in this capability,
and it is stated twice because the validator cannot state it once. `FormulaBlock`
overrides its `value` for the same reason: the inferred type would say `any` and
the model does not.
