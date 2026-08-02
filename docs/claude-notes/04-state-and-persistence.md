# 04 · State, Persistence, and Concurrency

## Three kinds of state

From `docs/runtime/backend-map.md`, and consistently observed in the code:

- **Canonical state** — the minimum durable state needed to reproduce an accepted revision.
- **Operational state** — durable attempts, stage receipts, outbox rows, sync flags. Needed
  for recovery, not for reconstructing content.
- **Derived index** — rebuildable acceleration/presentation (Knowledge lattice nodes, Formula
  dependency maps, outlines, styling). *Never* an authority.

Document's schema shows all three in one file: `documents`/`bases`/`change_sets` are
canonical; `attempts`/`stage_receipts`/`activity_outbox`/`delegated_command_claims`/
`prompt_outputs`/`identity_ledger` are operational; the projections are in-memory only.

## Revision models

Six distinct models coexist. Knowing which one a capability uses tells you how to change it.

| Model | Used by | Law |
| --- | --- | --- |
| Pure deterministic service | Formula, Rich Text | Same input + snapshot + limits ⇒ same result. No state. |
| Atomic revisioned record | Context, Structured Data, General Files, Connector | Stable ID, monotone `revision`, single-row compare-and-swap |
| Base + ChangeSets | Document, Slide | Materialised `Base` + append-only accepted changes reconstructs any retained revision |
| Generation + derived index | Knowledge | Canonical source windows; retrieval structures rebuildable |
| Durable attempt + settlement | Document prompts/formulas, Derived Outputs refresh | Freeze serially → compute concurrently → CAS on settle |
| Append-only fact stream + TTL lease | Activity (transactions) / Presence (leases) | Facts immutable and sequenced; leases expire and never become history |

### Base + ChangeSets in practice

`DocumentService.loadSnapshot(documentId, revision?)`:

```text
head            = store.getHead(documentId)
base            = store.getBaseAtOrBefore(documentId, target)
snapshot        = structuredClone(base.snapshot)
for changeSet in store.getChangeSets(documentId, base.baseSeq, target):
    assert changeSet.revision === expected     // else HistoryPrunedError
    snapshot = applyWithoutValidation(snapshot, changeSet.operations, richText)
validateSnapshot(snapshot, richText, limits)   // else DocumentValidationError
```

Note the two different reducer entry points: `applyOperations` (validates, produces forward +
inverse + touchedIds) is used when *accepting* a mutation; `applyWithoutValidation` is used
when *replaying* already-accepted history. Replaying validated history through validation
again would be wasted work, but the reconstructed snapshot is validated once at the end.

`compact(documentId)` appends a new `Base` at the retention cutoff (and at head), then prunes.
The schema enforces `base_seq <= revision`, and `appendBaseIfHead` is conditional on the head
revision so a concurrent mutation cannot be compacted over.

### Optimistic concurrency: three flavours

**1 · Single-row CAS in SQL** — Structured Data, Context, Connector:

```ts
update(entry: DataEntry, expectedRevision: number): boolean;   // false ⇒ conflict
softDelete(id, expectedRevision, deletedAt): boolean;
```

The service maps `false` to `StaleDataRevisionError` → HTTP 409. This is why these endpoints
can safely live on the **concurrent** queue.

**2 · Multi-statement transactional commit** — Document/Slide:

`commitMutation(commit): Promise<boolean>` takes head + changeSet + receipt + fact +
identity transitions + attempts + prompt-ownership transitions and commits them **together**,
conditional on `expectedRevision`. `false` ⇒ `RevisionConflictError`. Combined with the
serial queue, this makes the read-modify-write safe.

**3 · Rebase admission by touched IDs** — Document/Slide only:

```ts
// domain/rebase.ts
export const canRebase = (touchedIds: string[], intervening: DocumentChangeSet[]): RebaseDecision
```

If a client submits against an older revision, the service loads the snapshot **at the
authored revision**, computes which IDs the operations touch, and compares against the
`touchedIds` of every intervening ChangeSet. Disjoint ⇒ accept (applied against *current*
head). Overlapping ⇒ `RevisionConflictError`. This is not operational transformation — no
operation is rewritten; it is a set-disjointness admission test.

The same function gates undo/redo: `compensate()` requires that the target ChangeSet's
`touchedIds` do not collide with anything since, and additionally requires that the
intervening history is *contiguous and unpruned*, else `CompensationConflictError`.

## Idempotency

Idempotency is pervasive and takes three forms.

**Request receipts** (Document, Slide) — `(document_id, request_id)` primary key storing
`request_digest` + the original `result_json`:

```ts
const prior = await store.getSubmission(documentId, requestId);
if (prior) return replayReceipt(prior.requestDigest, digest, requestId, prior.result);
// replayReceipt throws IdempotencyMismatchError if digests differ
```

So a retry with the same body replays the original response; a *different* body under the
same request ID is a 409. `canonicalDigest` (sorted keys, `undefined` dropped, SHA-256) makes
the comparison stable across key ordering.

**Idempotency keys** (Derived Outputs) — callers supply namespaced keys and the store has
`claimDeclaration` / `claimRefresh` / `claimDefinitionUpdate`, each returning
`{ requestDigest, result?, created }`. Document generates them deterministically from attempt
IDs, e.g. `` `document:prompt-create:${attempt.id}` `` and
`` `document:prompt-create:${attempt.id}:refresh` ``.

**Delegated command claims** — the subtlest one. `prompt.update-definition` mutates state in
*another* capability (Derived Outputs). Document writes a durable claim row **before** the
external call, freezing the target output ID:

```ts
/**
 * Durable local half of a command delegated to another capability store.
 * The target is frozen before the external side effect starts so an exact
 * retry never retargets after the canonical Document changes.
 */
interface DocumentDelegatedCommandClaim {
  documentId; requestId; requestDigest;
  kind: "prompt.update-definition";
  targetOutputId;                       // frozen
  state: "pending" | "completed";
}
```

Without this, a retry after the Prompt Block was re-pointed would update the *wrong* Derived
Output. `assertDelegatedRequestReuse()` runs at the top of *every* command, so reusing that
request ID for a different command type is caught too.

**Reserved request-ID namespace.** Internal settlements mint request IDs prefixed
`$document-internal$:`, and `command()` rejects any external request whose ID starts with
that prefix. External callers cannot forge an internal settlement.

## SQLite conventions

Every capability opens its own database file. There is no shared connection or migration
runner — a fact the Database docs state explicitly.

| File | Owner |
| --- | --- |
| `data/documents.db` | Document |
| `data/slides.db` | Slide (never created — capability can't boot) |
| `data/activity.db` | Activity (not yet created on disk) |
| `data/knowledge.db` | Knowledge platform (`0-platform/database/knowledge-store.ts`) |
| `data/structured-data.db` | Structured Data |
| `data/contexts.db` | Context (single project-scoped table; no user scope) |
| `data/derived-outputs.db` | Derived Outputs |
| `data/general-files.db` | General Files |
| `data/connector.db` | Connector |

(`data/` also contains `structured-data-project.db` and `structured-data-user.db` — leftovers
from an earlier split-scope arrangement, not referenced by any current code path.)

### Project scoping via hashed table prefixes

Rather than a `project_id` column, table *names* are derived from the project:

```ts
const projectPrefix = (projectId: string): string =>
  createHash("sha256").update(projectId).digest("hex").slice(0, 16);

const root = `doc_${projectPrefix(projectId)}`;
// → doc_<16 hex>_documents, _bases, _change_sets, _attempts, …
```

Used by Document, Slide, Activity, Knowledge, Structured Data, Connector, General Files,
Derived Outputs. `runtime-scope.md` states the invariants: scope values never become table
names without deterministic hashing and a fixed prefix; **public requests cannot select a
project, actor, database, or table**; the same config always yields the same table names.

The store constructor takes `projectId` and exposes no project argument on any method — the
`KnowledgeStore` port comment says so explicitly: *"All operations are already scoped to one
project — the store implementation derives its table names from the projectId and exposes no
projectId argument anywhere in this interface."*

### Standard pragmas

Every schema initialiser opens with the same four:

```ts
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
db.pragma("synchronous = NORMAL");
```

### Constraints do real work

Document's DDL is the model. Invariants are enforced by the database, not only by TypeScript:

```sql
CHECK (base_seq <= revision)
CHECK (seq = revision)
CHECK (revision = prior_revision + 1)
CHECK (lifecycle IN ('active','archived','trashed'))
CHECK ((state='active' AND tombstoned_revision IS NULL)
    OR (state='tombstoned' AND tombstoned_revision IS NOT NULL))
CHECK (state != 'attached' OR attached_revision IS NOT NULL)
UNIQUE (document_id, seq)
UNIQUE (document_id, revision)
UNIQUE (document_id, block_id)                                 -- prompt_outputs
CREATE UNIQUE INDEX … ON attempts(document_id, block_id) WHERE kind = 'prompt-create'
CREATE INDEX … ON activity_outbox(occurred_at, fact_id) WHERE published_at IS NULL
```

Partial indexes are used for work queues (unpublished facts, detached prompt outputs, pending
claims). JSON payloads are stored as `BLOB` with canonical encoding.

### Migrations are ad-hoc but idempotent

There is no migration framework. Each schema file does `CREATE TABLE IF NOT EXISTS` plus,
where needed, hand-written forward migrations. Document's
`migrateActivityOutbox()` is the worked example: `hasColumn()` via `PRAGMA table_info`,
`addColumnIfMissing()`, then `UPDATE … WHERE col IS NULL` backfills.

That migration encodes a real architectural lesson, and the comment says it:

```text
-- This historical link may be cleared by ChangeSet compaction.
change_set_id     TEXT,
-- This copied source value must survive history compaction.
source_change_set_id TEXT,
```

The outbox originally FK'd to `change_sets`. Compaction deletes ChangeSets, which
`ON DELETE SET NULL`-ed the link and left outbox rows incomplete before Activity had consumed
them. The fix was to **copy** the source identifiers into the outbox row so it is
self-contained.

## Identity non-reuse

Document and Slide maintain an `identity_ledger` recording every structural ID (style, row,
block, list, list-item, table, table-row/column/cell/merge, rich-text-atom, rich-text-mark)
with `active | tombstoned` state and the revisions of its transitions.

`collectDocumentIdentities(snapshot)` walks the whole aggregate; `computeDocumentIdentityTransitions(before, after)`
diffs two snapshots into `{ added, removed }`. Each commit declares a reactivation policy:

```ts
identityReactivation: input.compensation ? "same-kind-compensation" : "forbid"
```

Normal mutations may not resurrect a tombstoned ID (`DocumentIdentityReuseError` → 400
`identity_reuse`). Undo/redo may, but only as the **same kind** — the error message
distinguishes the two cases. External references (Derived Output IDs, media file IDs) are
deliberately excluded from the ledger; the comment says so.

## History retention

`config.document.history` — `retainedBaseCount: 5`, `retainedChangeSetCount: 1000`,
`retainedTerminalAttemptCount: 1000`. When `head.revision - head.baseSeq >=
retainedChangeSetCount`, the service dispatches a `document.compact` internal job (serial
queue). Loading a revision that has been pruned raises `HistoryPrunedError` → **410 Gone**,
which is a nicely chosen status: the revision existed and is permanently unavailable.
