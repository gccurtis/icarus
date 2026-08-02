# Context runtime

## Construction

[`createContextManagerInstance`](../../../1-init/create/context.ts) opens `./data/contexts.db`, binds the configured `projectId` into `SQLiteContextStore`, and passes `config.context` plus the shared Logger to [`createContextManager`](../context.ts).

```mermaid
flowchart LR
  CFG["BackendConfig"] --> STORE["SQLiteContextStore(projectId)"]
  DB["./data/contexts.db"] --> STORE
  STORE --> FACTORY["createContextManager"]
  CFG --> FACTORY
  LOGGER["Logger"] --> FACTORY
  FACTORY --> RUNTIME["ContextManagerImpl"]
```

The manager has no mutable cache and keeps only its store, configuration, and logger. The SQLite connection remains owned by the store for process lifetime; the current port exposes no close operation.

## Public manager methods

| Method | Work and result | Persistence / side effects | Logging |
|---|---|---|---|
| `get(id)` | Loads by ID from the project table; returns record or `null` | Read only | debug `context.get` with found/duration |
| `getByName(name)` | Loads by exact live display name | Read only | debug `context.getByName` |
| `list(options={})` | Lists the project table; private records excluded by default | Read only | debug `context.list` with count |
| `declare(name, entries, options?)` | Checks raw entry count, checks live-name conflict, deduplicates, creates UUID at revision 1 with `private` from `options.private` (default `false`) | One store insert | info `context.declare` |
| `update(id, entries, expectedRevision)` | Checks raw count, existence, and revision; replaces the complete entry array; increments revision | One unconditional store update after service check | info `context.update` |
| `delete(id)` | Requires an ID lookup, then sets a tombstone timestamp | One store soft-delete; no expected revision | info `context.delete` |
| `resolve(entries)` | Depth-first nested expansion, first-seen deduplication, silent cycle/missing/depth omission | Store reads only | debug `context.resolve` |
| `combine(a,b)` | First-seen union keyed by `kind:id` | Pure; no log | none |
| `difference(a,b)` | Returns entries in `a` whose key is absent from `b` | Pure; no log | none |
| `composeNamed(op,a,b,displayName,options?)` | Resolves each operand (by `contextId` or inline `entries`), runs union/difference, checks live-name conflict, and inserts a new named record at revision 1 with `private` from `options.private` (default `false`) | One insert | info `context.composeNamed` |

All public methods return promises where declared, but the current SQLite calls execute synchronously on the event loop.

## Auxiliary helpers

### `dedup`

The module-private helper walks entries once, keys each as `${kind}:${id}`, and preserves the first occurrence. `declare` and `update` use it. `combine` contains equivalent inline logic; `difference` does not deduplicate `a`.

### Recursive `expand`

`resolve` defines an async recursive closure per call. Its shared `seen` set stores leaf keys and `context:${id}` keys. The guard is `if (depth > maxResolveDepth) return`, so depth 0 through the configured depth are visited and a child call one level beyond is omitted.

### Endpoint helpers

[`parseEntries`](../../../4-job-wiring/context/registerContextEndpoints.ts) treats a non-array as empty, ignores non-object elements, coerces `id` and `kind` with `String`, and drops entries with an empty result. It is transport normalization, not a complete schema validator.

`contextErrorResponse` maps three typed errors and maps every other thrown value to a 400 response. Endpoint read and pure-composition handlers do not consistently wrap all unexpected errors.

## Store operations

The store derives trusted table names once in its constructor and uses prepared parameters for values. `createSchema` is idempotent. `rowToRecord` parses `entries_json` without a recovery path; malformed stored JSON throws to the caller.

SQLite operations are individual statements. There is no multi-statement transaction in this capability and no store-level revision predicate on update/delete. WAL allows readers alongside a writer, but it does not turn the manager's read-then-write sequence into one atomic compare-and-swap.

## Concurrency and queue behavior

Every Context endpoint currently creates an inline job on the shared `concurrent` queue. Two direct or HTTP updates can both read the same revision and then both execute an unconditional update; the later write can overwrite the earlier one. The `expectedRevision` check detects already-stale callers but is not a cross-request atomic guarantee.

Name uniqueness is stronger: the SQLite partial unique index is the final arbiter for live names in the project table, even when two declarations race. The precheck produces `ContextConflictError` in the ordinary path; a race can instead surface a SQLite error.

## Resource-registry integration

[`ResourceRegistry.resolve`](../../../1-init/create/resource-reader.ts) calls `ContextManager.resolve`, then:

- passes `kind: "document"` leaves through as source IDs;
- maps a live text General File to its `knowledgeSourceId`;
- maps a live active Connector to all exposed `knowledgeSourceIds`; and
- drops unsupported, missing, non-text, pending, or failed resources.

It returns sorted `{id: sourceId, kind: "document"}` entries for Knowledge. This conversion is outside Context's authority and is intentionally not performed by `ContextManager.resolve` itself.
