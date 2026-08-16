# Formula API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`evaluate/`](evaluate/evaluate.md) | `evaluate` | query — what an expression is worth |

## One function, and no `shared/`

Nothing is promoted, because nothing has a second caller. Each procedure sits
under the one that calls it: `parse` and `reduce` are `evaluate`'s steps, and
`arithmetic` and `builtins` are `reduce`'s, in a directory of its own. When a
second public function needs one — a batch recalculation, say — that is when it
moves.

## It is a query, and writes nothing

Evaluating changes no row. A caller that wants the result *stored* writes it onto
the block through `revisions.submit`, where it is an edit like any other and an
undo reaches it.
