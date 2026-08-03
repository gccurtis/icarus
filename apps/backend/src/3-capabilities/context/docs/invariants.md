# Context invariants, guarantees, and limits

## Implemented precondition → outcome contracts

| Preconditions | Guaranteed outcome in the current implementation | Enforcement boundary |
|---|---|---|
| `declare` receives no more than `maxEntriesPerContext` raw entries and no current exact-name match | A UUID record at revision 1 is inserted with first-seen `kind:id` deduplication | Manager checks plus SQLite PK/current-name index |
| `update` sees a current row whose revision equals `expectedRevision` | Revision `N` is archived and the complete entries array becomes current revision `N + 1` | One SQLite history + CAS transaction |
| `delete` sees a current row at revision `N` | Snapshot `N` and terminal deletion `N + 1` are recorded and no current row remains | One SQLite transaction |
| `list` is called without `includePrivate` | Only current rows with `private = 0` are returned | SQLite predicate |
| `getByName` succeeds | Returned row is current and exactly matches the table's name comparison | SQLite current-table lookup |
| `composeNamed` receives operands that resolve (by ID or inline) and a `displayName` with no current conflict | A UUID record at revision 1 is inserted holding the composition as a rule: a `{contextId}` operand as a nested reference, a difference's right operand as `excludes` | Manager checks plus SQLite PK/current-name index |
| `composeNamed` receives a `{contextId}` operand that does not resolve to a current row | Throws `ContextNotFoundError` before any insert | Manager operand resolution |
| `resolve` receives repeated leaf identities | Each first-seen leaf key appears at most once in the result | Final deduplication |
| `resolve` encounters a cycle, missing nested ID, or depth beyond the cap **on the include side** | That path terminates or is omitted; the call does not intentionally throw a cycle/depth error | Recursive helper |
| `resolve` encounters a cycle or the depth cap **while expanding a record's `excludes`** | That record resolves to nothing, and the truncation is logged at error | Recursive helper |
| A record carries `excludes` | They are expanded (including nested contexts) and subtracted from *that record's own* expansion; a parent sees the subtracted result, not the exclusions | Per-record resolution |
| `resolve` encounters a `kind: "project"` entry and a membership port is registered | It expands to that port's answer, fetched at most once per call | `ProjectMembershipPort` |
| `resolve` encounters a `kind: "project"` entry and no port is registered, or enumeration throws | It expands to nothing, and the reason is logged | Manager |
| The same Context is reached by two different routes in one resolve | Both routes see the same set | Ancestor-path cycle guard plus per-record memo |
| `combine(a,b)` is called | Result is first-seen union of `a` then `b` | Pure helper |
| `difference(a,b)` is called | Every occurrence in `a` whose key is absent from `b` is retained in `a` order | Pure helper |

## Identity, name, and revision rules

- Entry identity is case-sensitive `${kind}:${id}`.
- **Exclusions match on `id` alone, not on `kind:id`.** The two sides are spelled by different people: the expansion by whichever capability owns the resource (`general::file::markdown`), the exclusion by whoever typed it (`general-file`). Requiring the kinds to agree lets an exclusion silently fail to subtract. The looser match can exclude two resources that share an `id` across kinds, which narrows a scope rather than leaking one — the safe direction to be wrong in, since an exclusion that misses leaks exactly what someone asked to withhold.
- Record IDs are random UUIDs.
- Current display-name uniqueness is across the single project table and case-sensitive.
- `update` increments the current revision; `delete` records terminal revision `N + 1` in history.
- `private` is a real column, fixed at creation by `declare`/`composeNamed` (defaults `false`) and immutable thereafter — there is no "make private" command on an existing record. It is a visibility flag only: `list` excludes private records unless `includePrivate` is set; `get`, `getByName`, `resolve`, and composition-operand lookup are unaffected by it. There is no ownership or reference-counting concept attached to it — a private record with nothing pointing at it is not detected or cleaned up by Context.
- Entries are stored as arrays and emitted in first-seen order. The code does not sort them into a canonical order.

## Limits

| Limit | Default | Applied to |
|---|---:|---|
| `maxEntriesPerContext` | 100,000 | Raw array length of `entries` and of `excludes`, on declare/update/composeNamed |
| `maxResolveDepth` | 10 | Nested resolve recursion; branches beyond it are omitted on the include side and withhold the record on the exclude side |

All sites throw a typed `ContextValidationError(field, reason)` on violation, mapped to 400 `context_invalid`. There are no implemented byte limits for names, descriptions, or serialized entries.

`maxEntriesPerContext` bounds what a record stores, not what it resolves to. A record naming the project holds one entry and can expand to every resource in it.

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

- Missing nested contexts and depth exhaustion are omissions, not diagnostics — **on the include side only**. On the exclude side they withhold the record and log at error.
- An unavailable or failing `ProjectMembershipPort` expands `project` to nothing, not to everything. Both directions of failure are wrong, but only one of them is invisible: a caller who gets nothing notices, and a caller silently grounded on the whole corpus does not.
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
