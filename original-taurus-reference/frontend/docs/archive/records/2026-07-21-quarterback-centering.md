# Change record — 2026-07-21 — Quarterback bar centers with the work surface

One structural fix in [AppShell.svelte](../../../src/lib/features/shell/AppShell.svelte)
(+ companion). No dock/component changes.

## The problem

`QuarterbackDock` was absolutely positioned inside the whole **body row** (panels
included), so it centered on the viewport-ish row: adjusting the side panels didn't
move it (it drifted off the document's center), and with its fixed `max-w-3xl` it could
sit on top of a panel when the center got narrow.

## The fix — anchor it to the region between the panels

```svelte
<!-- The center region between the panels: the Quarterback dock anchors to IT, ... -->
<div class="relative flex min-h-0 min-w-0 flex-1">
  <WorkSurface tab={activeTab} {projectId} {projectName} />
  <QuarterbackDock />
</div>
```

The work surface and the dock now share a `relative` center region; the outer body row
loses its `relative`. Because the dock's positioning (`absolute bottom-4 left-1/2
-translate-x-1/2 w-full max-w-3xl px-4`) now resolves against that region:

- it **centers with the document** (same `max-w-3xl` measure as the page);
- it **tracks panel drags/collapses live** (flex reflow moves it);
- it **shrinks with the region** (`w-full` + padding) so it can never hover over a
  panel;
- the behavior is **shell-level** — identical on Overview, documents, and every stage.

The floating treatment was kept over the alternative (docking it full-width above the
status bar): floating reads as an assistant you summon, docked reads as a permanent
form. Revisit if the floating version proves distracting.

## Verification

`pnpm check` → 0 errors / 0 warnings; `pnpm build` → clean.
