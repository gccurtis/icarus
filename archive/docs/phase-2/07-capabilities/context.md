# Context

*Verified against source at commit ef6d462, 2026-08-09.*

Context is the project's named set algebra over resource references. A context record is a display
name plus a deduplicated list of `{id, kind}` atoms; a context may name other contexts, and
`resolve()` flattens that graph into leaves. Its two consumers are the Knowledge scope resolver —
which turns resolved leaves into trusted Knowledge source IDs — and Persona, which keeps one
private wrapper record per persona. Context itself knows nothing about documents, files or
connectors: every non-`context` entry is an opaque pair of strings it passes through untouched.

---

## 1 · At a glance

| | |
| --- | --- |
| **Shape** | **Flat** — five files at the capability root. No `domain/`, no `application/`, no `ports/`, no `persistence/`, no `wire/` |
| **Endpoints** | **10** — 5 POST, 3 GET, 1 PATCH, 1 DELETE; 9 concurrent, 1 serial (`purge`); all inline |
| **DB file** | `./data/contexts.db` — cwd-relative, opened at [`1-init/create/context.ts:7`](../../../apps/backend/src/1-init/create/context.ts) |
| **Tables** | **2** — `ctx_<p>_contexts`, `ctx_<p>_history` (`p = sha256(projectId).hex.slice(0,16)`) |
| **Revision model** | A fresh `randomUUID()` always starts at revision 1 — Context does **not** use `nextRevisionAfterHistory`. `update` is a two-stage CAS (advisory check in the manager, authoritative `WHERE id = ? AND revision = ?` in the store). Delete writes snapshot@N then `deleted`@N+1 |
| **Tests** | [`test/capabilities/context.test.ts`](../../../apps/backend/test/capabilities/context.test.ts) — 315 lines, **11 tests**, all passing |
| **Source** | **5 files / 569 lines** in the capability directory; plus wiring `registerContextEndpoints.ts` (204) and factory `create/context.ts` (12) |
| **Config** | `context:` in `etc/configuration.yaml` — `maxEntriesPerContext: 100000`, `maxResolveDepth: 10`. Both defaults match [`loadBackendConfig.ts:230-232`](../../../apps/backend/src/0-utils/config/loadBackendConfig.ts) |
| **Module docs** | `src/3-capabilities/context/docs/` — six files, 522 lines. Mostly accurate; three corrections in §8 |
| **Status** | Complete and wired. **Four endpoints have no `try/catch` at all**, unknown errors default to **400** rather than 500, **no `Logger` is passed to its wiring**, and `declare()` accepts an empty `displayName` |

Per-file sizes:

| File | Lines |
| --- | ---: |
| `context.ts` | 285 |
| `sqlite-store.ts` | 204 |
| `types.ts` | 54 |
| `store.ts` | 20 |
| `index.ts` | 6 |

---

## 2 · Domain model

### 2.1 Project-only scope

There is no user scope, no workspace scope and no per-request scope. `SQLiteContextStore`
([`sqlite-store.ts:62-70`](../../../apps/backend/src/3-capabilities/context/sqlite-store.ts)) takes
`(projectId, dbPath)`, derives `prefix = sha256(projectId).hex.slice(0,16)` once in the
constructor, and stores the two computed table names as instance fields. No method takes a project
or a user. The rule is stated in the port's header —
[`store.ts:1-3`](../../../apps/backend/src/3-capabilities/context/store.ts):

```
// ContextStore interface.
// All methods are synchronous (SQLite is synchronous).
// projectId is encoded in the store instance — not in method signatures.
```

`1-init/create/context.ts:9-12` binds `config.projectId` and `config.context`. Nothing else can
construct a store with a different project.

### 2.2 `ContextEntry` — the shared atom, owned by the platform

[`0-platform/knowledge/types.ts:84-88`](../../../apps/backend/src/0-platform/knowledge/types.ts):

```ts
/** The shared resource-reference atom used by Context and scope-aware retrieval. */
export interface ContextEntry {
  id: string;
  kind: string;  // e.g. "document", "context"
}
```

Context **imports and re-exports** it, with the reason in the file header
([`types.ts:1-3`](../../../apps/backend/src/3-capabilities/context/types.ts)):

```
// Context capability types.
// ContextEntry is defined in knowledge/types.ts (the platform layer that needs it).
// Context imports it from there to avoid duplicating the atom.
```

So call sites read as if Context owned the type while the import arrow stays 3 → 0. `kind` is a
bare `string`, not a union — Context validates nothing about it beyond non-emptiness at the wire.
The only value Context itself interprets is the literal `"context"`.

### 2.3 `ContextRecord`

`types.ts:9-19`:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | a `randomUUID()` |
| `displayName` | `string` | unique among live records, case-sensitive |
| `description?` | `string` | free text, unbounded |
| `entries` | `ContextEntry[]` | *"unordered set; deduplicated on write"* — first-seen order is preserved in practice |
| `private` | `boolean` | *"When true, excluded from list() unless includePrivate is set. Fixed at creation."* |
| `revision` | `number` | *"monotone counter starting at 1"* |
| `createdAt`, `updatedAt` | `string` | ISO-8601 |

### 2.4 Supporting types

`context.ts:13-25`:

```ts
export interface ContextManagerConfig {
  readonly maxEntriesPerContext: number;  // default 100,000
  readonly maxResolveDepth: number;       // default 10 — cycle guard
}

/** One operand for a composition request: either an existing context by ID, or inline entries. */
export type ContextOperand = { contextId: string } | { entries: ContextEntry[] };

/** Optional fields shared by declare() and composeNamed(). private defaults to false. */
export interface ContextWriteOptions {
  readonly description?: string;
  readonly private?: boolean;
}
```

`ContextOperand` is a two-arm union, enumerated in full above. **`ContextWriteOptions` is not
exported from `index.ts`** even though it appears in two public method signatures (§8.6).

### 2.5 Errors

`types.ts:21-54` — four classes. Unlike Connector and General Files, **none of them carries a
`code` field**; the wiring matches on `instanceof` and supplies the wire code itself.

| Class | Fields | Message | Thrown at |
| --- | --- | --- | --- |
| `ContextNotFoundError` | `id` | `Context not found: ${id}` | `context.ts:143, 154, 164, 166, 232` |
| `ContextConflictError` | `displayName` | `Context '${displayName}' already exists` | `context.ts:116, 250` |
| `StaleContextError` | `id`, `current`, `expected` | `Stale revision for context ${id}: expected ${expected}, current ${current}` | `context.ts:144, 155` |
| `ContextValidationError` | `field`, `reason` | `${field}: ${reason}` | `context.ts:110, 137, 247, 256` — **four sites** |

`ContextValidationError` is the only one that reaches the wire with an extra key: the mapper adds
`field: e.field` to the 400 body (`registerContextEndpoints.ts:14`). The four throw sites are:
`declare` over the entry cap (`:110`), `update` over the entry cap (`:137`), `composeNamed` with a
blank `displayName` (`:247`), and `composeNamed` whose *result* exceeds the entry cap (`:256`). The
capability's own `docs/invariants.md:35` says *"All three sites"* — it is counting limits, not
throw sites, and undercounts by one.

---

## 3 · Operations

`ContextManager` (`context.ts:28-59`) is the entire surface. Fourteen members, grouped by the
comment banners in the source itself.

```ts
/** ContextManager satisfies KnowledgeResourceResolver so it can be injected into Knowledge. */
export interface ContextManager extends KnowledgeResourceResolver {
  // ── CRUD ─────────────────────────────────────────────────────────────────
  get(id: string): Promise<ContextRecord | null>;
  getByName(displayName: string): Promise<ContextRecord | null>;
  list(opts?: { includePrivate?: boolean }): Promise<ContextRecord[]>;
  declare(displayName: string, entries: ContextEntry[], options?: ContextWriteOptions): Promise<ContextRecord>;
  update(id: string, entries: ContextEntry[], expectedRevision: number): Promise<ContextRecord>;
  delete(id: string): Promise<void>;
  purge(id: string): Promise<void>;
  pruneHistory(cutoff: string): number;
  purgeExpired(cutoff: string): number;

  // ── Resolution (satisfies KnowledgeResourceResolver) ─────────────────────
  resolve(entries: ContextEntry[]): Promise<ContextEntry[]>;

  // ── Pure composition (no I/O) ─────────────────────────────────────────────
  combine(a: ContextEntry[], b: ContextEntry[]): ContextEntry[];
  difference(a: ContextEntry[], b: ContextEntry[]): ContextEntry[];

  // ── Persisted, named composition ─────────────────────────────────────────
  composeNamed(op: "union" | "difference", a: ContextOperand, b: ContextOperand,
               displayName: string, options?: ContextWriteOptions): Promise<ContextRecord>;
}
```

Everything is `Promise`-returning at the boundary although the store underneath is entirely
synchronous. `pruneHistory` and `purgeExpired` are the two exceptions — they return `number`
directly, because they must satisfy the shared `ResourceRetentionPort`.

### 3.1 `resolve()` — recursion, cycle guard, depth limit, silent omission

The interface comment (`context.ts:41-42`) is the whole contract in two lines:

```
  /** Expand all kind:"context" entries recursively into leaf entries.
   *  Cycles are guarded; missing IDs are silently omitted. */
```

The implementation, `context.ts:185-212`:

```ts
const expand = async (toExpand: ContextEntry[], depth: number): Promise<void> => {
  if (depth > this.config.maxResolveDepth) return;
  for (const entry of toExpand) {
    if (entry.kind !== "context") {
      const key = `${entry.kind}:${entry.id}`;
      if (!seen.has(key)) { seen.add(key); result.push(entry); }
      continue;
    }
    const contextKey = `context:${entry.id}`;
    if (seen.has(contextKey)) continue; // cycle guard
    seen.add(contextKey);

    const record = this.store.get(entry.id);
    if (!record) continue; // silently omit missing/deleted

    await expand(record.entries, depth + 1);
  }
};
await expand(entries, 0);
```

Facts a caller has to know, stated exactly:

- **One `seen` set holds both leaves and contexts.** Leaf keys are `${kind}:${id}` and context keys
  are `context:${id}` — the same string format, so a leaf entry `{kind:"context", id:X}` and a
  visited context X collide by design.
- **The cycle guard is mark-before-load.** A context id is added to `seen` *before* its record is
  fetched, so a self-reference or a loop terminates at the second encounter. Pinned by
  `context.test.ts:164`, *"resolve expands nested contexts once and terminates on a cycle"*.
- **The depth guard is `depth > maxResolveDepth`, checked on entry**, with the initial call at depth
  0 and children at `depth + 1`. Depths 0…`maxResolveDepth` are visited; a call at
  `maxResolveDepth + 1` returns immediately, dropping that subtree. Default `maxResolveDepth` is
  **10**.
- **Missing or deleted context IDs are omitted silently** — no error, no diagnostic, not even a log
  line. A logically deleted context has no current row, so it is indistinguishable from a typo.
  This is the one place in the capability where a tombstone changes an answer invisibly.
- **The result depends on entry order, not only on the graph.** Because a context is marked `seen`
  before its children are expanded, a context first reached *at* the depth limit (children dropped)
  and encountered again later at a shallower position is skipped entirely by the cycle guard. The
  same set of records can resolve to different leaf sets depending on the order of the input array.
- **Leaves come out in first-seen order and the result is never sorted.**
- The only record of the call is the debug log
  `context.resolve { inputCount, resolvedCount, durationMs }` (`context.ts:210`).

### 3.2 `combine`, `difference` and the asymmetry between them

```ts
combine(a, b)    // context.ts:214-222 — first-seen union over [...a, ...b], deduped by `${kind}:${id}`
difference(a, b) // context.ts:224-227 — a.filter(e => !bKeys.has(`${e.kind}:${e.id}`))
```

- `combine` duplicates the module-private `dedup` helper (`context.ts:63-74`) inline rather than
  calling it. Same logic, two copies.
- **`difference` does not deduplicate `a`.** If `a` contains the same entry twice, both survive.
  The module's own `docs/concepts.md:83` records this correctly.
- **Neither resolves nested contexts.** A `kind:"context"` entry passed to either is treated as an
  ordinary opaque leaf. Composition is over *stored* entry lists, not over resolved ones.

### 3.3 `composeNamed` — the only persisted composition

`context.ts:238-276`, in order:

1. Reject a blank or whitespace-only `displayName` →
   `ContextValidationError("displayName", "is required")`.
2. `store.getByName(displayName)` → `ContextConflictError` if taken.
3. `resolveOperand` each side (`context.ts:229-236`). `{contextId}` loads the record's **stored**
   entries and throws `ContextNotFoundError` if absent; it does **not** call `resolve()`, so nested
   contexts inside an operand stay unexpanded. `{entries}` is used as given.
4. Apply `combine` or `difference`.
5. Reject a result longer than `maxEntriesPerContext`.
6. Insert a fresh `randomUUID()` record at revision 1 with `private: options.private ?? false`.
7. Log `context.composeNamed { op, displayName, entryCount, resultId, private, durationMs }`.

The two endpoints return **only** `{ contextId: record.id }` (`registerContextEndpoints.ts:181,
200`) — not the record. A caller that wants the entries must follow up with
`GET /contexts/entry?id=`.

### 3.4 `private` — the real visibility mechanism

**There is no `~`-prefix convention and no `includeAnonymous` parameter anywhere in the backend.**
`grep` for either across `apps/backend/src` returns nothing. The superseded design page
[phase-1/claude-notes/07-capability-inventory.md](../../phase-1/claude-notes/07-capability-inventory.md)
claims that `composeNamed` *"persists the result as a caller-named context (listing excludes
`~`-prefixed records unless `includeAnonymous=true`)"* and gives the signature as
`composeNamed(op, a, b, displayName, description?)`. Both statements are false at HEAD. What exists
instead:

| Mechanism | Detail |
| --- | --- |
| Storage | `private INTEGER NOT NULL DEFAULT 0` (`sqlite-store.ts:33`) |
| Set | Once, at creation, from `options.private ?? false` (`context.ts:124`, `:268`) |
| Changed | Never. `update` spreads `...existing` (`context.ts:147`), so `private` is immutable — there is no "make private" or "make public" operation |
| Honoured by | `list(includePrivate)` alone: `WHERE private = 0` when false (`sqlite-store.ts:86-92`). `get`, `getByName`, `resolve` and `composeNamed`'s operand lookup all ignore it |
| Wire, read | `GET /contexts?includePrivate=true` — a string comparison (`registerContextEndpoints.ts:79`) |
| Wire, write | body field `private`, parsed by `parsePrivate`, which accepts **only literal `true`** |
| Real consumer | **Persona.** `personaService.ts:85` names each wrapper `` `persona:${personaId}` `` — a **colon** prefix, not a tilde — and declares it private |

`context.test.ts:37`, `:58` and `:192` pin the default, the listing behaviour, and the strict
literal-`true` parsing.

### 3.5 The two ports Context satisfies

`ContextManager` is consumed through two narrow interfaces, and the two relationships are **not**
the same kind of relationship.

| Port | Declared at | How Context satisfies it |
| --- | --- | --- |
| `KnowledgeResourceResolver` | [`0-platform/knowledge/types.ts:118-124`](../../../apps/backend/src/0-platform/knowledge/types.ts) | **Explicitly** — `export interface ContextManager extends KnowledgeResourceResolver` (`context.ts:28`), with the comment on line 27 saying why. Its optional `describeSource?` member is **not** implemented by Context |
| `PersonaContextPort` | [`3-capabilities/persona/ports/personaContext.ts`](../../../apps/backend/src/3-capabilities/persona/ports/personaContext.ts) | **Structurally, with no adapter** — `startBackend.ts:63-64` passes `contextManager` straight in. `declare` returns `ContextRecord`, which is assignable to `PersonaContextRecordRef = {id, revision}` |

There is a further indirection worth being precise about: **Knowledge is not handed the
`ContextManager`.** It is handed the `RuntimeResourceRegistry`, which wraps it
(`startBackend.ts:60-70`):

```ts
const contextManager = createContextManagerInstance(config, logger);
const resourceRegistry = createResourceReader(contextManager, logger);
// …
const knowledge = createKnowledge(config.projectId, intelligence, logger, resourceRegistry);
```

`RuntimeResourceRegistry.resolve`
([`1-init/create/resource-reader.ts:79-120`](../../../apps/backend/src/1-init/create/resource-reader.ts))
calls `this.contexts.resolve(entries)` first (`resource-reader.ts:81`) and then maps each leaf,
**checking Findings (`:90-94`) before General Files (`:96-100`)**:

1. `kind === "document"` — the id passes through as a source id.
2. An **accepted** Finding maps to its `knowledgeSourceId`.
3. A live General File maps to its `knowledgeSourceId`.
4. A live Connector maps to **all** of its exposed `knowledgeSourceIds`.
5. Anything unmapped is dropped.

The result is sorted and re-emitted as `{id: sourceId, kind: "document"}`. `describeSource` is
implemented **there** (`resource-reader.ts:122`), not in Context. The module's own
`docs/runtime.md:80-87` describes this mapping without mentioning Findings, which the code checks
first.

---

## 4 · Endpoints

Registered by
[`registerContextEndpoints`](../../../apps/backend/src/4-job-wiring/context/registerContextEndpoints.ts).
All ten are `responseMode: "inline"`.

| # | Method + path | Job name | Queue | Line | Success | try/catch | What it does |
| --: | --- | --- | --- | --: | --- | :-: | --- |
| 1 | `POST /contexts` | `context.declare` | concurrent | 56 | **201** `ContextRecord` | ✓ | Creates a named record |
| 2 | `GET /contexts` | `context.list` | concurrent | 73 | 200 `{records}` | **✗** | `?includePrivate=true` |
| 3 | `GET /contexts/entry` | `context.get` | concurrent | 84 | 200 `ContextRecord`, 404 on null | **✗** | `?id=` |
| 4 | `GET /contexts/by-name` | `context.getByName` | concurrent | 96 | 200 `ContextRecord`, 404 on null | **✗** | `?displayName=` |
| 5 | `PATCH /contexts/entries` | `context.update` | concurrent | 108 | 200 `ContextRecord` | ✓ | Replaces the entry list under CAS |
| 6 | `DELETE /contexts` | `context.delete` | concurrent | 125 | 204 `null` | ✓ | Takes `id` in the **request body**, not the query string |
| 7 | `POST /contexts/purge` | `context.purge` | **serial** | 138 | 204 `null` | ✓ | Erases the history series |
| 8 | `POST /contexts/resolve` | `context.resolve` | concurrent | 151 | 200 `{entries}` | **✗** | Flattens a supplied entry list |
| 9 | `POST /contexts/union` | `context.union` | concurrent | 167 | **201** `{contextId}` | ✓ | Persisted union |
| 10 | `POST /contexts/difference` | `context.difference` | concurrent | 186 | **201** `{contextId}` | ✓ | Persisted difference |

Route-shape notes:

- `/contexts` carries three methods (POST, GET, DELETE); the "get one" route is the odd
  `GET /contexts/entry?id=` rather than a path parameter — the backend has no path parameters
  anywhere.
- `DELETE /contexts` reads `id` from the JSON body (`registerContextEndpoints.ts:131-132`), which
  is unusual for a DELETE and is not documented on the wire.
- Purge is the only serial route.

**Error ladder** (`contextErrorResponse`, `registerContextEndpoints.ts:10-19`):

| Error | Status | `error` code |
| --- | ---: | --- |
| `ContextNotFoundError` | 404 | `not_found` |
| `ContextConflictError` | 409 | `conflict` |
| `StaleContextError` | 409 | `stale_revision` |
| `ContextValidationError` | 400 | `context_invalid` **plus a `field` key** |
| `ResourceNotDeletedError` | 409 | `not_deleted` |
| `ResourceHistoryNotFoundError` | 404 | `not_found` |
| anything else | **400** | `bad_request` |

**Context is the only capability in the backend whose unknown-error default is 400 rather than
500.** See §8.2.

### 4.1 Wire parsing

Four helpers, all in `registerContextEndpoints.ts`:

| Helper | Lines | Behaviour |
| --- | --- | --- |
| `parseEntries` | 21-27 | Non-array → `[]`; non-object elements dropped; `id`/`kind` `String`-coerced with `?? ""`; entries with an empty `id` or `kind` dropped. It does **not** check that `kind` is a known resource kind — by design, since Context treats non-`context` kinds as opaque |
| `parseOperand` | 29-40 | `{contextId}` if `contextId` is a non-empty string; else `{entries}` if `entries` is an array; else **throws a plain `Error`**, which the ladder turns into 400 `bad_request` |
| `parseDescription` | 42-44 | `typeof raw === "string" ? raw : undefined` |
| `parsePrivate` | 46-50 | `raw === true` — strict on purpose; see §7 |

Coercions applied directly in the handlers:

| Line | Code | Effect |
| --: | --- | --- |
| 64 | `String(body.displayName ?? "")` | A missing `displayName` becomes `""` — and `declare` **accepts it** (§8.4) |
| 116 | `String(body.id ?? "")` | update |
| 118 | `Number(body.expectedRevision)` | A missing value becomes `NaN`; `existing.revision !== NaN` is always true, so the caller gets **409 `stale_revision`** with `expected NaN` rather than a 400 |
| 132 | `String(body.id ?? "")` | delete |
| 145 | `String(body.id ?? "")` | purge |
| 178, 197 | `String(body.displayName ?? "")` | union / difference — here the empty string **is** rejected, by `composeNamed`, with 400 |

---

## 5 · Persistence

`SQLiteContextStore` opens `./data/contexts.db` and sets **only** `journal_mode = WAL`
(`sqlite-store.ts:64-65`). No `synchronous`, no `foreign_keys`, no `busy_timeout`. Context and
Structured Data are the two stores in the backend that set a single pragma; see
[04-state-and-persistence.md](../04-state-and-persistence.md).

File header (`sqlite-store.ts:1-3`):

```
// SQLite implementation of ContextStore.
// One table per database, scoped by project: ctx_${projectPrefix}_contexts.
// Prefix = SHA-256(projectId).slice(0,16).
```

### 5.1 `ctx_<p>_contexts`

| Column | Type |
| --- | --- |
| `id` | `TEXT PRIMARY KEY` — a `randomUUID()` |
| `display_name` | `TEXT NOT NULL` |
| `description` | `TEXT` nullable |
| `entries_json` | `TEXT NOT NULL` — a JSON array of `{id, kind}` |
| `private` | `INTEGER NOT NULL DEFAULT 0` |
| `revision` | `INTEGER NOT NULL DEFAULT 1` |
| `created_at`, `updated_at` | `TEXT NOT NULL` |

One index: `ctx_<p>_contexts_name` **UNIQUE** on `(display_name)` — exact and case-sensitive, so
`Research` and `research` are two records.

**There are no `CHECK` constraints on this table at all**, in sharp contrast to Connector and
General Files, whose tables are heavily checked. `entries_json` is not validated as JSON by SQLite,
and `rowToRecord` (`sqlite-store.ts:44-55`) calls `JSON.parse` on it with no recovery path — a
corrupted row throws a `SyntaxError` out of a synchronous read.

### 5.2 `ctx_<p>_history`

The shared schema from `initializeResourceHistorySchema`
([`0-utils/persistence/resourceHistory.ts:43-65`](../../../apps/backend/src/0-utils/persistence/resourceHistory.ts)),
with `resource_kind = "context"`. The snapshot payload is a whole `ContextRecord`.

### 5.3 The revision model, spelled out

Context is the odd one out among the three capabilities in this family: **it does not use
`nextRevisionAfterHistory`.** `declare` and `composeNamed` hardcode `revision: 1` on a fresh
`randomUUID()` (`context.ts:125`, `:269`), and a fresh UUID has no history by construction, so
there is no "resume after history" behaviour and no identity resumption. A deleted context can
never come back; only a new record with the same display name can.

`update` is a **two-stage CAS**:

1. *Advisory*, in the manager (`context.ts:142-144`): read the record, throw
   `ContextNotFoundError` if absent, throw `StaleContextError` if
   `existing.revision !== expectedRevision`.
2. *Authoritative*, in the store (`sqlite-store.ts:110-139`): inside one transaction, re-`SELECT`
   `WHERE id = ? AND revision = ?`; return `false` if it is gone; archive that snapshot at
   `expectedRevision`; run `UPDATE … WHERE id = ? AND revision = ?` and return
   `result.changes === 1`.
3. A `false` return sends the manager back to re-read and throw `StaleContextError` or
   `ContextNotFoundError` (`context.ts:152-156`).

`context.test.ts:92` — *"update increments the revision and rejects a stale expected revision"* —
covers the advisory path; the authoritative path is the one that survives a concurrent writer.

`delete(id, deletedAt)` (`sqlite-store.ts:141-164`) archives snapshot `N`, appends a `deleted`
record at `N + 1`, and removes the row, all in one transaction.

`purge(id)` (`sqlite-store.ts:166-171`) returns `"current"` when a live row exists →
`ResourceNotDeletedError` → 409 `not_deleted`; `"missing"` when there is no terminal `deleted`
record → `ResourceHistoryNotFoundError` → 404 `not_found`; otherwise `"purged"`. Because
`purgeResourceHistory` only purges when the *latest* record for the ID is a `deleted` record, a
context that was merely `update`d — snapshots only, no tombstone — returns **404 from purge, not
409**.

### 5.4 Where a tombstone is observable

Context's tombstones are the `record_type = 'deleted'` rows. **No read path returns them**: `get`,
`getByName`, `list`, `resolve`, `update`'s lookup and `composeNamed`'s operand lookup all read the
current table only, and there is no history endpoint. A tombstone is observable in exactly three
places:

1. **The purge status codes** — 409 versus 404, as above.
2. **`resolve`'s silence** — a deleted context referenced by a live one is dropped without a word
   (`context.ts:203`), so the caller sees a smaller resolved set with no explanation.
3. **`store.history(id)`** — declared on the port (`store.ts:17`) and implemented
   (`sqlite-store.ts:173-180`), with **no endpoint and no service method exposing it**. Used only
   by `context.test.ts:123, 133, 140`.

Retention: `bindResourceRetentionPort("context", contextManager)` at `startBackend.ts:144` — the
**last** of the eleven ports, deliberately, because everything that can own a context reference
sweeps first. `pruneHistoryBefore` never removes the latest `deleted` record for an ID through its
main statement, and the `isCurrent` callback `(_kind, id) => Boolean(this.get(id))`
(`sqlite-store.ts:182-189`) lets it drop a tombstone if the identity became current again — which,
for Context's UUID identities, it never can.

---

## 6 · Invariants

| Invariant | Enforced at |
| --- | --- |
| `entries.length <= maxEntriesPerContext` on declare | `context.ts:109-114` |
| …on update | `context.ts:136-141` |
| …on the `composeNamed` result | `context.ts:255-260` |
| `composeNamed` requires a non-blank `displayName` | `context.ts:246-248` |
| Display names are unique among live records | `sqlite-store.ts:38-39` (UNIQUE index) + pre-checks at `context.ts:115-116` and `:249-250` |
| `update` requires the exact expected revision | `context.ts:144` (advisory) + `sqlite-store.ts:112-115, 126-136` (authoritative) |
| Entries are deduplicated by `${kind}:${id}`, first-seen order preserved | `context.ts:63-74` (declare/update), `:214-222` (combine) |
| `private` is fixed at creation | `context.ts:124`, `:268`; `update` spreads `...existing` at `:147` |
| `private` on the wire requires a literal boolean `true` | `registerContextEndpoints.ts:46-50` |
| `resolve` visits each identity at most once | `context.ts:188, 195, 199-200` |
| `resolve` depth-limits at `maxResolveDepth` | `context.ts:191` |
| `resolve` omits missing records silently | `context.ts:203` |
| `composeNamed`'s by-ID operand must exist | `context.ts:230-233` |
| `delete` requires a live record | `context.ts:163-166` |
| `purge` refuses a live record and requires a terminal history record | `sqlite-store.ts:167` → `context.ts:172-173` |

**Not enforced anywhere:**

- **`declare` does not validate `displayName`** (§8.4). `context.ts:107-132` checks the entry count
  and the name conflict and never checks that the name is non-blank.
- **No length or byte limits** on `displayName`, `description`, or the serialized `entries_json`.
  The module's own `docs/invariants.md:35` says so and the code agrees.
- **No `CHECK` constraints** on the contexts table (§5.1).
- **No validation that `kind` is a known resource kind** — deliberate, but it means a typo in
  `kind` produces a context entry that resolves to nothing, silently.

---

## 7 · Design decisions worth preserving

**Where the atom lives, and why** — `context/types.ts:1-3`:

```
// Context capability types.
// ContextEntry is defined in knowledge/types.ts (the platform layer that needs it).
// Context imports it from there to avoid duplicating the atom.
```

**Project scope is in the instance, not the signature** — `context/store.ts:1-3`:

```
// ContextStore interface.
// All methods are synchronous (SQLite is synchronous).
// projectId is encoded in the store instance — not in method signatures.
```

**Why the manager declares the Knowledge port** — `context.ts:27`:

```
/** ContextManager satisfies KnowledgeResourceResolver so it can be injected into Knowledge. */
```

**The resolution contract, in two lines** — `context.ts:41-42`:

```
  /** Expand all kind:"context" entries recursively into leaf entries.
   *  Cycles are guarded; missing IDs are silently omitted. */
```

**Visibility is fixed at creation** — `context/types.ts:15`:

```
  /** When true, excluded from list() unless includePrivate is set. Fixed at creation. */
```

**Strict boolean parsing, on purpose** — `registerContextEndpoints.ts:46-47`:

```
/** Strict on purpose: only a literal boolean true counts. Anything else, including
 *  missing, null, or a truthy-looking string, is treated as "not private". */
```

**What the composition endpoints return, and why so little** —
`registerContextEndpoints.ts:162-165`:

```
  // ── Composition (persisted, named) ───────────────────────────────────────
  // Both endpoints resolve two operands (by context ID or inline entries),
  // apply the set operation, persist the result under the given displayName,
  // and return only the new context's ID.
```

**Why Persona consumes a three-method slice and never calls `update`** —
`3-capabilities/persona/ports/personaContext.ts:1-16`. This comment explains a Context design
constraint from the outside, and it is the best statement in the repository of why a fresh
`declare` at revision 1 is safer than an in-place mutation:

```
// The narrow slice of Context that Persona consumes.
//
// Satisfied structurally by ContextManager, which has many more methods. Persona
// states exactly what it uses: it manages one private wrapper record per persona
// and never reads Context for any other reason. There is deliberately no get(),
// resolve(), combine(), or list() here — expanding a context reference into
// retrievable content is the consumer's job, not Persona's.
//
// There is also no update(). A changed context is never applied by mutating the
// existing wrapper in place — Persona always declares a brand-new wrapper and,
// once its own record's CAS write has committed to the new wrapper, deletes the
// old one. A fresh declare() can never itself go stale (it always starts at
// revision 1), which is what makes this ordering immune to the partial-write
// gap described in docs/invariants.md: either side losing its race leaves, at
// worst, one harmless orphaned wrapper — never a persona record pointing at a
// stale or missing one.
```

The wrapper naming rule is stated where the name is built
(`persona/application/personaService.ts:83-85`):

```
/** The private wrapper's name is derived from the persona's immutable id, never
 *  its editable display name, so a rename can never orphan or collide it. */
const wrapperName = (personaId: string): string => `persona:${personaId}`;
```

**The composition-time mutability note on the registry that wraps Context** —
`1-init/create/resource-reader.ts:45-49`:

```
/**
 * Mutable only during composition. Once startup registers the concrete
 * capabilities, callers use this object through the narrow ResourceReader and
 * KnowledgeResourceResolver interfaces.
 */
```

---

## 8 · Known gaps and defects

Items with an entry in [11-known-issues.md](../11-known-issues.md) are cross-referenced there.

### 8.1 Four endpoints have no `try/catch`, so the client gets Fastify's generic 500

`GET /contexts` (list), `GET /contexts/entry`, `GET /contexts/by-name` and `POST /contexts/resolve`
call `await ctx.…` with **no `try`** (`registerContextEndpoints.ts:73-82, 84-94, 96-106, 151-160`).
A throw inside those `work()` functions is not mapped. It propagates to `JobScheduler` (which logs
`job.failed`, [`0-utils/jobs/scheduler.ts:243-249`](../../../apps/backend/src/0-utils/jobs/scheduler.ts)),
then to `registerHttpTransport` (which logs `http.request.failed` with `statusCode: 500` and then
**rethrows**, [`2-transport/registerHttpTransport.ts:113-121`](../../../apps/backend/src/2-transport/registerHttpTransport.ts)),
so the client receives Fastify's default 500 body rather than the capability's `{error, message}`
shape.

**The concrete hazard is `POST /contexts/resolve`**: line 156 is
`const body = request.body as Record<string, unknown>;` followed immediately by `body.entries`, so
a request with **no JSON body** throws a `TypeError` — reading a property of `undefined` — and
returns a generic 500. The three GET routes are safer only because `request.query` is always an
object.

The module's own `docs/flows.md:20, 26` honestly flag "unexpected failures not locally mapped" but
stop short of saying what the client actually receives.
→ [11-known-issues.md](../11-known-issues.md)

### 8.2 Unknown errors default to 400, not 500

`contextErrorResponse`'s fallthrough is
`return { statusCode: 400, body: { error: "bad_request", message: msg } };`
(`registerContextEndpoints.ts:17-18`). Every other capability's ladder ends at 500
`internal_error`. So a genuine internal failure inside a *mapped* endpoint — a `JSON.parse` failure
on a corrupted `entries_json`, say — is reported to the client as **their** fault, with a 400.

This is not purely accidental: it is what makes `parseOperand`'s plain `Error` (a real client
mistake) come back as 400 on `/contexts/union` and `/contexts/difference`. The cost is that server
faults are indistinguishable from client faults on the other six mapped routes.
→ [11-known-issues.md](../11-known-issues.md)

### 8.3 No `Logger` is passed to the wiring at all

`registerContextEndpoints(registry, ctx)` takes two parameters (`registerContextEndpoints.ts:52-55`)
and `startBackend.ts:177` calls it with two — compare `registerGeneralFileEndpoints(registry,
generalFiles, logger)` at `:179` and `registerConnectorEndpoints(registry, connector, logger)` at
`:180`. **Context endpoints therefore log no errors.** Every other capability's wiring has a
`logError` helper writing `<capability>.<operation>.error`; Context has none, and there is no
`Logger` in scope to add one. A 400 or 409 returned to a client leaves no trace in
`logs/backend-YYYY-MM-DD.log`. → [11-known-issues.md](../11-known-issues.md)

### 8.4 `declare()` accepts an empty `displayName` and produces a record named `""`

`declare` (`context.ts:107-132`) checks the entry count and the name conflict and **never checks
that the name is non-blank**. Combined with `String(body.displayName ?? "")` at
`registerContextEndpoints.ts:64`, `POST /contexts` with no `displayName` **succeeds with 201** and
creates a record whose `display_name` is the empty string. A second such request then fails with
**409 `conflict`** on the unique index — a confusing outcome for a caller who never named anything.

`composeNamed` rejects the identical input with 400 `context_invalid`, field `displayName`
(`context.ts:246-248`). The asymmetry is unrecorded in the module's own `docs/`; `docs/types.md:64`
mentions only `composeNamed`'s rejection. No test covers `declare`'s acceptance.
→ [11-known-issues.md](../11-known-issues.md)

### 8.5 `expectedRevision` omitted on `PATCH /contexts/entries` yields 409, not 400

`Number(body.expectedRevision)` (`registerContextEndpoints.ts:118`) turns a missing value into
`NaN`. `existing.revision !== NaN` is always true, so the manager throws `StaleContextError` and
the client gets **409 `stale_revision`** with the message `… expected NaN, current 1`. The correct
answer to "you forgot a required field" is 400.

### 8.6 Dead and unexported surface

| Symbol | Where | Status |
| --- | --- | --- |
| `ContextStore.history(id)` | port `store.ts:17`, impl `sqlite-store.ts:173-180` | **No production caller.** No endpoint and no service method exposes it; only `context.test.ts:123, 133, 140` uses it |
| `ContextWriteOptions` | `context.ts:22-25` | **Not exported** from `index.ts`, despite appearing in the public `declare` and `composeNamed` signatures. A consumer importing from `#context` can pass an object literal (structural typing) but cannot name the type |
| `KnowledgeResourceResolver.describeSource` | `0-platform/knowledge/types.ts:122` | Optional and **not implemented by Context**. The real implementation is on `RuntimeResourceRegistry` (`resource-reader.ts:122-155`) |
| `dedup` vs `combine` | `context.ts:63-74` vs `:214-222` | The same six lines of dedup logic, written twice |

### 8.7 Content-bearing values are logged with no `detail` label

`context.declare` logs `displayName` (`context.ts:130`); `context.getByName` logs `displayName`
(`:95`); `context.composeNamed` logs `displayName` (`:274`). `grep -rn "detail:"` across
`3-capabilities/context`, its wiring file and its factory returns **nothing**, so these records are
unlabelled — treated as `shape` and never dropped even under `logging.detail: "shape"`. The
logger's own taxonomy classifies names and titles as `content`. Same posture as Connector and
General Files; see [09-configuration.md](../09-configuration.md).

### 8.8 `resolve`'s depth limit is untested, and its order-dependence is undocumented

`context.test.ts:164` covers the cycle guard only. Nothing exercises `maxResolveDepth`, and nothing
anywhere records the order-dependent truncation described in §3.1 — a context first reached at the
depth limit is permanently marked `seen`, so a later shallower reference to it is skipped.

### 8.9 Module-doc corrections

| Location | Claim | Reality |
| --- | --- | --- |
| `context/docs/invariants.md:35` | *"All three sites throw a typed `ContextValidationError`"* | **Four** throw sites: `context.ts:110, 137, 247, 256` |
| `context/docs/runtime.md:80-87` | Describes `ResourceRegistry.resolve` as `document` leaves → General Files → Connector | The code checks **Findings first**, before General Files (`resource-reader.ts:88-95`) |
| `context/docs/flows.md:20, 26` | Flags the missing error handling | Correct that the gap exists; never says the client gets Fastify's generic 500 |
| `context/docs/README.md:50` | Links to `docs/capabilities/context.md` | That directory never existed under that name; the archived page is now at [phase-1/capabilities-old/context.md](../../phase-1/capabilities-old/context.md). This is the only broken relative link in the eighteen doc files of these three capabilities |

---

**See also**: [connector.md](connector.md) and [general-files.md](general-files.md) for two of the
four resource families a resolved context can name · [persona.md](persona.md) for the private
wrapper records and the defect that structural seam hides ·
[01-layers-and-boundaries.md](../01-layers-and-boundaries.md) for the `ContextEntry` ownership
inversion · [06-platform-services.md](../06-platform-services.md) for Knowledge scopes.
