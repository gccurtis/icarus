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
| `getByName(name)` | Loads by exact current display name | Read only | debug `context.getByName` |
| `list(options={})` | Lists the project table; private records excluded by default | Read only | debug `context.list` with count |
| `declare(name, entries, options?)` | Checks raw counts for `entries` and `options.excludes`, checks current-name conflict, deduplicates both, creates UUID at revision 1 with `private` from `options.private` (default `false`) | One current-table insert | info `context.declare`, plus `context.declare.detail` at content |
| `update(id, entries, expectedRevision, options?)` | Checks raw counts, existence, and revision; replaces the complete entry array at revision +1. `options.excludes` replaces exclusions only when supplied — omitted leaves them alone, `[]` clears them | Archives prior snapshot and CAS-updates current in one transaction | info `context.update`, plus `context.update.detail` at content |
| `setProjectMembership(port)` | Registers the enumerator behind `kind: "project"`. Called once during composition, after the resource capabilities exist | None | info `context.project-membership.registered` |
| `delete(id)` | Requires a current row | Archives current revision, appends terminal revision +1, removes current in one transaction | info `context.delete` |
| `purge(id)` | Requires no current row and terminal deletion history | Irreversibly removes retained history | info `context.purge` |
| `pruneHistory(cutoff)` / `purgeExpired(cutoff)` | Shared retention hooks | Prune old current-resource snapshots / purge expired deleted resources | scheduler logging |
| `resolve(entries)` | Per-record expansion: leaves pass through, `project` expands via the membership port, `context` expands to that record's own resolved set less its excludes. Final deduplication | Store reads only, plus at most one membership call | debug `context.resolve` with counts, `context.resolve.detail` at content, plus `context.resolve.excluded`, `context.resolve.project`, `context.resolve.exclusion-incomplete`, `context.resolve.project-unavailable`, `context.resolve.project-failed` |
| `combine(a,b)` | First-seen union keyed by `kind:id` | Pure; no log | none |
| `difference(a,b)` | Returns entries in `a` whose key is absent from `b` | Pure; no log | none |
| `composeNamed(op,a,b,displayName,options?)` | Stores the composition as a rule — `{contextId}` operands become nested references, a difference's right operand becomes `excludes` — checks current-name conflict, and inserts a new named record at revision 1 with `private` from `options.private` (default `false`) | One insert | info `context.composeNamed`, plus `context.composeNamed.detail` at content |

All public methods return promises where declared, but the current SQLite calls
execute synchronously on the event loop. Startup's shared retention scheduler
supplies the cutoff. Defaults are 30 days and a 24-hour sweep interval, with one
sweep immediately after HTTP binds and per-capability failure isolation.

## Auxiliary helpers

### `dedup`

The module-private helper walks entries once, keys each as `${kind}:${id}`, and preserves the first occurrence. `declare` and `update` use it. `combine` contains equivalent inline logic; `difference` does not deduplicate `a`.

### `expandList` / `expandContext`

`resolve` threads a per-call `ResolutionState` — a memo, the fetched project membership, and counters — rather than holding anything on the instance, so concurrent resolves cannot see each other's.

`expandContext` guards cycles with the **ancestor path** rather than a global visited set, because a Context reached twice must resolve identically both times. The memo makes a diamond cost one expansion; a result truncated by the depth cap is not memoized, since that truncation belongs to the path and not the record.

The depth guard is `if (depth > maxResolveDepth)`, so depth 0 through the configured depth are visited and a child call one level beyond is omitted.

### `subtract`

Removes `excludes` from an expansion, **matching on `id` alone**. See [Invariants](invariants.md) for why the looser match is the correct direction to be wrong in.

### Endpoint helpers

[`parseEntries`](../../../4-job-wiring/context/registerContextEndpoints.ts) treats a non-array as empty, ignores non-object elements, coerces `id` and `kind` with `String`, and drops entries with an empty result. It is transport normalization, not a complete schema validator.

`parseExcludes` wraps it but preserves the difference between an absent field and an empty one, because `update` reads them differently: omitted leaves existing exclusions alone, `[]` clears them. Collapsing the two would make it impossible to replace entries without silently widening the scope.

`contextErrorResponse` maps Context validation/not-found/conflict/revision
errors plus purge's `not_deleted` and missing-history outcomes. Other caught
values map to a 400 response.

## Store operations

The store derives trusted current/history table names once in its constructor
and uses prepared parameters for values. `createSchema` is idempotent.
`rowToRecord` parses `entries_json` without a recovery path; malformed stored
JSON throws to the caller. Update and delete use SQLite transactions to keep
history and current state atomic.

## Concurrency and queue behavior

Every Context endpoint creates an inline job on the shared `concurrent` queue.
Update's `id + expectedRevision` SQL predicate gives concurrent writers one
winner. Delete is transactionally serialized with current-row lookup, history
append, and current-row removal.

Name uniqueness is enforced by the current table's SQLite unique index even
when two declarations race. The precheck produces `ContextConflictError` in
the ordinary path; a race can instead surface a SQLite error.

## Resource-registry integration

[`ResourceRegistry.resolve`](../../../1-init/create/resource-reader.ts) calls `ContextManager.resolve`, then:

- passes `kind: "document"` leaves through as source IDs;
- maps a live text General File to its `knowledgeSourceId`;
- maps a live active Connector to all exposed `knowledgeSourceIds`; and
- drops unsupported, missing, non-text, pending, or failed resources.

It returns sorted `{id: sourceId, kind: "document"}` entries for Knowledge. This conversion is outside Context's authority and is intentionally not performed by `ContextManager.resolve` itself.

The registry also satisfies `ProjectMembershipPort`. `listProjectEntries` enumerates General Files, Connector entries, and accepted Findings — the three capabilities that actually put content into Knowledge, and therefore the whole of what a scope can admit. Documents are deliberately absent: a Document is not a Knowledge source, and `kind: "document"` in a Context entry means a source ID rather than a Document capability row.

Each entry is spelled the way a caller would spell that resource, so an exclusion naming one actually subtracts it. Enumerating in source-ID vocabulary would leave exclusions silently failing to match.

`startBackend` calls `contextManager.setProjectMembership(resourceRegistry)` after the resource capabilities are registered, closing the loop the other way: the registry resolves Context's leaves, and Context asks the registry what the project holds.
