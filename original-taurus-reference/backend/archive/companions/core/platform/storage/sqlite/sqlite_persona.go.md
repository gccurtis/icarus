# sqlite_persona.go

The persona slice of the SQLite `Store`: personas, their immutable version
history, and the per-user default persona. Three tables back it — `personas`
holds the mutable head (name, description, `current_version`), `persona_versions`
holds one append-only row per version with the JSON-encoded definition, and
`persona_defaults` holds one (project, user) → persona pointer.

Everything here is project-scoped: every statement keys on `project_id` plus the
entity id, so two projects can use the same persona id without colliding. The
file is part of the one shared `*Store` and one connection; the split from
`sqlite.go` is organizational only, mirroring `core/capability/persona`.

## Code breakdown

### File header and imports

The package comment states the split rationale (shared `*Store`, one
connection). Imports are the usual storage set — `database/sql`, `encoding/json`
for definitions, `errors` for `sql.ErrNoRows` matching, `strings` for constraint
sniffing, `time` for timestamp parsing — plus the `persona` capability package,
which supplies both the domain types and the sentinel errors this layer returns.

### CreatePersona — head row and first version written together

Marshals `version.Definition` to JSON, then inserts the `personas` row and the
first `persona_versions` row inside one transaction, so a persona never exists
without the version its `current_version` names. The insert is guarded by
translating SQLite's duplicate-key error into a domain sentinel:

```go
if strings.Contains(err.Error(), "UNIQUE constraint failed") {
    return persona.ErrAlreadyExists
}
```

The string sniff is how the driver's untyped error is mapped back to a meaning
the caller can act on. `defer tx.Rollback()` after a successful `Commit` is a
no-op, so the deferred rollback is safe as an unconditional cleanup.

### UpdatePersonaVersion — optimistic concurrency on `current_version`

The core invariant of the file. The caller passes the version it believes is
current; the `UPDATE` carries that belief into its `WHERE` clause:

```go
`UPDATE personas SET ... WHERE project_id = ? AND id = ? AND current_version = ?`
```

No row is locked or read first — instead the write itself only applies if the
persona is still on the expected version. If a concurrent writer already
advanced it, zero rows change and this caller loses the race. On `changed == 0`
the method disambiguates the two possible causes with a `COUNT(*)`: no persona
at all means `persona.ErrNotFound`, a persona that exists means someone else got
there first, so `persona.ErrVersionConflict`. The caller is expected to re-read
and retry rather than blindly overwrite.

The new `persona_versions` insert is a second line of defence on the same
invariant — a duplicate (project, persona, version) key is likewise reported as
`ErrVersionConflict`. Head update and version append commit together, so the
history can never gain a version the head does not point at.

### DeletePersona — dependents first, then the head

One transaction removes the default pointers, then the version history, then the
persona row, so no orphan rows can survive a partial failure. `RowsAffected` on
the final delete distinguishes "removed" from "was never there"
(`persona.ErrNotFound`); the deletes of dependents are unconditional and may
legitimately affect zero rows.

### PersonaByID and scanPersona

`PersonaByID` is a single-row lookup that hands the `*sql.Row` straight to
`scanPersona`. `scanPersona` takes the package's `rowScanner` interface (from
`sqlite.go`) rather than a concrete type, so the same routine serves both the
single-row and the list paths. It maps `sql.ErrNoRows` to `persona.ErrNotFound`
and parses the two stored timestamp strings back into `time.Time`; parse errors
are deliberately ignored, leaving a zero time rather than failing a read on a
malformed timestamp.

### PersonaVersion and scanPersonaVersion

The same pairing for one historical version. `scanPersonaVersion` additionally
unmarshals the `definition` column into the typed `Definition` — and unlike the
timestamp parse, a bad definition *is* returned as an error, because the
definition is the payload the caller actually came for.

### PersonaVersions — full history, ascending

Queries every version for a persona `ORDER BY version` and scans each through
`scanPersonaVersion`. An empty result is reported as `persona.ErrNotFound`: a
persona always has at least one version, so no rows means the persona itself is
absent, and the caller gets the same sentinel it would from `PersonaByID`.

### PersonasByProject — the project listing

Lists a project's personas ordered by `name, id`, giving a stable, human-ordered
result even when two personas share a name. An empty project returns a nil slice
and no error — absence of personas is not an error here, in contrast to
`PersonaVersions`.

### DefaultPersona and SetDefaultPersona

`DefaultPersona` reads the (project, user) row directly rather than through a
scan helper, since nothing else scans `persona_defaults`; a missing pointer is
`persona.ErrNotFound`. `SetDefaultPersona` first verifies the target persona
exists in that project — the pointer must never dangle — then upserts with
`ON CONFLICT(project_id, user_id) DO UPDATE`, so each user has exactly one
default per project and re-pointing is a single statement rather than a
delete/insert pair.
