# 0024 — Name manager: storage and HTTP handlers (pass 1 of 2)

This is Increment 4 of the formula design, pass 1: the storage and
handler-package plumbing that lets `core/capability/formula/names` (Increment
2) and its constructive-table methods (Increment 3) run against a durable
store and be driven over HTTP. Route registration and wiring into
`transport.go`/`wiring.go` are deliberately deferred to pass 2 — this pass adds
the pieces those files will consume, without touching either.

Four independent pieces, landed together: an `access.Access` method that
exposes a caller's project role to other capabilities; timestamps on
`names.Entry` (stamped by the store, not the deterministic `Manager`); a
SQLite-backed `names.NameStore`; and a new `core/handlers/name` package.

## `core/capability/access/project.go`

### MembershipRole — expose a caller's role to other capabilities

```go
func (a *Access) MembershipRole(userID, projectID string) (Role, error)
```

**What / goal / why:** every other capability's handler that needs
project-scoped authorization (so far, only `core/handlers/project` and
`core/handlers/document`) has relied on `ctx.Role` — the role already resolved
onto the *session's selected* project. The name-manager routes are scoped by
the `:projectID` path parameter instead, since a caller can read or write a
project's names without that project being their current selection, so they
need to authorize against an arbitrary project id on every request.
`MembershipRole` is `requireOwner`'s read-oriented sibling: same
`ErrNotFound`→`ErrForbidden` collapse (a non-member cannot distinguish "not a
member" from "no such project"), but it returns the actual `Role` instead of
just pass/fail, so a caller can gate on anything short of `RoleRead`.

## `core/capability/formula/names/names.go`

### Entry timestamps and Column JSON tags

```go
type Column struct {
	Name string     `json:"name"`
	Type ColumnType `json:"type"`
}

type Entry struct {
	...
	CreatedAt time.Time
	UpdatedAt time.Time
}
```

**What / goal / why:** a durable store needs to report when a name was created
and last changed, and a handler needs to serialize a `Column` directly as a
request/response field. Record 0022 deliberately kept `Entry` and the
`Manager` clock-free and deterministic (`Manager.Evaluate`'s determinism
guarantee depends on it); that guarantee is preserved here — no `Manager`
method sets either field. Only the store (SQLite, below) stamps them, the same
split `access.Project`'s `CreatedAt`/`UpdatedAt` already has between the
service and its store.

## `core/platform/storage/sqlite/sqlite.go`

### The formula_names table and names.NameStore

```go
CREATE TABLE IF NOT EXISTS formula_names (
	project_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL,
	value TEXT NOT NULL, schema TEXT NOT NULL, rows TEXT NOT NULL,
	source TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
	PRIMARY KEY (project_id, name)
)
```

**What / goal / why:** one row per stored name, primary-keyed on
`(project_id, name)` for namespace isolation. `value`/`schema`/`rows` are JSON
text; `value` only carries meaning for a scalar entry (a table/function entry
writes the literal `"null"`, since a table/function `Entry`'s zero-valued
`formula.Value` cannot itself be marshaled — it has no `Kind`). A `scalarEntry`
helper is the one predicate both `PutName` and the shared `scanName` decoder
use to decide whether `value` means anything for a given entry's `type`.

`PutName` upserts with `INSERT ... ON CONFLICT(project_id, name) DO UPDATE`,
deliberately omitting `created_at` from the `DO UPDATE SET` list so an update
preserves the original stamp while `updated_at` advances — the store-level
half of the clock-free-`Manager` split above. `Name`/`Names`/`DeleteName`
follow the file's established boundary-translation convention: `sql.ErrNoRows`
→ `names.ErrNotFound`, and `scanName` reuses the same `rowScanner` interface
`scanDocument` already established, so one decoder serves both `Name`'s
`QueryRow` and `Names`'s `Query` loop.

## `core/handlers/name/name.go` (new package)

### Handlers, authorization, and the endpoint set

```go
type Handlers struct {
	access *access.Access
	names  *names.Manager
}

func (h Handlers) authorizeRead(userID, projectID string) (endpoint.Response, bool)
func (h Handlers) authorizeWrite(userID, projectID string) (endpoint.Response, bool)
```

**What / goal / why:** the HTTP surface over the name manager — `List`, `Get`,
`Delete`, `SetValue`, `SetTable`, `SetFunction`, `AddColumn`, `AppendRows`, and
`Evaluate` — one method per route, matching the `Handlers`/`NewHandlers` shape
every other `core/handlers/*` package uses. The one departure from that
pattern is authorization: `authorizeRead`/`authorizeWrite` call the new
`access.MembershipRole` against `req.Param("projectID")` rather than trusting
`ctx.Role`, for the reason recorded above. `authorizeWrite` additionally
refuses a `RoleRead` member with 403 — the same read/write split
`document.canWrite` enforces, generalized to return its own failure response
(a non-member and a read-only member get different status codes, so a bare
bool was not enough).

### entryView, view, and error mapping

```go
type entryView struct {
	Name, Type string
	Value      *formula.Value
	Columns    []names.Column
	Rows       [][]formula.Value
	Source     *string
	CreatedAt, UpdatedAt string
}

func mapErr(err error) endpoint.Response
```

**What / goal / why:** `entryView` mirrors `Entry`'s own tagged-union shape on
the wire — `omitempty` pointer/slice fields mean only the one a given `Type`
populates appears in the JSON. `mapErr` is the shared error boundary for every
`names.Manager` call: `ErrNotFound`→404, the two constructive-write conflicts
(`ErrNameExists`, `ErrNotATable`)→409, the remaining nine validation
sentinels→400 with their own safe-to-expose message, and — checked last, via
`errors.As` — a `*formula.FormulaError` (from `SetFunction`'s parse or
`Evaluate`'s parse-or-run) renders as a structured 400 carrying both the
message and the machine-readable `Kind`, so a client can branch on failure
category without string-matching.

## Dependency direction, unchanged

`names` imports only `formula` and gained no new import. `sqlite.go` and
`name.go` both import `names` (one-way); neither is imported back. `formula`
itself was not touched in this pass.

## What pass 2 still owes

Route registration in `transport.go`, constructing `names.Manager` and
`name.Handlers` in `wiring.go`, and a live `dev-test/` pass are unchanged by
this commit — `core/handlers/name` is exercised only by its own package test
until pass 2 wires it in.
