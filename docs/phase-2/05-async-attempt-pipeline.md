# 05 · The Async Attempt Pipeline

*Verified against source at commit ef6d462, 2026-08-09.*

Two capabilities in this backend do work that cannot finish inside the request that started it:
Document (prompt creation, prompt refresh, formula evaluation) and Derived Outputs (refresh
against a language model). Both use the same three-phase shape — **freeze, compute, settle** —
and they implement it differently enough that the differences are the most useful thing to
learn.

| | Document | Derived Outputs |
| --- | --- | --- |
| Durable record of an in-flight operation | `doc_<p>_attempts` (7 states) + `doc_<p>_stage_receipts` | `do_<p>_refresh_attempts` (a record, not a state machine) |
| Where compute runs | A separate **internal job** on the concurrent queue | Inline, inside the HTTP job that requested it |
| Where settle runs | A separate **internal job** on the serial queue | Inline, in the same call |
| Survives a process restart | **Yes** — recovery re-dispatches | **No** — an interrupted refresh leaves a `settled = 0` attempt row and nothing retries it |
| Conflict detection | Revision CAS in `commitMutation`, plus a stale check per kind | A four-fence CAS in one `IMMEDIATE` transaction |
| Idempotency | Client `requestId` receipts + per-stage receipts | Three claim tables keyed by a caller-supplied `idempotencyKey` |

Everything below is about the operational tables. The revision models they settle *into* are on
[04 · State and persistence](04-state-and-persistence.md); the queues they run on are on
[02 · Request and job runtime](02-request-and-job-runtime.md).

---

## 1 · The shape

```text
FREEZE      serial      · read head, check preconditions, write a durable record
                          of exactly what was frozen, return 202 with an id
   │
COMPUTE     concurrent  · the slow part. No lock is held. Nothing in the frozen
                          record may be re-read from live state
   │
SETTLE      serial      · re-check that the world still matches what was frozen,
                          then commit — or mark the attempt stale and stop
```

Document assigns the three phases to three different jobs. Its wiring
([`4-job-wiring/document/createDocumentJobs.ts`](../../apps/backend/src/4-job-wiring/document/createDocumentJobs.ts))
is a total `switch` with no `default`, so adding an intent type is a compile error until wiring
handles it. The full inventory — **7 intents, the entire internal-job surface of the backend**:

| Intent type | Job name | Queue | Calls |
| --- | --- | --- | --- |
| `document.compact` | `documents.compact` | **serial** | `compact(documentId)` |
| `document.prompt.create.compute` | `documents.prompt.create.compute` | **concurrent** | `computePromptCreation(attemptId)` |
| `document.prompt.create.settle` | `documents.prompt.create.settle` | **serial** | `settlePromptCreation(attemptId)` |
| `document.prompt.refresh.compute` | `documents.prompt.refresh.compute` | **concurrent** | `computePromptRefresh(attemptId)` |
| `document.prompt.refresh.settle` | `documents.prompt.refresh.settle` | **serial** | `settlePromptRefresh(attemptId)` |
| `document.formula.evaluate.compute` | `documents.formula.evaluate.compute` | **concurrent** | `computeFormulaEvaluation(attemptId)` |
| `document.formula.evaluate.settle` | `documents.formula.evaluate.settle` | **serial** | `settleFormulaEvaluation(attemptId)` |

The rule is uniform: **compute is concurrent; settle and compact are serial.** The freeze
happens inside `POST /documents/command`, which is itself on the serial queue
(`registerDocumentEndpoints.ts:108`).

Derived Outputs does all three phases inside one job. `POST /derived-output-refresh` is
registered `queueType: "concurrent", responseMode: "inline"`
([`registerDerivedOutputEndpoints.ts:146-150`](../../apps/backend/src/4-job-wiring/derived-outputs/registerDerivedOutputEndpoints.ts)),
and `refresh()` freezes, calls the model, and settles before returning. That is why it needs a
four-fence CAS: by the time it settles, a *different* concurrent job may have changed the same
output.

---

## 2 · Document's attempt model

### 2.1 The table

[`document/persistence/sqliteSchema.ts:238-273`](../../apps/backend/src/3-capabilities/document/persistence/sqliteSchema.ts):

```sql
CREATE TABLE IF NOT EXISTS ${tables.attempts} (
  id                        TEXT PRIMARY KEY,
  document_id               TEXT NOT NULL,
  kind                      TEXT NOT NULL
    CHECK (kind IN ('prompt-create', 'prompt-refresh', 'formula-evaluation')),
  client_request_id         TEXT NOT NULL,
  request_digest            TEXT NOT NULL,
  block_id                  TEXT NOT NULL,
  frozen_document_revision  INTEGER NOT NULL CHECK (frozen_document_revision >= 0),
  state                     TEXT NOT NULL
    CHECK (state IN ('requested', 'computing', 'proposed', 'settled',
                     'unchanged', 'stale', 'failed')),
  frozen_json               BLOB NOT NULL,
  candidate_json            BLOB,
  diagnostic_json           BLOB,
  settled_change_set_id     TEXT,
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL,
  UNIQUE (document_id, kind, client_request_id),
  FOREIGN KEY (document_id) REFERENCES ${tables.documents}(id) ON DELETE CASCADE,
  FOREIGN KEY (settled_change_set_id) REFERENCES ${tables.changeSets}(id) ON DELETE SET NULL
);
```

Three indexes back it, one of which is a reservation rather than a lookup:

```sql
CREATE UNIQUE INDEX ${tables.attempts}_prompt_create_block
  ON ${tables.attempts}(document_id, block_id) WHERE kind = 'prompt-create';
```

That partial unique index is what makes "one in-flight prompt creation per block ID" a database
guarantee rather than a service convention.

`frozen_json` / `candidate_json` / `diagnostic_json` are three JSON columns rather than a wide
table because the frozen and candidate shapes differ per kind. `attemptToStorageParts` splits
them on write and `rowToAttempt` spreads them back over the common base
(`document/persistence/sqliteMappers.ts`).

### 2.2 Three kinds, seven states

| Kind | Frozen | Candidate |
| --- | --- | --- |
| `prompt-create` | `styleId`, `presentation?`, `placement`, `definition {prompt, context, stabilisationText}` | `candidateOutputId`, `candidateHeadRevision` |
| `prompt-refresh` | `promptBlockId`, `outputId`, `frozenAppliedRevision` | `candidateHeadRevision` |
| `formula-evaluation` | `atomId`, `originChangeSetId?`, `frozenExpression`, `frozenExpressionDigest` | `resolverSnapshotDigest`, `candidateOperations` |

States: `requested → computing → proposed → settled`, with three other terminal exits.

| State | Meaning | Terminal |
| --- | --- | --- |
| `requested` | Frozen and durable; compute dispatched | no |
| `computing` | The compute stage claimed it | no |
| `proposed` | Compute produced a candidate; settle dispatched | no |
| `settled` | Committed; `settled_change_set_id` points at the ChangeSet | **yes** |
| `unchanged` | Compute found nothing new (prompt refresh only) | **yes** |
| `stale` | The world moved under the frozen state before settle | **yes** |
| `failed` | The stage threw, or the initial refresh produced no revision | **yes** |

The terminal set `["settled","unchanged","stale","failed"]` is written out twice — at
[`documentService.ts:1783`](../../apps/backend/src/3-capabilities/document/application/documentService.ts)
in `runStage`'s early return, and as `terminalAttemptStates` at `sqliteDocumentStore.ts:147`
for count-based pruning. They agree today; nothing enforces that they keep agreeing.

### 2.3 Stage receipts

Each attempt has at most two stage receipts, one per phase
(`document/persistence/sqliteSchema.ts:298-315`):

```sql
CREATE TABLE IF NOT EXISTS ${tables.stageReceipts} (
  attempt_id       TEXT NOT NULL,
  stage            TEXT NOT NULL CHECK (stage IN ('compute', 'settle')),
  idempotency_key  TEXT NOT NULL UNIQUE,
  request_digest   TEXT NOT NULL,
  state            TEXT NOT NULL CHECK (state IN ('running', 'completed', 'failed')),
  result_json      BLOB,
  diagnostic_json  BLOB,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  PRIMARY KEY (attempt_id, stage),
  FOREIGN KEY (attempt_id) REFERENCES ${tables.attempts}(id) ON DELETE CASCADE
);
```

The key is deterministic — `` `document:${attemptId}:${stage}` `` (`documentService.ts:1788`) —
so a duplicate dispatch computes the same key and loses the race on the `UNIQUE` constraint.
`claimStage` (`sqliteDocumentStore.ts:736-791`) returns one of three verdicts:

| Verdict | Condition | What `runStage` does |
| --- | --- | --- |
| `"claimed"` | No row, or an existing `failed` row that passes the same-stage digest check | Proceed |
| `"running"` | A row is already `running` | **Return immediately** |
| `"completed"` | A row is already `completed` | **Return immediately** |

Reusing an idempotency key for a *different* `(attemptId, stage)` throws
`"Document stage idempotency key was reused"` (`sqliteDocumentStore.ts:755`).

---

## 3 · `runStage` — the shared driver

[`documentService.ts:1774-1918`](../../apps/backend/src/3-capabilities/document/application/documentService.ts).
All six compute/settle entry points are thin wrappers around it. The order matters:

1. Load the attempt. Missing → `DocumentAttemptNotFoundError`. Wrong kind →
   `DocumentOperationError`. **Already terminal → silent return** (`:1783`).
2. `claimStage(receipt)`. Anything other than `"claimed"` → return.
3. On `compute` with state `requested`, flip the attempt to `computing`.
4. Run the kind-specific work.
5. **On throw**: build `{ code: "stage_failed", message }`, and record it. For `prompt-create`
   this goes through `failPromptCreationStage`, which writes the failed attempt, the failed
   receipt, and the pending-ownership detach in **one** transaction. Then rethrow.
6. **On success**: `completeStage`. If *that* write fails, the attempt is deliberately left
   non-terminal. The comment (`:1907-1908`) is the reason:

   > ```text
   > // The stage effect succeeded. Keep the attempt non-terminal and the
   > // receipt running so startup recovery can safely finish the receipt.
   > ```

Each of the four phases (`start`, `work`, `record-failure`, `complete`) is wrapped in
`retryStageAction` (`:1920-1946`), which retries on the schedule
`STAGE_RETRY_DELAYS_MS = [10, 50]` (`:145`) — **two retries, 10 ms then 50 ms, then rethrow**.
Each retry logs `document.internal-stage.retrying` at warn with `{attemptId, stage, kind, phase,
retryNumber, delayMs, errorName, errorMessage}`.

---

## 4 · The three Document pipelines end to end

### 4.1 Prompt creation

**Freeze** — `requestPromptCreation` (`:1254-1325`), inside `POST /documents/command` on the
serial queue. In order:

1. Replay by command receipt `(documentId, requestId)`, or by an existing attempt for the same
   `(documentId, "prompt-create", requestId)`; a digest mismatch on the latter is
   `IdempotencyMismatchError` → 409.
2. `head.revision !== command.expectedRevision` → `RevisionConflictError` → 409.
3. The block ID must not already exist in the snapshot.
4. The block ID must not be reserved by an existing `prompt-create` attempt or a
   `prompt_outputs` row → `"Block identity is already reserved"`.
5. **A dry-run `applyOperations`** inserting a `divider` at the requested placement. This proves
   the placement is legal *before* any external call is made. Its result is discarded.
6. Attempt + command receipt written in one transaction (`createAttemptWithSubmission`).
7. Dispatch `document.prompt.create.compute`. Return `{type: "prompt.create-requested",
   attemptId}` with HTTP **202** (`commandStatus`: any result type ending in `requested` is 202).

**Compute** — `computePromptCreation` (`:1506-1567`), concurrent queue. It re-loads the snapshot
rather than trusting the frozen definition, and says why (`:1508-1510`):

> ```text
> // Resolved here rather than at request time: the variable may have been
> // rebound in between, and the definition should reflect what the Block is
> // grounded on now, not what it was when the request was queued.
> ```

Then `derivedOutputs.declare(..., { idempotencyKey: "document:prompt-create:<attemptId>" })`,
register **pending** ownership, then `derivedOutputs.refresh(outputId, { idempotencyKey:
"document:prompt-create:<attemptId>:refresh" })`. If the refresh comes back with
`headRevision <= 0`, the ownership is detached and the attempt goes `failed` with
`{code: "initial_refresh_failed"}`. Otherwise the attempt goes `proposed` and settle is
dispatched.

**Settle** — `settlePromptCreation` (`:1569-1612`), serial queue. It inserts the real `prompt`
block through the ordinary `mutate` CAS with `settleAttempt` set, so the attempt flips to
`settled` in the same transaction as the ChangeSet. A settlement conflict —
`isPromptSettlementConflict` covers `DocumentOperationError`, `DocumentPlacementError`,
`DocumentStyleReferenceError`, `DocumentValidationError`, `RevisionConflictError` — detaches the
ownership and marks the attempt `stale`. Any other error propagates and fails the stage.

### 4.2 Prompt refresh

Freeze records `(promptBlockId, outputId, frozenAppliedRevision)` plus the head revision.
Compute calls `derivedOutputs.refresh` with key
`document:prompt-refresh:<attemptId>:refresh`; if `headRevision <= frozenAppliedRevision` the
attempt becomes `unchanged` and stops (`:1621-1628`).

Settle (`:1646-1670`) re-verifies **four** things before mutating: the block still exists, it is
still a `prompt`, its `output.outputId` still equals the frozen one, and its
`output.appliedRevision` still equals the frozen one. Any mismatch → `markStale`. Otherwise it
applies a single `prompt.apply-derived-output` operation.

### 4.3 Formula evaluation

This is the one pipeline that starts **without an explicit request**. Every `mutate` maps the
reducer's `applied.formulaChanges` into fresh `formula-evaluation` attempts
(`:1086-1106`) and dispatches compute for each of them (`:1164`). So a plain `document.submit`
can spawn concurrent jobs. Attempts can also be requested explicitly through the
`formula.evaluate.request` command.

Compute (`:1672-1712`) parses the frozen source with `languageVersion: "formula/v1"`, builds a
resolver snapshot, evaluates, and produces one of two rich-text operations:

- success → `apply-formula-settlement` with `{acceptedValue: toWire(value), displayText:
  formatFormulaValue(value)}`;
- parse or evaluation failure → `apply-formula-settlement` with
  `` displayText: `{{${expression}}}` `` and a `{code, message, sourceRange?}` diagnostic
  (`formulaDiagnosticOperation`, `:1750-1772`; the default code is `evaluation_error`).

Settle (`:1714-1745`) is the strictest of the three. It refuses unless **all four** hold: the
atom still exists; it is still a formula atom; `digestFormulaExpression(atom.expression)` still
equals the frozen digest; and **no intervening ChangeSet's `touchedIds` contains the atom id**
(`:1729-1737`). That last check reuses the same touched-ID footprint machinery that
[04 §10](04-state-and-persistence.md) describes for rebase admission.

### 4.4 Prompt-output ownership

`doc_<p>_prompt_outputs` is a three-state machine — `pending → attached | detached` — with a
`UNIQUE (document_id, block_id)` and a partial index on detached rows.
`promptOwnershipTransitions` (`:1174-1204`) diffs the block→output map before and after a
mutation and emits `detached` for pairs that disappeared or changed and `attached` for new
pairs.

The store method that applies a transition only ever **UPDATEs**
(`updatePromptOutputOwnershipRow`, `sqliteDocumentStore.ts:1584-1630`). An attach for an
unregistered output id throws `` `Prompt-output ownership not found: ${outputId}` `` inside the
commit transaction, and any transition that would change the owner throws
`"Prompt-output ownership transition changed its owner"`. The one exception is the raw insert
used when duplicating a document, and it explains itself
(`sqliteDocumentStore.ts:932-937`):

> ```text
> /**
>  * Raw insert, used by `commitCreation` for a copy's freshly declared outputs.
>  * They are `attached` from birth rather than `pending`: the Block and the
>  * output land in the same commit, so there is no window in which one exists
>  * without the other.
>  */
> ```

**Detached outputs are never collected.** The seam is fully built on the persistence side —
the partial index
`prompt_outputs_detached ON (state, updated_at, output_id) WHERE state = 'detached'`
(`document/persistence/sqliteSchema.ts:294-296`), the port method
`listDetachedPromptOutputs(limit?)` (`document/ports/documentStore.ts:167`), and its
implementation (`sqliteDocumentStore.ts:965`). **Its only caller in the repository is a test**
(`document-persistence.test.ts:598`). There is no garbage-collection job, no retention port
entry, no internal intent, and no endpoint, so a detached row accumulates until the document
is purged. This is an unwired seam, not a working feature.

---

## 5 · Derived Outputs: the three-way CAS settle

`settleRefresh` ([`derived-outputs/sqlite-store.ts:679-794`](../../apps/backend/src/3-capabilities/derived-outputs/sqlite-store.ts))
is the most carefully guarded write in the backend. It begins with a shape check **outside** the
transaction (`:680-686`) that throws if the candidate does not match its own frozen inputs:

```ts
if (
  input.revision.outputId !== input.outputId ||
  input.revision.definitionRevision !== input.expectedDefinitionRevision ||
  input.revision.revision !== input.expectedHeadRevision + 1
) {
  throw new Error("Refresh candidate does not match its frozen output state");
}
```

Then, inside one `db.transaction(...).immediate()`, four ordered fences:

| Order | Fence | `SettleRefreshState` | Attempt `discarded_reason` |
| ---: | --- | --- | --- |
| 0 | The output row still exists | `output_deleted` | `"output_deleted"` |
| 1 | `definition_revision === expectedDefinitionRevision` | `definition_changed` | `"definition_changed"` |
| 2 | `head_revision === expectedHeadRevision` | `head_changed` | `"head_changed"` |
| 3 | `getKnowledgeGeneration() === expectedKnowledgeGeneration` | `knowledge_changed` | `"knowledge_changed"` |

Existence is really a fourth check; the *three-way CAS* proper is **definition × head ×
knowledge generation**. None of the four is an exception — each records the attempt with
`settled = 0` and a reason, completes the idempotency claim with `skipped: true`, and returns a
discriminated result. A caller that ignores `state` will silently believe it published.

When all four pass, in order (`:748-786`):

1. `insertRevision(...)` — the immutable answer row.
2. `archiveOutput(output, completedAt)` — snapshot the pre-publish aggregate into history.
3. The publish `UPDATE`, **guarded a second time in its own `WHERE`**:
   `WHERE id = ? AND definition_revision = ? AND head_revision = ?`.
4. `if (published.changes !== 1) throw new Error("Derived refresh publish CAS changed an
   unexpected row count")`.
5. `settleAttempt(input, true, null)`.
6. `completeRefreshClaim(...)`.

`failRefresh` (`:796-898`) runs **the same four fences in the same order** before writing
`freshness_state = 'failed'`, with the same double-guarded `WHERE` and its own
`changes !== 1` throw. Its successful path returns `skipped: false` (`:893`) — so on this API,
`skipped` means "a concurrent change won", not "nothing happened".

`completeRefreshClaim` carries two comments worth keeping. At `:964-965`:

> ```text
> // A concurrent delete cascades the claim. The refresh remains safely
> // skipped, but there is no longer an output-scoped identity to retain.
> ```

and at `:983`:

> ```text
> // Return the same canonical JSON shape that every later replay reads.
> ```

The second is load-bearing: the method returns `JSON.parse(encoded)` rather than the in-memory
object, so the first caller and every subsequent replay receive byte-identical shapes.

Five tests pin this behaviour, and their names are the specification:
`derived-outputs.test.ts:971` *"concurrent refreshes publish one revision and leave current
freshness"*, `:1006` *"an old-definition refresh cannot roll back a newer published
definition"*, `:1053` *"a late failing attempt cannot overwrite a newer successful head"*,
`:627` *"Knowledge add and remove invalidate outputs and fence an in-flight refresh"*, and
`:456` *"definition update is one SQLite CAS that also marks freshness stale"*.

### 5.1 The knowledge-generation fence

`markAllOutputsStaleForKnowledgeChange` (`:546-573`) is one immediate transaction that archives
every output row, increments the singleton `knowledge_generation`, and then marks every output
stale with **no `WHERE` clause**. It is wired at `startBackend.ts:95-97`:

```ts
knowledge.onSourceMutation((mutation) => {
  derivedOutputs.recordKnowledgeSourceMutation(mutation);
});
```

Fence 3 exists so an in-flight refresh that read the corpus *before* the mutation cannot publish
after it.

**The event's `sourceId` is ignored.** `KnowledgeSourceMutation` is `{operation: "add" |
"remove", sourceId}` (`0-platform/knowledge/types.ts:150-153`), and the handler
(`derived-outputs.ts:1047-1056`) discards the id and invalidates project-wide. That is a
deliberate simplification, but it makes `DerivedEvidence.sourceId`'s documented purpose —
selective invalidation — unimplemented.

---

## 6 · The three idempotency claim tables

They are separate tables rather than one because their replay payloads differ.

| Table | Digest input | Replay payload |
| --- | --- | --- |
| `do_<p>_declarations` | `sha256({prompt, contextEntries, stabilisationText})` (`derived-outputs.ts:286-295`) | none stored — the output row itself is the result, re-read via `getOutput` |
| `do_<p>_refresh_claims` | `sha256({outputId})` (`:297-301`) | `DerivedRefreshResult` as canonical JSON in `result_json` |
| `do_<p>_definition_update_claims` | `sha256({outputId, prompt, contextEntries, stabilisationText, expectedDefinitionRevision})` (`:303-317`) | `DerivedOutput` as canonical JSON in `result_json` |

Note the refresh digest covers **only the output id**. Reusing a refresh key for a *different*
output throws; reusing it for the same output is a legitimate replay no matter what changed in
between.

`_declarations` has no `result_json` at all, so `claimDeclaration` re-reads the output and
throws `` `Derived output declaration '${key}' references a missing output` `` if it is gone.

All three claim methods run as `db.transaction(...).immediate()`, insert a pending row and
return `{created: true}` on first sight, and on second sight return the stored digest plus the
parsed result when one exists. A digest mismatch raises the matching typed error —
`DerivedOutputIdempotencyConflictError` (`:627-631`),
`DerivedOutputDefinitionUpdateIdempotencyConflictError` (`:683-687`),
`DerivedOutputRefreshIdempotencyConflictError` (`:745-749`) — all three mapped to **409**.

Key validation (`:319-326`): non-blank after `trim()`, at most 512 **UTF-8 bytes** (the SQL
CHECK measures 512 *characters*, so the JS check is the stricter of the two).

**A claim is not a lock.** The capability's own `docs/invariants.md:82` states it: *"A key claim
is not a durable queued job and not strict single-flight: an incomplete same-key caller may
recompute."* Confirmed in source — `claimRefresh` inserts a pending row and returns
`{created: true}`; a second caller sees `{created: false}` with no `result` and proceeds to
recompute.

---

## 7 · Who actually supplies idempotency keys

**No HTTP endpoint does.** All seven Derived Outputs endpoints call the service without an
options argument, so the claim tables are never exercised from outside the process. Verified:
`grep -rn "idempotencyKey" apps/backend/src/4-job-wiring/` matches only error-mapping strings
(`"idempotency_mismatch"`), never a call argument.

The only production keys in the tree are minted by Document:

| Site | Key | Target |
| --- | --- | --- |
| `documentService.ts:1367` | `` `document:prompt-definition:${canonicalDigest({documentId, requestId})}` `` | `updateDefinition` |
| `documentService.ts:1516` | `` `document:prompt-create:${attempt.id}` `` | `declare` |
| `documentService.ts:1528` | `` `document:prompt-create:${attempt.id}:refresh` `` | `refresh` |
| `documentService.ts:1619` | `` `document:prompt-refresh:${attempt.id}:refresh` `` | `refresh` |

The consequence, stated plainly: **replay safety for Derived Outputs is in-process only.** Two
identical `POST /derived-output-refresh` requests run two full model refreshes and race each
other into `settleRefresh`; the loser is discarded with `state: "head_changed"` and
`skipped: true`. Nothing is corrupted — that is what the fences are for — but the token spend
is real and no client can prevent it.

Document is different: its client-supplied `requestId` **does** travel over the wire (it is a
required field in the command envelope, `document/wire/commandSchemas.ts:26-27`), and it backs
the two receipt tables described in [04 §11](04-state-and-persistence.md#11--idempotency-receipts-and-claims).
Comments and Templates do the same.

One thing that does **not** exist, despite being described in the archived design notes and in
the shipped `etc/configuration.yaml:204-205` comment: there is **no delegated-command claim
table**. `grep -rn "DelegatedCommandClaim\|delegated" apps/backend/src/3-capabilities/document/`
returns nothing. `updatePromptDefinition` (`:1329-1382`) relies on the far side being idempotent
instead, and says so (`:1355-1357`):

> ```text
> // Derived Outputs is idempotent on this key alone, so a retry after a
> // crash between this call and recordSubmission below simply replays the
> // already-completed result rather than reapplying the definition twice.
> ```

---

## 8 · The transaction outbox

Three capabilities keep a local outbox of accepted transactions and publish them into Activity
after their own commit: Document, Comments, and Templates. All three tables carry
`source_transaction_id` as the primary key, a nullable `published_at`, and a partial index
`WHERE published_at IS NULL`.

| Capability | Table | Kinds | FK to current state |
| --- | --- | --- | --- |
| Document | `doc_<p>_transaction_outbox` | `document.created`, `document.changed`, `document.compensated`, `document.deleted` | `resource_root_id → resources ON DELETE SET NULL`; `change_set_id → change_sets ON DELETE SET NULL` |
| Comments | `cmt_<p>_transaction_outbox` | `created`, `updated`, `resolved`, `reopened`, `deleted` | **none** |
| Templates | `tpl_<p>_transaction_outbox` | `template.registered`, `template.updated`, `template.deleted` | **none** |

Templates says why it has no FK (`templates/persistence/sqliteSchema.ts:74-75`):

> ```text
> -- No foreign key to current templates: accepted source transactions remain
> -- publishable after logical deletion.
> ```

### 8.1 What survives compaction

Document's outbox is the one that has to survive its own capability's history compaction, and
the schema is annotated for exactly that (`document/persistence/sqliteSchema.ts:193-206`):

> ```text
> -- Structural attachment while retained; SET NULL lets the immutable
> -- transaction survive resource purge as required by ledger retention.
> resource_root_id  TEXT,
> …
> -- This historical link may be cleared by ChangeSet compaction.
> change_set_id     TEXT,
> -- This copied source value must survive history compaction.
> source_change_set_id TEXT,
> …
> -- This is the Document source digest, never an Activity ledger digest.
> semantic_digest   TEXT NOT NULL,
> ```

Compaction is what makes this necessary. `compactRetentionHistory`
(`sqliteDocumentStore.ts:1168-1171`) runs `DELETE FROM change_sets WHERE document_id = ? AND
seq <= ?`. Because `change_set_id` is `ON DELETE SET NULL`, every outbox row below the anchor
loses its FK — but `source_change_set_id` is a **plain copied column with no FK**, so the
identifier survives and `getCommittedTransactionByChangeSet` still resolves.

The same distinction is stated as a field comment on the domain type
(`document/domain/model.ts:460-493`):

> ```text
> A copied source ChangeSet ID, deliberately independent of the historical
> ChangeSet foreign key. Document compaction must not make an outbox row
> incomplete before Activity has consumed it.
> ```

Purge is the harsher case: it deletes the `resources` root, so `resource_root_id` goes NULL and
the outbox row remains publishable with no structural attachment at all.

The transaction ID is deterministic (`documentService.ts:2110-2118`):
`` `document:${documentId}:${sourceRequestId}:${kind}` ``. Activity turns it into a row id by
`` `act_${sha256(idempotencyKey)}` `` (`activityService.ts:104-107`), so the same source
transaction always lands on the same ledger row.

### 8.2 When publishing happens

| Capability | On commit | On startup drain | Stops on first failure? |
| --- | --- | --- | --- |
| Document | **yes** (`documentService.ts:885`, `:946`, `:1163`) | yes (`startBackend.ts:190`) | no — continues the loop |
| Comments | **yes** (`commentService.ts:250`, `:390`) | yes (`startBackend.ts:192`) | no — continues the loop |
| Templates | **no** | yes (`startBackend.ts:194`) | **yes — `break`** |

Document and Comments both publish inside the accepted command, catching and logging failures
without changing the result. Document's rationale (`documentService.ts:2121-2124`):

> ```text
> /**
>  * Source state is already committed when this runs. Delivery failures stay in
>  * the local outbox for `publishPendingActivity()` rather than changing the
>  * accepted Document command result.
>  */
> ```

`markTransactionPublished` uses `COALESCE(published_at, ?)`, so re-marking is idempotent.

**Templates is the outlier, twice.** `templateService.ts:232-256` is the *only* place it ever
calls `publisher.publish` — there is no post-commit publish anywhere in the service. And its
loop `break`s on the first failure (`:252`):

```ts
} catch (error) {
  // Source state is already committed. Delivery failures stay in the
  // outbox for the next drain rather than changing an accepted result.
  this.dependencies.logger.warn("templates.activity.publish-failed", { … });
  break;
}
```

So a Templates command's Activity transaction is not visible until the **next process restart**,
and one undeliverable row blocks every row behind it until then.

Activity's own module docs state the opposite. `activity/docs/concepts.md:110-112`: *"Document,
Comments, and Templates map committed source-transaction records to Activity transactions after
commit and retry unpublished records through their recovery paths."* And
`activity/docs/invariants.md:98-100`: *"Each retains a self-contained transaction-outbox row,
publishes post-commit, and retries pending rows through its recovery path."* Both sentences are
true of Document and Comments and **false of Templates in both halves** — it does not publish
post-commit, and its drain does not retry past the first failure.

**There is no periodic retry loop for any of the three.** `publishPendingActivity` is called
exactly once per process, from `startBackend.ts:190`, `:192`, `:194`.

---

## 9 · Recovery on startup

Four calls, in this order, at `startBackend.ts:188-195` — after every endpoint is registered and
**before** `app.listen`:

| Line | Call | Logs |
| ---: | --- | --- |
| 188 | `document.recoverPendingAttempts()` | `document.attempts.recovered {count}` |
| 190 | `document.publishPendingActivity()` | `document.activity.recovered {count}` |
| 192 | `comments.publishPendingActivity()` | `comments.activity.recovered {count}` |
| 194 | `templates.publishPendingActivity()` | `templates.activity.recovered {count}` |

`recoverPendingAttempts` (`documentService.ts:1966-1976`) does two things:

1. `recoverInterruptedStages(now)` — one UPDATE that flips **every** `running` stage receipt to
   `failed` with `{code: "process_interrupted", message: "The prior process stopped before this
   stage completed"}` (`sqliteDocumentStore.ts:851-864`). It is unfiltered by document or age:
   any receipt still marked `running` when the process starts was, by definition, interrupted.
2. `listRecoverableAttempts()` — every attempt in `requested | computing | proposed`, ordered
   `updated_at ASC, id ASC` (`sqliteDocumentStore.ts:704-713`) — then re-dispatches each one:
   `proposed` → **settle**, anything else → **compute**.

The `failed` receipt from step 1 is what makes step 2 safe: `claimStage` re-claims a `failed`
receipt after a digest check, so the re-dispatched stage runs instead of being swallowed as
`"running"`.

Nothing recovers Derived Outputs. An interrupted `refresh` leaves a `do_<p>_refresh_attempts`
row with `settled = 0` and `completed_at` NULL, and its pending claim row keeps
`result_json` NULL forever. Nothing scans for either. The output stays at its previous
`head_revision` with whatever freshness state it had, which is correct but silent.

---

## 10 · Back-pressure and dispatch retries

`dispatch` returns after **admission**, not completion
([`0-utils/jobs/internalRuntime.ts:85-113`](../../apps/backend/src/0-utils/jobs/internalRuntime.ts)),
and the runtime says why (`:108-109`):

> ```text
> // Scheduler logging records eventual execution failures. Observe the
> // promise here because dispatch deliberately returns after admission.
> ```

Admission can fail. Only one failure is treated as transient
(`internalRuntime.ts:20-24`):

> ```text
> /**
>  * Capacity is the one admission failure that is expected to clear without a
>  * configuration change. Capabilities can use this predicate without knowing
>  * which scheduler or queue owns the intent.
>  */
> ```

`isRetryableInternalJobAdmissionError` is `error instanceof QueueCapacityError`, and Document is
its only consumer. `handleDispatchFailure` (`documentService.ts:2155-2171`) logs
`document.internal-job.dispatch-pending` with `{intentType, retryCount, retryable, errorName,
errorMessage}` and then:

```ts
if (!retryable) return;                    // unknown intent type = wiring bug, never retried
this.scheduleDispatchRetry(intent, retryCount + 1);
```

`scheduleDispatchRetry` (`:2173-2190`):

```ts
const delayMs = Math.min(
  DISPATCH_RETRY_INITIAL_DELAY_MS * (2 ** Math.min(retryCount - 1, 16)),
  DISPATCH_RETRY_MAX_DELAY_MS
);
const timer = setTimeout(…, delayMs);
timer.unref();
```

With `DISPATCH_RETRY_INITIAL_DELAY_MS = 25` and `DISPATCH_RETRY_MAX_DELAY_MS = 2_000`
(`:146-147`), the schedule is **25 ms → 50 → 100 → 200 → 400 → 800 → 1600 → 2000 ms**, then flat
at 2 s. The exponent is capped at 16 and the timer is `unref()`ed, so pending retries never hold
the process open. Retries are keyed by `intent.idempotencyKey` and a duplicate dispatch for a
key already pending is a no-op (`:2147`). Success logs
`document.internal-job.dispatch-recovered`.

**There is no retry limit.** A permanently full queue retries at 2 s forever. That is the
intended reading of the design: the durable attempt row, not the queue, is the recovery
authority — and a dropped dispatch is picked up at the next restart by
`recoverPendingAttempts`.

Non-retryable admission failures are logged and dropped.

---

## 11 · The honest limits

Each of these was verified in source. None of them is theoretical.

| # | Limit | Where |
| --- | --- | --- |
| 1 | **No HTTP endpoint forwards an idempotency key to Derived Outputs.** All seven pass no options; the three claim tables are exercised only by Document's four in-process call sites. Replay safety over HTTP is nil | `registerDerivedOutputEndpoints.ts`, all 7 registrations |
| 2 | **Templates publishes Activity on the startup drain only, and `break`s on the first failure.** No post-commit publish exists; one undeliverable row blocks the queue behind it until the next restart | `templateService.ts:232-256`; the only `publisher.publish` call in the file |
| 3 | **The Activity poison pill has no dead-letter path.** `SQLiteActivityStore.publish` throws `ActivityTransactionConflictError` when a transaction id already exists with a different digest (`sqliteActivityStore.ts:149-153`). All three publishers catch, log a warn, and leave `published_at` NULL — so the row is retried on every subsequent drain, forever. Nothing counts attempts, nothing moves it aside, nothing alerts | `sqliteActivityStore.ts:150-152`, `documentService.ts:2138-2146`, `commentService.ts:406-441`, `templateService.ts:243-253` |
| 4 | **No periodic outbox retry.** `publishPendingActivity` runs once per process | `startBackend.ts:190`, `:192`, `:194` |
| 5 | **Nothing recovers a Derived Outputs refresh.** An interrupted refresh leaves `settled = 0` and a pending claim, and nothing scans for either | `DerivedOutputStore` (`derived-outputs/store.ts:136-140`) has `insertAttempt` and `updateAttemptResult` and **no list or query method at all** |
| 6 | **Detached prompt outputs are never collected.** The index and `listDetachedPromptOutputs` both exist; the only caller anywhere is a test | `document/ports/documentStore.ts:167`, `sqliteDocumentStore.ts:965`, `document-persistence.test.ts:598` |
| 7 | **Shutdown does not drain the queues.** `JobScheduler` has no `stop()`, `drain()`, `cancel()`, or `AbortSignal`. `app.close()` waits for in-flight HTTP requests but not for internal jobs | `0-utils/jobs/scheduler.ts` (279 lines, no such method); `startBackend.ts:220-227` |
| 8 | **Compute has no timeout of its own.** The only bound on a compute stage is the Intelligence provider's HTTP timeout (`intelligence.providers.openrouter.timeoutMs`, default 30 000). A hung compute holds a concurrent worker slot indefinitely with no operator lever | `0-utils/jobs/scheduler.ts`; `etc/configuration.yaml:34` |
| 9 | **`InternalJobIntent`, `JobAdmissionReceipt` and `ResponseMode` are exported and unused** outside `0-utils/`; capabilities declare their own structurally compatible intent unions | `0-utils/jobs/internalRuntime.ts:11`, `0-utils/jobs/types.ts:51`, `:5` |
| 10 | **`SchedulerInternalJobsRuntime`'s sequence counter is per-instance.** Job IDs are `internal-<slug>-<n>`. Only one instance exists today (`documentJobs`), so no collision — but a second runtime registering an identically named intent type would mint the same ID | `internalRuntime.ts:92`, `:104` |
| 11 | **Document's stage terminal-state list is duplicated,** once in the service and once in the store. Nothing enforces that they agree | `documentService.ts:1783`, `sqliteDocumentStore.ts:147` |

### 11.1 On the poison pill, specifically

It is worth spelling out because the failure mode is quiet. Activity's store computes a digest
over the transaction and, on a repeated id, compares:

```ts
// 3-capabilities/activity/persistence/sqliteActivityStore.ts:149-153
if (existing) {
  if (existing.transaction_digest !== digest) {
    throw new ActivityTransactionConflictError(transaction.id);
  }
  return rowToTransaction(existing);
}
```

A producer that reuses a `sourceTransactionId` with different content therefore throws on every
delivery attempt. Because Document's transaction id is
`` `document:${documentId}:${sourceRequestId}:${kind}` `` and Document's request receipts already
guarantee that a given `requestId` produces one result, this should not happen in normal
operation — but if it does (a receipt pruned, a restored database, a client reusing a request id
across a purge-and-recreate), the row is permanently undeliverable.

Document logs `document.activity.publish-failed` and Templates logs
`templates.activity.publish-failed`, both at **warn**; Comments logs
`comments.activity.publish.failed` — note the dot: the three event names do not agree, so an
operator cannot grep one pattern for all three. Document and Comments log once per drain and
move on; Templates stops the whole drain. The outbox row is never pruned by retention
([04 §9.3](04-state-and-persistence.md)), so it is retried at every restart for the life of the
database.

No test covers this path. The Activity module's own docs do not mention it either.

---

## 12 · Quick reference

| Question | Answer |
| --- | --- |
| What does a 202 from `POST /documents/command` mean? | An attempt row is durable and compute has been dispatched. Nothing has been committed |
| How do I find out what happened to an attempt? | `document.attempt` query by `attemptId`; terminal states are `settled`, `unchanged`, `stale`, `failed` |
| What makes a duplicate internal dispatch safe? | The `UNIQUE` idempotency key on `stage_receipts`, checked by `claimStage` before any work |
| What happens if the process dies mid-compute? | Startup flips the `running` receipt to `failed` and re-dispatches from the attempt's state |
| What happens if the process dies mid-refresh (Derived Outputs)? | Nothing. The attempt row stays `settled = 0` and the claim stays pending |
| Can two refreshes of the same output both publish? | No. Fence 2 (`head_revision`) rejects the second, and the publish `UPDATE` is guarded again |
| Why is settle serial and compute concurrent? | Settle does a read-modify-write against document head; the serial queue is what makes that CAS safe to attempt at all |
| How long does a dispatch retry back off? | 25 ms doubling to a 2 s cap, forever, on an `unref()`ed timer |
| Where does an Activity transaction actually get written? | On commit for Document and Comments; on the next process start for Templates |
