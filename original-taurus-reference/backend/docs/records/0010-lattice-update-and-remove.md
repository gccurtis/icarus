# 0010 — lattice source update (smart re-embed) + remove

This completes the knowledge lattice's source lifecycle. Retrieval, and add,
already existed ([0008](0008-knowledge-lattice-and-dev-convention.md),
[0009](0009-klr-lattice-correction.md)); this record adds **remove**, and makes
the existing **update** path (re-adding an origin) cost-smart. With add /
update / remove / retrieve all present, the lattice is a fully managed store.

## Update is Add — now with embedding reuse

We kept the original shape: `Add` is the single create-or-update. Re-adding an
existing origin already replaced its data and preserved `AddedAt`; what changed
is *what it costs*. It used to re-embed every window on every re-add. Now it
**reuses the stored embedding of every window whose text is unchanged and embeds
only what actually changed** — the optimal update, with no new operation and no
new API.

The mechanism is a content-diff, not a client-supplied range. On re-sync,
`embedWindows` builds a map of the previous windows' text → their stored
(already-normalized) vectors, keyed by slicing `prev.Text` with each old
window's byte range. Each new window whose text is in that map reuses the vector;
the rest are batched to the provider. `AddResult` now reports `{windows, reused,
embedded}`, and `usage` reflects only the embedded subset — so the saving is
visible and the cost is honest.

Because our windowing is sequential (greedy from the start), reuse is **exact
for appends and unchanged prefixes** and best-effort for edits high in a
document (an early insertion re-flows downstream window boundaries, so those
windows' text changes and they re-embed). This is the common editing pattern, so
the win is real: re-adding an unchanged document embeds **nothing**
(`reused: N, embedded: 0, usage: 0`, confirmed live). Making mid-document edits
cheap too is a windowing change (content-defined chunking), deliberately not in
this slice; a client-supplied changed-range endpoint is also deferred, because
it buys no embedding-cost benefit over the content-diff until chunk boundaries
are edit-stable.

### Vector-identity safety

Reuse assumes the embedding space is stable. If a re-sync's embed call reveals a
**different identity** than the source was stored under (the model was
re-routed), the reused vectors are from the old space and must not be mixed —
so everything is re-embedded under the new identity and the source is re-stamped.
One honest edge: re-adding **byte-identical** text under a changed model reuses
everything and never calls the embedder, so the change goes unobserved and the
source stays in the old space (retrieval then 409s under the new model). The
recovery is **remove + add** (now supported) or any real edit; the mismatch
message says so. Keeping a no-op re-add free was the deliberate trade.

## Remove

New `Remove(projectID, sourceType, sourceID)` deletes a source's snapshot,
windows, nodes and membership edges and rebuilds the corpus tier from the
remaining frontier — in **one write transaction**, the same atomicity
`ReplaceSource` gives (the shared corpus-rebuild step was factored into a
`rebuildCorpus{Tx,Locked}` helper in both stores). Removing an origin that was
never added is a no-op reporting `Removed=false`. Removing the last source
empties the lattice.

The store port gained two methods: `DeleteSource(origin, rebuildCorpus)` and
`SourceWindows(localRefID)` (the old windows the reuse diff reads). Both the
SQLite and in-memory stores implement them.

## Endpoints

The `/dev/knowledge/documents/:id` surface is now:

| Method | Operation | Result |
| --- | --- | --- |
| `POST` | add or smart-update | `201` with `{windows, reused, embedded, usage, ...}` |
| `DELETE` | remove | `200 {removed:true}`, or `404` if never indexed |

`RemoveDocument` deliberately does **not** load the document — a document that
was deleted is a *reason* to remove it from the lattice, not a blocker — so it
removes by id directly. Auto-removing a source when its document is deleted (and
auto-syncing on document change) is left as a future document→knowledge
integration; for now these are manual `/dev` calls, mirroring add.

## Tests

Unit: Remove deletes a source, rebuilds the corpus, and makes it unretrievable
while the other source survives; removing the last source empties the lattice;
removing an unknown origin reports `Removed=false`. A counting embedder proves an
append reuses the unchanged windows and embeds only the tail, and a byte-identical
re-add embeds nothing (zero usage); an edit under a changed model re-embeds all
and re-stamps the identity; the identity-mismatch recovery is remove + add. Store
tests cover `DeleteSource` (real vs unknown origin) round-trips. The live
`dev-test/knowledge` suite adds a reuse assertion (`embedded:0` on an unchanged
re-add) and a remove-then-unretrievable + 404 flow.

## Completion boundary

The lattice now supports the full source lifecycle — add, update (smart
re-embed), remove, retrieve. Still deliberately out of scope: content-defined
chunking (for cheap mid-document-edit reuse), a client-supplied changed-range
update endpoint, automatic document→knowledge sync on change/delete, and any
generation build/verify/promote machinery.
