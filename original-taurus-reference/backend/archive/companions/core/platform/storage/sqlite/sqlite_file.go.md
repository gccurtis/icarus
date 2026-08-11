# sqlite_file.go

The project-scoped binary file store: uploaded bytes and their metadata, kept in
the `files` table as a `BLOB` alongside everything else. This is not a separate
store — every file in the package shares one `*Store` and one connection, and the
split is organizational, mirroring the capability boundaries in
`core/capability`.

Storing bytes in the database rather than on disk keeps the whole application
state in one file: a backup or a restart carries uploads with it, and there is no
second thing to keep in sync. The design point of the API is the **split between
metadata and content**. `file.File` (name, content type, size, uploader, created
time) is cheap and is what listings and lookups return; the bytes are fetched
separately and only when actually needed, so listing a project's files never
loads a single blob.

That split used to have a scoping consequence: `Content` took only a file id and
returned raw bytes with no project label, so it could not check that the caller
was entitled to them and the boundary rested entirely on the capability reading
`Meta` first. **Both by-id reads now take the project id and filter on it in
SQL** (`WHERE id = ? AND project_id = ?`), so a file belonging to another
project reads as `file.ErrNotFound` here rather than being handed over for
someone upstream to reject. The capability still re-checks the label it gets
back; the two layers are independent on purpose.

## Code breakdown

### File header and imports

States the shared-`*Store` invariant, then imports `database/sql`, `errors`,
`time`, and `core/capability/file` for the `File` type and `ErrNotFound`.

### Put — insert metadata and content together

One insert covering both halves of a file. Content is passed as `[]byte` and
bound directly to the `BLOB` column, so nothing is encoded or copied through a
string. `Size` is stored as given rather than derived from the blob, since it is
the value the upload path already validated against its limit.

### Meta — metadata without the bytes, scoped to a project

Selects every column except `content` for one `(id, project_id)` pair and scans
it through `scanFileMeta`. The `content` column is omitted deliberately so this
read stays cheap; the project predicate costs nothing extra, since
`idx_files_project` already exists and the lookup is by primary key either way.

### Content — the blob, scoped to a project

A single-column read keyed on **both** the id and the project, scanning the blob
into a `[]byte` and mapping `sql.ErrNoRows` to `file.ErrNotFound`. Bytes carry
no label of their own, so a mismatched project is indistinguishable from a
missing file — which is the intended answer. Any other driver error is returned
with a nil slice rather than paired with a half-scanned buffer.

### ByProject — a project's file metadata, newest first

Scans the same metadata columns for one project, ordered
`created_at DESC, id` — the id breaks ties so files uploaded in the same instant
still list in a stable order. Rows go through `scanFileMeta` in a loop; `rows.Err()`
is returned so an iteration that stopped on an error is not mistaken for the end
of the result.

### scanFileMeta — one scan routine for both row shapes

Takes a `rowScanner`, so the same code serves `Meta`'s single row and the
`ByProject` loop. Parses `created_at` with `timeLayout` and maps `sql.ErrNoRows`
to `file.ErrNotFound`, so a missing file is the capability's sentinel error
rather than a driver error leaking upward.
