# Backend request — document descriptors and row windows

**Priority:** — · **Status:** ⛔ **WITHDRAWN by Alpha (2026-07-27)** — Alpha removed pagination and row windowing entirely (workstream B); the whole document is loaded and diffed. Do not build this. Kept for the reasoning only.
**Was to unblock:** bounded document startup, scroll-driven content loading, exact
front-end pagination without downloading every block/atom, and large-document DOM
windowing.

## What Alpha now implements

Alpha owns deterministic row-to-page composition in whole typographic points. It has
a pure paginator, stable row/page index, configurable eight-page request estimate,
normalized manifest/body repository, a viewport range controller, and additive clients
for the proposed routes below.

The production editor deliberately remains on Omega's resolved
`GET /documents/:documentID` response. That endpoint seeds the repository with every
row, so the new viewport seam finds nothing missing. Alpha will not pretend this is
network virtualization or evict editable ProseMirror content until Omega supplies
revision-coherent row windows and the windowed-editor behavior gate passes.

## Required capability

Omega should expose bounded metadata, compact row metrics, and row bodies separately.
Pages remain derived and must not become resources or fetch units.

```http
GET /documents/:documentID/descriptor
```

The descriptor should return identity/name/timestamps, exact revision, row count,
canonical `pageLayout`, captured `layoutRules`, optional exact aggregate counts, and
an opaque `rowSnapshot`. It must not resolve and serialize all row bodies merely to
omit them afterward.

```http
GET /documents/:documentID/row-manifest?snapshot=...&cursor=...&limit=...
```

The manifest response is cursor-bounded and ordered:

```json
{
  "documentId": "doc-1",
  "revision": 42,
  "rows": [
    { "id": "row-100", "ordinal": 100, "heightIncrease": 0 }
  ],
  "previousCursor": null,
  "nextCursor": "opaque-or-null"
}
```

Alpha streams the compact manifest to calculate the exact total page count. `ordinal`
is a read projection only; all edits and anchors continue to use stable IDs.

```http
GET /documents/:documentID/rows?snapshot=...&cursor=...&limit=...&direction=forward
GET /documents/:documentID/rows/locate?snapshot=...&rowId=...&before=...&after=...
```

Row-window responses contain complete canonical rows, revision, ordinal range, and
opaque previous/next cursors. `locate` provides bounded context for search, outline,
comments, history, and collaborator jumps.

## Consistency and safety

- Descriptor, manifest, and body responses must describe one coherent revision.
- Cursors are opaque, document-scoped, and bound to the snapshot.
- The preferred snapshot remains readable for a bounded lifetime while a newer head
  is accepted.
- If retained snapshots are not yet possible, requests must carry an expected
  revision and fail with Omega's structured revision conflict instead of silently
  mixing row orders.
- Authorization matches resolved document reads.
- Limits are server-bounded; malformed/expired cursors fail explicitly.
- Row identities and canonical height inputs must match the resolved document at the
  same revision.

## Front-end follow-up when it ships

Enable the row-window source behind the existing repository boundary, stream the
manifest, fetch the estimated initial eight-page body window, and have the viewport
range request forward/backward windows. Keep dirty/selected/composing rows pinned
and retain the full-document editor fallback until cross-window selection, IME,
clipboard, undo/redo, and collaboration parity pass.

The approved architecture and phased behavior gate live in
[the pagination design](../plans/2026-07-23-document-pagination-engine.md).
