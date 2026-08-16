# Formula Types

Lives at `types/types.md`.

| File | Holds |
| --- | --- |
| [`evaluation.ts`](evaluation.ts) | `Evaluation` — what a computation produced — and `Cells` |
| [`expression.ts`](expression.ts) | `Expression`, the parsed tree; private to this capability |

## `FormulaValue` is content's, and is not redefined here

A value is [content's](../../content/types/value.ts), including the recursive
`table` member and the `v.any()` at its cells. Restating it here would give the
system two answers to the same question, and the one a block stores would be the
other one.

## An error is not a value

`Evaluation` is `fresh` with a value or `error` with a message, in the shape a
formula block records. Making failure a `FormulaValue` kind would put a re-check
in every consumer of a value, forever.

## `Cells` is supplied, never read

A formula does not know what holds it — a sheet cell, a paragraph, a slide — so
the values around it come from the caller. Reading a sheet here would tie
evaluation to one resource type and to the revision machinery underneath it. An
address absent from the map is blank, which is a value.

## `Expression` is private

Nothing stores a parsed tree: what is stored is the text an author wrote and the
value it last produced. Re-parsing is cheap, and a stored tree is a second
representation to keep in step with the text.
