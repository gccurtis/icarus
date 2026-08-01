# Context invariants, guarantees, and limits

## Implemented precondition → outcome contracts

| Preconditions | Guaranteed outcome in the current implementation | Enforcement boundary |
|---|---|---|
| `declare` receives no more than `maxEntriesPerContext` raw entries and no live exact-name match in the chosen scope | A UUID record at revision 1 is inserted with first-seen `kind:id` deduplication | Manager checks plus SQLite PK/live-name index |
| `update` sees a live-or-ID-visible row whose revision equals `expectedRevision` | The complete entries array is replaced and returned at revision +1 | Manager read/check, then store update; not one SQL CAS |
| `list` is called without `includeAnonymous` | Only live rows whose names do not begin `~` are returned | SQLite predicate |
| `getByName` succeeds | Returned row is live and exactly matches the selected table's name comparison | SQLite live predicate |
| `promote` finds a user row and no live exact-name project conflict | A project copy with a new UUID, revision 1, and new timestamps is inserted; user source is retained | Manager plus project insert |
| `resolve` receives repeated leaf identities | Each first-seen leaf key appears at most once in the result | Per-call `seen` set |
| `resolve` encounters a cycle, missing nested ID, or depth beyond the cap | That path terminates or is omitted; the call does not intentionally throw a cycle/depth error | Recursive helper |
| `combine(a,b)` is called | Result is first-seen union of `a` then `b` | Pure helper |
| `difference(a,b)` is called | Every occurrence in `a` whose key is absent from `b` is retained in `a` order | Pure helper |

## Identity, name, and revision rules

- Entry identity is case-sensitive `${kind}:${id}`.
- Record IDs are random UUIDs; promotion never preserves the source ID.
- Live display-name uniqueness is per physical scope table and case-sensitive.
- The same display name may exist once in user scope and once in project scope.
- `update` increments `revision`; `delete` currently does not increment it or update `updatedAt`.
- Anonymous naming is a `~` prefix convention, not a separate type or SQL column.
- Entries are stored as arrays and emitted in first-seen order. The code does not sort them into a canonical order.

## Limits

| Limit | Default | Applied to |
|---|---:|---|
| `maxEntriesPerContext` | 1,000 | Raw array length for declare/update only |
| `maxResolveDepth` | 10 | Nested resolve recursion; branches beyond it are silently omitted |

`compose` does not enforce `maxEntriesPerContext`, and deduplication happens after the declare/update raw-length check. There are no implemented byte limits for names or serialized entries.

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
- project-first `get` can therefore return a deleted project record rather than falling back to a live user record;
- update/delete/promote/resolve use ID lookup and can observe a tombstoned row.

Documentation and callers must not claim that every ID path hides tombstones until the store query is tightened.

## Scope and security

- User/project table prefixes are deterministic SHA-256 fragments computed from startup configuration.
- Endpoint paths select only the already-bound user or project table.
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

Current non-goals include content ownership, leaf existence validation, retrieval, authentication, automatic anonymous-context cleanup, Context history, hard deletion, automatic user→project merge, and canonical sorting/digests inside this capability.
