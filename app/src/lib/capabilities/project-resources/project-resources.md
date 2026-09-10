# project resources

A scoped, metadata-only index for the resources Project Overview can list:
documents, slide decks, spreadsheets, research threads, external files, and
findings. The retired connection resource is intentionally absent; connected
sources are represented as connectors.

`readProjectResourceIndex` resolves its project from the request route, filters
every represented table on the server, and returns one shared query key. Each
item is a closed projection of id, kind, display name, timestamp, and a
project-authorized actor display name (or `null` when that exact historical
subject is no longer inspectable)—not a raw represented row—so bodies,
evidence, storage ids, hashes, provenance, and fields added later cannot leak
through implicitly. Every row and nested actor/stage subject must match the one
current represented shape. Malformed scoped rows and rows carrying unknown or
retired fields are quarantined in an explicit `unavailable` list rather than
being decoded, repaired, or forwarded. Template
instantiation refreshes that key, so returning to Project Overview shows the new
resource without asking the broad Store capability to stand in as an invalidation
mechanism. Snapshots, cells, changes, and template bodies are not part of this
surface.

Canonical resource ids are counted across their entire source table before
projection. Every scoped claimant of a duplicate id is quarantined, including
when the other claimant belongs to another project, because Store mutation paths
would otherwise be ambiguous.

`createProjectResource` creates an editor-ready blank document or slide deck and
its revision-zero leader snapshot. Editor-ready is a represented invariant: a
document contains one empty paragraph and a deck contains one empty slide, so
the first edit never targets a client-only projection. It accepts only `target` and an optional
explicit `title`; project and actor come from request scope, and provenance
cannot be supplied. When `title` is omitted, the capability reads represented
titles in that project and allocates the first free `Untitled document N` or
`Untitled deck N` suffix immediately before creating the row. New Tab and
Project Overview therefore do not choose names from potentially stale cached
indexes. The result carries that chosen title with the opaque resource id and
revision. This replaces Project Overview's former client-shaped generic Store
mutation. Both launchers refresh the merged resource index and the exact
`documents`, `slideDecks`, or `spreadsheets` query before opening, because tab
and editor titles consume the latter.

`renameProjectResource` first exact-admits one unique project-owned editor
resource. Its whole-row replacement explicitly names every current field; it
never spreads a stored row, so an unknown or retired field can neither authorize
the command nor survive it accidentally.

Request scope currently proves project membership but does not include the
membership role. The development session is the represented owner; enforcing
owner/editor/viewer write differences remains a system-wide scope change rather
than a client-supplied field in this capability.
