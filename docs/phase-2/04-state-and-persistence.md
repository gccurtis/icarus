# 04 · State and Persistence

*Verified against source at commit ef6d462, 2026-08-09.*

Every durable byte in this backend lives in SQLite, in **12 database files holding 53 live
tables**, opened by `better-sqlite3` from 23 different source files. There is no shared
connection, no connection pool, no ORM, no query builder, and no migration runner. Each
capability writes its own DDL as a template string and executes it on construction.

That is not an accident of neglect — it is the "capabilities own their own storage" rule, stated
most clearly in a comment about the one place it is deliberately broken (§4). This page
describes what the rule buys, where it is enforced, and where it gives way.

Related pages: [03 · Capability anatomy](03-capability-anatomy.md) for the layer that owns a
store, [05 · The async attempt pipeline](05-async-attempt-pipeline.md) for the operational
tables (attempts, stage receipts, claims, outboxes) that this page only inventories, and
[09 · Configuration](09-configuration.md) for the retention and history knobs.

---

## 1 · The census

Measured by counting `CREATE TABLE` statements per schema file plus one per
`initializeResourceHistorySchema` call. Table counts include the shared history table where a
capability has one.

| DB file | Owner | Own tables | Shared `_history` | Total | Prefix |
| --- | --- | ---: | ---: | ---: | --- |
| `data/activity.db` | Activity | 3 | 0 | **3** | `activity_` |
| `data/comments.db` | Comments | 3 | 1 | **4** | `cmt_` |
| `data/connector.db` | Connector | 2 | 1 | **3** | `conn_` |
| `data/contexts.db` | Context | 1 | 1 | **2** | `ctx_` |
| `data/derived-outputs.db` | Derived Outputs | 8 | 1 | **9** | `do_` |
| `data/documents.db` | Document | 12 | 1 | **13** | `doc_` |
| `data/general-files.db` | General Files | 1 | 1 | **2** | `gf_` |
| `data/investigation.db` | Investigation | 3 | 1 | **4** | `inv_` |
| `data/knowledge.db` | Knowledge (platform) | 5 | 0 | **5** | `kn_` |
| `data/personas.db` | Persona | 1 | 1 | **2** | `psn_` |
| `data/structured-data.db` | Structured Data | 1 | 1 | **2** | `sd_` |
| `data/templates.db` | Templates | 3 | 1 | **4** | `tpl_` |
| | **Live total** | **43** | **10** | **53** | |
| *(never created)* | *Slides* | *12* | *1* | *(13)* | `slides_` |

Slides has a complete, typechecked, tested schema at
[`slides/persistence/sqliteSchema.ts`](../../apps/backend/src/3-capabilities/slides/persistence/sqliteSchema.ts)
and **nothing constructs it**. No `1-init/create/slides.ts` exists, `startBackend.ts` never
mentions Slides, and `slides.db` is never created. Its 13 tables are counted here only so a
reader who opens the file is not confused about why they cannot find the database. See
[07-capabilities/slides.md](07-capabilities/slides.md).

The 12 paths are all declared as cwd-relative string constants in `1-init/create/*.ts`, one per
capability — e.g.
[`1-init/create/document.ts:22`](../../apps/backend/src/1-init/create/document.ts)
(`const DOCUMENT_DB_PATH = "./data/documents.db";`). Because they are relative to the process
working directory, starting the backend from the repository root creates `<repo>/data/`, not
`apps/backend/data/`. Nothing guards against this.

**Activity and Knowledge are the two stores with no revision history table** — deliberately.
Activity is an append-only ledger where nothing is ever superseded; Knowledge is a rebuildable
derived index and is never an authority. Neither is registered with the retention scheduler
(§9).

---

## 2 · Project scoping is bound once at startup and never travels over HTTP

There is no `project_id` column anywhere. Scope is carried in the **table name**:

```ts
// 3-capabilities/document/persistence/sqliteSchema.ts:21-22
const projectPrefix = (projectId: string): string =>
  createHash("sha256").update(projectId).digest("hex").slice(0, 16);
```

That four-line function is copied verbatim into **13 files** — twelve capability stores
(eleven live plus the unreachable Slides) and the Knowledge platform store — under one of two
local names, `projectPrefix` or `tablePrefix`. The literal prefix plus the 16 hex characters
produce names like `doc_9f2c…a1_change_sets`.

`config.projectId` is read exactly once per store, at construction, inside
`1-init/create/*.ts`. Its default is the literal string `"default"`
([`loadBackendConfig.ts:201`](../../apps/backend/src/0-utils/config/loadBackendConfig.ts)), and
the shipped YAML sets it explicitly at `etc/configuration.yaml:211`.

Three facts follow, and all three were checked:

| Fact | Verification |
| --- | --- |
| No store method takes a project argument | Every `SQLite*Store` constructor takes `(projectId, dbPath)`; no interface method mentions a project |
| No HTTP path can select a project | `grep -rn "projectId" src/4-job-wiring/ src/2-transport/` returns **nothing**. `RequestEnvelope` ([`0-utils/types/request.ts`](../../apps/backend/src/0-utils/types/request.ts)) has `params`, `query`, `headers`, `body` — no scope field |
| The original project id is not recoverable from the database | Only the SHA-256 prefix is persisted. A `.db` file cannot say which project owns a prefix |

Two of the 13 copies name their parameter something other than `projectId`: Structured Data
calls it `ownerId`
([`structured-data/sqlite-store.ts:22-23`](../../apps/backend/src/3-capabilities/structured-data/sqlite-store.ts))
and Context calls it `id` (`context/sqlite-store.ts:22-23`). Both are passed `config.projectId`
at their single construction sites
([`1-init/create/structured-data.ts:15`](../../apps/backend/src/1-init/create/structured-data.ts),
`1-init/create/context.ts:10`), so the behaviour is identical; only the vocabulary differs. The
Structured Data factory carries the clearest statement of the intent:

> ```text
> // Structured Data is project-scoped at runtime. Prefixing by projectId keeps
> // tenant data separated inside the shared DB file.
> ```

---

## 3 · The revision models actually in use

Six models coexist. Knowing which one a capability uses is the first thing to establish before
changing it.

| Model | Used by | Law |
| --- | --- | --- |
| **Stateless** | Formula, Rich Text, Intelligence, Observability | No persistence at all. Same input ⇒ same output |
| **Typed current + generic history** | Context, Structured Data, General Files, Connector, Comments, Persona, Templates, Investigation, Derived Outputs | The typed table holds live rows only; superseded revisions and the terminal tombstone live in the shared history table |
| **Current head + Base/ChangeSets** | Document | A live head row plus materialised `Base` snapshots plus forward ChangeSets reconstructs any retained revision. `seq = revision = prior + 1`, enforced in SQL |
| **Mutable definition + immutable numbered revisions** | Derived Outputs | The definition changes in place under CAS; each published answer is an append-only `_revisions` row that outlives logical deletion |
| **Generation counter + rebuildable index** | Knowledge | Source windows are canonical; retrieval structures are disposable. `sources.revision` is an opaque caller string used only as a re-ingest guard |
| **Append-only ledger + TTL lease** | Activity (transactions) / Presence (leases) | Transactions are immutable and carry a monotonic project sequence; leases expire and never become history |

Per-capability specifics — where the `+1` is computed, whether the client supplies an expected
revision, and what an ID is derived from — are in the
[capability pages](07-capabilities/README.md). Three that differ from the obvious default:

- **Connector** and **General Files** have *deterministic* IDs (`sha256(provider + locator)` and
  `sha256(content)` respectively), so a resource can be re-created under an ID that already has
  history. Both call `nextRevisionAfterHistory`
  ([`resourceHistory.ts:153`](../../apps/backend/src/0-utils/persistence/resourceHistory.ts)),
  which returns `MAX(revision) + 1`, or `1` when there is no history at all. Re-registration
  therefore resumes at *terminal + 1* rather than restarting at 1 — until a purge erases the
  history, after which the same identity legitimately begins again at 1.
- **Context** always mints a fresh UUID, so `create` always writes revision 1.
- **Comments** has no `expectedRevision` on the wire at all. Its CAS is internal.

---

## 4 · The one shared table shape

`0-utils/persistence/` is 3 files and 434 lines. It is the only shared persistence code in the
tree, and it exists for a documented reason. The header of the smallest of the three files,
[`likePattern.ts:1-21`](../../apps/backend/src/0-utils/persistence/likePattern.ts), is the
codebase's clearest statement of its own storage-ownership rule *and its exception*, and is
worth quoting in full:

> ````text
> /**
>  * SQL `LIKE` treats `%` and `_` as wildcards, so caller-supplied text used as a
>  * substring filter has to be escaped or it silently stops being a substring
>  * filter: searching for `50%` matches every row, and `report_final` also matches
>  * `reportXfinal`.
>  *
>  * **This lives in `0-utils` rather than in each capability's persistence**, which
>  * is the one place this codebase's "capabilities own their own storage" rule
>  * gives way. The reason is history: Templates and General Files each grew a name
>  * filter independently, and they disagreed — one escaped and one did not, so the
>  * same query returned different results depending on which capability answered
>  * it. Four copies of a four-line function is cheap; four copies that disagree is
>  * a class of bug nobody goes looking for.
>  *
>  * Every call site must also declare the escape character, because SQLite has no
>  * default one:
>  *
>  * ```sql
>  * WHERE name LIKE ? ESCAPE '\'
>  * ```
>  */
> ````

Two footnotes the comment does not carry. The "four copies" is rhetorical: only **two**
capabilities currently do name filtering — General Files (three clauses,
`sqliteGeneralFileRepository.ts:146`, `:150`, `:154`) and Templates (one two-column clause,
`sqliteTemplateStore.ts:129-130`). And the exported constant `LIKE_ESCAPE_CHARACTER`
(`likePattern.ts:22`) is **dead**: every one of those four clauses writes the literal
`ESCAPE '\'` into its SQL string instead of interpolating it.

### 4.1 The shared DDL

[`resourceHistory.ts:43-65`](../../apps/backend/src/0-utils/persistence/resourceHistory.ts):

```sql
CREATE TABLE IF NOT EXISTS ${tableName} (
  resource_kind TEXT NOT NULL,
  resource_id   TEXT NOT NULL,
  revision      INTEGER NOT NULL CHECK (revision >= 1),
  record_type   TEXT NOT NULL CHECK (record_type IN ('snapshot', 'deleted')),
  snapshot_json TEXT,
  recorded_at   TEXT NOT NULL,
  PRIMARY KEY (resource_kind, resource_id, revision),
  CHECK (
    (record_type = 'snapshot' AND snapshot_json IS NOT NULL) OR
    (record_type = 'deleted' AND snapshot_json IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS ${tableName}_recorded
  ON ${tableName}(recorded_at, resource_kind, resource_id);
```

| Column | Meaning |
| --- | --- |
| `resource_kind` | Discriminator, so one history table serves several resource types. Investigation is the only capability that uses more than one value (`question`, `hypothesis`, `finding`); every other capability passes a constant so it can share the same helper functions |
| `resource_id` | The capability's own resource ID |
| `revision` | 1-based. **The history table holds superseded revisions only** — never the live one |
| `record_type` | `snapshot` (a superseded state) or `deleted` (a terminal tombstone) |
| `snapshot_json` | `JSON.stringify(snapshot)`. NULL exactly when `record_type = 'deleted'`, enforced by the table CHECK |
| `recorded_at` | ISO-8601, always supplied by the caller. Never `CURRENT_TIMESTAMP` |

`tableName` is **string-interpolated into the SQL**, not bound. That is safe because every caller
passes a locally constructed constant of the form `` `${prefix}_history` `` where the prefix
embeds a SHA-256 hash — but it means `tableName` is trusted input, and a future caller that
forwards user text would be an injection.

### 4.2 The nine helpers

| Export | Line | Behaviour |
| --- | ---: | --- |
| `initializeResourceHistorySchema` | 43 | The DDL above, `IF NOT EXISTS` |
| `insertHistorySnapshot` | 67 | `INSERT … 'snapshot'` with `JSON.stringify(snapshot)` |
| `insertHistoryDeletion` | 91 | `INSERT … 'deleted', NULL` |
| `getResourceHistory<T>` | 124 | `ORDER BY revision ASC` |
| `getLatestHistoryRecord` | 138 | `ORDER BY revision DESC LIMIT 1` |
| `nextRevisionAfterHistory` | 153 | `MAX(revision) + 1`, or `1` when there is no history |
| `purgeResourceHistory` | 167 | **Guarded.** Returns `false` unless the latest record is `deleted`; otherwise deletes every row for that resource |
| `pruneHistoryBefore` | 187 | See §9.2 |
| `listExpiredDeletedResources` | 215 | Resources whose max-revision record is `deleted` and older than the cutoff |

### 4.3 The exact line between shared and capability-owned

This is the trade the design makes, and it is worth stating precisely because it is not
obvious from the file list.

| Shared in `0-utils/persistence/resourceHistory.ts` | Owned by each capability |
| --- | --- |
| The history table's column set | The database **file** |
| Its CHECK constraints and primary key | The history table's **name** |
| Its `_recorded` index | Every current/live table and every index on one |
| The SQL for insert / read / prune / purge | The transaction that pairs an archive with a current-row write |
| `ResourceNotDeletedError`, `ResourceHistoryNotFoundError` | The `resourceKind` string values |
| The `ResourceRetentionPort` interface | The decision of **when** to archive |
| | Retained capability state removed alongside history (Bases, ChangeSets, identity ledgers, attempts, receipts, outboxes) |

What the sharing buys: ten stores agree on what a superseded revision looks like, one prune
implementation is correct for all of them, and — because both error classes are shared — every
capability's purge endpoint returns the same status codes without coordination. What it costs:
the history table is the one place a capability cannot change its own storage shape
unilaterally, and `initializeResourceHistorySchema` interpolates a table name supplied by its
caller.

### 4.4 The eleven history tables

Ten are created at startup; the eleventh belongs to Slides and is never reached.

| Capability | Table | Initialised at |
| --- | --- | --- |
| General Files | `gf_<prefix>_history` | `sqliteGeneralFileRepository.ts:64` |
| Connector | `conn_<prefix>_history` | `sqliteConnectorRepository.ts:93` |
| Structured Data | `sd_<prefix>_history` | `structured-data/sqlite-store.ts:49` |
| Context | `ctx_<prefix>_history` | `context/sqlite-store.ts:41` |
| Derived Outputs | `do_<prefix>_history` | `derived-outputs/sqlite-store.ts:167` |
| Persona | `psn_<prefix>_history` | `persona/persistence/sqliteSchema.ts:58` |
| Comments | `cmt_<prefix>_history` | `comments/persistence/sqliteSchema.ts:83` |
| Document | `doc_<prefix>_history` | `document/persistence/sqliteSchema.ts:317` |
| Templates | `tpl_<prefix>_history` | `templates/persistence/sqliteSchema.ts:95` |
| Investigation | `inv_<prefix>_history` | `sqliteInvestigationStore.ts:194` |
| **Slides** | `slides_<prefix>_history` | `slides/persistence/sqliteSchema.ts:309` — **unreachable** |

`resourceKind` values in use: `"general-file"`, `"connector"`, `"structured-data"`,
`"context"`, `"derived-output"`, `"persona"`, `"comment"`, `"document"`, `"template"`, and
Investigation's three-value union `"question" | "hypothesis" | "finding"`.

### 4.5 The one cross-capability HTTP contract

The two shared error classes are the only vocabulary in the tree that ten independent wiring
files agree on:

| Error | Status | Body |
| --- | ---: | --- |
| `ResourceNotDeletedError` | **409** | `{ error: "not_deleted", message }` |
| `ResourceHistoryNotFoundError` | **404** | `{ error: "not_found", message }` |

Mapped identically at `general-files/registerGeneralFileEndpointMappings.ts:18-19`,
`connector/registerConnectorEndpointMappings.ts:31-32`,
`structured-data/registerStructuredDataEndpoints.ts:18-19`,
`context/registerContextEndpoints.ts:15-16`,
`derived-outputs/registerDerivedOutputEndpoints.ts:16-18`,
`investigation/registerInvestigationEndpoints.ts:411-414`,
`comments/registerCommentEndpoints.ts:26-29`,
`document/registerDocumentEndpoints.ts:34-37`,
`persona/registerPersonaEndpoints.ts:21-24`, and
`templates/registerTemplateEndpoints.ts:24-27`.

**Two services match on `error.name` rather than `instanceof`.** Both are swallowing
`ResourceHistoryNotFoundError` from a cascade purge that a retry has already completed:

```ts
// documentService.ts:976 — and personaService.ts:466, character for character
if (!(error instanceof Error && error.name === "ResourceHistoryNotFoundError")) throw error;
```

Renaming that class without updating both string literals would turn a swallowed retry into a
thrown 404.

---

## 5 · Typed current tables hold live rows only

There is no soft-delete flag anywhere in the live backend. Confirmed by inspection: no
`deleted_at`, `is_deleted`, `archived_at`, or `state = 'deleted'` column exists on any current
table. Normal `get` / `list` / `resolve` queries read the typed table and therefore see live
rows by construction — there is no filter to forget.

Two near-misses worth naming so a reader does not mistake them for soft deletes:

- **`DocumentLifecycle` is `active | archived`**
  ([`document/domain/model.ts:14`](../../apps/backend/src/3-capabilities/document/domain/model.ts),
  SQL CHECK at `sqliteSchema.ts:63-64`). Archiving is a live state, not a deletion. `grep -rn -i
  "trashed" apps/backend/src` returns hits only under `slides/`
  (`slides/domain/model.ts:13`, `slides/persistence/sqliteSchema.ts:65`) — the unreachable
  capability still carries a three-value lifecycle including `trashed`. Document's `trashed`
  state is genuinely gone.
- **Document's identity ledger has an `active | tombstoned` column**
  (`document/persistence/sqliteSchema.ts:118-119`). That is a *structural identity* state — it
  prevents a block or style ID from being reused — not a resource deletion state. A logically
  deleted Document has no row in `documents` at all; it is not a tombstoned current document.

Templates says this most directly, in a schema comment
([`templates/persistence/sqliteSchema.ts:53`](../../apps/backend/src/3-capabilities/templates/persistence/sqliteSchema.ts)):

> ```text
> -- Every row is a live, usable template; there is no state to filter on.
> ```

and again for the uniqueness index (`:58-59`):

> ```text
> -- No partial predicate: deletion removes the live row rather than flagging
> -- it, so a name is freed by construction rather than by a predicate.
> ```

---

## 6 · Archive, then advance

Every capability that keeps history follows the same two-statement shape inside one SQLite
transaction: **write the pre-image to history first, then write the new current row**, with the
old revision in the `WHERE` clause of the write. If the CAS fails the archive is rolled back
with it.

Context is the shortest example
([`context/sqlite-store.ts:110-139`](../../apps/backend/src/3-capabilities/context/sqlite-store.ts)),
and it is representative:

```ts
update(record: ContextRecord, expectedRevision: number): boolean {
  return this.db.transaction(() => {
    const row = this.db.prepare(`
      SELECT * FROM ${this.tableName} WHERE id = ? AND revision = ?
    `).get(record.id, expectedRevision);
    if (!row) return false;                        // ← conflict, nothing written
    insertHistorySnapshot(this.db, this.historyTableName, {
      resourceKind: "context",
      resourceId: record.id,
      revision: expectedRevision,                  // ← the OLD revision
      snapshot: rowToRecord(row),
      recordedAt: record.updatedAt
    });
    const result = this.db.prepare(`
      UPDATE ${this.tableName} SET … revision = ?, updated_at = ?
      WHERE id = ? AND revision = ?                // ← guarded a second time
    `).run(…, record.revision, record.updatedAt, record.id, expectedRevision);
    return result.changes === 1;
  })();
}
```

Structured Data (`sqlite-store.ts:143-180`), Persona
(`sqlitePersonaStore.ts:125-164`), Templates, Comments, Investigation, Connector, General
Files, and Derived Outputs (`archiveOutput`, `sqlite-store.ts:904-912`) all repeat this shape.
Document does it inside its much larger `commitMutation`
([`sqliteDocumentStore.ts:397-486`](../../apps/backend/src/3-capabilities/document/persistence/sqliteDocumentStore.ts)),
which commits head + ChangeSet + receipt + outbox row + identity transitions + attempts +
prompt-ownership transitions together, conditional on `expectedRevision`, and returns `false`
on conflict.

**The history revision is always the superseded one.** A resource at revision 5 that is updated
to 6 writes history row `revision = 5`. This is why the history table never contains the live
revision, and why `nextRevisionAfterHistory` returns `MAX + 1`.

---

## 7 · Logical deletion is a terminal revision, not a flag

Deletion writes **two** history rows and removes the current row, in one transaction:

1. `insertHistorySnapshot(kind, id, N, snapshot)` — archive the live state at revision `N`.
2. `insertHistoryDeletion(kind, id, N + 1)` — a `deleted` record with `snapshot_json` NULL.
3. `DELETE FROM <current table> WHERE id = ?` (usually also `AND revision = ?`).

The delete result is `N + 1`, and that number is what the endpoint returns to the caller. So a
resource's revision sequence continues through its own death: the tombstone *is* a revision.

General Files takes this one step further, and it is worth calling out because it looks
surprising: because a General File's ID is `sha256(content)`, **replacing a file's content is
modelled as deleting the old ID**. `replace()`
([`sqliteGeneralFileRepository.ts:198-246`](../../apps/backend/src/3-capabilities/general-files/persistence/sqliteGeneralFileRepository.ts))
inserts the new content-addressed row, archives the previous row with `replacedById` stamped
into the snapshot, writes a terminal `deleted` record at `previous.revision + 1`, and deletes
the previous row. The `replaces_id` / `replaced_by_id` columns preserve the chain. A superseded
General File is therefore terminally deleted history, not a superseded live row.

Capabilities that own resources in *other* capabilities do that cleanup first, before anything
is destroyed. Document's is the clearest, and it explains why
([`documentService.ts:913-916`](../../apps/backend/src/3-capabilities/document/application/documentService.ts)):

> ```text
> // Derived Outputs live in another capability's store, so the cascade cannot
> // reach them — it only clears the ownership rows that point at them. They
> // are removed first, before anything is destroyed, so a failure here leaves
> // the document intact and the command retryable.
> ```

---

## 8 · Purge is the only irreversible interface, and it is guarded twice

Ten capabilities can purge. Six reach it through **8 dedicated `POST …/purge` endpoints** —
`/contexts/purge`, `/connector/purge`, `/structured-data/purge`, `/derived-outputs/purge`,
`/general-files/purge`, and Investigation's three (`/questions/purge`, `/hypotheses/purge`,
`/findings/purge`). Four reach it through a command envelope instead: `document.purge`
(`document/domain/model.ts:645`), `template.purge` (`templates/domain/model.ts:148`),
`persona.purge` (`persona/domain/model.ts:119`), and `comment.purge`
(`comments/domain/model.ts:67`). Every one of the ten reaches the same guard.

The guard lives in `purgeResourceHistory`
([`resourceHistory.ts:167-185`](../../apps/backend/src/0-utils/persistence/resourceHistory.ts)):

```ts
const latest = getLatestHistoryRecord(db, tableName, resourceKind, resourceId);
if (!latest || latest.recordType !== "deleted") return false;
```

and every store adds an earlier check for a live row. Derived Outputs' `purgeOutput`
([`derived-outputs/sqlite-store.ts:494-514`](../../apps/backend/src/3-capabilities/derived-outputs/sqlite-store.ts))
is typical:

| Check, in order | If it fails |
| --- | --- |
| 1. There is **no** live row in the current table | `ResourceNotDeletedError` → **409 `not_deleted`** |
| 2. A latest history record exists **and** its `record_type` is `deleted` | `ResourceHistoryNotFoundError` → **404 `not_found`** |

Only then does purge delete history and any capability-owned retained state. Two consequences
follow that a reader should not have to discover:

- **Purge emits no Activity transaction and writes no outbox row.** Document's purge
  (`purgeRetainedDocument`, `documentService.ts:971-982`; store guard at
  `sqliteDocumentStore.ts:1038-1046`) deletes the `resources` root and lets the FK cascade take
  `bases`, `change_sets`, `identity_ledger`, `retained_outputs` and history. Previously
  committed outbox rows survive with `resource_root_id` set to NULL — the schema comment at
  `document/persistence/sqliteSchema.ts:193-194` says why:

  > ```text
  > -- Structural attachment while retained; SET NULL lets the immutable
  > -- transaction survive resource purge as required by ledger retention.
  > ```

- **Derived Outputs runs two cascades off two roots, in order.** Logical delete cascades the
  *operational* tables off `_outputs` (declarations, refresh claims, definition-update claims,
  refresh attempts); purge cascades the *answer* table off `_resources` (`_revisions`). That
  is why `GET /derived-output-revisions?outputId=X&revision=N` still returns 200 for a
  logically deleted output while `GET /derived-outputs?id=X` returns 404. The asymmetry is the
  point of the retained root, not an oversight.

---

## 9 · Retention

### 9.1 The scheduler

[`0-utils/persistence/resourceRetentionScheduler.ts`](../../apps/backend/src/0-utils/persistence/resourceRetentionScheduler.ts)
is 161 lines and carries its own design comments:

> `:39-42`
> ```text
> /**
>  * Runs every capability in a deterministic sequence. Each purge and prune is
>  * isolated so one resource or capability cannot abort the rest of the sweep.
>  */
> ```

and, for the helper that produces each port:

> `:26-29`
> ```text
> /**
>  * Binds capability methods without leaking their receiver. This also keeps the
>  * composition root independent of every capability's concrete retention type.
>  */
> ```

Exact behaviour:

| Property | Detail |
| --- | --- |
| Ports | **11**, registered at [`startBackend.ts:123-147`](../../apps/backend/src/1-init/startBackend.ts) |
| Order | `document → persona → templates → templates-orphans → investigation → derived-outputs → comments → connector → general-files → structured-data → context` |
| Per port | `purgeExpired(cutoff)` **first**, then `pruneHistory(cutoff)`; each in its own `try/catch` |
| Cutoff | One per sweep: `now − revisionRetentionDays × 86 400 000`, ISO-8601 (`:98-100`) |
| Start | `start()` is idempotent, runs **one awaited sweep**, re-checks `started`, then arms `setInterval` and calls `timer.unref()` (`:66`) |
| Overlap | `runNow()` coalesces — a tick during an active sweep joins it (`:85-94`) |
| Stop | Clears the timer and `await`s the in-flight sweep |
| Defaults | `revisionRetentionDays: 30`, `sweepIntervalHours: 24` (`loadBackendConfig.ts:255-256`, matching `etc/configuration.yaml:206-208`) |

The order is load-bearing, and `startBackend.ts:121-122` says so:

> ```text
> // Parent resources precede their owned resources so retention can cascade
> // through ownership before a generic child sweep sees the same history.
> ```

`templates-orphans` is not a capability. It is an inline `ResourceRetentionTarget`
(`{ pruneHistory: () => 0, purgeExpired: (cutoff) => templates.collectOrphanedResources(cutoff) }`)
with its own justification at `startBackend.ts:129-133`:

> ```text
> // Rides the retention sweep rather than owning a timer: it is the same
> // shape of work — conservative, cutoff-driven, reaping what nothing
> // references — and a second scheduler would be a second thing to
> // configure, observe, and shut down. The retention cutoff doubles as the
> // grace period that tells an orphan from a registration in flight.
> ```

Start ordering matters and is asserted by a source-scanning test. `startBackend.ts:210-212`:

> ```text
> // Start recurring work only after the transport has bound successfully.
> // Otherwise a listen failure would leave interval timers keeping the
> // failed startup process alive.
> ```

`runtime-wiring.test.ts:212-222` compares source-text indices to assert `syncScheduler.start()`
appears after `await app.listen`. **It does not make the same assertion about
`retentionScheduler.start()`** — moving that call above `app.listen` would fail nothing.

### 9.2 What prune actually deletes

`pruneHistoryBefore` (`resourceHistory.ts:187-213`) does two things.

1. Always: delete every row with `recorded_at < cutoff` **except** the max-revision `deleted`
   row of each resource. Preserving that tombstone is what makes purge-after-prune still work —
   `purgeResourceHistory` recognises a resource as deleted only by looking at its latest record.
2. If an `isCurrent` callback is supplied: for each resource returned by
   `listExpiredDeletedResources`, if the resource is **live again**, also delete its expired
   `deleted` rows. This is the deterministic-ID case — a Connector or General File can be
   re-created under an ID that already has a tombstone, at which point the tombstone is no
   longer terminal and can go.

`isCurrent` is optional in the signature and **all ten call sites supply it**
(`sqliteInvestigationStore.ts:581`, `sqliteCommentStore.ts:378`,
`sqliteGeneralFileRepository.ts:314`, `sqliteDocumentStore.ts:1181`,
`sqliteConnectorRepository.ts:389`, `structured-data/sqlite-store.ts:229`,
`sqliteTemplateStore.ts:330`, `context/sqlite-store.ts:183`, `sqlitePersonaStore.ts:211`,
`derived-outputs/sqlite-store.ts:517`).

**The cutoff comparison is strict `<`.** A record recorded exactly at the cutoff instant
survives. `resource-retention.test.ts:25-54` pins this with a test literally named *"the
retention boundary keeps 29- and 30-day records and expires 31-day records"*.

### 9.3 What retention does not touch

The shipped configuration says it, at `etc/configuration.yaml:204-205`:

> ```text
> # Resource revision-history retention. This does not prune Activity,
> # transaction outboxes, command receipts, or delegated claims.
> ```

That is accurate about Activity, the outboxes, and the receipts. The phrase **"delegated
claims" describes nothing that exists** — there is no delegated-claim table in the tree
(see [05 · The async attempt pipeline](05-async-attempt-pipeline.md) §7). It is a stale term
in a live config file.

To that list, add: retention does not prune Derived Outputs' three claim tables, does not
prune Document's attempts or stage receipts on a *time* basis (those are bounded by count, §10),
does not touch Knowledge, does not run `VACUUM`, and does not rotate or delete log files.

Once a Document revision is pruned, a revision-qualified load raises `HistoryPrunedError`
([`document/domain/errors.ts:42-45`](../../apps/backend/src/3-capabilities/document/domain/errors.ts))
→ **410 `history_pruned`** (`registerDocumentEndpoints.ts:46-47`). It is the only 410 in the
backend.

### 9.4 Document's second, count-based retention

Document is the one capability with two retention controls. `config.document.history`
(`retainedBaseCount: 5`, `retainedChangeSetCount: 1000`, `retainedTerminalAttemptCount: 1000`;
`loadBackendConfig.ts:240-242` and `etc/configuration.yaml:191-194`) bounds structural history
by **count**, and drives the serial `document.compact` internal job. `config.retention` bounds
resource history by **time**, and drives the shared sweep.

Compaction is where the two meet. `compactRetentionHistory`
(`sqliteDocumentStore.ts:1122-1177`) writes an anchor `Base` at the earliest retained revision
and then deletes `change_sets WHERE seq <= anchor` and `bases WHERE base_seq < anchor`. The
count-based path additionally deletes history *envelopes* below the change cutoff, and says why
(`sqliteDocumentStore.ts:620-623`):

> ```text
> // A retained head envelope must always have enough Base/Change Set
> // data to reconstruct it. Count-based compaction makes revisions below
> // the anchor unavailable, so remove those envelopes in the same
> // transaction instead of leaving misleading retained history behind.
> ```

Terminal attempts are trimmed to the newest `retainedTerminalAttemptCount` by
`updated_at DESC, id DESC` in the same transaction (`sqliteDocumentStore.ts:633-651`).

---

## 10 · Concurrency control

Four distinct patterns are in use. All four rely on `better-sqlite3` being synchronous — the
whole read-modify-write happens inside one `db.transaction(...)` with no `await` in the middle.

| # | Pattern | Used by | Conflict signal |
| --- | --- | --- | --- |
| 1 | **Client-supplied `expectedRevision`** on the wire, checked in the `WHERE` clause | Structured Data, Context, Connector, Persona, Templates, Document, Investigation | `false` / `undefined` from the store, mapped to a typed error → **409** |
| 2 | **Internal CAS with no wire field** | Comments | Never surfaces as 409; the service re-reads |
| 3 | **Multi-statement transactional commit** | Document `commitMutation` | `false` → `RevisionConflictError` → 409 |
| 4 | **Multi-fence CAS across two dimensions plus a generation counter** | Derived Outputs `settleRefresh` | A `SettleRefreshState` discriminant, not an exception — see [05](05-async-attempt-pipeline.md) §5 |

Two implementation details worth knowing before touching any of them:

- Derived Outputs' settle path uses `db.transaction(...).immediate()`, which takes a write lock
  at `BEGIN` rather than on first write. Everything else uses the deferred default.
- Document additionally admits *stale-revision* submissions through a set-disjointness test
  rather than rejecting them. `canRebase` (`document/domain/rebase.ts`) compares the touched-ID
  footprint of the incoming operations against the `touched_ids_json` of every intervening
  ChangeSet; disjoint means the submission is applied against current head, overlapping means
  `RevisionConflictError`. **No operation is rewritten** — this is an admission test, not
  operational transformation.

---

## 11 · Idempotency: receipts and claims

Two mechanisms, three storage shapes. Neither is a queue and neither is a lock.

### 11.1 Request receipts — keyed by a caller-supplied `requestId`

Document, Comments, and Templates all take a `requestId` in the **request body** and store
`(request_id, request_digest, result_json)`. A retry with the same body replays the stored
result; the same `requestId` with a *different* body is a 409 `idempotency_mismatch`.

| Capability | Table | Key | Notes |
| --- | --- | --- | --- |
| Document | `doc_<p>_command_receipts` | `(document_id, request_id)` | FK cascade off `documents` |
| Document | `doc_<p>_create_receipts` | `request_id` alone | Separate table with its own rationale, below |
| Comments | `cmt_<p>_receipts` | `request_id` | Flat |
| Templates | `tpl_<p>_command_receipts` | `request_id` | Flat |

Document's split into two receipt tables is explained in the schema
(`document/persistence/sqliteSchema.ts:90-98`):

> ```text
> -- Replay record for document.create. Keyed by request id alone, because the
> -- document id does not exist until the service allocates one and a retry has
> -- nothing else to look up with.
> --
> -- It still carries document_id, purely so it can CASCADE. A receipt records
> -- "this request produced that document"; once the document is deleted the
> -- record is meaningless, and replaying it would hand the caller a head for a
> -- document that no longer exists — every subsequent load would 404. Letting
> -- an old request id create a fresh document is the coherent outcome.
> ```

Templates states the same policy for its whole table
(`templates/persistence/sqliteSchema.ts:63-65`):

> ```text
> -- Idempotency without reservation: a completed command records what it
> -- returned, and an exact retry replays it. Nothing is claimed ahead of the
> -- work, so there is no pending state and no identity to freeze.
> ```

Document reserves a request-ID namespace so an external caller cannot forge an internal
settlement: `INTERNAL_REQUEST_PREFIX = "$document-internal$:"`
(`documentService.ts:144`), and `command()` rejects any external request whose ID starts with
it (`documentService.ts:293-295`, `DocumentOperationError("Request ID uses a reserved Document
namespace")`).

### 11.2 Idempotency claims — Derived Outputs

Three separate claim tables, because their replay payloads differ. Details and the digest
inputs are in [05 · The async attempt pipeline](05-async-attempt-pipeline.md) §6. The
persistence-side facts:

- All three carry the same two CHECKs: a non-blank key of at most 512 characters, and a
  64-character lowercase-hex digest (`derived-outputs/sqlite-store.ts:86-89`, `:98-101`,
  `:116-119`).
- The two result-carrying tables add `CHECK ((result_json IS NULL) = (completed_at IS NULL))`
  — a claim is either fully pending or fully completed, never half.
- All three FK to `_outputs` with `ON DELETE CASCADE`, so a logical delete makes previously
  used keys reusable.
- **A claim is not a lock.** The capability's own `docs/invariants.md:82` says so: *"A key claim
  is not a durable queued job and not strict single-flight: an incomplete same-key caller may
  recompute."*

### 11.3 Document's stage receipts

`doc_<p>_stage_receipts` (`document/persistence/sqliteSchema.ts:298-315`) is the third shape:
`PRIMARY KEY (attempt_id, stage)` plus a `UNIQUE` idempotency key of the form
`` `document:${attemptId}:${stage}` ``. It is the mechanism that makes a duplicate internal
dispatch a no-op. Covered in [05](05-async-attempt-pipeline.md) §3.

---

## 12 · The PRAGMA situation

**There are 13 sites that open a SQLite connection and set `journal_mode = WAL`. They do not
agree on anything else.** The superseded design page at
`phase-1/claude-notes/04-state-and-persistence.md` states that every schema initialiser opens
with the same four pragmas; that is false in **6 of the 13**, which is why the full table is
reproduced here.

| Pragmas set | Sites | Files |
| --- | ---: | --- |
| WAL + `foreign_keys=ON` + `busy_timeout=5000` + `synchronous=NORMAL` | **7** | comments `sqliteSchema.ts:29-32`, persona `:22-25`, document `:49-52`, templates `:29-32`, activity `:26-29`, slides `:47-50` *(unreachable)*, derived-outputs `sqlite-store.ts:235-238` |
| WAL + `busy_timeout` + `synchronous` — **no `foreign_keys`** | **1** | investigation `sqliteInvestigationStore.ts:114-116` |
| WAL + `synchronous` + `foreign_keys` — **no `busy_timeout`** | **3** | general-files `sqliteGeneralFileRepository.ts:101-106`, connector `sqliteConnectorRepository.ts:138-143`, knowledge `0-platform/database/knowledge-store.ts:88-90` |
| **WAL only** | **2** | context `sqlite-store.ts:65`, structured-data `sqlite-store.ts:86` |

So **8 of 13 sites set `busy_timeout = 5000`** and 5 do not. On the 5 that do not, SQLite's
default busy timeout is 0: a concurrent writer gets `SQLITE_BUSY` immediately rather than
retrying for five seconds. In practice the backend runs one process with one connection per
file, so the window is narrow — but WAL explicitly permits a reader and a writer concurrently,
and Connector's sync scheduler writes on a timer while HTTP jobs read.

`foreign_keys` is the one that could have real consequences. **Three sites never set it**
(Investigation, Context, Structured Data) and **two set it after the DDL runs** (General Files,
Connector). Nothing is broken today, for reasons worth stating so a future change does not
break it:

- **Investigation, Context and Structured Data declare no foreign keys at all**, so there is
  nothing to enforce. A future FK in `inv_*`, `ctx_*` or `sd_*` would be silently unenforced.
- **General Files and Connector set the pragma *after* `createSchema(...)`.** The DDL is
  unaffected — SQLite parses `FOREIGN KEY` clauses regardless of the setting — and because the
  pragma is applied outside any transaction it takes effect for every subsequent statement.
  Connector's one real FK (`conn_<p>_items.entry_id → conn_<p>_entries(id) ON DELETE CASCADE`,
  `sqliteConnectorRepository.ts:85-87`) is therefore enforced. It is an inconsistency of
  ordering, not a live defect.

One more gap worth recording because a reader will hit it: the Knowledge platform store's own
module documentation (`0-platform/database/docs/concepts.md:46-48`) lists its three pragmas
correctly but does not say that **8 capability stores set a `busy_timeout` this one does not**.
That is not drift — it is an accurate page that lacks the comparison.

---

## 13 · Constraints do real work

The DDL is not a formality. Document's schema is the model, and every one of these is enforced
by SQLite rather than only by TypeScript
([`document/persistence/sqliteSchema.ts`](../../apps/backend/src/3-capabilities/document/persistence/sqliteSchema.ts)):

```sql
CHECK (base_seq <= revision)                                    -- :72
CHECK (lifecycle IN ('active', 'archived'))                     -- :64
CHECK (is_template IN (0, 1))                                   -- :66
CHECK (seq = revision)                                          -- :171
CHECK (revision = prior_revision + 1)                           -- :172
UNIQUE (document_id, seq)                                       -- :169
UNIQUE (document_id, revision)                                  -- :170
CHECK ((state = 'active'     AND tombstoned_revision IS NULL)
    OR (state = 'tombstoned' AND tombstoned_revision IS NOT NULL))  -- :125-128
CHECK (state != 'attached' OR attached_revision IS NOT NULL)    -- :287
UNIQUE (document_id, block_id)                    -- prompt_outputs, :286
UNIQUE (document_id, revision)                    -- transaction_outbox, :212
```

Partial indexes back work queues rather than general lookups — three of them, all of the form
`WHERE <state predicate>`: unpublished outbox rows (`:219-221`), detached prompt outputs
(`:294-296`), and the `prompt-create` block reservation
(`CREATE UNIQUE INDEX … ON attempts(document_id, block_id) WHERE kind = 'prompt-create'`,
`:271-273`).

Other capabilities enforce their own domain rules the same way. General Files makes its
content-addressing checkable:

```sql
id TEXT PRIMARY KEY CHECK (length(id) = 64 AND id NOT GLOB '*[^0-9a-f]*')   -- :28-29
CHECK (byte_size = length(CAST(content AS BLOB)))                            -- :47
CHECK (content_hash = id)                                                    -- :48
```

Connector validates its JSON columns in SQL
(`json_valid(sync_config_json) AND json_type(sync_config_json) = 'object'`,
`sqliteConnectorRepository.ts:46-48`). Activity constrains its meta row to a singleton
(`CHECK (singleton_key = 'activity')`, `activity/persistence/sqliteSchema.ts:33`) and its
sequence to `UNIQUE` (`:43`).

JSON payloads are stored as `BLOB` in the newer schemas (Document, Comments, Templates,
Activity, Slides) and as `TEXT` in the older ones (Context, Structured Data, Connector, General
Files, Derived Outputs, Knowledge). Nothing depends on the difference; it is a chronology
marker.

---

## 14 · Fresh schemas, not migrations

There is no migration runner, no `schema_migrations` table, no version column, and no checksum
anywhere in the backend. `grep -rn -i "no migration\|not migrate\|no legacy" apps/backend/src`
returns **zero hits** — this policy is stated in no code comment. Every schema file uses
`CREATE TABLE IF NOT EXISTS` and describes only the current layout; an existing database with
an incompatible shape is neither detected nor upgraded.

The one module doc that names this correctly is
`0-platform/database/docs/concepts.md:50`: *"There is no versioned migration or checksum.
Existing incompatible schemas are not upgraded."*

`docs/phase-1/platform/database.md` describes a `Database` platform object, a
`CapabilityMigration` type, a migration registry, checksummed migrations, and a rule that
"repositories never open their own hidden connection". **None of it exists.** That page is
superseded; the module's own README already flags it: *"The older Database platform design
describes an intended broader boundary; it must not be read as implemented behavior."*
(`0-platform/database/docs/README.md:7`).

---

## 15 · What is not implemented, and what is broken

| # | Statement | Evidence |
| --- | --- | --- |
| 1 | **Nothing ever closes a SQLite connection.** Six stores expose `close()` (`SQLiteActivityStore`, `SQLiteCommentStore`, `SQLiteInvestigationStore`, `SQLiteDocumentStore`, `SQLiteSlidesStore`, `SQLiteKnowledgeStore`; `SQLiteTemplateStore` has none). None is called outside tests | `startBackend.ts:220-227` stops timers, closes Fastify, flushes the logger, and calls `process.exit(0)` with every handle open. The `-wal` / `-shm` files left in `data/` are the visible result |
| 2 | **There is no shared `Database` platform.** `0-platform/database/` is a single 389-line SQLite adapter for Knowledge and nothing else | 23 source files import `better-sqlite3` directly |
| 3 | **Retention never runs `VACUUM`,** so a purged database does not shrink | `resourceRetentionScheduler.ts` has no `VACUUM` and neither does any store |
| 4 | **Structured Data's `contextEntries` column is write-never.** The column exists, defaults to `'[]'`, and no code path ever writes a non-empty value | `structured-data/sqlite-store.ts:33`; self-reported in the capability's own `docs/` |
| 5 | **Knowledge's level-index table is never written.** `kn_<p>_level_indices` is created; `putLevelIndex` has no caller | `0-platform/database/knowledge-store.ts:65`. Its own `docs/concepts.md:39` says the indices are "currently persisted but not used" — they are not persisted either |
| 6 | **`LIKE_ESCAPE_CHARACTER` is dead** | Zero references outside `likePattern.ts`; all four LIKE clauses hard-code `ESCAPE '\'` |
| 7 | **`ResourceHistoryRecordType`, `ResourceRetentionClock`, `ResourceRetentionTarget`, `ResourceRetentionSweepResult` are exported and unused** outside `0-utils/` and the retention test | `resourceHistory.ts:3`, `resourceRetentionScheduler.ts:8, 12, 17` |
| 8 | **`retentionScheduler.start()` has no ordering test,** unlike `syncScheduler.start()` | `runtime-wiring.test.ts:212-222` covers only the sync scheduler |
| 9 | **`template.delete` cannot delete a Document-backed template.** `DocumentTemplateRuntime.logicalDelete` (`documentService.ts:777-787`) builds a `document.delete` command with **no `expectedRevision`**; `deleteDocument` (`:890-912`) throws `RevisionConflictError` whenever `head.revision !== expectedRevision`, which `undefined` always is. `templateService.ts:555` does not catch. Document is the only registered kind (`startBackend.ts:119`) | No test covers it: `templates.test.ts` uses a fake `TemplatableResource`, and `document-application.test.ts:1727` exercises every part of the Templates contract *except* `logicalDelete`, `purge`, and `listSealedResources` |

Item 9 is the most consequential persistence defect in the tree and is tracked on
[11 · Known issues](11-known-issues.md).

---

## 16 · Quick reference

| Question | Answer |
| --- | --- |
| Where does a resource's live state live? | Its capability's typed current table. Live rows only |
| Where do old revisions live? | `<prefix>_history`, shared DDL, `revision` = the superseded number |
| How is a deletion represented? | A `deleted` history row at `N + 1`, plus removal of the current row. No flag |
| Can a delete be undone? | No. There is no restore operation anywhere |
| What makes purge legal? | No live row **and** the latest history record is `deleted` |
| What does purge cost? | Irreversible. No Activity transaction, no outbox row |
| Which tables does retention prune? | `<prefix>_history` only, plus Document's Bases/ChangeSets/attempts via compaction |
| Which tables does retention never prune? | Activity, all outboxes, all receipts, all Derived Outputs claim tables, Knowledge, log files |
| How is a project scoped? | `sha256(projectId).hex.slice(0,16)` in the table name, bound at construction |
| Can a request choose a project? | No. `projectId` appears nowhere in `4-job-wiring/` or `2-transport/` |
| How many schema versions are supported? | One. There is no migration runner |
