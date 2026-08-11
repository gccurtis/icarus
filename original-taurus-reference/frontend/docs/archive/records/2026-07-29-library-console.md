# 2026-07-29 — The library console: Context and Templates become real screens

`/library/context` and `/library/templates` rendered an "not implemented yet" placeholder
(`LibrarySpace.svelte`, deleted here). They now render a real console. The **data is still mocked
and badged**; the screens are not.

## The premise that changed: Omega already had the model

The roadmap said "no backend model exists for templates or context assets". It was wrong.
`core/capability/contexts` ships full CRUD plus `GET /contexts/:contextID/resolved`, with recursive
expansion, leaf-level subtraction, and a write-time acyclic guarantee. Document templates ship
`base.template.isTemplate` plus `ContextVariable`s, `GET /documents/templates`, and
`POST /documents {fromTemplateId}` — two of which `NewTabStage` already calls. **The only thing
missing is scope**: all of it is project-scoped. That reframed the work from "design a model" to
"build the screens and file a narrow scope request".

## The app's own spatial grammar, not a new screen

```svelte
<LibraryShell>            <!-- top bar, auth bounce, space nav, Mock badge -->
  <LibraryRail … />       <!-- the map: owner scope, search, the assets -->
  <main class="surface-work flex min-w-0 flex-1 flex-col overflow-hidden">
  <LibraryPanel …>        <!-- the detail panel -->
```

Context rail as the map, work surface for what the asset actually *is*, right-hand panel for its
identity — the grammar the workspace shell already uses, so the library reads as the same product
rather than a settings page. `<main>` clips and never scrolls; the sections inside scroll in their
own frames, which is `ResourceTable`'s discipline and fixes both the dead band under the content and
the last row sliced by a fixed pixel height.

## A context's substance is set algebra, shown with its result

Included and Excluded sit side by side as the parallel halves of one definition, with the resolved
leaf set below in the resource table's grammar — no header row, the tinted kind tile carrying the
type, capped at exactly five rows. Union and difference are unusable if you cannot see what they
produced, so the result sits with the definition rather than behind a button.

The **From** column shows only the first hop (`via[0]`), so every row maps to something visible in
Included above; a three-name chain turned a scannable table into a wall. Selecting a row reveals the
full path, double-click opens the resource.

## A template's substance is its preview and the context it needs

The preview dispatches on kind — document as paper with prompt blocks in the `intel` treatment,
spreadsheet as a real grid with formula cells. `slides` is a declared kind with **no mock on
purpose**: a slide template is a slide or a deck, and either way its preview must be the actual
rendered slide.

**Context slots are not prompt placeholders.** This was got wrong once and is worth stating: each is
a named requirement for background material that a library context fills, and a prompt block *draws
on* a slot rather than interpolating it — exactly Omega's `BlockContext`. So the section is headed
"Context", entries are plain names, and the preview shows `Reads <slot>` beneath a block. A
Prompt/Content toggle shows the same template with its slots empty and filled, which is a template's
value proposition in one control.

## Back means back to the project

```ts
const projectId = $workspace?.projectId;
goto(projectId ? `/projects/${projectId}` : '/projects');
```

Not `history.back()`. The spaces cross-link, so walking history mostly landed on *another library
space* — you bounce between two routes and never leave. `workspace` still holds the last project
entered this session, so this needed no new machinery.

## Honest about the data

A `MockBadge` sits in the shell's top bar, and unbuilt actions toast plainly. Omega has real
contexts and templates — project-scoped — so an unbadged screen would be claiming something that is
not there. Filed as `docs/backend-requests/asset-library-owner-scope.md`.
