# Context Capability — Design


## Summary

Context is a **regular capability** (`3-capabilities/context/`) that lets callers
name and persist unordered sets of resource references (`ContextEntry[]`).  A
context entry is `{ id: string; kind: string }` — the minimal pair that
identifies a resource without hard-coding what kind that resource is.

Context is scoped by both `userId` and `projectId` from backend config.  The
runtime keeps two persistence views:
- a user-level store keyed by `userId`
- a project-level store keyed by `projectId`

The project store is the authoritative runtime view.  The user store acts as a
personal/default layer that can be promoted into the project store.  On lookup,
the project store is checked first; if an entry is missing there but exists in
the user store, it can be copied into the project store and then treated as
project-owned.

### Runtime IDs

```ts
interface BackendConfig {
  userId: string;
  projectId: string;
  // ...other config
}
```

These are the built-in scope identifiers the rest of the capability layer
assumes are already available.

The capability provides:
- CRUD for named, versioned Context records
- `resolve` — recursive expansion of entries whose `kind === "context"` into
  flat leaf entries
- Pure composition helpers: `combine` (union) and `difference`

Knowledge retrieval is extended with an optional **scope**, expressed as a
`ContextEntry[]`.  Scope filtering happens after lattice descent; the semantics
are "only keep windows whose source is in this scope".

---

## The shared atom: `ContextEntry`

```ts
/** Identifies a resource by its platform ID and the kind-string that
 *  describes how to locate it.  Lives in 3-capabilities/context/types.ts
 *  and is re-exported from there for any capability that needs it.      */
interface ContextEntry {
  id:   string;
  kind: string;  // e.g. "document", "context", "variable", …
}
```

The pair is intentionally opaque to Context itself.  Only the resolver needs
to know what to do with a particular kind.

**Supported kinds (initial)**

| kind        | meaning                                         | resolved by    |
|-------------|--------------------------------------------------|----------------|
| `"document"` | A knowledge source; `id === sourceId` in Knowledge | direct mapping |
| `"context"`  | A named Context record; expand recursively     | Context.resolve |

---

## Context record

```ts
interface ContextRecord {
  id:          string;       // random 16-byte hex
  displayName: string;       // unique within project
  entries:     ContextEntry[];  // conceptually an unordered set; stored as array for simplicity
  revision:    number;       // monotone counter; starts at 1
  createdAt:   Date;
  updatedAt:   Date;
  deletedAt?:  Date;
}
```

`displayName` uniqueness is scoped to live (non-deleted) records.

### Entries are an unordered set

Duplicate `kind:id` pairs are collapsed (last write wins on update).  Order
is not meaningful — callers must not rely on it.  Internally entries are
stored as a JSON array for simplicity; the deduplication key is `${kind}:${id}`.

### Anonymous contexts

Contexts whose `displayName` starts with `~` are **anonymous** — typically
created on the fly as the result of a compose/decompose operation.  `list()`
excludes them by default; pass `{ includeAnonymous: true }` to see them.
`get` and `getByName` always return them regardless.

Callers that want a throwaway scope without polluting the named-context
namespace use `declare("~" + crypto.randomUUID(), entries)`.  A future
housekeeping job can sweep unreferenced anonymous contexts.

Anonymous contexts may exist at either scope:
- `~`-named user contexts stay in the user table until promoted
- `~`-named project contexts stay in the project table

Promotion from user to project is an explicit copy, not a move.  That keeps the
user copy intact while making the project view stable for retrieval and
collaboration.

```ts
// compose returns a new persisted anonymous context
async compose(
  op: "combine" | "difference",
  a: ContextEntry[],
  b: ContextEntry[]
): Promise<ContextRecord>
```

`compose` is the persisted counterpart to the pure `combine`/`difference`
helpers — it runs the operation and saves the result as an anonymous context
so the caller gets back a referenceable `id`.

---

## Context class API

```ts
interface ContextManagerConfig {
  maxEntriesPerContext: number;  // default 1000
  maxResolveDepth:      number;  // default 10 — cycle guard + sanity cap
}

interface ContextScope {
  userId: string;
  projectId: string;
}

class ContextManager {
  // ── Scope ──────────────────────────────────────────────────────────────
  /** Context can be addressed at user or project scope; project is default. */
  scope: ContextScope;

  // ── CRUD ───────────────────────────────────────────────────────────────
  get(id: string): Promise<ContextRecord | null>;
  getByName(displayName: string): Promise<ContextRecord | null>;
  list(opts?: { includeAnonymous?: boolean }): Promise<ContextRecord[]>;

  declare(displayName: string, entries: ContextEntry[]): Promise<ContextRecord>;

  /** expectedRevision is the caller's last-known revision — optimistic lock. */
  update(id: string, entries: ContextEntry[], expectedRevision: number): Promise<ContextRecord>;

  /** Soft-delete; keeps the record so history is preserved. */
  delete(id: string): Promise<void>;

  // ── Resolution ─────────────────────────────────────────────────────────
  /**
   * Expand all kind:"context" entries recursively until only leaf entries
   * remain.  Cycle detection via visited-ID set.  Depth is capped at
   * config.maxResolveDepth.  Returns deduplicated leaf entries preserving
   * first-seen order.  Missing context IDs are silently omitted (they
   * were deleted; not an error).
   */
  resolve(entries: ContextEntry[]): Promise<ContextEntry[]>;

  // ── Composition (pure, no I/O) ──────────────────────────────────────────
  // ── Pure composition helpers (no I/O, no ordering guarantee) ─────────────
  /** Set union keyed on `${kind}:${id}`. */
  combine(a: ContextEntry[], b: ContextEntry[]): ContextEntry[];

  /** Entries in a whose key does not appear in b. */
  difference(a: ContextEntry[], b: ContextEntry[]): ContextEntry[];

  // ── Persisted composition ──────────────────────────────────────────────────
  /** Run combine/difference and save the result as a new anonymous context. */
  compose(op: "combine" | "difference", a: ContextEntry[], b: ContextEntry[]): Promise<ContextRecord>;
}
```

`combine` and `difference` are pure helpers; they do **not** resolve — the
caller does that separately if needed.

---

## File layout

```
3-capabilities/context/
  types.ts          ContextEntry, ContextRecord, error classes
  store.ts          ContextStore interface
  sqlite-store.ts   SQLite implementation
  context.ts        createContextManager(store, config, logger)
  index.ts          barrel

4-job-wiring/context/
  registerContextEndpoints.ts
```

### Error classes

```ts
class ContextNotFoundError   extends Error { readonly id: string; }
class ContextConflictError   extends Error { readonly displayName: string; }
class StaleContextError      extends Error { readonly id: string; }
```

### SQLite schema

Two tables, both keyed by the runtime identity that owns them:

- `ctx_user_${prefix}_contexts` (`prefix` = SHA-256(userId).slice(0,16))
- `ctx_proj_${prefix}_contexts` (`prefix` = SHA-256(projectId).slice(0,16))

The project table is used for retrieval.  The user table is a secondary source
during promotion and personal scoping.

```sql
CREATE TABLE ctx_proj_${prefix}_contexts (
  id           TEXT    PRIMARY KEY,
  display_name TEXT    NOT NULL,
  entries_json TEXT    NOT NULL,   -- JSON array of {id, kind}
  revision     INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,
  deleted_at   TEXT
);
CREATE UNIQUE INDEX ctx_proj_${prefix}_contexts_name
  ON ctx_proj_${prefix}_contexts(display_name)
  WHERE deleted_at IS NULL;

CREATE TABLE ctx_user_${prefix}_contexts (
  id           TEXT    PRIMARY KEY,
  display_name TEXT    NOT NULL,
  entries_json TEXT    NOT NULL,
  revision     INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,
  deleted_at   TEXT
);
CREATE UNIQUE INDEX ctx_user_${prefix}_contexts_name
  ON ctx_user_${prefix}_contexts(display_name)
  WHERE deleted_at IS NULL;
```

---

## HTTP endpoints

All use query/body params (no path params — job registry exact matching).
Endpoints exist in both scope flavors so callers can manipulate the user view
or the project view directly.

| Method | Path                  | Params                                           | Notes                                                |
|--------|-----------------------|--------------------------------------------------|------------------------------------------------------|
| POST   | `/user/contexts`           | body: `{displayName, entries}`                   | create in user table; prefix name with `~` for anonymous |
| GET    | `/user/contexts`           | query: `?includeAnonymous=true`                  | list user contexts; anonymous hidden by default      |
| GET    | `/user/contexts/entry`     | query: `?id=`                                    | get one by id                                        |
| GET    | `/user/contexts/by-name`   | query: `?displayName=`                           | get one by name                                      |
| PATCH  | `/user/contexts/entries`   | body: `{id, entries, expectedRevision}`          | replace entries (deduplicates)                       |
| DELETE | `/user/contexts`           | body: `{id}`                                     | soft-delete                                          |
| POST   | `/user/contexts/resolve`   | body: `{entries}`                                | resolve in user scope                                |
| POST   | `/user/contexts/combine`   | body: `{a, b}`                                   | pure union, no I/O                                   |
| POST   | `/user/contexts/difference`| body: `{a, b}`                                   | pure difference, no I/O                              |
| POST   | `/user/contexts/compose`   | body: `{op, a, b}` (`op`: `"combine"`\|`"difference"`) | run op + persist as anonymous user context |
| POST   | `/project/contexts`         | body: `{displayName, entries}`                   | create in project table; prefix name with `~` for anonymous |
| GET    | `/project/contexts`         | query: `?includeAnonymous=true`                  | list project contexts; anonymous hidden by default   |
| GET    | `/project/contexts/entry`   | query: `?id=`                                    | get one by id                                        |
| GET    | `/project/contexts/by-name` | query: `?displayName=`                           | get one by name                                      |
| PATCH  | `/project/contexts/entries` | body: `{id, entries, expectedRevision}`          | replace entries (deduplicates)                       |
| DELETE | `/project/contexts`         | body: `{id}`                                     | soft-delete                                          |
| POST   | `/project/contexts/resolve` | body: `{entries}`                                | resolve in project scope                             |
| POST   | `/project/contexts/combine` | body: `{a, b}`                                   | pure union, no I/O                                   |
| POST   | `/project/contexts/difference`| body: `{a, b}`                                  | pure difference, no I/O                              |
| POST   | `/project/contexts/compose` | body: `{op, a, b}` (`op`: `"combine"`\|`"difference"`) | run op + persist as anonymous project context |

---

## Logging

`ContextManager` follows the same pattern as every other capability: log all
mutations at `info` level, all read operations at `debug` level, include
timing on every call.  Minimum fields:

```
context.declare   info   { displayName, entryCount, durationMs }
context.update    info   { id, entryCount, revision, durationMs }
context.delete    info   { id, durationMs }
context.compose   info   { op, entryCount, resultId, durationMs }
context.resolve   debug  { inputCount, resolvedCount, depth, durationMs }
context.list      debug  { count, includeAnonymous, durationMs }
context.get       debug  { id, found, durationMs }
```

Scoped retrieval logs within the existing `knowledge.retrieve` / `knowledge.retrieveMany`
log line; add fields:

```
scopeInputCount    — entries passed in by caller
scopeResolvedCount — entries after recursive expand
scopeSourceCount   — distinct sourceIds in admissible set
windowsBeforeScope — windows returned by descent
windowsAfterScope  — windows remaining after scope filter
```

This lets you see immediately how much scope filtering is cutting off, and
whether a stale or empty context is accidentally discarding everything.

---

### `KnowledgeResourceResolver` interface

Kept in `0-platform/knowledge/` so Knowledge has zero dependency on the
Context capability.  Context injects itself at wiring time.

```ts
/** Resolves a mixed ContextEntry[] to a flat set of leaf entries.
 *  Knowledge calls this if the scope contains any non-document entries.
 *  For the initial "document" case nothing needs resolving.            */
interface KnowledgeResourceResolver {
  resolve(entries: ContextEntry[]): Promise<ContextEntry[]>;
}
```

`ContextManager` satisfies this interface — no adapter needed.

### Updated retrieval types

```ts
interface KnowledgeRetrievalOptions {
  topK?:      number;
  scope?:     ContextEntry[];   // absent or [] = full lattice (no restriction)
}

interface KnowledgeScopeManifest {
  inputEntries:      ContextEntry[];   // as supplied by caller
  resolvedEntries:   ContextEntry[];   // after recursive expand
  resolvedSourceIds: string[];         // set used to filter windows
  contextDigest:     string;           // SHA-256(JSON(inputEntries))
  scopeDigest:       string;           // SHA-256(JSON(resolvedSourceIds sorted))
  resolvedAt:        string;           // ISO timestamp
}

interface RetrieveResult {
  regions:  Region[];
  scope:    KnowledgeScopeManifest | null;   // null when no scope was applied
  usage:    Usage;
}
```

### Filter semantics

After descent returns `windowIds`:

1. If `scope` is absent or empty → no filter; all windows are candidates.
2. Otherwise, resolve entries via `KnowledgeResourceResolver` (if any
   `kind !== "document"` entries) or use directly.
3. Build `admissibleSourceIds = new Set(resolvedEntries.map(e => e.id))`.
4. Filter `windows` to `window.sourceId ∈ admissibleSourceIds`.
5. Proceed with `assembleRegions` on the filtered set.

The `label` / `kind` field is **not** used as a filter; `sourceId` is the
authoritative key.  This avoids mismatches if a source was re-indexed with a
different label.

This is not equivalent to rebuilding the lattice from only the scoped sources
unless the corpus tier already contains no cross-source nodes.  In the current
mixed corpus lattice, post-descent filtering is the correct exclusion
mechanism: it guarantees out-of-scope windows are removed, but it can still
change ranking because mixed corpus centroids participated in the descent.

### Exclude semantics

An exclude scope is expressed by the caller using `difference` before passing:

```ts
const scope = ctx.difference(allEntries, excludedEntries);
const result = await knowledge.retrieve(query, { scope });
```

No separate "exclude" parameter is needed.

### `Knowledge` constructor change

```ts
class Knowledge {
  constructor(
    store:    KnowledgeStore,
    embedder: Embedder,
    logger:   Logger,
    opts?:    KnowledgeOptions & { resolver?: KnowledgeResourceResolver }
  )
}
```

`resolver` is optional.  If scope contains only `kind: "document"` entries,
the resolver is never called.

For logging, scoped retrieval should always record the input scope, the
resolved leaf scope, and the before/after window counts so crash reports can
distinguish an empty result from a bad scope.

### `retrieveMany`

New overload that batches embeddings and runs one descent per query:

```ts
retrieveMany(
  queries: string[],
  options?: KnowledgeRetrievalOptions
): Promise<RetrieveResult[]>
```

Scope is resolved once, shared across all queries in the batch.  Each query
gets its own `RetrieveResult` with the same `scope` manifest.

---

## Init wiring

`1-init/create/context.ts` — creates `ContextManager` with SQLite store.

`1-init/startBackend.ts` additions:
1. `createContextManager(config, logger)` → `contextManager`
2. `registerContextEndpoints(registry, contextManager)`
3. Pass `contextManager` as `resolver` into the `Knowledge` constructor via
   `createKnowledge(config, logger, { resolver: contextManager })`

---

## Alias additions (tsconfig + package.json)

| alias           | target                                  |
|-----------------|-----------------------------------------|
| `#context`      | `3-capabilities/context/index.ts`       |
| `#context/*`    | `3-capabilities/context/*`              |

---

## What this does NOT do

- **Context does not own document content** — that is Knowledge's job.
- **Context does not validate that referenced IDs exist** — stale IDs are
  silently dropped at resolve time.
- **No real-time invalidation** — if a source is removed from Knowledge,
  contexts that reference it still contain the entry; resolve just returns
  fewer leaves.
- **No per-entry subkind** — if you need to distinguish `document/v1` from
  `document/v2` use a different `kind` string; don't layer subkinds.
- **Formula/Name Manager scoping** — out of scope here; formula has no
  retrieval step.
