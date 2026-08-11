# Windowed row reads (BR-DOC-ROW-WINDOWS)

`GET /documents/:id` returns the whole document. Large documents need bounded
loading: a tiny descriptor and a row manifest to lay out the scrollbar instantly,
then windowed row fetches and a locate call. Alpha already ships the client
(`systems/documents/rows.ts`); it was dead code because the routes did not exist.

## Projection: `core/capability/document/windows.go`

Read projections over existing document state — **no new storage**. Each resolves
the document (`d.Get`) and is stamped with the same head revision `GET` reports,
so the client detects a mid-scroll edit and re-syncs.

- **`Descriptor(projectID, id)`** → `{id, name, revision, pageLayout,
  layoutRules, styleRegistry, rowCount}` — no row bodies.
- **`RowManifest(projectID, id)`** → `{revision, rows:[{id, height, offset}]}`.
  Heights and cumulative offsets come from the same `rowHeight` metrics
  `Paginate` (record 0041) uses, so the client needs no layout logic.
- **`RowWindow(projectID, id, from, count)`** → `{revision, from, count, rows}`.
  `from` is a row id or a zero-based index (empty = start); `count` is clamped to
  `[1, 200]` (default 50) so one call can never pull an unbounded slice.
- **`Locate(projectID, id, atomID, index, byIndex)`** → `{rowId, index, offset}`
  — jump target for an atom id or a row index.

## Routes (sync, project-scoped)

- `GET /documents/:documentID/descriptor`
- `GET /documents/:documentID/row-manifest`
- `GET /documents/:documentID/rows?from=<rowId|index>&count=<n>`
- `GET /documents/:documentID/rows/locate?anchor=<atomId>|?index=<n>`

All four are `dispatchSync` (added to `operationSync`) and read-available to any
project member.

## Tests

- **Unit** (`windows_test.go`): descriptor rowCount matches a full read; manifest
  offsets are cumulative and heights positive; a window returns exactly the
  requested rows by index and by id (clamped at the end); locate maps an atom and
  an index (out-of-range → not found); revision advances after an edit and the
  window carries it.
- **Integration** (`dev-test/windows/run.sh`, no model, always runs): descriptor
  has no `rows`; manifest first offset 0; window by index and clamped-by-id;
  locate by anchor and index; revision advances after a change.
