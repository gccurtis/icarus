# General Files runtime

## Construction

[`createGeneralFilesInstance`](../../../1-init/create/generalFiles.ts) creates one `SQLiteGeneralFileStore(config.projectId, "./data/general-files.db")`, then calls [`createGeneralFileService`](../application/generalFileService.ts) with that store, the process Knowledge instance, and shared Logger.

The resulting object has no mutable cache and no close method. Its asynchronous mutations sequence synchronous SQLite statements and asynchronous Knowledge operations.

## Public service methods

### `upload(request)`

1. Require a non-empty string filename and string content.
2. Extract and lowercase the final extension; classify kind.
3. For text kind, verify a UTF-8 Buffer round-trip.
4. Hash the full string and look up an active matching hash.
5. If active, call Knowledge add/upsert as self-heal and return `reused`.
6. Otherwise build a revision-1 row, or a prior deleted row's revision +1.
7. Admit text to Knowledge first.
8. Insert a new row or unconditionally update the deterministic tombstone.
9. If persistence fails and no concurrent active row appeared, best-effort remove the just-admitted source and rethrow.

Successful new/resurrected uploads log `general-files.upload`; reuse logs `general-files.upload.reused`. Logs include IDs and metadata, not content.

### `update(id, {content})`

Update is complete-content replacement, not a patch:

- absent/deleted source → `GeneralFileNotFoundError`;
- identical hash → Knowledge self-heal and `unchanged`;
- active target hash already exists → admit target, remove source from Knowledge, then `linkReplacement`;
- otherwise build a new content-addressed row at source revision +1, admit it, remove old Knowledge, then call transactional `replace`.

If old Knowledge removal fails, the new source is removed best-effort and SQLite is untouched. If the SQLite replacement loses its active source, helpers remove a non-active candidate and re-add the old source only when its original revision is still active. This avoids a losing concurrent update resurrecting stale Knowledge.

The filename, extension, and kind are copied from the source row. The endpoint cannot rename or reclassify a file during update.

### `get(id)` and `list(filters?)`

`get` loads by ID and rejects absent/deleted rows; it returns full content. `list` delegates to the repository and returns active metadata only. Both log debug duration/count/size metadata.

### `delete(id)`

Delete rejects absent/deleted IDs, removes an indexed source from Knowledge first, then soft-deletes SQLite. If SQLite throws, it attempts to restore Knowledge only if the same revision remains active. It logs only after success.

## Auxiliary functions

| Helper | Role |
|---|---|
| `hashContent` | SHA-256 UTF-8 content digest |
| `isValidUtf8` | Buffer encode/decode equality for text-kind strings |
| `admitToKnowledge` | No-op for other kind; deterministic Knowledge add/upsert for text |
| `removeFromKnowledge` | No-op without a source ID; awaited Knowledge removal otherwise |
| `compensateKnowledge` | Best-effort add/remove with structured failure logging |
| `restoreKnowledgeIfStillActive` | Re-add only when ID/revision/hash still identify an active source |
| `removeKnowledgeIfNotActive` | Remove candidate only if it did not become active |
| `now` | ISO timestamp provider |

## Repository methods and transactions

- `insert`, `update`, and `softDelete` are individual SQL statements.
- `replace` is one SQLite transaction: upsert/reactivate the target, then retire source with `id + revision + deleted_at IS NULL`. Any failed guard rolls back both statements.
- `linkReplacement` is one guarded `UPDATE` because the target already exists.
- list creates parameterized clauses and combines them with `AND`; results sort newest creation first.

SQLite protects a replacement within this database. It does not include Knowledge writes in that transaction.

## Job queues and concurrency

Mutation endpoints (`upload`, `update`, `delete`) use the shared serial queue. `get` and `list` use the concurrent queue. All respond inline.

The repository still protects update replacement with an expected source revision because direct service callers or other processes can bypass the in-process serial queue. A competing direct update yields one SQLite winner; the compensation helpers are state-aware so the loser does not re-admit the retired source. Upload resurrection and `softDelete` are not revision-guarded at repository level.

## Logging

Service records include operation, IDs, kinds, filenames, byte sizes, revisions/counts, Knowledge window counts, reuse/resurrection flags, and rounded durations. Endpoint failures log `general-files.<operation>.error` with error name/message before mapping the response. File content is not included in logs.

## Runtime resource registry

Startup calls `resourceRegistry.registerGeneralFiles(service)`. The registry uses `get`/`list` to:

- resolve either a file ID or `general-file:${id}` source reference;
- describe only files with a `knowledgeSourceId`;
- enforce frozen resource ID, kind, and optional revision on reads; and
- return line slices plus the stored full-file byte size.

This registration is composition-time mutability; it does not allow arbitrary runtime service lookup.
