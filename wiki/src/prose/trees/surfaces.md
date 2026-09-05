## What it is

The frame. Eight shipped surfaces make the screen: `app` composes the grid; `top-bar`, `tab-bar`, `status-bar` and `command-bar` are its chrome; `content`, `context` and `inspector` are the three planes a view is rendered into. A surface is a directory with a root component named for it ([[check:surface-shape]]), an optional `types.ts`, a document, and up to five concern directories — `components`, `effects`, `interactions`, `procedures`, `shared` — and nothing else ([[check:concern-is-one-of-five]]).

The three planes do not know what they render. [[file:app/src/lib/surfaces/content/content.svelte]] and [[file:app/src/lib/surfaces/context/context.svelte]] glob `app-views/categories/*/{content,context}/*.svelte` and resolve the active tab's key to a path: the registry is the filesystem.

## What it owns

- **Root components** — `app.svelte` (the grid; dispatches commands), `top-bar.svelte` (theme, project), `tab-bar.svelte` (tabs with category icons), `content.svelte`, `context.svelte` (the rail plus the panel), `inspector.svelte`, `status-bar.svelte`, `command-bar.svelte`.
- **Procedures** — [[file:app/src/lib/surfaces/context/procedures/rail-entries.ts]] (a label and an icon for every context view; `Record<ContextView, …>` so an unnamed key fails to compile), [[file:app/src/lib/surfaces/tab-bar/procedures/category-entries.ts]] (an icon per category), two `resource-name.ts`.
- **Effects** — [[file:app/src/lib/surfaces/top-bar/effects/apply-theme.svelte.ts]] (writes `data-theme` on `<html>` and one localStorage key), [[file:app/src/lib/surfaces/app/effects/dispatch-commands.svelte.ts]]. Everything under `effects/` is `.svelte.ts` and nothing under `procedures/` or `interactions/` declares a rune ([[check:effects-declare-runes]]).
- **Types** — `context/types.ts` and `inspector/types.ts` hold the panel widths: rail 44, minimum 224, maximum 480, collapsed 44.

`shared/` constructs nothing at module load and exports nothing already made ([[check:shared-hands-out-no-instance]]) — an instance there would outlive the mount and be handed to the next one.

## What it may and may not import

[[check:surface-imports]]: no server code, no route internals, and another surface only at its root or its types. A prop is a callback or an id, never the thing being displayed ([[check:view-takes-ids-and-callbacks]]), so two surfaces cannot disagree about content. Nothing shipped imports a development surface ([[check:nothing-imports-development]]). Where a concern document names a path, that path exists ([[check:documented-paths-resolve]]).

## Shape on disk

```
surfaces/
  <surface>/
    <surface>.md
    <surface>.svelte
    types.ts
    components/ effects/ interactions/ procedures/ shared/
    test/
```

## Invariants

Eight checks under `scripts/lint/surfaces/`, and they run over all three view trees (`surfaces`, `app-views`, `development-views`), so what is said here of a surface is also true of a category view and a demo.

## What to open first

1. [[file:app/src/lib/surfaces/app/app.svelte]] — the grid, and where every other surface is mounted.
2. [[file:app/src/lib/surfaces/context/context.svelte]] — the rail, the glob, the placeholder for a key the tree has no file for.
3. [[file:app/src/lib/surfaces/content/content.svelte]] — keyed on the tab, not the category, so two documents are two editors.
4. [[file:app/src/lib/surfaces/context/procedures/rail-entries.ts]] — the map from a view key to what a person sees.

[[file:app/src/lib/surfaces/content/content.md]] mentions `$lib/app-views/workspaces/`, which does not exist; the glob reads `categories/*/content`. Recorded under [[page:/gaps|Gaps]].

## Units
