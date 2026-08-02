# Context invariants, guarantees, and limits

## Implemented precondition → outcome contracts

| Preconditions | Guaranteed outcome in the current implementation | Enforcement boundary |
|---|---|---|
| `declare` receives no more than `maxEntriesPerContext` raw entries and no current exact-name match | A UUID record at revision 1 is inserted with first-seen `kind:id` deduplication | Manager checks plus SQLite PK/current-name index |
| `update` sees a current row whose revision equals `expectedRevision` | Revision `N` is archived and the complete entries array becomes current revision `N + 1` | One SQLite history + CAS transaction |
| `delete` sees a current row at revision `N` | Snapshot `N` and terminal deletion `N + 1` are recorded and no current row remains | One SQLite transaction |
| `list` is called without `includePrivate` | Only current rows with `private = 0` are returned | SQLite predicate |
| `getByName` succeeds | Returned row is current and exactly matches the table's name comparison | SQLite current-table lookup |
| `composeNamed` receives operands that resolve (by ID or inline) and a `displayName` with no current conflict | A UUID record at revision 1 is inserted holding the union/difference result | Manager checks plus SQLite PK/current-name index |
| `composeNamed` receives a `{contextId}` operand that does not resolve to a current row | Throws `ContextNotFoundError` before any insert | Manager operand resolution |
| `resolve` receives repeated leaf identities | Each first-seen leaf key appears at most once in the result | Per-call `seen` set |
| `resolve` encounters a cycle, missing nested ID, or depth beyond the cap | That path terminates or is omitted; the call does not intentionally throw a cycle/depth error | Recursive helper |
| `combine(a,b)` is called | Result is first-seen union of `a` then `b` | Pure helper |
| `difference(a,b)` is called | Every occurrence in `a` whose key is absent from `b` is retained in `a` order | Pure helper |

## Identity, name, and revision rules

- Entry identity is case-sensitive `${kind}:${id}`.
- Record IDs are random UUIDs.
- Current display-name uniqueness is across the single project table and case-sensitive.
- `update` increments the current revision; `delete` records terminal revision `N + 1` in history.
- `private` is a real column, fixed at creation by `declare`/`composeNamed` (defaults `false`) and immutable thereafter — there is no "make private" command on an existing record. It is a visibility flag only: `list` excludes private records unless `includePrivate` is set; `get`, `getByName`, `resolve`, and composition-operand lookup are unaffected by it. There is no ownership or reference-counting concept attached to it — a private record with nothing pointing at it is not detected or cleaned up by Context.
- Entries are stored as arrays and emitted in first-seen order. The code does not sort them into a canonical order.

## Limits

| Limit | Default | Applied to |
|---|---:|---|
| `maxEntriesPerContext` | 100,000 | Raw array length for declare/update, and the combined result for composeNamed |
| `maxResolveDepth` | 10 | Nested resolve recursion; branches beyond it are silently omitted |

All three sites throw a typed `ContextValidationError(field, reason)` on violation, mapped to 400 `context_invalid`. There are no implemented byte limits for names, descriptions, or serialized entries.

## Concurrency and atomicity

SQLite guarantees the current-name unique index and the multi-statement
transactions used by update and delete. Therefore:

- an update already stale at its read is rejected;
- concurrent writers for the same revision have one update-CAS winner;
- delete has no public expected revision, but archives and removes the row in
  one store transaction; and
- a declaration race may surface a raw SQLite constraint error instead of `ContextConflictError`.

All endpoint jobs use the concurrent queue, so SQLite rather than queue topology
serializes these mutations.

## Current/history deletion

Normal reads use the typed current table only. Deleted Contexts are absent from
`get`, `getByName`, `list`, update/delete lookup, resolution, and composition
operand lookup without lifecycle predicates.

History retains complete superseded snapshots and a terminal deletion record.
Purge returns 409 while a current row exists, 404 without terminal history, and
otherwise removes that history. Shared retention prunes old snapshots for
current Contexts and purges deleted Contexts whose terminal record crosses the
cutoff.

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

Context has focused tests for revisioned update, logical deletion, normal-read
absence, and purge in addition to scope/resource integration coverage.

Current non-goals include content ownership, leaf existence validation,
retrieval, authentication, automatic cleanup of unreferenced private contexts,
history inspection endpoints, and canonical sorting/digests inside this
capability.
