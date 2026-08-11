# 2026-07-27 — Workstream D, part 3: the file-transfer seam (L4)

`ResourcesPanel` — a *generic* shell panel — imported `exportDocumentMarkdown` /
`importMarkdownFile` from the documents system and filtered on `kind === 'document'`: exactly
the "shell becomes a coupling point for all features" failure the panel-system design named.
The document knowledge now lives in a per-kind transfer table; the panel names no kind.

## The seam: `features/shared/transfer.ts` (new)

Each kind can declare how it moves through a file:

- `import` — the file-input `accept`, the modal copy and labels, and a `run(file)` resolving to
  the created resource so the panel can open its tab.
- `export` — the modal copy and a `run(id, name)` that triggers the download itself.

The panel consumes two accessors: `importers` (kinds that can import, with specs) and
`exporterFor(kind)`. Adding transfer support for slides (say) is a table entry, not a shell
edit. Today's single entry is `document` (Markdown round-trip via `$systems/documents/io`;
pdf/docx stay long-term deferred).

**Why a static table and not a `surface.ts`-style contribution store:** import/export is
project-level — importing a Markdown file must work with no document tab open — so there is no
live stage to publish a contribution. The table sits beside `kinds.ts`, the other static
per-kind table.

## Panel changes

- The Import/Export button row renders only when some kind declares transfer support.
- The Import modal iterates `importers`; the Export modal lists resources whose kind has an
  exporter. Titles went kind-neutral ("Import" / "Export"); the kind-specific words live in
  each spec's copy.
- Behavior is otherwise unchanged: shared `busy` flag, `ApiError` toasts, input cleared so the
  same file can be re-picked.

## New e2e: `transfer-panel.spec.ts` (suite now 14)

These modals had **no coverage**; the rewrite could have shipped broken and nothing would have
caught it. The new spec signs in, opens the rail panel, and asserts: the Markdown import copy
and picker render; an empty project's Export modal shows the generic empty state; and after
seeding a real document through the API it appears in the Export list.

Two things the spec had to learn about the app (recorded in its comments): buttons named
Import/Export exist in three places (top bar / rail panel / Overview table), and re-clicking
the already-active rail section *collapses* the panel (8160593), so it selects the section
once. Also the two-kinds-of-409 lesson again: seeding `POST /documents` from a fresh API
context 409s until `POST /session/project` selects the project.

## Verification

- `pnpm check` — 0 errors, 0 warnings
- `pnpm test` — 338/338
- `pnpm build` — clean
- companions — `transfer.ts.md` new; `ResourcesPanel.svelte.md` rewritten as prose; verifier OK
- `pnpm test:e2e` — **14/14** (the new spec passing against live Omega)
