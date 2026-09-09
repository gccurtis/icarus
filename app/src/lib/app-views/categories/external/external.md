# External

External is the permanent project library for files that do not have dedicated
editors. Findings may later join the same manager, but no Findings surface is
implemented here.

The Content surface is `external.library`. It owns bounded file/folder upload,
mixed receipts, search/filter/sort, Table and Directory modes, breadcrumbs,
project-relative folder navigation, and file/folder selection. A directory is a
projection over file paths, not a durable row. Selecting an item keeps the
singleton External tab; it never creates a per-file editor tab.

Context is library-wide:

- `external.overview` reports inventory, projected folders, bytes, unavailable
  metadata and material coverage.
- `external.history` reads durable upload, re-upload, rename, move,
  dataset-context and delete events. It is not reconstructed from current rows.

There is no Policy context view.

`external.file` is a compact manager Inspector. Its top actions are Rename,
Re-upload, Download, Move and Delete. Name and path also support double-click
editing. Details include original upload name, classification, size, timestamps,
actors and origin—not the internal hash/storage id. References are counted and
listed. CSV/TSV can carry authored dataset context. Plain text and source code
share the canonical `code` family and one material-profile path; legacy `text`
rows canonicalize on read. Material state appears only for that unified family,
CSV/TSV and images; generated summary UI appears only when a descriptor exists.
Standalone images use their original visual embedding and show no generated
summary.

`external.directory` manages a projected folder with collision-checked,
revision-token-protected, atomic descendant path replacement. Native bytes do not
move.

All data and mutations cross the external-files capability. That capability owns
native identity/storage coordination and delegates only supported semantic work
to semantic-overlay.

Project Overview and New Tab search open a file by focusing it inside this same
singleton. New Tab keeps every file searchable but admits only the newest file to
its bounded Recent shelf, preventing one folder upload from displacing ordinary
editor work.
