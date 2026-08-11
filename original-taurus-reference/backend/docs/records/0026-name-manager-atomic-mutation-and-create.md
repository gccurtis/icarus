# 0026 — Name manager: atomic table mutation, and CreateTable over HTTP

Two related additions to the formula name manager. First, `AddColumn` and
`AppendRows` were a read-modify-write over `NameStore.Name` followed by
`PutName` — a caller had to be the single writer for a given name, since two
concurrent calls on the same table could interleave and one's write could
silently clobber the other's. `NameStore` gains an atomic `UpdateName` method
that closes that gap, and `AddColumn`/`AppendRows` are rewritten to use it.
Second, `Manager.CreateTable` (added in
[record 0023](0023-formula-constructive-tables.md)) had no HTTP route — a
caller could only reach it as a library, not over the wire. This pass adds a
`CreateTable` handler and registers `POST /projects/:projectID/names/:name/table`
(fail-if-exists), complementing the existing `PUT` on the same path
(`SetTable`, which always replaces).

## `core/capability/formula/names/names.go`

### `NameStore` gains `UpdateName`

```go
// UpdateName atomically reads an entry, applies mutate, and writes the
// result in one transaction, so concurrent read-modify-write callers cannot
// lose an update. It returns ErrNotFound if the entry is absent, or mutate's
// error (leaving the stored entry unchanged).
UpdateName(project, name string, mutate func(Entry) (Entry, error)) error
```

**What/goal/why:** adds a fifth method to the `NameStore` port: an atomic
read-modify-write, expressed as a `mutate` callback the store runs against
the current entry under whatever locking or transaction discipline it uses
internally. The goal is to let a caller like `AddColumn`/`AppendRows` express
"read this entry, check and transform it, write the result" as a single
operation the store can make indivisible, rather than composing it from two
separate port calls (`Name` then `PutName`) with a window between them where
another writer can interleave. `ErrNotFound` is the store's responsibility to
return before ever invoking `mutate`; any other error `mutate` returns is
propagated unchanged, and the store must leave the row untouched in that case.

## `core/capability/formula/names/memory.go`

### `MemoryStore.UpdateName`

```go
// UpdateName runs the read, mutate, and write under a single lock, so
// concurrent callers mutating the same name are serialized and cannot lose an
// update. mutate sees a copy and the stored result is a copy, so neither aliases
// the store's data.
func (s *MemoryStore) UpdateName(project, name string, mutate func(Entry) (Entry, error)) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	entry, ok := s.projects[project][name]
	if !ok {
		return ErrNotFound
	}
	updated, err := mutate(cloneEntry(entry))
	if err != nil {
		return err
	}
	s.projects[project][name] = cloneEntry(updated)
	return nil
}
```

**What/goal/why:** the in-memory implementation is the simplest possible one
that satisfies the port's contract — hold the one mutex `PutName`/`Name`/
`DeleteName` already share across the read, the `mutate` call, and the write,
so no other `MemoryStore` method can interleave. It reuses `cloneEntry` on
both sides (into `mutate` and out to the store) for the same non-aliasing
reason `Name`/`Names` already clone on read: neither `mutate` nor a later
caller holding the returned `Entry` can reach into the store's own slices.

## `core/capability/formula/names/manager.go`

### `AddColumn` and `AppendRows` call `UpdateName`; `loadTable` removed

```go
func (m *Manager) AddColumn(project, name string, column Column) error {
	if !formula.IsIdentifier(column.Name) {
		return ErrInvalidName
	}
	if !validColumnType(column.Type) {
		return ErrInvalidColumnType
	}
	return m.store.UpdateName(project, name, func(entry Entry) (Entry, error) {
		if entry.Type != TypeTable {
			return Entry{}, ErrNotATable
		}
		for _, existing := range entry.Schema {
			if existing.Name == column.Name {
				return Entry{}, ErrDuplicateColumn
			}
		}
		schema := append(cloneColumns(entry.Schema), column)
		rows := cloneRows(entry.Rows)
		for i := range rows {
			rows[i] = append(rows[i], formula.NullValue())
		}
		return Entry{Name: name, Type: TypeTable, Schema: schema, Rows: rows}, nil
	})
}
```

**What/goal/why:** `AddColumn` and `AppendRows` previously called a shared
`loadTable` helper (`Name` + a `TypeTable` check) and then a separate
`PutName` — a genuine read-modify-write with a race window between the two
calls. Both are rewritten to call `m.store.UpdateName` with a `mutate`
callback that does the same table-type check, validation, and transform, but
now runs wherever the store makes it indivisible. `loadTable` had no other
caller, so it is deleted outright rather than left dead. The column-name and
type checks in `AddColumn` that don't depend on the current entry (identifier
shape, valid `ColumnType`) stay outside the callback, ahead of the store
call, since they need no read of the existing table to evaluate.

## `core/platform/storage/sqlite/sqlite.go`

### `marshalName` extracted; `PutName` reuses it; new `Store.UpdateName`

```go
func marshalName(entry names.Entry) (value, schema, rows string, err error) {
	v := []byte("null")
	if scalarEntry(entry.Type) {
		if v, err = json.Marshal(entry.Value); err != nil {
			return "", "", "", err
		}
	}
	sc, err := json.Marshal(entry.Schema)
	if err != nil {
		return "", "", "", err
	}
	rw, err := json.Marshal(entry.Rows)
	if err != nil {
		return "", "", "", err
	}
	return string(v), string(sc), string(rw), nil
}
```

```go
func (s *Store) UpdateName(project, name string, mutate func(names.Entry) (names.Entry, error)) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	entry, err := scanName(tx.QueryRow(
		`SELECT name, type, value, schema, rows, source, created_at, updated_at
		 FROM formula_names WHERE project_id = ? AND name = ?`, project, name))
	if err != nil {
		return err
	}
	updated, err := mutate(entry)
	if err != nil {
		return err
	}
	value, schema, rows, err := marshalName(updated)
	if err != nil {
		return err
	}
	now := time.Now().UTC().Format(timeLayout)
	if _, err := tx.Exec(
		`UPDATE formula_names SET type = ?, value = ?, schema = ?, rows = ?, source = ?, updated_at = ?
		 WHERE project_id = ? AND name = ?`,
		string(updated.Type), value, schema, rows, updated.Source, now, project, name); err != nil {
		return err
	}
	return tx.Commit()
}
```

**What/goal/why:** `PutName`'s three-column payload encoding (`value`,
`schema`, `rows`) is pulled out into `marshalName` so `UpdateName` can reuse
it verbatim rather than duplicating the `json.Marshal` calls; `PutName`'s
body is otherwise unchanged, just calling the new helper. `Store.UpdateName`
is the durable implementation of the atomic port: it runs the whole
read-mutate-write inside one `s.db.Begin()` transaction. Because every
connection's DSN sets `_txlock=immediate` (`pragmaDSN`, from
[record 0024](0024-name-manager-storage-and-handlers.md)), `BEGIN` itself
takes SQLite's write lock immediately — before the `SELECT` even runs — so no
other transaction can read the same row, mutate it, and commit in the gap
before this one writes. `defer tx.Rollback()` follows the same pattern already
used elsewhere in this file (`ReplaceSource`, `DeleteSource`, ...): it is a
no-op after a successful `tx.Commit()`, and on any error path (a missing row,
a `mutate` failure, a marshal failure, a failed `UPDATE`) it discards the
transaction, leaving the row untouched.

## `core/handlers/name/name.go`

### `CreateTable` handler

```go
// CreateTable creates a new, empty table with the given columns, failing with
// 409 if the name is already taken (unlike SetTable, which replaces). Requires
// write access.
func (h Handlers) CreateTable(ctx access.Context, req endpoint.Request) endpoint.Response {
	projectID := req.Param("projectID")
	if resp, ok := h.authorizeWrite(ctx.User.ID, projectID); !ok {
		return resp
	}
	var in struct {
		Columns []names.Column `json:"columns"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	if err := h.names.CreateTable(projectID, req.Param("name"), in.Columns); err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusCreated, Body: map[string]string{"status": "created"}}
}
```

**What/goal/why:** wires `Manager.CreateTable` — constructive since
[record 0023](0023-formula-constructive-tables.md), but never reachable over
HTTP — to a handler in the same style as `SetTable`/`AddColumn`/`AppendRows`:
authorize write, bind the request body (just `columns`, no rows), call the
manager, map the result. `mapErr` already maps `names.ErrNameExists` to `409`
(used by no other handler until now), so no new error-mapping case was
needed. It reports `201 Created` on success — the one setter-family handler
that creates rather than upserts, unlike the `200`s `SetTable`/`SetValue`/
`SetFunction`/`AddColumn`/`AppendRows` return.

## `core/transport/transport.go`

### Registered `POST .../table` alongside `PUT .../table`

```go
gated.POST("/projects/:projectID/names/:name/table", s.adaptScoped(nameHandlers.CreateTable))
```

**What/goal/why:** registers the new handler on the gated group, in the same
block and under the same `opts.Names != nil` guard as every other
name-manager route, placed directly above the existing `PUT` on the same
path so the two routes that share `.../table` but differ by method (create
vs. replace) read together.

## Verification

`go build ./...`, `go vet ./...`, and `go test ./...` are unchanged and green
(no `.go` file changed as part of writing this record — the code landed in
the commits this record documents). `dev-test/names/run.sh` gained a step
exercising the new route: `POST .../orders/table` with a column list → `201`,
then the same request again → `409` (`ErrNameExists`); the suite passes
end-to-end.
