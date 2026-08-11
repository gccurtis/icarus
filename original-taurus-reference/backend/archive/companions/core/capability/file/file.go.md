# file.go

The file capability: a project-scoped binary store for uploaded attachments and
the images documents embed. A `File` is metadata (name, content type, size,
uploader, created time) plus opaque bytes held behind a `Store` port, so the
content can move to object storage later without touching a single caller. The
service enforces a per-upload size cap and re-checks project scope on every
read.

The project boundary is the product's core privacy property, so this package no
longer rests it on caller discipline alone. Every by-id `Store` read takes the
project it is being made on behalf of and must answer `ErrNotFound` for a file
that belongs elsewhere; the service then re-checks the label on the row it gets
back. Two independent layers, neither load-bearing by itself.

## Code breakdown

### Package doc and `Scope`

The package comment states the content-behind-a-port design. `Scope` is trusted
application context — a project id — set after `access` has selected a project;
the capability never resolves it itself.

### `DefaultMaxSize` and the sentinel errors

`DefaultMaxSize` (25 MiB) is the cap applied when the composition root passes 0.
The four errors separate the reasons a request fails: `ErrNotFound`,
`ErrInvalid`, `ErrInvalidScope` (no project on the request), and `ErrTooLarge`.
Cross-project reads deliberately collapse into `ErrNotFound` so a project cannot
even confirm that another project's file exists.

### `CodeTooLarge`, `tooLarge`, and `sizeLimit` — one failure, two identities

The size failure is a `limit.Exceeded` carrying the cap, the actual size and the
file's name, so a client can say "this file is 31 MB and the cap is 25 MB". Before
this it was the bare sentinel, whose message was the whole story: the two routes
that mapped it worded it differently and neither named the bound.

`CodeTooLarge` lives here rather than in the shared `limit` package for the same
reason `document` owns its conflict codes — the shared type is a shape, not a
registry of every limit in the system.

`sizeLimit` embeds `*limit.Exceeded` and adds two small methods, and **both are
load-bearing**:

- `Is` keeps `errors.Is(err, ErrTooLarge)` true. Enriching an error is exactly where
  a check that used to match silently stops matching, and callers that only care
  *whether* the upload failed should not have to change. Same device as
  `document.AdmissionConflict`.
- `Unwrap` is what lets `errors.As` — and so `limit.From` — reach the embedded
  limit.

The second one is easy to get wrong, and was: embedding promotes `Error()` and
`Body()`, so the value prints like a limit and looks like one, while `errors.As`
still fails because the concrete type is `*sizeLimit` and there is no chain to walk.
`TestUploadSizeCapCarriesTheArithmetic` asserts the sentinel *and* the numbers
together for that reason, and it is what caught the missing `Unwrap`.

### `File` — the metadata record

Everything about a stored file except the bytes, JSON-tagged for the transport
layer. `ProjectID` on the record is what makes a returned row self-describing —
the service can verify what it was handed.

### `Store` — the persistence port

```go
Meta(projectID, id string) (File, error)
Content(projectID, id string) ([]byte, error)
```

Both by-id reads carry the project. That signature is the point: bytes have no
label of their own, so an implementation that took only an id could not tell
whether the caller was entitled to them and had to trust that someone upstream
had checked. Implementations must return `ErrNotFound` when the id exists but
belongs to another project, which puts the boundary in the query (a `WHERE
project_id = ?` in SQL) rather than in a convention.

### `Files` and `New`

The service holds the store, the size cap, and an injectable `now` so tests can
stamp deterministic timestamps. `New` rejects a nil store and substitutes
`DefaultMaxSize` for any cap below 1. `MaxSize` exposes the effective cap so the
transport can advertise it.

### `Upload` — validate, stamp, store

Requires a project scope, a name, non-empty content, and an uploader; enforces
the byte cap through `tooLarge` (so the failure carries its arithmetic); defaults a
blank content type to `application/octet-stream` and a blank uploader name to the
uploader id. It mints the id, stamps `CreatedAt` in UTC, and hands the store a
**copy** of the content so a caller reusing its buffer cannot mutate what was
stored.

### `Meta`, `Download`, `List`

`Meta` is `load`. `Download` calls `load` first — which both scopes the metadata
read and yields the row's own `ProjectID` — then fetches the bytes with that
project id, so the content query is scoped by a label that came from the
database rather than from the request. A content read that fails is reported as
`ErrNotFound` rather than leaking a storage error. `List` needs no id lookup: it
delegates straight to `ByProject`, which has always been scoped.

### `load` — the scope gate, twice over

Requires a non-empty project, passes it into `Store.Meta`, and then still
compares `meta.ProjectID` against the scope before returning. The redundancy is
deliberate: the store is expected to have filtered already, and this check is
the second layer that catches an implementation that did not.

### `newID`

16 random bytes, hex-encoded — the id scheme used across capabilities.
