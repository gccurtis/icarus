# external files

The project-scoped authority for native external files. External owns the
complete source lifecycle: upload admission, native descriptor derivation,
storage coordination, represented identity, paths/directories, history,
authorized download, references, re-upload and deletion.

The semantic material lane is downstream. It never calculates an upload hash,
publishes/removes native content, chooses a storage path, or owns the External
row. External delegates a committed reference only for unified plain-text/source
code, CSV/TSV, or images. External has no exact semantic lane.

## Procedures

| Procedure | Contract |
| --- | --- |
| `readExternalFileLibrary` | Strict project inventory, virtual directories, material status, limits and quarantined metadata |
| `readExternalFile` | One admitted file plus native availability, References and conditional material projection |
| `readExternalFileHistory` | Newest 200 durable project lifecycle events, including deleted files |
| `uploadExternalFiles` | Mixed-result bounded file/folder ingestion and post-commit supported-material enqueue |
| `reuploadExternalFile` | CAS replacement of native content on the same id/name/path, semantic retirement/requeue and old-blob reclamation |
| `renameExternalFile` | CAS local name/path-leaf rename with original upload provenance preserved |
| `relocateExternalFile` | CAS full project-path change with collision rejection |
| `relocateExternalDirectory` | Descendant-token CAS and one atomic table replacement for every member path |
| `updateExternalFileContext` | CAS add/clear of bounded authored CSV/TSV context and material retirement/requeue |
| `removeExternalFile` | Reference-safe CAS delete, semantic retirement, durable History and unshared-byte reclamation |
| `readExternalFileContent` | Server-only authorization and verified native-byte resolution for the attachment route |

## Native authority

`admitNativeFile` receives already bounded bytes and derives the SHA-256,
`_storage:<hash>`, actual size, canonical media type and subkind. It passes that
complete descriptor to `externalFileStorage`, which verifies rather than
discovers it. The repository atomically publishes, deduplicates, re-verifies on
read, removes idempotently, and reads the legacy material directory for old rows.

The repository's process mutation lease serializes native publication/row claim
with row removal/native reclamation. It is not a distributed lock.

## Representation and compatibility

New rows have original/current name, canonical relative path, classification,
native receipt, optional dataset context, origin, actors, revision and update
time. The representation keeps additions optional for stored legacy rows. Reads
strictly admit metadata and project safe fallback values; invalid rows are
quarantined.

Plain text, Markdown, XML, and recognized source files all persist as the
canonical `code` subkind and delegate through `externalFile::code`. The retired
stored `text` value is accepted only for compatibility and canonicalized on
read; it is never emitted by current admission.

Folders are projections over canonical relative paths. A directory revision token
is derived from all descendant ids, revisions and paths. File/path collisions,
root moves, and moving a folder inside itself are rejected before any descendant
is replaced.

## Ordering and recovery

Initial upload derives and publishes bytes before row creation, then appends
History and enqueues supported material. A row failure compensates an unclaimed
new blob best-effort. A semantic failure never rolls back a usable file.

Re-upload publishes candidate bytes, retires old semantics, updates the same row,
appends History, queues new supported material, then removes the old hash only if
no row claims it. If cleanup fails before row replacement, the original row
remains authoritative.

Delete refuses represented usage, retires semantics, rechecks revision and usage,
removes the row, records History, and reclaims only an unshared hash. A final
native removal error leaves a safe reported orphan.

The filesystem, represented tables, History rows and semantic tables do not share
a distributed transaction. Ordering and compensation are explicit parts of each
result contract.
