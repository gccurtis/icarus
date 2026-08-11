# 2026-07-27 — Workstream D, part 1: the deletions (D4, D5, D6)

The mechanical opening of the last reorg workstream: three catalogued pieces of dead code
deleted, plus the dead helpers that only they used. No behavior changes — every deleted line was
unreachable, and the gates prove it (check 0/0, 338 unit tests, build, e2e 13/13).

## D4 — `data/document-context.ts` + `systems/documents/context.ts`

Both deleted. The `data` facade had **zero importers**; the `systems` module had become a
comment-only breadcrumb trail (`export {}`) recording where its former mocks moved during the
integration push. Git history keeps the breadcrumbs; the barrel (`systems/documents/index.ts`)
dropped its `./context` re-export.

## D5 — `QuarterbackDock`'s `currentDoc`

`const currentDoc = $derived(activeRuntime())` was never read — `send` pins new chats via
`activeResourceId`/`activeResourceKind` from the workspace store, not the registry. The derive
and the now-unused `$systems/resources/registry` import are gone.

## D6 — `inspectAnchor` + `RowLens` + `BlocksLens` (per UX1)

`3866771` (2026-07-23) removed the left-gutter row/block handles and said it was removing
`inspectAnchor` too — but only the `DocumentStage` half went. With **UX1 decided** (row/block
inspection stays unreachable *by design*: this is a text editor, not a block editor), the rest
followed:

- `runtime.inspectAnchor` deleted (no caller since the gutter went); `NodeSelection` and
  `blockAt` imports trimmed with it.
- `panels/details/lenses/RowLens.svelte` and `BlocksLens.svelte` deleted.
- Dead helpers deleted with their only consumers: `blockKindShortName` and the
  `RowSelection`/`BlocksSelection` slices in `lens-helpers.ts`; the whole geometry block in
  `systems/documents/inspector.ts` (`blockHeightFloor`, `minimumRowHeight`, `normalizedWidths`,
  `updateNormalizedWidth` — the Row lens's mocked child-width editor was their one user).
- `NoneLens` no longer tells users to "use the left-margin handle" — copy now names only what
  exists (select text or place the caret).

### What deliberately stays

- **`SelectionInfo` keeps its `row`/`blocks` modes** — `editor/session.ts` is a frozen contract.
  The `DetailsPanel` dispatcher gets a defensive `{:else}` → `NoneLens` for modes that can no
  longer occur, instead of branches to deleted lenses.
- **`actions.inspectBlock` stays** — it lost its only caller (RowLens's child list) but
  `EditorActions` is frozen; the action still works.
- **`deriveSelection`'s override handling stays** — the selection model keeps translating
  `blocks`/`row` overrides faithfully; they simply have no producer anymore
  (`inspectBlock` only ever pins `block`).

## Docs

Catalog rows D4/D5/D6 struck through with what happened; orientation's workstream-D bullet now
lists them done and names the remainder (A3, A4, L1–L4, L5/L6 optional, PC1). Companions updated
in the same change for all nine touched sources; `inspector.ts.md` was rewritten as prose while
at it (its old byte-mirror form mostly documented the deleted geometry).

## Verification

- `pnpm check` — 0 errors, 0 warnings
- `pnpm test` — 338/338
- `pnpm build` — clean
- `node scripts/verify-companions.mjs` over all nine touched sources — OK
- `pnpm test:e2e` — **13/13**
