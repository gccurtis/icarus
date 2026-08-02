# General Files runtime

## Construction

[`createGeneralFilesInstance`](../../../1-init/create/generalFiles.ts) creates one `SQLiteGeneralFileStore(config.projectId, "./data/general-files.db")`, then calls [`createGeneralFileService`](../application/generalFileService.ts) with that store, the process Knowledge instance, and shared Logger.

The resulting object has no mutable cache and no close method. Its asynchronous mutations sequence synchronous SQLite statements and asynchronous Knowledge operations.

## Public service methods

### `upload(request)`

1. Require a non-empty string filename and string content.
2. Extract and lowercase the final extension; classify kind.
3. For text kind, verify a UTF-8 Buffer round-trip.
4. Hash the full string and look up a current matching hash.
5. If current, call Knowledge add/upsert as self-heal and return `reused`.
6. Otherwise ask history for this deterministic identity's next revision.
7. Admit text to Knowledge first.
8. Insert the new current row.
9. If persistence fails and no concurrent current row appeared, best-effort
   remove the just-admitted source and rethrow.

Successful new or deterministic re-registration uploads log
`general-files.upload`; reuse logs `general-files.upload.reused`. Logs include
IDs and metadata, not content.

### `update(id, {content})`

Update is complete-content replacement, not a patch:

- absent current source → `GeneralFileNotFoundError`;
- identical hash → Knowledge self-heal and `unchanged`;
- current target hash already exists → admit target, remove source from Knowledge, then `linkReplacement`;
- otherwise build a new content-addressed row at the target identity's next
  historical revision, admit it, remove old Knowledge, then call transactional
  `replace`.

If old Knowledge removal fails, the new source is removed best-effort and
SQLite is untouched. If the SQLite replacement loses its current source,
helpers remove a non-current candidate and re-add the old source only when its
original revision remains current. This avoids a losing concurrent update
reintroducing stale Knowledge.

The filename, extension, and kind are copied from the source row. The endpoint cannot rename or reclassify a file during update.

### `get(id)` and `list(filters?)`

`get` loads current by ID and returns full content. `list` returns current
metadata only. Both log debug duration/count/size metadata.

### `delete(id)`

Delete rejects an ID without a current row, removes its indexed source from
Knowledge first, then archives snapshot `N`, appends terminal deletion `N + 1`,
and removes current in one SQLite transaction. If SQLite throws, it attempts to
restore Knowledge only if the same revision remains current. It logs only after
success.

### `purge(id)` and retention

Purge rejects a current file, requires terminal deletion history, and
irreversibly removes that identity's retained history. `pruneHistory(cutoff)`
removes old snapshots for current files; `purgeExpired(cutoff)` purges deleted
identities whose terminal record is older than the shared cutoff. Neither path
calls Knowledge because successful logical deletion already removed the source.
The shared defaults are 30 retention days and a 24-hour sweep interval, with
one sweep immediately after HTTP binds and per-capability failure isolation.

## Auxiliary functions

| Helper | Role |
|---|---|
| `hashContent` | SHA-256 UTF-8 content digest |
| `isValidUtf8` | Buffer encode/decode equality for text-kind strings |
| `admitToKnowledge` | No-op for other kind; deterministic Knowledge add/upsert for text |
| `removeFromKnowledge` | No-op without a source ID; awaited Knowledge removal otherwise |
| `compensateKnowledge` | Best-effort add/remove with structured failure logging |
| `restoreKnowledgeIfStillActive` | Re-add only when ID/revision/hash still identify the current source |
| `removeKnowledgeIfNotActive` | Remove candidate only if it did not become current |
| `now` | ISO timestamp provider |

## Repository methods and transactions

- `insert` writes one current row; `nextRevision` reads retained identity history.
- `replace` is one SQLite transaction: insert the target, archive the expected
  source snapshot plus terminal revision, then remove source current. Any
  failed guard rolls back all statements.
- `linkReplacement` uses the same history/current transaction when the target
  already exists.
- `delete` atomically archives current, appends terminal history, and removes
  current.
- list creates parameterized clauses and combines them with `AND`; results sort newest creation first.

SQLite protects a replacement within this database. It does not include Knowledge writes in that transaction.

## Job queues and concurrency

Mutation endpoints (`upload`, `update`, `delete`, `purge`) use the shared serial
queue. `get` and `list` use the concurrent queue. All respond inline.

The repository protects replacement with the expected source revision because
direct service callers or other processes can bypass the in-process serial
queue. A competing direct update yields one SQLite winner; compensation helpers
are state-aware so the loser does not re-admit the source moved to history.

## Logging

Service records include operation, IDs, kinds, filenames, byte sizes,
revisions/counts, Knowledge window counts, reuse/re-registration flags, and
rounded durations. Endpoint failures log `general-files.<operation>.error` with
error name/message before mapping the response. File content is not included
in logs.

## Runtime resource registry

Startup calls `resourceRegistry.registerGeneralFiles(service)`. The registry uses `get`/`list` to:

- resolve either a file ID or `general-file:${id}` source reference;
- describe only files with a `knowledgeSourceId`;
- enforce frozen resource ID, kind, and optional revision on reads; and
- return line slices plus the stored full-file byte size.

This registration is composition-time mutability; it does not allow arbitrary runtime service lookup.
