# 2026-07-26 — Companion redo: restore multi-section format + backfill

Phase 1 of the recut plan. An earlier batch (B2b/G4/B6) had written companions as a single
whole-file fence — byte-exact but useless as documentation, since the whole point of a
companion is to explain the code **in pieces**. This restores the required multi-section format
across the affected files and backfills two systems that never had companions.

Done with **five parallel subagents** (per the user's steer that this is parallelizable), each
gated on the new `scripts/verify-companions.mjs`; then independently re-verified here.

## Restored to multi-section (22 files that were single-fence)

```
ai-agent:      types, store, copy, api, actions, QuarterbackDock.svelte, QuarterbackPanel.svelte
resources:     types, api, store, index, registry, ResourceSettingsDialog.svelte, ResourceTable.svelte
organizations: types, store, api, index, data/organizations, OrganizationsDialog.svelte, ShellTopBar.svelte
name-manager:  NameManagerPanel.svelte
```

Each is now `# <path> — breakdown` → `Companion to […]` intro → repeated
`## section` / `### one-liner` / verbatim fenced slice / describing paragraph, with the fenced
slices' union reproducing the source byte-for-byte (blank lines between declarations parked at
the end of the preceding fence, per the gold standards `scripts/verify-companions.mjs.md` and
`src/lib/systems/documents/api.ts.md`).

## Backfilled (systems that had NO companions — a pre-existing gap)

```
projects: types, api, store, index, activity   (5 new)
session:  types, api, store, index             (4 new)
```

These predate the companion practice; they're now companion-complete (test files exempt).

## Verification

- `scripts/verify-companions.mjs` prints **OK** for all 31 touched/created files (verified per
  agent and in a combined pass). `git status` confirmed the agents changed **only** `*.md` —
  no source was touched. `pnpm check` 0/0; `pnpm test` 271 (unaffected — docs only).

## Finding: 41 pre-existing drifted companions (out of scope here, flagged)

A repo-wide run of the verifier (140 companioned sources) found **41 that already drift** —
untouched by this work. Two causes: (a) **format drift** — a blank line between fenced
sections was dropped (e.g. `documents/io.ts`), content correct but not byte-exact; and (b)
**stale content** — the data-layer migration turned several `data/*.ts` into one-line
re-exports, but their companions still document the old pre-migration modules (e.g.
`data/resources.ts`). This is a separate, pre-existing hygiene problem; tracked for a decision
on whether to sweep it next.
