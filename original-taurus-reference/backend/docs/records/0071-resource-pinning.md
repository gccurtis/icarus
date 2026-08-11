# Resource pinning (Alpha gap G4a)

`ResourceSettingsDialog` offers "Pin to top of the table." Resources are a unified
catalog projected from family owners (documents, …), so a cross-kind attribute
that applies to any resource kind lives in a small catalog-attribute side table
the `resource` capability owns — not on any one family.

## Model: `core/capability/resource`

- **`Attributes{ Pinned bool }`** — catalog-level flags, independent of the
  family that owns a resource's content. The type is the seam for future
  per-resource catalog metadata (e.g. an access scope, gap G4b).
- **`AttributeStore`** port: `ResourceAttributes`, `SetResourceAttributes`,
  `ResourceAttributesByProject` (resource-specific method names because one
  `*sqlite.Store` implements every capability's store). `MemoryAttributeStore` for
  tests.
- `Summary` gains `Pinned`, merged in at read time: `List` reads the project's
  attributes once (`ResourceAttributesByProject`) and tags each summary; `Get`
  reads the single resource's. **Server-side ordering is unchanged** — the catalog
  uses keyset pagination, so pinned-first is a **client display concern** (the
  client renders pinned resources at the top); the backend only stores and exposes
  the flag.
- `NewWithAttributes(store, families…)` injects the store; `New(families…)` keeps
  the old signature with pinning disabled (a nil store), so existing callers are
  untouched. `SetPinned(projectID, kind, id, bool)` verifies the resource exists in
  its family first — a pin can never target another project's resource.

## Persistence

`resource_attributes(project_id, kind, resource_id, pinned, PRIMARY KEY(project_id,
kind, resource_id))`; all-zero attributes delete the row so the table holds only
set flags.

## Route

`PATCH /resources/:kind/:resourceID/attributes {pinned?}` (edit access, sync);
returns the updated summary. The service re-checks project scope.

## Tests

- **Unit** (`attributes_test.go`): pin surfaces in List/Get; project-scoped (p2
  never sees p1's pin); a nil attribute store disables pinning and rejects
  `SetPinned`.
- **Integration** (`dev-test/resources`): pin → `pinned:true` on Get + List →
  unpin → `pinned:false`; pinning a nonexistent resource is a 404. (Also updated
  the suite's stale hard-delete expectation to the current soft-delete/trash
  behavior — pre-existing, same as the documents suite.)
