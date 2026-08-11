# 2026-07-27 — Workstream D, part 2: the facades (L1, L2, L3)

Four one-line `data/` facades deleted, eleven importers rewired, and the import convention
written down in AGENTS.md. No behavior changes — every facade was a whole-barrel re-export, so
every import resolves to exactly what it did before, just under its real name.

## The disease (L1, L2)

`data/document-inspector.ts`, `data/document-layout.ts`, and `data/document-collaboration.ts`
were each `export * from '$systems/documents/index'` — three extra names for the same barrel.
None narrowed anything, so importing inspector constants "from collaboration" would have worked;
a facade that cannot catch a wrong-named import is worse than no facade. `document-layout` had
**zero importers**; `documents.ts` already was the system's facade.

`data/overview.ts` (≡ `data/projects.ts`, re-exporting `$systems/projects/index`) was the same
disease against a different system, so it went in the same sweep — leaving it would have made the
newly settled convention false the day it was written.

## The rewiring

- Inspector constants (3 files: `TypographyControls`, `LayoutPanel`, `ColorPopover`) →
  `$systems/documents/inspector`, matching what the three slides panels already did.
- Collaboration (5 files: `DocumentStage`, `SlideStage`, `DocumentCollaboratorAvatar`,
  `services/identity.ts`, `identity-directory/resolvers.ts`) →
  `$systems/documents/collaboration`.
- Overview (3 files: `OverviewStage`, `ActivityFeed`, `services/project-runtime.ts`) →
  `$data/projects`.

## The convention (L3)

Now in AGENTS.md → *Import convention for the `$data` / `$systems` aliases*:

- `$data/<system>` — **one facade per system**, the system's public surface.
- `$systems/<system>/<submodule>` — the precise import when you want one specific module.
  Reaching a submodule directly is correct, not a smell (so `HistoryPanel`'s
  `$systems/documents/api` and `AiTasksPanel`'s `$systems/documents/ai-tasks` — the imports L3
  flagged as "inconsistent" — are the convention, not violations of it).
- **No other facades**, ever — no second `$data` name for the same system.

L3 was a documentation problem wearing a refactor's clothes: both existing styles were fine;
what was missing was the rule that says so and the four files that broke it.

## Verification

- `pnpm check` — 0 errors, 0 warnings
- `pnpm test` — 338/338
- `pnpm build` — clean
- `node scripts/verify-companions.mjs` over the 12 touched sources — OK
- `pnpm test:e2e` — **13/13**
