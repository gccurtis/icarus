# The Client Model

Objects that live in the browser and hold one user's state: what is open, which
tab is active, and everything a tab carries.

## A client instance

This is a single-page application. The `/app` layout persists, tabs are client
state rather than route state, and views do not remount on navigation. A client
instance is therefore **one browser tab holding the application** — one desktop
window later — and it owns one client model for its whole life.

| Object | Owns | Holds `$state` |
| --- | --- | --- |
| [`configuration`](configuration/configuration.md) | The settings the server published to this tab | no |
| [`storage`](storage/storage.md) | This project's browser store, and the format of what survives a reload | no |
| [`tab-list`](tab-list/tab-list.md) | What is open, in what order, and which one is active | yes |
| [`tab-views`](tab-views/tab-views.md) | One view per open tab: its centre, rail, lens and geometry | yes |
| [`workspace-state`](workspace-state/workspace-state.md) | The composition of those two, and every write to either | yes |
| [`commands`](commands/commands.md) | Every argument-free action, the chords bound to them, and whether the bar is showing | yes |
| [`document-runtimes`](document-runtimes/document-runtimes.md) | One runtime per open document: the unsent buffer, the submit protocol, the undo stack | yes |
| [`slide-deck-runtimes`](slide-deck-runtimes/slide-deck-runtimes.md) | The same, for one deck | yes |
| [`spreadsheet-runtimes`](spreadsheet-runtimes/spreadsheet-runtimes.md) | The same, for one sheet | yes |

In construction order, which is dependency order: configuration depends on
nothing, the three registers read their flush thresholds off it, `workspace-state` is
handed the two halves it coordinates, and commands closes over it.

**`tab-list` and `tab-views` are the two objects the graph does not return.**
They are built here and handed to `createWorkspaceState`, and `ClientModel` names
neither: a view that could reach one through the graph could move a tab without
going through the coordinator, and the coordinator being the only writer is what
makes an operation log over it complete.

**Storage is built and read by nothing.** Nothing persists while the stored shape
is unsettled, and storage holds exactly that one section. It stands intact and
unused rather than being torn out and rebuilt.

## Initialization, not a lazy singleton

The layout that owns the instance initializes it:

```ts
// start.ts
export const initClientModel = (input: ClientModelInput): ClientModel =>
  (instance = buildClientModel(input));
```

`ClientModelInput` carries the project token, which comes from the route —
`/app/[project]`. A self-building singleton cannot take a constructor argument.
It would have to reach for `page` itself, or accept a setter afterwards and be
observable half-built until someone remembered to call it.

`buildClientModel` sits above the initializer in the same file, and is pure
composition over its input. A test builds a whole graph in one call and asserts
across objects without touching module state.

**Composed, held, handed out — one file, in that order.** The builder and the
accessor were two modules and are now one, because both are execution and
together they are under two hundred lines.

`buildClientModel` is not exported. The initializer returns the graph it built,
so a test wanting two calls it twice and asserts on the returned values rather
than on the instance — and there is no second published way to stand a graph up,
which is the failure this shape exists to prevent.

`clientModel()` throws before initialization. An accessor returning `undefined`
hands the failure to whoever reached the model too early, and it surfaces later
and elsewhere.

## The guard, and what it is not for

`clientModel()` refuses twice, and the two refusals are different mistakes.
Reaching it from a server path is a category error — this graph belongs to a tab,
and no amount of waiting produces one — so it says *browser-only*. Reaching it in
the browser before the layout ran is a question of order, so it says *not built*.
Collapsing them would report both in whichever words fit one of them.

The guard is not what stops the model being built on the server; `ssr = false`
already does that. It is what makes **browser-only a fact about this module**
rather than a consequence of a flag on a route, so `start.ts` is safe to import
from anywhere without a consumer having to know which routes render where.

The guard belongs to `start.ts` and nowhere else. What holds everywhere beneath it
is narrower: **no module in this tree constructs an object at module load, and
none but this file reaches `$app/*`.** A module is imported on the server whether
or not SSR is on — SvelteKit loads a route's component modules to link their CSS
even when it renders only a shell — so a constructed module-level object is one
object shared by every request in the process. `$state`, counters, subscriptions,
and other live state belong to an instance a root built.

`lifetime` enforces all three.

## A project switch is a full page load

`/app/[project]` is parameterized, so navigating between two projects
client-side reuses the same layout component and its `<script>` never re-runs.
The model would go on serving the previous project's tabs, silently. Project
links carry `data-sveltekit-reload`, and that attribute is load-bearing: it is
the only thing standing between a project switch and a stale graph, because there
is no other moment at which the layout script runs again.

That is not a workaround for the initializer. A fresh client instance is what a
project switch is: another set of open tabs, another storage key, another scope.

## Why `/app` is client-rendered

SSR was never turned on for rendering. It went on because `adapter-static` could
not run server code at all, and everything that actually depended on that is
untouched:

| | Works with `ssr = false`? |
| --- | --- |
| `+page.server.ts` load | Yes — the client router fetches `__data.json` |
| Remote functions | Yes |
| `+server.ts` endpoints | Yes — unrelated to rendering |
| Server capabilities, the database registry | Yes — they run in the request, not the render |
| First paint containing content | **No.** This is the whole cost |

Revisiting it is a per-route flag, not an architecture change.

### Rules waiting on SSR

`ssr = false` makes two otherwise-standard client rules inert. They are scoped
rather than deleted, because the first route to enable SSR needs them that day.

| | Today | Under SSR |
| --- | --- | --- |
| Construction | Browser-only. The layout script does not run on the server. | Runs on the server too, so no constructor may touch the DOM. |
| `window`, `document`, `localStorage` | Read directly at construction — there is no server path that reaches them. | Only inside `browser`-guarded methods or effects, never during construction. |

Writing a guard for a path that cannot run buys nothing and obscures which
constraints are load-bearing.

## Why not Svelte context

Context buys per-render isolation, and there are no concurrent renders to
isolate: the frame renders once per client instance. What it costs is
`getContext` in every consumer, forever, to separate instances that never
coexist. It would also cost a cookie instead of `localStorage`, because a cookie
is the only store a server render can read — and `/app` does not server-render.

## Release

The composition root is a Svelte layout component, so release is `$effect`
cleanup in that layout: an object exposing a terminal operation is closed there,
in reverse dependency order, when the layout is destroyed.

`ClientModel.close()` is that hook, and the three registers are what brought it —
a runtime holds a subscription and an unsent buffer, and both have to go
somewhere deliberate when the tab does. It releases in reverse construction
order.

It is **synchronous**.

## What must never be written here

**A module-scope `new` or `create*()`.** The failure mode is a convenience
singleton added "just until the frame is wired": it would typecheck and behave
perfectly with one user.

**A second holder of the instance.** A second cache is a second graph, and the
whole isolation argument rests on there being one.

Two smaller ones, both of which look harmless:

- **A module-level counter.** The `nextId` behind a tab id is the tempting case:
  it is not user data, so it reads as safe — but one counter per process mints
  ids for every client instance at once. It belongs to the instance.
- **`$state(DEFAULTS)` instead of `$state({ ...DEFAULTS })`**, which wraps the
  module constant itself in the reactive proxy so a deep write reaches every
  later reader. `DEFAULTS` is frozen so that mistake throws instead of leaking.
