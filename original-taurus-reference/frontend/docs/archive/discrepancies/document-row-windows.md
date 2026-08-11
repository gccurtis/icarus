# Discrepancy — document reads are not row-windowed

**Status:** Open · **Boundary:** `src/lib/data/document-rows.ts`

Alpha's document UI now paginates canonical rows locally and has a normalized
manifest/body repository plus clients for descriptors and revision-bound row
windows. Omega currently exposes only the fully resolved
`GET /documents/:documentID`, so the runtime still downloads every row and seeds the
repository in one operation.

This fallback is truthful and editing-safe: page composition is real, but network and
editable-DOM virtualization are not claimed. The viewport range controller calls the
row repository seam; because every body is currently present, no fetch is needed.

The mismatch closes when Omega ships the capability described in
[the backend request](../backend-requests/document-row-windows.md) and Alpha enables
that source after its windowed-editor parity gate.
