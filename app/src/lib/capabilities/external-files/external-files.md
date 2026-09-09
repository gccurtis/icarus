# external files

The scoped ingestion and management boundary for project-owned native files.
External owns upload receipts, safe metadata projection, local display rename,
usage checks, download resolution, deletion, and shared-byte reclamation. Native
bytes are content-addressed by SHA-256 through the material-content model; a
relative upload path is stored only as metadata and is never joined to a server
filesystem path.

| procedure | answers |
| --- | --- |
| `readExternalFileLibrary` | Every valid file in the project with bounded metadata, semantic status, limits, and quarantined-row notices |
| `readExternalFile` | One file's metadata, native-byte availability, semantic products, and represented usage |
| `uploadExternalFiles` | A mixed-success file/folder batch with stable row receipts and post-commit semantic enqueue status |
| `renameExternalFile` | A compare-and-swap project-local display rename that preserves original name, path, hash, and bytes |
| `removeExternalFile` | A compare-and-swap delete after usage refusal and semantic retirement, followed by unreferenced-byte reclamation |
| `readExternalFileContent` | Server-only authorization and verified native-byte resolution for the HTTP download route |

New rows always carry original name, normalized relative path, byte size,
revision, and updated actor. Those fields remain optional in the representation
type because stores created before this capability contain the smaller external
row shape. Reads admit that legacy shape and project concrete fallback values;
new writes do not reproduce it.

The JSON store is failure-safe per table but is not transactional across the
native-byte directory, external rows, semantic tables, and indexes. Ingestion
therefore publishes bytes first, creates a row second, and enqueues semantics
last. Native publication/row creation and row removal/native reclamation share
the material-content model's process-level mutation lease; otherwise delete could remove a newly published
hash before its upload creates the claiming row. This matches the represented
store's process-local concurrency model. A semantic enqueue failure is reported
but never rolls back a valid file.
Deletion refuses represented usage, retires semantic products while the source
row still exists, removes the row synchronously, and then removes the blob only
when no external row in any project carries the hash. A last-step byte removal
failure leaves a safe orphan for later reclamation rather than a dangling row.

Files are resources managed in the singleton External library, not editable
documents and not per-file workspace tabs. Findings are intentionally not part
of this implementation.
