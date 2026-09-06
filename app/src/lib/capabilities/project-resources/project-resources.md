# project resources

A scoped, metadata-only index for the resources Project Overview can list:
documents, slide decks, spreadsheets, research threads, and findings. External
files and the retired connection resource are intentionally absent; connected
sources are represented as connectors.

`readProjectResourceIndex` resolves its project from the request route, filters
every represented table on the server, and returns one shared query key. Each
item is a closed projection of id, kind, display name, timestamp, and a
project-authorized actor display name—not a raw represented row—so bodies,
evidence, storage ids, hashes, provenance, and fields added later cannot leak
through implicitly. Malformed scoped legacy rows are quarantined in an explicit
`unavailable` list rather than crashing the index or being forwarded. Template
instantiation refreshes that key, so returning to Project Overview shows the new
resource without asking the broad Store capability to stand in as an invalidation
mechanism. Snapshots, cells, changes, and template bodies are not part of this
surface.

Canonical resource ids are counted across their entire source table before
projection. Every scoped claimant of a duplicate id is quarantined, including
when the other claimant belongs to another project, because Store mutation paths
would otherwise be ambiguous.

`createProjectResource` creates an editor-ready blank document or slide deck and
its revision-zero leader snapshot. It accepts only `target` and an optional
explicit `title`; project and actor come from request scope, and provenance
cannot be supplied. When `title` is omitted, the capability reads represented
titles in that project and allocates the first free `Untitled document N` or
`Untitled deck N` suffix immediately before creating the row. New Tab and
Project Overview therefore do not choose names from potentially stale cached
indexes. The result carries that chosen title with the opaque resource id and
revision. This replaces Project Overview's former client-shaped generic Store
mutation. Spreadsheet creation stays visibly unavailable until its editor consumes
represented ids.

Request scope currently proves project membership but does not include the
membership role. The development session is the represented owner; enforcing
owner/editor/viewer write differences remains a system-wide scope change rather
than a client-supplied field in this capability.
