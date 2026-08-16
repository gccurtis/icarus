# Comments Types

Lives at `types/types.md`.

| File | Holds |
| --- | --- |
| [`anchor.ts`](anchor.ts) | `commentAnchorValidator`, `anchorWithinValidator`, `commentTargetValidator`, and `commentAnchor` |
| [`comment.ts`](comment.ts) | `Thread`, `Comment`, and `commentBody` |

## The legality table is here rather than in `api/`

Which `within` a target may hold is a statement about what an anchor *is*, not a
step in a procedure — the same reason `documents` keeps `documentTitle` in
`types/`. It sits beside the validator it completes: the validator proves the
shape, and `commentAnchor` proves the pairing, which is a constraint between two
fields and therefore not expressible in a validator at all.

Getting it wrong is silent rather than loud. A cell anchor on a document names a
sheet nothing in a document has, so no surface would ever render the thread — the
remark is lost without anything failing.

## `targetId` is a string and not a `v.id`

Seven target tables, three of which arrive in pass 4. A union of id types would
make every reader choose between them to render one list, and an anchor does not
need the tables to exist: it is a kind and an id.

The three general resources are the exception, and only because they have a body
to resolve against — [`resolveAnchor`](../api/start/start.md) checks the id it
names is still there.

## `Thread` carries its comments and the row does not

A thread without its replies renders nothing: the anchor and the resolved state
are not what anybody reads. So the read form is a join the storage deliberately
does not make, and `projectId` stops at the boundary — every thread returned is
from the project that was asked about.

`Comment.at` is the row's `_creationTime`. A comment stores no time of its own,
because the one thing it could say is when it was written.
