# sqlite_resource.go

`sqlite_resource.go` persists resource *catalog attributes*: the small,
kind-agnostic facts the resource catalog keeps about a document, file or other
resource without owning the resource itself. Today that is two things — whether
the resource is pinned, and its access scope. One table, `resource_attributes`,
keyed by `(project_id, kind, resource_id)`, backs `resource.AttributeStore`.

The access scope stored here is the load-bearing part. A scope narrows *who,
among a project's members*, may see a resource: project-wide by default, or
restricted to named organizations and users. Both the catalog listing (which
filters out resources the caller may not see) and the per-document access guard
read the scope from this table, so it is the second, finer gate behind
project membership — a member of the project is not automatically a viewer of
every resource in it.

That gives the table one important invariant: **it holds only real
restrictions**. A resource with default attributes has no row at all, and the
absence of a row is a meaningful answer (unpinned, project-wide), not a gap. The
write path and the scope codec both work to preserve that. As with the rest of
the package these are methods on the one shared `*Store`; the file split mirrors
`core/capability` and changes no behaviour.

## Code breakdown

### Package doc and imports

Names the file's scope (pinning and access scopes) and restates the shared-Store
split. Imports are the `resource` capability for `Attributes`, `Kind`,
`AttributeKey` and `AccessScope`, plus `database/sql`/`errors` for the no-rows
case and `encoding/json` for the scope column.

### ResourceAttributes: one resource's attributes, defaulting when unset

Reads the row for a `(project, kind, id)` triple. `sql.ErrNoRows` is not an error
here — it returns the zero `resource.Attributes`, which is exactly what "no
restrictions recorded" means. `pinned` is stored as an integer and converted with
`pinned != 0`; the access column goes through `decodeAccessScope`.

### SetResourceAttributes: replace attributes, deleting the row when nothing is set

The write path, and the enforcement point for the no-empty-rows invariant:

```go
if attrs.IsZero() {
    // DELETE FROM resource_attributes WHERE ...
}
```

A zero `Attributes` deletes rather than writing a row of defaults, so unpinning a
resource and reopening it to the whole project leave the table exactly as it was
before either was set. Otherwise it upserts via `ON CONFLICT(project_id, kind,
resource_id) DO UPDATE`, so setting attributes is idempotent and needs no prior
read. `boolToInt` (from `sqlite.go`) and `encodeAccessScope` handle the two
column conversions.

### ResourceAttributesByProject: every set attribute in a project, in one read

Returns a map keyed by `resource.AttributeKey{Kind, ID}`. This is the shape the
catalog needs: listing a project means deciding pinning and visibility for many
resources at once, and a per-resource query would be N round trips. Because the
table holds only restrictions, the map is small — a resource missing from it
carries the defaults, which is the same answer `ResourceAttributes` gives for a
missing row.

### encodeAccessScope and decodeAccessScope: the scope column codec

The scope is stored as JSON text in a single column rather than normalized into
rows, because it is read as a unit and never queried by its contents. The codec's
two rules both defend the invariant above. Encoding a `nil` scope yields `""`, so
an unrestricted resource stores no scope text; decoding `""` yields `nil`, the
default project-wide scope. A marshal or unmarshal failure also collapses to the
default rather than propagating an error — these functions have no error channel,
and the catalog's own normalization already guarantees a scope equivalent to
"everyone" is stored as `nil` in the first place. Worth naming plainly: that
recovery fails *open*, since the default is the widest scope, so unreadable
stored text widens visibility rather than blocking access.
