# Document creator attribution (1a)

Adds `CreatorID` and `CreatorName` to the `Document` struct so the owner who
created a document is recorded and returned in API responses. Previously only
timestamps were stored — the creator identity was lost.

## What changed

- **`Document` struct** — added `CreatorID string` and `CreatorName string`
  with `json:"creatorId"` and `json:"creatorName"` tags.

- **`Summary` struct** — added the same two fields so lightweight catalogue
  queries also carry creator identity.

- **`Documents.Create()`** — sets creator fields from the `Actor` argument.
  The `actor` variable is now extracted before the `Document` literal so both
  fields can be set.

- **`Documents.Duplicate()`** — sets creator fields from the duplicating
  actor (the new copy's creator, not the source's).

- **SQLite** — added `creator_id` and `creator_name` columns to the `documents`
  table (default empty for existing rows). Updated `CreateDocument` INSERT,
  `DocumentByID`/`DocumentsByProject`/`TrashedDocumentsOlderThan` SELECTs,
  `DocumentSummaries` SELECT + scan, and `scanDocument` to include the two
  new columns in the correct scan order.

- **MemoryStore** — updated `DocumentSummaries` to populate creator fields
  from the stored `Document`.

- **Tests** — `TestCreateSetsCreator`: create, get, list, and summaries all
  verify the creator fields. Transport test (`TestDocumentEndpoints`) now
  checks that the create response includes a non-empty `creatorId`.

## Why

The InfoPanel in Taurus Alpha shows the document creator name. Currently it
hardcodes "Maya Chen" because `Document` carries no creator identity. Adding
these fields unblocks Alpha Goal 5 and removes one mock identity resolution
path.
