# 04 · State, Persistence, and Concurrency

## Three kinds of state

From `docs/runtime/backend-map.md`, and consistently observed in the code:

- **Canonical state** — the minimum durable state needed to reproduce an accepted revision.
- **Operational state** — durable attempts, stage receipts, outbox rows, sync flags. Needed
  for recovery, not for reconstructing content.
- **Derived index** — rebuildable acceleration/presentation (Knowledge lattice nodes, Formula
  dependency maps, outlines, styling). *Never* an authority.

Document's schema shows all three in one file. `resources` is the retained identity anchor;
`documents` is the live current-head projection; `history` plus `bases`/`change_sets` retain
reconstructable revisions. `attempts`/`stage_receipts`/`command_receipts`/
`prompt_outputs` are current operational state;
`transaction_outbox` retains committed source transactions independently of current state.
The in-memory projections remain derived.

## Revision models

Six related models coexist. Knowing which one a capability uses tells you how to change it.

| Model | Used by | Law |
| --- | --- | --- |
| Pure deterministic service | Formula, Rich Text | Same input + snapshot + limits ⇒ same result. No state. |
| Typed current + generic history | Context, Structured Data, General Files, Connector, Comments, Persona, Templates, Investigation, Derived Outputs | Current tables contain live rows only; capability history contains superseded snapshots and terminal deletion records |
| Current head + Base/ChangeSets | Document | A live head plus materialised `Base` and accepted changes reconstructs any retained revision; a stable root anchors history after deletion |
| Generation + derived index | Knowledge | Canonical source windows; retrieval structures rebuildable |
| Durable attempt + settlement | Document prompts/formulas, Derived Outputs refresh | Freeze serially → compute concurrently → CAS on settle |
| Append-only transaction ledger + TTL lease | Activity (transactions) / Presence (leases) | Transactions are immutable and sequenced; leases expire and never become history |

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

**1 · Transactional current/history CAS** — Structured Data, Context, Connector:

```ts
update(entry: DataEntry, expectedRevision: number): boolean;   // false ⇒ conflict
delete(id, expectedRevision, recordedAt): number | undefined;
```

The store transaction first archives current revision *N*, then writes current revision
*N+1*. Delete archives *N*, appends terminal deletion revision *N+1*, and removes the current
row. A stale expected revision maps to HTTP 409. These endpoints can safely live on the
**concurrent** queue because the entire transition is checked and committed in SQLite.

**2 · Multi-statement transactional commit** — Document:

`commitMutation(commit): Promise<boolean>` takes head + changeSet + receipt + source transaction +
identity transitions + attempts + prompt-ownership transitions and commits them **together**,
conditional on `expectedRevision`. `false` ⇒ `RevisionConflictError`. Combined with the
serial queue, this makes the read-modify-write safe.

**3 · Rebase admission by touched IDs** — Document only:

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
runner. Existing backend data was declared disposable for the current/history conversion,
so schema initialisers describe only the new layout and contain no legacy-data compatibility.

| File | Owner |
| --- | --- |
| `data/documents.db` | Document |
| `data/activity.db` | Activity |
| `data/knowledge.db` | Knowledge platform (`0-platform/database/knowledge-store.ts`) |
| `data/structured-data.db` | Structured Data |
| `data/contexts.db` | Context (single project-scoped table; no user scope) |
| `data/derived-outputs.db` | Derived Outputs |
| `data/general-files.db` | General Files |
| `data/connector.db` | Connector |
| `data/comments.db` | Comments |
| `data/personas.db` | Persona |
| `data/templates.db` | Templates |
| `data/investigation.db` | Investigation |

The backend data reset removes `.db`, `.db-wal`, and `.db-shm` files before these fresh
schemas are initialised; test databases remain temporary.

### Project scoping via hashed table prefixes

Rather than a `project_id` column, table *names* are derived from the project:

```ts
const projectPrefix = (projectId: string): string =>
  createHash("sha256").update(projectId).digest("hex").slice(0, 16);

const root = `doc_${projectPrefix(projectId)}`;
// → doc_<16 hex>_documents, _bases, _change_sets, _attempts, …
```

Used by Document, Activity, Knowledge, Structured Data, Connector, General Files,
Derived Outputs and the other persisted resource capabilities. `runtime-scope.md` states the
invariants: scope values never become table
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
CHECK (lifecycle IN ('active','archived'))
CHECK ((state='active' AND tombstoned_revision IS NULL)
    OR (state='tombstoned' AND tombstoned_revision IS NOT NULL))
CHECK (state != 'attached' OR attached_revision IS NOT NULL)
UNIQUE (document_id, seq)
UNIQUE (document_id, revision)
UNIQUE (document_id, block_id)                                 -- prompt_outputs
CREATE UNIQUE INDEX … ON attempts(document_id, block_id) WHERE kind = 'prompt-create'
CREATE INDEX … ON transaction_outbox(occurred_at, source_transaction_id) WHERE published_at IS NULL
```

Partial indexes are used for work queues (unpublished transactions, detached prompt outputs, pending
claims). JSON payloads are stored as `BLOB` with canonical encoding.

The `active | tombstoned` check above belongs to Document's **structural identity ledger**.
It prevents reusing row/block/style IDs and is not a resource-deletion state. A logically
deleted Document has no row in `documents`; it is not a tombstoned current Document.

### Fresh schemas, not migrations

Schema files still use idempotent `CREATE TABLE IF NOT EXISTS`, but there is deliberately no
forward migration code for the current/history conversion or transaction-outbox rename. The
runtime starts from reset capability databases. In particular, schemas create only
`transaction_outbox`, `source_transaction_id`, and `transaction_kind`; no legacy
`activity_outbox` or Fact-named columns are detected or copied.

The Document outbox keeps copied `source_change_set_id` data alongside its optional
`change_set_id`. That makes the source transaction self-contained when ChangeSet compaction
clears or removes the historical link; it is a property of the fresh schema, not a migration.

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

## Resource deletion: current, history, and purge

User-facing persisted resources share one lifecycle contract:

```text
typed current table: id, revision, live fields, created_at, updated_at

capability history: resource_kind, resource_id, revision,
                    record_type (snapshot | deleted), snapshot_json, recorded_at
```

`resource_kind` distinguishes Questions, Hypotheses, and Findings in Investigation's one
history table; single-resource capabilities use it too so all stores share the same helpers.
Normal get/list/resolve/relationship queries read typed current tables only. There is no
`deletedAt` on public models, no soft-delete filter to forget, and no restore/reactivation
operation.

The transitions are:

1. Create inserts current revision 1 and no history row.
2. Update archives current revision *N*, then replaces current with *N+1* in one transaction.
3. Logical delete archives *N*, appends a `deleted` record at *N+1*, and removes current in
   one transaction. Owning capabilities first remove Knowledge sources or owned resources as
   required.
4. Purge is allowed only when no current row exists and the latest history record is terminal
   deletion. It physically removes history and capability-owned retained state and emits no
   Activity transaction.

Connector IDs derive from provider + locator and General File IDs derive from content. If an
identical resource is registered again before purge, the store consults history and creates
current revision *N+1* under the same deterministic ID. That can look like reactivation, but
is simply deterministic allocation plus a new current row. After purge removes allocation
history, the same identity begins again at revision 1.

Document follows the same public contract while retaining its Base/ChangeSet body model.
`resources` is an internal stable root; `documents` contains live heads only; `history`
contains superseded head envelopes and terminal deletion. Bases, ChangeSets, and the identity
ledger remain attached to the root so revision-qualified loads can reconstruct a deleted
Document. Attempts, prompt ownership, stage receipts, and command receipts are attached to
current state and disappear on logical deletion. `active` and `archived` are the only live
`DocumentLifecycle` states — deletion is not `trashed`.

## Revision retention scheduler

There are now two complementary Document retention controls:

- `config.document.history` (`retainedBaseCount: 5`, `retainedChangeSetCount: 1000`,
  `retainedTerminalAttemptCount: 1000`) bounds structural Base/ChangeSet/attempt history and
  drives serial `document.compact` work.
- `config.retention` (`revisionRetentionDays: 30`, `sweepIntervalHours: 24`) applies the
  time-based current/history policy across all resource capabilities.

After HTTP binds, `ResourceRetentionScheduler.start()` runs one awaited sweep immediately and
then arms the recurring timer. It visits capabilities sequentially in ownership-aware order
(Document and Persona before their owned Derived Output/Context resources). For each it runs
expired-deletion purge first and live-resource history pruning second. Purge and prune each
have an independent error boundary with structured logging, so one failure cannot stop the
remaining sweep. A tick that arrives during an active sweep joins it rather than overlapping.
Shutdown clears the timer and awaits the active sweep.

For live resources, snapshot history strictly older than the cutoff is removed. For deleted
resources, a terminal deletion older than the cutoff triggers the capability's normal purge.
Document first reconstructs and writes a Base at the earliest retained revision before
removing older Bases and ChangeSets, preserving loadability of every retained revision.

This policy does **not** prune Activity, transaction outboxes, command receipts, or delegated
claims as generic time-series data, and it does not run SQLite `VACUUM`. Once a revision is
pruned, a revision-qualified Document load raises `HistoryPrunedError` → **410 Gone**.
