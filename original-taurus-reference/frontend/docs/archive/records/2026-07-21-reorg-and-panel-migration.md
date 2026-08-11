# Change record — 2026-07-21 — Increment 1: reorg + panel-system migration

Executes [plans/2026-07-21-next-steps.md](../plans/2026-07-21-next-steps.md) § 1: the
approved [panel-system design](../plans/2026-07-21-panel-system-design.md) landed
together with the directory reorganization. Behavior is identical; ownership is now
legible from the tree.

## The moves (all `git mv` — history follows)

```text
lib/editor/{schema,bridge,session}.ts  →  features/stages/document/editor/
stages/DocumentStage.svelte            →  features/stages/document/
stages/{OverviewStage,PurposeStatement,CreateColumn,
        ActivityFeed,ActivityActor}    →  features/stages/overview/
stages/{NewTabStage,NewResourcePanel,TemplatesCarousel,
        AiCreateDialog}                →  features/stages/new-tab/
stages/{ResourceTable,ImportDialog,ExportDialog,
        ResourceSettingsDialog}        →  features/stages/shared/
stages/kinds.ts                        →  features/shared/kinds.ts
```

Every companion moved with its file (titles + relative links updated). `data/` stays
deliberately flat — one file per Omega capability is its organization.

## The panel migration (the approved contract, now real)

- **New `features/shared/surface.ts`** (+ companion): `PanelSection` /
  `SurfaceContribution` / the `activeSurface` store. Placed in `features/shared/` —
  not `shell/` as first sketched — so stages don't import the shell (refinement noted
  in the design doc).
- **Universal sections became shell-owned components** (`features/shell/panels/`):
  ProjectPropertiesPanel (project info via the workspace + projects stores — no
  props), ResourcesPanel, HistoryPanel, PersonasPanel, QuarterbackPanel (scope now
  read from `$activeSurface.scope`, so the shell no longer touches the editor
  session).
- **Document sections became document-owned** (`features/stages/document/panels/`):
  OutlinePanel, DocPropertiesPanel, DetailsPanel (the selection/prompt lens moved
  verbatim from the old inspector switch). `DocumentStage` publishes its contribution
  after load — context: Outline + Document; inspector: Details (leading); scope
  "Document — {name}" — and clears it on destroy.
- **AppShell merges** `universal + $activeSurface` per rail (contributed context
  follows universal; contributed inspector leads) and renders each section's component
  blind. The old `ContextPanelContent`/`InspectorPanelContent` switch components are
  **deleted**. Section normalization now also covers persisted ids whose contribution
  isn't mounted.
- Small UX consequence (per the approved design): document metadata lives in its own
  contributed **Document** section instead of overloading universal Properties, and
  with no document open the inspector rail is just Quarterback.

## The rules, audited

`grep`-audited after the move: **no cross-stage imports; `data/` imports nothing
upward; the shell's only stage imports are in `WorkSurface`** — codified as the one
sanctioned exception (it is the stage router; mounting stages is its job). Orientation
directory map + architecture entry updated to the new paths; the design doc is marked
**implemented** with the two execution refinements.

## Verification

`pnpm check` → 0 errors / 0 warnings; `pnpm build` → clean — both on the first run
after the moves and again after the docs/companion sync. (Behavior unchanged; no new
backend interaction, so no live pass this increment.) Checkpoint commit before the
reorg: `8974f0b`.
