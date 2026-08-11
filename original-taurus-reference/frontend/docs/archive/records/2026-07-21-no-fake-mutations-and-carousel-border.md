# Change record — 2026-07-21 — No faked backend mutations; carousel border; panel polish

Applies the principle **the front end shows data and flags gaps; pivotal data changes
belong to the backend** to two places where we were faking mutations, plus a few Overview
/ New-tab polish items.

## Removed the client-only project rename mock (everywhere)

`renameProjectMock` is deleted from `src/lib/data/projects.ts` and all call sites:

- **Overview** — the double-click inline rename added earlier is gone; the project name
  is plain centered text again.
- **Project settings** — the Name field is now **read-only** (shows `project.name`); the
  Save button, `saveName`, and the local `name` state are removed. The footnote now says
  renaming is pending backend support.

Rename stays a **backend request**
([project-updates.md → Rename](../backend-requests/project-updates.md)); we no longer
pretend it works client-side. (Resource rename is unaffected — that's part of the
wholesale resource mock, not a real backend entity's attribute.)

## Purpose statement no longer persisted

`loadPurpose` / `savePurpose` (localStorage) are removed from
[`overview.ts`](../../../src/lib/data/overview.ts). The purpose box is now **edit-only**:
[`PurposeStatement.svelte`](../../../src/lib/features/stages/PurposeStatement.svelte) keeps
it in local state (reset per project) and shows a muted "Not saved yet — pending backend"
note once you type. Real persistence is the backend request
([project-purpose.md](../backend-requests/project-purpose.md)). Rationale: persisting a
real project attribute to localStorage fakes a save — exactly what we don't want.

## Overview / New-tab polish

- **Resources heading** → the same **eyebrow** style (`text-label uppercase … text-muted`)
  as Create and Activity, instead of a bold `h2`, so the three sections match.
- **Templates carousel** ([TemplatesCarousel.svelte](../../../src/lib/features/stages/TemplatesCarousel.svelte)):
  now a **bordered frame** with the fade **inside** the border — the outer frame draws a
  crisp border and holds `overflow-hidden`; the inner scroll strip carries the mask
  gradient, so cards fade as they approach the border while the border itself stays solid
  (no more "whole section fades in/out").
- **New-resource panel** ([NewResourcePanel.svelte](../../../src/lib/features/stages/NewResourcePanel.svelte)):
  border removed — it's now a background-free, border-free row.

## Docs

Updated [discrepancies/overview.md](../../discrepancies/overview.md),
[discrepancies/projects.md](../../discrepancies/projects.md),
[backend-requests/project-purpose.md](../backend-requests/project-purpose.md), and
[backend-requests/project-updates.md](../backend-requests/project-updates.md) to reflect
that rename and purpose are backend-only (no client mock/persistence). All touched
companions updated verbatim.

## Verification

`pnpm check` → 0 errors / 0 warnings; `pnpm build` → clean.
