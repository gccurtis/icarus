# `LibraryConsole.svelte` — the console behind Context and Templates

Rendered by `/library/context` and `/library/templates`; both routes are two lines passing
`space`. The two spaces share everything except the center of the screen, so the rail, the
header, and the detail panel are written once here. The frame itself — top bar, auth bounce,
Toaster, Back — lives one level up in [`LibraryShell`](LibraryShell.svelte.md), shared with the
Agents space, whose rail and center are a different shape and which therefore has its own
console (`AgentsConsole`).

## The app's own spatial grammar

```svelte
<LibraryRail … />        <!-- the map: owner scope, search, the assets -->
<main class="surface-work flex min-w-0 flex-1 flex-col overflow-hidden">
<LibraryDetails {asset} />  <!-- the detail panel -->
```

The console deliberately reuses the shell's layout vocabulary rather than inventing a screen:
context rail as the map, work surface for what the asset actually *is*, and a right-hand panel
for its identity. A library that looked like a settings page would read as a different product.
`w-context` / `w-inspector` come from the shell geometry tokens in
`docs/style/surfaces-components-motion.md`.

The right region is a **detail panel**, not an inspector — this is a route, and there is no
selection to inspect. It borrows `surface-inspector` for its material only. Since the AI bar
arrived it is wrapped in [`LibraryPanel`](LibraryPanel.svelte.md), which owns the Details/Agent
switch and takes `assetLabel` so the [Agent lens](AgentLens.svelte.md) can show the open asset as
always-in-scope context; `<main>` is `relative` so
[`LibraryQuarterback`](LibraryQuarterback.svelte.md) can anchor to its foot, and the space
components carry `pb-24` so the bar never covers their last row.

The console also words the panel's `copiesNote`, because the copy rule is not the same for both
spaces: **only a template is ever "brought into" a project** — see the header action below — and
saying otherwise on the Context screen would name a motion contexts do not have.

`<main>` clips and never scrolls: the sections inside it scroll within their own frames, the way
`ResourceTable` does. A scrolling page left a dead band under the content and sliced its last row.

## The header, and the two verbs

Title top-left with `Owner: …` beneath it; a `⋯` menu nudged into the corner (`-mr-3 -mt-1.5`,
because a kebab reads as chrome only when it sits *at* the edge) holding the only three things you
can do to an asset — Share, Duplicate, Delete. There is deliberately no rule under the header; a
divider there read as a second, cramped top bar.

**`Bring into project` appears only on Templates**, under the `⋯`, with no project picker: it goes
into the project you are working in. A context has no equivalent — you reach for a context from
inside the project that needs it — so a control here would name a motion that does not exist.

## The data is mocked, and says so

The shell's `MockBadge` covers this console too. Omega has real contexts and real document
templates, but both are **project-scoped**; the owner-scoped library this screen presents does not
exist yet, and neither does per-asset sharing. Until those land, everything comes from
[`library-mock.ts`](library-mock.ts.md) and the badge keeps the screen honest. Unbuilt actions
toast plainly rather than pretending to work.
