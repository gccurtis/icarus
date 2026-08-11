# `/library/context` — the context library route

Two lines. The route exists to name a URL and pick a space; everything it renders lives in
[`LibraryConsole`](../../../lib/features/library/LibraryConsole.svelte.md).

```svelte
<LibraryConsole space="context" />
```

## Why a route and not a workspace tab

The asset libraries are **user- and organization-scoped**, cutting across projects, so they have
to be reachable from project selection — where there is no workspace shell and no tab strip — as
well as from inside a project. A tab could not be. The console therefore owns a full-page frame
with its own top bar and auth bounce rather than mounting into the shell.

`/library/templates` is its sibling and renders the same component with `space="templates"`; the
two cross-link from the console's top bar.

## What is real here

The screen is real; **the data is mocked and badged**. Omega has contexts
(`core/capability/contexts`) but they are project-scoped, and owner-scoped libraries plus
per-asset sharing do not exist yet — see
[`library-mock.ts`](../../../lib/features/library/library-mock.ts.md) for exactly what is
invented. This route replaced the "not implemented yet" placeholder it used to render, so the
console can be built out slice by slice against a shape that is already settled.
