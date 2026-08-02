# Context invariants, guarantees, and limits

## Implemented precondition → outcome contracts

| Preconditions | Guaranteed outcome in the current implementation | Enforcement boundary |
|---|---|---|
| `declare` receives no more than `maxEntriesPerContext` raw entries and no live exact-name match | A UUID record at revision 1 is inserted with first-seen `kind:id` deduplication | Manager checks plus SQLite PK/live-name index |
| `update` sees a live-or-ID-visible row whose revision equals `expectedRevision` | The complete entries array is replaced and returned at revision +1 | Manager read/check, then store update; not one SQL CAS |
| `list` is called without `includePrivate` | Only live rows with `private = 0` are returned | SQLite predicate |
| `getByName` succeeds | Returned row is live and exactly matches the table's name comparison | SQLite live predicate |
| `composeNamed` receives operands that resolve (by ID or inline) and a `displayName` with no live conflict | A UUID record at revision 1 is inserted holding the union/difference result | Manager checks plus SQLite PK/live-name index |
| `composeNamed` receives a `{contextId}` operand that does not resolve to a live row | Throws `ContextNotFoundError` before any insert | Manager operand resolution |
| `resolve` receives repeated leaf identities | Each first-seen leaf key appears at most once in the result | Per-call `seen` set |
| `resolve` encounters a cycle, missing nested ID, or depth beyond the cap | That path terminates or is omitted; the call does not intentionally throw a cycle/depth error | Recursive helper |
| `combine(a,b)` is called | Result is first-seen union of `a` then `b` | Pure helper |
| `difference(a,b)` is called | Every occurrence in `a` whose key is absent from `b` is retained in `a` order | Pure helper |

## Identity, name, and revision rules

- Entry identity is case-sensitive `${kind}:${id}`.
- Record IDs are random UUIDs.
- Live display-name uniqueness is across the single project table and case-sensitive.
- `update` increments `revision`; `delete` currently does not increment it or update `updatedAt`.
- `private` is a real column, fixed at creation by `declare`/`composeNamed` (defaults `false`) and immutable thereafter — there is no "make private" command on an existing record. It is a visibility flag only: `list` excludes private records unless `includePrivate` is set; `get`, `getByName`, `resolve`, and composition-operand lookup are unaffected by it. There is no ownership or reference-counting concept attached to it — a private record with nothing pointing at it is not detected or cleaned up by Context.
- Entries are stored as arrays and emitted in first-seen order. The code does not sort them into a canonical order.

## Limits

| Limit | Default | Applied to |
|---|---:|---|
| `maxEntriesPerContext` | 1,000 | Raw array length for declare/update only |
| `maxResolveDepth` | 10 | Nested resolve recursion; branches beyond it are silently omitted |

`composeNamed` does not enforce `maxEntriesPerContext` on its combined result. There are no implemented byte limits for names, descriptions, or serialized entries.

## Concurrency and atomicity

SQLite guarantees each individual statement and the live-name unique index. Context does not open a transaction around lookup plus mutation, and `ContextStore.update` has no expected-revision predicate. Therefore:

- an update already stale at its read is rejected;
- two concurrent writers can both pass the same revision check and last-writer-wins;
- delete can race update and has no revision argument; and
- a declaration race may surface a raw SQLite constraint error instead of `ContextConflictError`.

These are current non-guarantees, not properties callers should depend on. All endpoint jobs use the concurrent queue, so queue topology does not serialize these mutations.

## Soft-delete visibility

The intended public model is soft deletion, but current store predicates differ:

- `list` and `getByName` exclude deleted rows;
- `get(id)` does not filter `deleted_at`;
- update/delete/resolve/composeNamed operand resolution use ID lookup and can observe a tombstoned row.

Documentation and callers must not claim that every ID path hides tombstones until the store query is tightened.

## Scope and security

- The project table prefix is a deterministic SHA-256 fragment computed from the configured `projectId` at startup.
- There is no user-scoped Context table and no per-request scope selection; all endpoints address the same table.
- Context is an authorization-neutral reference set. It does not authenticate access to leaves.
- Unknown leaf kinds are preserved by Context; the resource registry drops kinds it cannot map.
- A frozen Knowledge scope adds membership and revision checks downstream, but Context alone is not a content-read security boundary.

## Failure behavior

- Missing nested contexts and depth exhaustion are omissions, not diagnostics.
- JSON corruption or SQLite errors propagate; mutation handlers generally map them to 400.
- Manager logging occurs after successful operations; a persistence throw prevents the success log.
- There is no cross-capability write or compensation in Context itself.

## Test coverage and non-goals

There is currently no dedicated Context capability test file under `apps/backend/test/capabilities`. Context behavior receives indirect coverage through Derived Output scope/resource tests and production smoke routing. The contracts above were therefore derived from [`context.ts`](../context.ts), [`sqlite-store.ts`](../sqlite-store.ts), and endpoint wiring rather than inferred from an absent test.

Current non-goals include content ownership, leaf existence validation, retrieval, authentication, automatic cleanup of unreferenced private contexts, Context history, hard deletion, and canonical sorting/digests inside this capability.
