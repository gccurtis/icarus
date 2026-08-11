# AppShell.svelte

The workspace shell orchestrator: top bar, tab strip, two section-driven side panels around a
work surface, the floating AI Agent composer, and the status bar — bound to the per-project
workspace store.

> **Rewritten 2026-07-27 (workstream D, catalog A4).** This companion was a ~200-line
> byte-mirror; it is now prose, and the file it documents is now **pure composition** — the
> section policy it used to carry moved to [`shell-sections.ts`](shell-sections.ts.md).

## What it does

- `$effect(() => enterProject(projectId))` — strict per-project isolation: entering a project
  (re)loads that project's shell state; nothing renders until `$workspace` resolves.
- Derives each rail's sections through `contextSectionsFor($activeSurface)` /
  `inspectorSectionsFor($activeSurface)` — the fallback sets, the surface-merge rule, and what
  is permanent live in `shell-sections.ts`, not here.
- A repair effect asks `repairSection(sections, persistedId)` per rail and normalizes with
  `setPanel` when the persisted section no longer resolves — the *decision* is the module's,
  the *store write* is the shell's (the same model-computes/orchestrator-commits shape as the
  document runtime).
- Renders the frame: `ShellTopBar`, `TabStrip`, left `SidePanel` (context), the center region —
  `WorkSurface` for the active tab with `QuarterbackDock` anchored to it, so the AI bar centers
  with the work and never overlaps a panel — right `SidePanel` (inspector), `StatusBar`.

## Panel wiring

Both `SidePanel`s are driven entirely by the workspace store: `width`/`collapsed`/`section`
come from `$workspace.context` / `$workspace.inspector`, and the callbacks write back through
`setPanel` (`onselect` also un-collapses). The content snippet resolves the active section's
component and renders it with no props — a contributed section's component reads its own
surface's session store (see `features/shared/surface.ts`, frozen).

The left snippet also renders a section's `placeholder` copy when it has no component — honest
holding text for a view whose contents are not defined yet.
