# sqlite_formula_names.go

The per-project formula name manager: the durable half of
`core/capability/formula/names`. One table, `formula_names`, keyed on
(`project_id`, `name`), stores every named value a project's formulas can refer
to — a scalar, a table, or a function.

The interesting property is that one table holds three differently-shaped
payloads. Rather than nullable columns or a JSON blob, the row carries all of
`value`, `schema`, `rows`, and `source`, and the entry's `type` decides which of
them are meaningful. The unused columns are written as harmless placeholder JSON
(`"null"`, `"[]"`) and skipped on read, so the write and read paths agree on a
single rule about which column matters — a rule stated once, in `scalarEntry`.

This file is part of the one shared `*Store` and connection; the split from
`sqlite.go` mirrors the capability boundary.

## Code breakdown

### File header and imports

The package comment records the organizational split. Imports are the usual
storage set plus the `names` capability, which supplies `names.Entry`, the
`EntryType` constants, and `names.ErrNotFound`.

### scalarEntry — which column holds the payload

The single predicate the rest of the file is built on. Null, number, text, and
logic entries keep their payload in the `value` column; everything else does not
— a table's payload lives in `schema` and `rows`, and a function's in `source`.
Both `marshalName` and `scanName` consult it, so the encode and decode sides can
never disagree about where an entry's data lives. Adding a new scalar type is a
one-line change here rather than an edit in two places.

### marshalName — serialize an entry's payload columns

Returns the three JSON strings a write needs. `value` is marshaled only for a
scalar type and otherwise stays the literal `"null"`; `schema` and `rows` are
always marshaled, which for a non-table entry yields empty/`null` JSON that
`scanName` will simply not look at. The result is that every row is
well-formed JSON in every column regardless of type, so a decode never has to
handle an empty string.

### PutName — upsert, preserving `created_at`

Marshals the payload columns, stamps a single `now` used for both timestamps, and
inserts with `ON CONFLICT(project_id, name) DO UPDATE`. The conflict clause
refreshes `type`, the payload columns, `source`, and `updated_at` — but
pointedly not `created_at`, so a name keeps its original creation time across
every subsequent overwrite and only an insert ever sets it. Callers therefore do
not need to know whether a name already exists.

### UpdateName — atomic read-modify-write

The method that exists because `PutName` cannot express "change part of this
entry". The caller supplies a `mutate` function; the store reads the current
entry, applies it, and writes the result — all inside one transaction:

```go
tx, err := s.db.Begin()   // immediate: takes the write lock up front
```

That "immediate" is the whole point, and it comes from `pragmaDSN` in
`sqlite.go`, which sets `_txlock=immediate` on every connection. `BEGIN` acquires
the write lock before the `SELECT`, so two concurrent callers mutating the same
name are serialized rather than both reading the same pre-state and one
clobbering the other's write. Without it, the read and the update could interleave
and an update would be lost. A read of a missing name propagates
`names.ErrNotFound` out of `scanName`, and an error from `mutate` aborts the
transaction via the deferred `Rollback` — so a mutation that decides it cannot
proceed leaves the stored entry untouched.

The write refreshes only the payload columns, `source`, and `updated_at`; the
name and `created_at` are identity and stay fixed.

### Name and Names — the read paths

`Name` is the single-entry lookup, `Names` the project listing ordered by name so
the result is stable and human-ordered. Both select the same column list and
funnel through `scanName`, which is typed against the package's `rowScanner`
interface precisely so it can serve a `*sql.Row` and a `*sql.Rows` alike. `Names`
returns `rows.Err()` as its final error, so an iteration that broke off early is
not mistaken for a short list.

### DeleteName — removal must be observable

Deletes by (project, name) and checks `RowsAffected`: zero means the name was not
there, reported as `names.ErrNotFound`. Unlike some other deletes in this
package, deleting a missing name is *not* treated as success — formulas referring
to a name need to know whether it was ever defined.

### scanName — decode by type

The mirror of `marshalName`. It scans every column into strings, converts `type`,
then unmarshals `value` only for a scalar and `schema`/`rows` only for a table —
consulting `scalarEntry` for the first test, exactly as the write path did. The
`source` column is scanned straight into the entry with no decoding, since a
function body is stored as plain text. Timestamp parse errors are ignored,
degrading to a zero time, whereas a malformed payload column *is* returned as an
error: the payload is what the caller came for.
