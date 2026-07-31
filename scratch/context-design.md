# Context Capability — Design

## Summary

Context is a **regular capability** (`3-capabilities/context/`) that lets callers
name and persist ordered sets of resource references (`ContextEntry[]`).  A
context entry is `{ id: string; kind: string }` — the minimal pair that
identifies a resource without hard-coding what kind that resource is.

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

class ContextManager {
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

Table: `ctx_${prefix}_contexts`  (`prefix` = SHA-256(projectId).slice(0,16))

```sql
CREATE TABLE ctx_${prefix}_contexts (
  id           TEXT    PRIMARY KEY,
  display_name TEXT    NOT NULL,
  entries_json TEXT    NOT NULL,   -- JSON array of {id, kind}
  revision     INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,
  deleted_at   TEXT
);
CREATE UNIQUE INDEX ctx_${prefix}_contexts_name
  ON ctx_${prefix}_contexts(display_name)
  WHERE deleted_at IS NULL;
```

---

## HTTP endpoints

All use query/body params (no path params — job registry exact matching).

| Method | Path                  | Params                                           | Notes                                                |
|--------|-----------------------|--------------------------------------------------|------------------------------------------------------|
| POST   | `/contexts`           | body: `{displayName, entries}`                   | create; prefix name with `~` for anonymous           |
| GET    | `/contexts`           | query: `?includeAnonymous=true`                  | list; anonymous hidden by default                    |
| GET    | `/contexts/entry`     | query: `?id=`                                    | get one by id (anonymous included)                   |
| GET    | `/contexts/by-name`   | query: `?displayName=`                           | get one by name                                      |
| PATCH  | `/contexts/entries`   | body: `{id, entries, expectedRevision}`          | replace entries (deduplicates)                       |
| DELETE | `/contexts`           | body: `{id}`                                     | soft-delete                                          |
| POST   | `/contexts/resolve`   | body: `{entries}`                                | resolve → flat deduplicated leaf entries             |
| POST   | `/contexts/combine`   | body: `{a, b}`                                   | pure union, no I/O                                   |
| POST   | `/contexts/difference`| body: `{a, b}`                                   | pure difference, no I/O                              |
| POST   | `/contexts/compose`   | body: `{op, a, b}` (`op`: `"combine"`\|`"difference"`) | run op + persist as anonymous context |

---

## Knowledge scope integration

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
