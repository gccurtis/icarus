# sqlite_context.go

Persistence for stored contexts — named, reusable sets of a project's resources
that can be bound to a prompt variable. One table, `contexts`, keyed on
`(project_id, id)`, with the two ref lists held as JSON text columns.

A context stores **only references**: an `Includes` list and an `Excludes` list
of `{kind, id}` pairs. It never stores the resources themselves, nor a
materialized membership. Flattening those refs to concrete leaf resources —
expanding whole-project, expanding a nested context or a connector to the files
it syncs, then subtracting the excludes — happens live in the `contexts`
capability's `Resolve`, against ports wired at composition. That is deliberate:
because only references are durable, a context follows the project as it changes
instead of going stale, and a member that has since been deleted simply drops
out of the next resolution.

## Code breakdown

### File header: one Store, one connection, split by capability

The package clause repeats the note carried by every file in this split: all of
these methods hang off the same `*Store` over a single connection, so the file
boundary is organizational and mirrors `core/capability`. Timestamps here are
formatted and parsed with `time.RFC3339Nano` spelled out rather than the
package's `timeLayout` alias; the layouts are identical, so values interoperate
with the rest of the store.

### `marshalRefs` — the ref-list encoder, which never fails a write

Turns `[]contexts.Ref` into the JSON text stored in `includes_json` /
`excludes_json`. An empty list short-circuits to the literal `"[]"`, matching the
column default, and — notably — a marshal error also returns `"[]"` rather than
propagating:

```go
b, err := json.Marshal(refs)
if err != nil {
	return "[]"
}
```

So neither branch can make an insert or update fail on encoding. The tradeoff is
that a hypothetical unencodable ref would be dropped silently; in practice `Ref`
is a pair of strings, so the error path is unreachable.

### `unmarshalRefs` — the tolerant decoder

The mirror image, and equally forgiving: blank or whitespace-only text yields
`nil`, and malformed JSON also yields `nil` instead of an error. A context row
whose ref list was somehow corrupted still loads — as an empty side — rather
than making the whole context unreadable. Note the asymmetry with the encoder:
empty encodes to `"[]"` but decodes back to `nil`, not an empty slice, which is
fine because resolution treats both as "nothing on this side".

### `InsertContext` — create with both ref lists

Inserts identity, name, creator, both encoded ref lists, and the timestamps. The
refs are encoded inline through `marshalRefs`, so a caller passing nil includes
gets `"[]"` on disk.

### `ContextByID` — one context within a project

A single-row read always scoped by `project_id` as well as `id`, decoded by
`scanContext`.

### `ContextSummaries` — a project's contexts

Selects the same full column set as `ContextByID` — including both ref lists —
so "summary" describes the use, not a narrower row. No `ORDER BY`; ordering is
the caller's concern.

### `UpdateContext` — rename and redefine

Writes `name`, both ref lists, and `updated_at`. Project, id, creator, and
creation time are fixed. Editing a context replaces its includes and excludes
wholesale rather than diffing them, which keeps the write a single statement and
matches how the capability hands down a complete definition. A zero
`RowsAffected` becomes `contexts.ErrNotFound`.

### `DeleteContext` — scoped delete that reports a miss

Deletes the `(project_id, id)` row and returns `ErrNotFound` when nothing
matched. Nothing cascades: other contexts that reference this one by ref keep
their stale entry, and resolution simply skips a member that no longer exists.

### `scanContext` — the shared row decoder

Takes the package's `rowScanner` interface so the single-row and listing paths
decode identically, and decodes both JSON columns through `unmarshalRefs` before
parsing the timestamps. One small note: it compares `err == sql.ErrNoRows`
directly rather than using `errors.Is`, unlike the sibling scanners;
`database/sql` returns that sentinel unwrapped, so the behaviour is the same
today, but `errors.Is` would be the safer idiom.
