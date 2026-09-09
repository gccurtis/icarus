# Store

The Store owns the server process's materialized representation tables. Each
table is held in memory and, when a directory is configured, persisted as one
JSON file. A path such as `documents.r-memo.title` is deliberately untyped at
the boundary: the Store admits the path and storable value, while the calling
capability owns domain validation and authorization.

## Ownership Boundary

One Store instance belongs to one server runtime. It alone owns the in-memory
table map, table-file replacement, transaction journal, and commit availability
state. Capabilities receive the Store through the server model and may request
operations; they do not open files, hold table maps, or implement compensation.

The configured process must be the only writer for its directory. Coordinating
several processes would require a different model with locking or a shared
database; this Store does not pretend that a filesystem rename is distributed
coordination.

`StoreUnitOfWork` is a callback-scoped mutation port, not another Store model.
It owns no global state and becomes unusable as soon as its synchronous callback
returns. The root Store refuses access while that callback is active, which
prevents an operation from accidentally escaping the transaction through a
captured reference.

## Lifetime

Construction first recovers any committed journal and only then loads tables.
The Store therefore cannot be handed to the ready server while represented
tables disagree about the last transaction. Tables remain in memory for the
server process lifetime; individual writes are synchronous and hold no open
file handle that needs a release step.

The process-level `ICARUS_STORE_DIRECTORY` override exists for isolated
harnesses. Playwright points it at a disposable seed copy and removes that copy
when its server exits. Ordinary development and production use the directory
named by `configuration/representation.yaml`.

## Invariants

- A public mutation admits every path and value before changing live state.
- A direct mutation replaces one complete table file durably, then adopts the
  same immutable row array in memory.
- A transaction stages every table in an isolated map. Invalid work, a thrown
  callback, or a failpoint before the journal decision discards the entire map.
- A durable journal containing every after-image is the commit decision. Once
  that decision exists, interruption is recovered forward; it is never guessed
  backward from whichever table files happened to be renamed.
- Journal replay is idempotent. Recovery rewrites every after-image, removes the
  journal durably, and only then permits construction to finish.
- A Store interrupted after its commit decision refuses all further access.
  The next constructor is the only recovery entry.
- Transaction callbacks are synchronous, cannot nest, and receive a scoped
  unit. This keeps one JavaScript run-to-completion interval equal to one staged
  intent and prevents asynchronous work from retaining transaction authority.
- Row identities are opaque UUIDs. Removing a row cannot make a stale client id
  address a later replacement.
- The journal accepts exactly its current schema. Recovery contains no legacy
  reader, migration, or fallback interpretation.

## Commit path

Direct table persistence uses a sibling next-file: write, file `fsync`, rename,
then directory `fsync`. A transaction adds one decision before those table
replacements:

1. Run all operations against the scoped working map.
2. Durably write `.store-transaction.json` with every changed table's after-image.
3. Durably replace the changed table files in deterministic table-name order.
4. Adopt the same table values in memory.
5. Durably remove the journal.

A crash before step 2 leaves no decision and therefore no represented change.
A crash from step 2 onward leaves the decision available for constructor-time
replay. The fault-injection contract exercises the pre-decision rollback,
post-decision restart phases, partial replay, and readiness refusal.
