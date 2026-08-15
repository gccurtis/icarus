# The Client Model

Objects that live in the browser and hold one user's state: what is open, which
tab is active, and everything a tab carries.

## A client instance

This is a single-page application. The shell layout persists, tabs are workbench
state rather than route state, and views do not remount on navigation. A client
instance is therefore **one browser tab holding the application** — one desktop
window later — and it owns one client model for its whole life.

| Object | Owns | Holds `$state` |
| --- | --- | --- |
| [`storage`](storage/storage.md) | This project's browser store, and the format of what survives a reload | no |
| [`workbench`](workbench/workbench.md) | What is open, which tab is active, and everything a tab holds | yes |

Two, down from five. `activities` and `inspector` were pure getters over the
workbench, and `preferences` held four numbers that became per tab. See
[workbench.md](workbench/workbench.md) for the fold and what each surface became.

## Initialization, not a lazy singleton

The layout that owns the instance initializes it:

```ts
// index.ts
export const initClientModel = (input: ClientModelInput): ClientModel =>
  (instance = buildClientModel(input));
```

`ClientModelInput` carries the project token, which comes from the route —
`/app/[project]`. A self-building singleton cannot take a constructor argument.
It would have to reach for `page` itself, or accept a setter afterwards and be
observable half-built until someone remembered to call it.

`buildClientModel` lives in [`constructor.ts`](constructor.ts) and is pure
composition over its input: browser storage keyed by the project, then the
workbench over that storage. A test builds a whole graph in one call and asserts
across objects without touching module state.

**It is not reachable through the door.** The initializer and tests are the whole
set allowed to hold a graph, so re-exporting the builder beside the accessor
would have published a second way to stand one up — and a second graph is the one
failure this file's whole shape exists to prevent. A test reaches it at
`$model/client/constructor`, which the door rules exempt test code from.

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
rather than a consequence of a flag on a route, so the door is safe to import
from anywhere without a consumer having to know which routes render where.

The guard belongs to the door and nowhere else. What holds everywhere beneath it
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
The model would go on serving the previous project's workbench, silently. Project
links carry `data-sveltekit-reload`, and that attribute is load-bearing: it is
the only thing standing between a project switch and a stale graph, because there
is no other moment at which the layout script runs again.

That is not a workaround for the initializer. A fresh client instance is what a
project switch is: another workbench, another storage key, another scope.

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
isolate: the shell renders once per client instance. What it costs is
`getContext` in every consumer, forever, to separate instances that never
coexist. It would also cost a cookie instead of `localStorage`, because a cookie
is the only store a server render can read — and `/app` does not server-render.

## Release

The composition root is a Svelte layout component, so release is `$effect`
cleanup in that layout: an object exposing a terminal operation is closed there,
in reverse dependency order, when the layout is destroyed.

No client object owns anything releasable today, so `ClientModel` has no
`close()`. The hook is named here so the first object to own a subscription or a
socket inherits one instead of inventing one.

## What must never be written here

**A module-scope `new` or `create*()`.** The failure mode is a convenience
singleton added "just until the shell is wired": it would typecheck and behave
perfectly with one user.

**A second holder of the instance.** A second cache is a second graph, and the
whole isolation argument rests on there being one.

Two smaller ones, both of which look harmless:

- **A module-level counter.** The workbench's `nextId` was one before this tree
  existed. It is not user data, so it reads as safe — but one counter per process
  mints ids for every client instance at once.
- **`$state(DEFAULTS)` instead of `$state({ ...DEFAULTS })`**, which wraps the
  module constant itself in the reactive proxy so a deep write reaches every
  later reader. `DEFAULTS` is frozen so that mistake throws instead of leaking.
