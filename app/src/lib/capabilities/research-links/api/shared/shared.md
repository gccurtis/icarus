# Shared Research Link Procedures

Lives at `api/shared/shared.md`.

| File | Preserves |
| --- | --- |
| [`endpoint.ts`](endpoint.ts) | that `(kind, id)` names a row in the caller's project, and the label the log freezes in |
| [`as-link.ts`](as-link.ts) | that a stored row becomes a `ResearchLink` in one place, so `projectId` never leaves |

## `endpointIn`

`link` and `unlink` both resolve an end, and it is promoted rather than copied
because it holds the invariant spanning them: a kind names a table, and an id is
only that kind's id if it was minted for that table. `normalizeId` is what makes
the pair a key rather than two columns that happen to sit together.

**It returns `null` rather than throwing**, because the two callers want
different things from the same lookup. `link` refuses — *not found*, never
*forbidden* — to draw an edge to a row the caller cannot see. `unlink` only wants
a label, and must still work when the row is gone, which is exactly when a
dangling edge is being cleaned up.

The label is the object's own sentence — a finding's title, a hypothesis's
statement, a question's text — because the activity log freezes it in and has to
still read after that object is deleted.

## `asLink`

`bearers` and `subjects` return the same shape from opposite ends. Converting in
one place is what makes "a stored shape is converted at the boundary" true here:
`projectId` is dropped once, and `_creationTime` becomes `at` once.
