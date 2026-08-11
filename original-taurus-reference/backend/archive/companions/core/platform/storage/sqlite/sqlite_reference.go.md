# sqlite_reference.go

`sqlite_reference.go` is the durable reference graph: the SQLite implementation
of `reference.Store`. One table, `resource_references`, holds directed edges
between resources — a `(project, from_kind, from_id) → (to_kind, to_id)` link
with a `kind`, an `anchor` naming the block the link sits in, and an update
timestamp. Reading it forwards gives a document's outgoing links; reading it
backwards gives its backlinks. That is the whole capability's persistence: four
methods, one write and two reads over a single table.

The graph is a *derived projection* of document content, rebuilt after every
edit rather than mutated edge by edge. That shapes the write side: there is no
add-edge or remove-edge, only a whole-set replacement per source resource. Like
every file in this package these are methods on the one shared `*Store`; the
split mirrors `core/capability` and changes no behaviour.

## Code breakdown

### Package doc and imports

Notes that this file is the reference slice of the single Store. Imports are just
the `reference` capability (for `StoredEdge`) and `time` for parsing the stored
timestamp — no `database/sql` or `errors`, because nothing here does a
single-row lookup that has to distinguish "missing".

### ReplaceOutgoing: atomically swap a resource's outgoing edges for a new set

The only write. In one transaction it deletes every edge whose origin is
`(projectID, fromKind, fromID)` and inserts the supplied set. Replacement rather
than diffing is what makes re-indexing correct: after a document is edited, the
graph holds exactly the links the new content contains — links removed by the
edit disappear without anyone having to compute the difference. The transaction
(with its deferred rollback) means no reader sees the empty window between the
delete and the inserts, so a backlinks query never briefly reports that a
document links to nothing. Inserts use `INSERT OR REPLACE`, so a duplicate edge
within the incoming batch collapses onto the primary key instead of failing the
whole re-index.

### Outgoing: the edges that start at a resource

Selects by `(project_id, from_kind, from_id)`, ordered by `to_id, anchor` so the
result is stable across calls — the ordering is what keeps a rendered link list
from reshuffling between reads.

### Incoming: the edges that point at a resource, its backlinks

The mirror query, selecting by `(project_id, to_kind, to_id)` and ordered by
`from_id, anchor`. Both directions are covered by the same table because an edge
row records both endpoints; the difference between "links" and "backlinks" is
purely which pair of columns is matched.

### queryEdges: the shared row decoder

Both reads pass their SQL and args through this helper, which runs the query and
scans rows into `[]reference.StoredEdge`, parsing `updated_at` with the error
discarded (an unreadable timestamp yields the zero time rather than failing the
read). Keeping the scan in one place is what lets `Outgoing` and `Incoming` be
one-line queries whose only difference is the `WHERE` and `ORDER BY` clauses.
