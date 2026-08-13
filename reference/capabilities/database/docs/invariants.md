# Database invariants and guarantees

## Guaranteed by the adapter

| Preconditions | Outcome |
| --- | --- |
| A usable database path and project ID are supplied | Parent directory, connection, pragmas, project tables, and indexes are created |
| The same project ID is reused | The same deterministic 16-hex table namespace is selected |
| `putSource` succeeds | One source row contains all supplied fields |
| A bulk `putWindows` or `putNodes` call succeeds | Every supplied row is committed; a driver error rolls back that batch |
| `putFrontier` succeeds | Frontier exactly equals the supplied entry set at commit |
| Empty ID array is passed to `getWindows`/`getNodes` | Empty result without invalid SQL |
| A missing source/index is requested | `undefined` rather than a fabricated record |

Caller values are bound as SQL parameters. The only SQL identifier interpolation is a SHA-256-derived hexadecimal prefix.

## Data-shape assumptions

The adapter assumes Knowledge supplies valid IDs, offsets, counts, dates, vectors, and JSON-compatible values. The schema does not duplicate those validations. It also assumes every relevant row is accessed through the correct project-prefixed adapter instance.

## Atomicity limits

The following are atomic individually: source upsert/delete statements, window batch upsert, node batch upsert, frontier replacement, and level-index statements. A complete source add, source replacement, source removal, or corpus rebuild is not atomic across tables. Crash/failure reconciliation is not implemented in this adapter.

## Referential-integrity limits

`foreign_keys = ON` is set, but the schema declares no foreign keys. Therefore:

- deleting a source does not cascade;
- windows/nodes can reference absent source IDs;
- node member IDs are opaque JSON and cannot be checked by SQLite;
- frontier IDs can reference missing nodes/windows;
- the adapter relies on Knowledge's write order and explicit cleanup.

## Migration and lifecycle limits

- `CREATE IF NOT EXISTS` is the only schema-management mechanism.
- There is no schema version, checksum, migration ledger, rollback, or compatibility check.
- Production uses a hard-coded relative `./data/knowledge.db` path.
- The project ID is represented only by a truncated hash in table names.
- `close()` is not part of `KnowledgeStore` and is not called by normal backend shutdown wiring.
- There is no Logger at this boundary.

## Concurrency guarantees and risks

WAL/NORMAL are enabled on the adapter connection. `better-sqlite3` calls are synchronous and serialized on the JavaScript thread for one instance. The adapter does not set a busy timeout, expose transaction retries, coordinate multiple store instances, or serialize multi-call Knowledge mutations. Concurrent `Knowledge.add/remove` operations can interleave their separate SQL calls unless the owning jobs prevent it.

## Recovery expectations

Derived nodes, frontier, and level indices are conceptually rebuildable, but no startup reconciliation scans for partial state. Windows include the retrievable text and embeddings, yet reconstruction helpers are not exposed by this adapter. A failed multi-call mutation may require a subsequent successful Knowledge add/remove to restore coherent state.

## Test gaps

No direct tests currently pin:

- schema creation and project isolation;
- every row round trip;
- batch rollback;
- frontier replacement;
- source/corpus-node deletion separation;
- malformed persisted JSON behavior;
- concurrent instances/WAL behavior;
- partial Knowledge mutation recovery;
- lifecycle closure.

Any expansion toward the older general Database design should be treated as a new platform implementation, not an assumed property of this adapter. It would require deliberate migration and transaction ownership decisions across existing capability-specific databases.
