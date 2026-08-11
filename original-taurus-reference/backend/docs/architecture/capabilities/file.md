# FILE — the project-scoped binary store

FILE is the **project-scoped store for opaque bytes**: chat attachments, the
images documents embed, anything uploaded that is not itself a modelled resource.
A `File` is metadata (name, content type, size, uploader) plus a blob, keyed by
project. Nothing in the capability interprets the bytes.

It exists so no other capability has to hold binary data. [Chat](chat.md) stores
an attachment's `FileID` and never its content; documents embed an image by id.
Content sits behind the `Store` port specifically so it can move to object
storage later without any caller changing.

FILE is also **the clean template of the capability meta-model** described in
[runtime-model §6](../runtime-model.md#6-phase-4--the-capability-meta-model) —
one doc-comment stating the responsibility, plain value types, a `Scope` first
parameter, one `Store` port, a `Files` service built by `New(...)`, stateless
methods over the port, a `memory.go` adapter, and handlers outside the capability
in `core/handlers/file`. It imports no other capability and has no behaviour
ports at all. When in doubt about the shape, read this one first.

- **Domain** — [`core/capability/file/file.go`](../../../core/capability/file/file.go),
  with the in-memory adapter in
  [`memory.go`](../../../core/capability/file/memory.go).
- **Application handlers** —
  [`core/handlers/file/file.go`](../../../core/handlers/file/file.go).

## The model

```go
type Scope struct{ ProjectID string }

type File struct {                       // metadata only; the bytes live in the Store
	ID, ProjectID       string
	Name, ContentType   string
	Size                int64
	UploaderID          string
	UploaderName        string
	CreatedAt           time.Time
}

type Store interface {
	Put(f File, content []byte) error
	Meta(id string) (File, error)
	Content(id string) ([]byte, error)
	ByProject(projectID string) ([]File, error)
}
```

## Project scope is the capability's job

Look closely at the port: `Meta(id)` and `Content(id)` take **no project
parameter**. `Store.Content` in particular hands back raw bytes with no label
saying which project they belong to — the storage layer cannot enforce anything.

So the enforcement lives entirely in one unexported method:

```go
func (f *Files) load(scope Scope, id string) (File, error) {
	// … blank scope → ErrInvalidScope
	meta, err := f.store.Meta(strings.TrimSpace(id))
	if err != nil { return File{}, ErrNotFound }
	if meta.ProjectID != scope.ProjectID { return File{}, ErrNotFound }
	return meta, nil
}
```

`Meta` and `Download` both route through `load` before touching content — and
`Download` calls `store.Content` only *after* `load` has proved ownership. A file
in another project is reported as `ErrNotFound`, not a distinct "wrong project"
error, so a caller cannot confirm that another project's file ids exist. This is
the concrete instance of the runtime model's "the boundary is enforced twice"
claim, and it is why `DEF-1` in [issues-and-gaps](../issues-and-gaps.md) flags the
unlabelled `Content` return as defence-in-depth debt rather than a live hole.

## Operations

`Files` is stateless over `Store` plus two immutable fields: a `maxSize` cap and
an injectable clock.

- **`Upload(scope, name, contentType, content, uploaderID, uploaderName)`** —
  validates a non-blank scope, name, uploader and non-empty content; rejects
  content over `maxSize` with `ErrTooLarge`; defaults a blank content type to
  `application/octet-stream` and a blank uploader name to the uploader id; stamps
  a fresh id and UTC timestamp; stores a **copy** of the caller's slice.
- **`Meta(scope, id)`** — metadata only, via `load`.
- **`Download(scope, id)`** — metadata + bytes, via `load` then `store.Content`.
- **`List(scope)`** — the project's files, newest first (`ByProject`).
- **`MaxSize()`** — the effective cap, so callers can report it.

`New(store, maxSize)` requires a store and falls back to `DefaultMaxSize`
(25 MiB) when `maxSize < 1` — which is exactly what
[`wiring`](../../../core/wiring/wiring.go) does, calling `file.New(store, 0)`.

## HTTP surface

Three project-scoped routes, registered only when a file service is wired. `List`
has **no route today** — it is service-only, used by tests.

| Method & path | Handler | Purpose |
|---|---|---|
| `POST /files` | `Upload` | JSON `{name, contentType, content}` with base64 content; write role. → `201` with the `File`. |
| `GET /files/:fileID` | `Download` | The raw bytes under the stored content type. |
| `GET /files/:fileID/meta` | `Meta` | The metadata as JSON. |

Two details worth knowing. The upload route carries its **own larger body cap**
(`32M`) via an Echo `BodyLimit` middleware, and the global body limit explicitly
skips `POST /files` — base64 inflates content by a third, so the transport cap
has to sit above the capability's 25 MiB. And download is **always a download,
never inline**: the response sets a filename so a stored `text/html` file cannot
render inside the app's origin.

Error mapping: `ErrNotFound` → `404`, `ErrTooLarge` → `413`, `ErrInvalid` /
`ErrInvalidScope` → `400`.

## Persistence

One table in the one SQLite [store](../persistence.md): `files`, with the content
held inline as a `BLOB` alongside its metadata, foreign-keyed to `projects` and
indexed by `(project_id, created_at)` for listing. `MemoryStore` provides the
same contract for tests, holding metadata, a byte copy, and insertion order.

## Related

- [Chat](chat.md) — attachments store a `FileID` here and never the bytes.
- [Access](access.md) — establishes the project scope and the write role.
- [Persistence](../persistence.md) — the `files` schema.
