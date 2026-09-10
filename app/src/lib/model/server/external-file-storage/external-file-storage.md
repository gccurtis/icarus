# External file storage

The process-local native-byte repository for External files. External admits
identity, type, size, and ownership; this object alone turns an admitted SHA-256
identity into filesystem I/O. Semantic and Derived Output readers borrow the
same verified bytes through this port rather than opening storage themselves.

## Ownership Boundary

One server-model instance owns the configured repository directory, publication
recovery copies, row-claim markers, garbage quarantines, filesystem calls, and
the process-local mutation queue. The External capability owns file classification, project authorization,
represented rows, revisions, path uniqueness, lifecycle history, and semantic
outbox decisions. Callers provide a complete content-addressed descriptor; they
never provide or receive a native path.

`external-file-storage` is the sole owner of native filesystem I/O for project
files. The removed material-content object has no fallback directory, reader,
configuration, or compatibility contract.

## Lifetime

- **Instance:** one per server graph and native repository directory.
- **Constructed by:** `buildServerModel`, after Store journal recovery.
- **Startup:** Store construction first recovers its journal. Strict External
  rows are then admitted and passed to `reconcile`, which restores interrupted
  committed publications before removing stale artifacts and unowned blobs.
- **Released by:** nothing; operations open and close their own handles and the
  mutation queue holds promises only while work is active.

The mutation queue reduces redundant process-local races. It is not the
correctness boundary: immutable hashes make publication repeatable and Store
transactions decide represented ownership.

## Invariants

- A storage id is exactly `_storage:<sha256>` and agrees with the lowercase
  64-hex hash supplied beside it.
- The declared size is a non-negative safe integer and equals both the admitted
  input and every verified read.
- Bytes are hashed before publication and again on every read; a mismatched
  value fails closed.
- Publication writes a mode-`0600` sibling recovery file, fsyncs it, hard-links
  the immutable canonical hash, and fsyncs the repository directory. The recovery
  file stays until its Store row has a durable claim.
- A claim filename binds one canonical hash to one opaque digest of an External
  row id. Shared hashes have independent claims.
- Reads use `O_NOFOLLOW`; represented identities never become arbitrary paths.
- Equal bytes share one blob. Cleanup removes a blob only after both represented
  Store ownership and durable publication/row claims say it is unowned.
- Removal first renames the canonical file to a unique garbage quarantine. It
  then rechecks claims/publications and restores a protected value before any
  deletion. This closes upload/delete races across server processes.
- Removal and startup reconciliation are idempotent. A committed row always wins
  over an apparent orphan; an unrecoverable represented value fails startup.
- There is one current repository. No legacy directory, unhashed filename,
  migration, alias, or fallback reader exists.

## Public methods

| Method | Effect | Contract |
| --- | --- | --- |
| `put` | file | Verify and durably publish immutable admitted bytes, retaining a hash-bound recovery token until claim |
| `claimPublication` | file | Create the represented row's durable claim, restore canonical bytes if needed, then remove the recovery copy |
| `discardPublication` | file | Remove the recovery copy for a Store decision that rolled back |
| `releaseClaim` | file | Idempotently release one represented row's hash claim after commit |
| `read` | file | Return hash-and-size-verified bytes, `undefined` when absent, or fail on corruption |
| `remove` | file | Quarantine, recheck protection, and idempotently remove or restore one content address |
| `reconcile` | file | Rebuild row claims, restore represented bytes, and remove stale recovery/quarantine/claim files and true orphans |
| `acquireMutation` | process | Serialize redundant cleanup/publication work within this graph; never the correctness boundary |

## File tree

```text
external-file-storage/
├── external-file-storage.md
├── index.server.ts
├── types.ts
├── constructor.ts
├── definition.ts
└── test/
```
