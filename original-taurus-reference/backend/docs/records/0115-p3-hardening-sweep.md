# 0115 — P3 hardening sweep (defence-in-depth, efficiency, coherence)

Clears the remaining minor items from the architecture review
([`issues-and-gaps.md`](../architecture/issues-and-gaps.md)). Each is small on its
own; together they close the gap between "safe because every caller remembers"
and "safe by construction." Every behavioural change was written test-first.

The one architectural decision in this batch, `COH-1`, has its own record:
[0114](0114-agent-composition-tier.md).

## Defence-in-depth

### DEF-1 — the storage layer now scopes file reads by project

`(*Store).Content(id)` returned raw bytes with **no project label**, so it could
not self-verify. It was safe only because its single caller loaded metadata first
and compared `ProjectID`. A second caller — or a moment's inattention in the
existing one — would have leaked another project's bytes with nothing to stop it.

The file `Store` port now takes the project on both by-id reads:

```go
Meta(projectID, id string) (File, error)
Content(projectID, id string) ([]byte, error)
```

with `WHERE id = ? AND project_id = ?` in SQL. The boundary is now enforced by
the query rather than by caller discipline, which is the whole point of
defence-in-depth: the project boundary is this product's core privacy property
and should not rest on a convention.

`Meta` was scoped alongside `Content` because it was equally unscoped and equally
cheap to fix — one extra predicate on an already-indexed primary-key lookup —
and doing one and not the other would have left the same trap. `Download` now
passes `meta.ProjectID` (a value that came out of the database) rather than
`scope.ProjectID` into `Content`, and the capability's own
`meta.ProjectID != scope.ProjectID` check stays in place, deliberately redundant
with the new `WHERE`. Two independent layers; neither load-bearing alone.

Test-first: `TestStoreReadsAreProjectScoped` (`core/capability/file`) and
`TestFileReadsAreProjectScoped` (`sqlite`) — a foreign project id gets
`ErrNotFound` from both reads while the owning project still gets its bytes.

### DEF-3 — one `CanWrite`, not nine

The write-permission predicate was copy-defined in **nine** places: eight handler
packages plus transport. All nine were verified byte-identical
(`role == RoleOwner || role == RoleEdit`) before anything was touched, so no
behaviour changed. It now lives once, on the type it describes:

```go
func (r Role) CanWrite() bool { return r == RoleOwner || r == RoleEdit }
```

and all 38 call sites read `ctx.Role.CanWrite()`. This was never a bug — the
copies agreed. It was a latent one: a future role change had nine places to
remember, and a single miss would be a silent authorization gap.

### DEF-4 — the late-binding wiring cycles no longer fail silently

Two genuine construction cycles are broken by late binding (document ↔ reference,
document ↔ contexts). The reference half was the dangerous one: `Run` hands the
document service an empty `lazyReferenceIndexer` and back-patches it later, and
until now an unwired indexer **returned nil**. A document saved in that window
would have dropped its links with no error, no log, and no trace — and because
the caller also discards the error (`_ =`, deliberately, so a reindex failure
cannot fail a save), the loss was doubly invisible.

It now reports unwired use as an error instead of silently succeeding. Nothing
calls it in that window today — `Run` completes wiring before the listener starts
— so this is a guard against future reordering, not a live bug.

### DEF-2 — considered, deliberately not built

CSRF defence rests on `SameSite=Lax` plus non-GET mutations. Adding anti-CSRF
tokens is a real second layer, but it changes the request contract and the client
lives in a **separate repository** (the SvelteKit cockpit). Unilaterally
requiring a token here would break it. Left open in the register as a decision
for whoever owns both sides.

## Efficiency

### PERF-2 — a redundant index and an N+1

Two indexes covered the identical columns `(document_id, seq)`:
`idx_change_sets_doc_seq` (non-unique) and `idx_change_sets_doc_revision`
(unique). Equivalence was verified against a live database
(`pragma_index_xinfo`) before anything was removed — same key columns, same
order, neither partial, differing only in uniqueness — and no query pins an
index by name with `INDEXED BY`. The unique one therefore serves every read the
other did, so the non-unique index was pure write-amplification on the hottest
insert path in the system. It is removed, with a `DROP INDEX IF EXISTS` so
existing databases shed it too — the idiom that fits this schema's declarative,
additive, applied-on-every-open model.

Comment listing hydrated each comment individually, firing a replies query per
comment — a textbook N+1 on a thread page. The comment `Store` gained a batched
`RepliesByComments`, so listing a document's comments costs one replies query
instead of N. `hydrate` split into `hydrate` (load one thread, then finish) and
`hydrateWith` (finish an already-loaded thread), which is what lets `List` feed
comments from its batch while both paths complete a comment through identical
code — the batched result cannot drift from the single-comment one. The
per-comment `AnchorInProject` call stays: it crosses the `AnchorReader` port into
the document capability, so batching it is a port reshape with its own
justification, not part of this fix.

The whole-`base` re-serialize on rebase was left alone: it is inherent to the
fold model, not an oversight.

Test-first: `TestRedundantChangeSetIndexDropped` (a fresh database does not
create the index, and one that already has it sheds it on reopen while the unique
index survives), `TestRepliesByCommentsBatchesThreads` (the batched map matches
per-comment loads reply for reply), and `TestListBatchesReplyLoads` (listing makes
exactly one batched load and zero per-comment loads, and every hydrated comment
equals what `Get` returns). The existing `TestHydratePropagatesStoreError` was
extended to fail the batched method too, so a reply-store failure still surfaces
from `List` rather than becoming a silently empty thread.

### PERF-3 — trash purge moved off the boot path, and made recurring

`Run` called `docs.PurgeStale()` synchronously during composition. That delayed
readiness by however long the sweep took — but the larger problem only shows up
in a long-lived process: it ran **exactly once, ever**. Trash accumulated for the
rest of the process's life no matter how much built up.

It is now `runTrashPurge` in
[`core/wiring/document_purge.go`](../../core/wiring/document_purge.go): one sweep
at startup, then hourly, bound to `jobCtx` so it stops with the job pool, the
task reaper, and the connector detector. Failures are logged, never fatal; the
next tick retries.

## Privacy

### PRIV-3 — emails are redacted from request logs

The request logger recursively redacted password/token/secret/authorization/
api_key but **not `email`**, so register, login, and member-list bodies were
written to the log in full. `email` joins the redaction set and inherits the same
case-insensitive recursive walk.

The other half of PRIV-3 — `GET /jobs/:jobID` being authorized by possession of
the (unguessable) job id rather than by ownership — remains open in the register.

## File organization

### ORG-2 — the tree is `gofmt`-clean, and stays that way

Four files had standing formatting drift, all predating this review. They are
formatted, and `scripts/check-format.sh` now asserts the tree is clean. That
matters less for the four files than for the signal: while `gofmt -l` had known
output, a *real* formatting mistake was invisible in the noise. AGENTS.md now
lists both checks — companions and formatting — alongside build and test.
