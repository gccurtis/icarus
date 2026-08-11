# References + backlinks un-mocked (B5)

Replace the mock References panel with Omega's real reference graph. Verified endpoint shapes
against a fresh Omega build on `:8444`.

## Omega (reverses the old "blocked" status)

`GET /documents/:id/references` (outgoing) + `GET /documents/:id/backlinks` (incoming), gated on
`opts.References`. Edges are derived from the inline links each document carries. Each `Edge` is
`{ fromResource: Ref, toResource: Ref, kind, anchor? }`; `Ref` is `{ kind, id, name? }`.

## Changes

- New `systems/documents/references.ts`: `loadReferences` / `loadBacklinks` + `ReferenceEdge` /
  `ReferenceRef` types.
- `ReferencesPanel.svelte`: loads both lists in parallel on document change — outgoing = each edge's
  `toResource`, incoming = each edge's `fromResource` — with loading/error/empty states; each row
  opens the referenced resource as a tab. Removed the mock + MockBadge + the mocked "navigation is
  mocked" toast.
- `context.ts`: removed `DocumentReference` + `mockDocumentReferences` — the last mock here, so the
  file is now an export-free breadcrumb (`export {}`). Updated its doc comment.

## Verification

- `:8444` (`opts.References` enabled): `GET /documents/:id/references` → `200 {references:[]}`;
  `GET …/backlinks` → `200 {backlinks:[]}` (empty — the test doc has no inter-document links; the
  wrapper + shape match Omega's `Edge` model). Populated edges derive from real inline links.
- `svelte-check` clean; vitest 227/227; touched companions reproduce.

## Follow-up

Exercise populated edges (a document linking to another) against live `:8443`. The inspector's
"named reference" control (in the Details panel's Reference section) still uses the Names API and is
tracked separately.
