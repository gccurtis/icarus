# Database runtime

## Construction and lifecycle

`new SQLiteKnowledgeStore(projectId, dbPath)` performs all setup synchronously:

1. creates `dirname(dbPath)` recursively;
2. opens the file with `better-sqlite3`;
3. enables WAL, NORMAL synchronous mode, and foreign-key processing;
4. derives the 16-hex project table prefix;
5. creates the five tables and two indexes if absent.

[`createKnowledge`](../../../1-init/create/knowledge.ts) is the production factory. It always supplies `./data/knowledge.db`. The adapter has a public `close()` method, but `KnowledgeStore` does not declare it and startup currently retains no handle for shutdown closure.

## Method reference

### Source registry

| Method | SQL behavior | Return/atomicity |
| --- | --- | --- |
| `getSource(sourceId)` | Select by primary key | mapped record or `undefined` |
| `putSource(record)` | Insert; on ID conflict replace every non-key field | one statement |
| `deleteSource(sourceId)` | Delete matching row | one statement; no cascade |
| `listSources()` | Select all ordered by `added_at ASC` | mapped array; equal timestamps have unspecified tie order |

### Windows

| Method | SQL behavior | Return/atomicity |
| --- | --- | --- |
| `getWindows(ids)` | Dynamic parameterized `IN` query; empty input returns immediately | Existing subset only; result order is unspecified |
| `putWindows(windows)` | Upsert each ID in a driver transaction | Whole supplied array commits/rolls back together |
| `deleteWindowsForSource(sourceId)` | Delete by `source_id` | one statement |

Window upsert may move an existing content-addressed ID to a new source/ordinal because all fields are updated on conflict. IDs include source identity in current Knowledge construction, so normal callers do not collide across sources.

### Lattice nodes

| Method | SQL behavior | Return/atomicity |
| --- | --- | --- |
| `getNodes(ids)` | Parameterized `IN`; empty input returns immediately | Existing subset; unspecified order |
| `putNodes(nodes)` | Upsert each node in a driver transaction | Whole supplied array atomic |
| `deleteNodesForSource(sourceId)` | Delete source-tier nodes by exact source | one statement |
| `deleteCorpusNodes()` | Delete nodes whose source is SQL `NULL` | one statement |
| `getSourceNodeIds(sourceId)` | Select IDs by source | order unspecified |

### Frontier and level index

| Method | SQL behavior | Return/atomicity |
| --- | --- | --- |
| `getFrontier()` | Select all | mapped entries, order unspecified |
| `putFrontier(entries)` | In one transaction, delete all project frontier rows then upsert supplied entries | replacement atomic |
| `getLevelIndex(level)` | Select JSON by primary key | parsed value or `undefined` |
| `putLevelIndex(index)` | Upsert serialized whole object by level | one statement |
| `deleteLevelIndex()` | Delete every level for project | one statement |
| `close()` | Close underlying connection | subsequent calls fail in driver |

## Helper map

| Helper | Purpose |
| --- | --- |
| `tablePrefix` | Stable project-to-table namespace |
| `createSchema` | Idempotent unversioned DDL |
| vector/ID serializers | JSON encoding and decoding |
| row converters | snake_case SQLite rows to Knowledge domain values |

All queries interpolate only the internally derived hexadecimal table prefix. Caller values are parameterized. Dynamic `IN` placeholder strings are derived from array length, not values.

## Transaction boundaries

`better-sqlite3` transactions protect only:

- one `putWindows` batch;
- one `putNodes` batch;
- full frontier replacement.

Knowledge source replacement calls delete windows, insert windows, delete nodes, insert nodes, rebuild/replace corpus state, and finally put the source record as separate operations. A failure between those calls can leave partially replaced persistence. The adapter offers no outer transaction primitive to make the full lifecycle atomic.

## Errors and logging

SQLite/open/JSON errors propagate unchanged. The adapter accepts no Logger and emits no records. Knowledge logs successful/skipped high-level operations, but adapter-level duration, busy/locked failures, transaction rollback, schema creation, and connection lifecycle are not logged.

## Performance properties

- Reads by IDs use primary-key `IN` lookups.
- Source deletions of windows/nodes use dedicated source indexes.
- Bulk writes reuse prepared statements inside transactions.
- Every vector/member/index value is JSON text, requiring full parse/stringify.
- The synchronous driver blocks the Node event loop while each operation executes.
- Very large ID arrays create one SQLite statement and may hit parameter limits; the adapter does not chunk them.
