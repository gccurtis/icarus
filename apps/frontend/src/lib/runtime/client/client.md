# The Client Runtime

Objects that live in the browser and hold one user's state: what is open, which
tab is active, how wide the panels are.

## Why `/app` is client-rendered

These objects are **browser-only**, and construction throws anywhere else:

```ts
// index.ts — the composition root, and the only guard in this tree
export const clientRuntime = (): ClientRuntime => {
  if (!browser) throw new Error("The client runtime is browser-only …");
  return (instance ??= createClientRuntime(createBrowserStorage()));
};
```

That guard is the isolation, and it is the whole reason the shape is what it is.

A module is **imported on the server whether or not SSR is on** — SvelteKit loads
a route's component modules to link their CSS even when it renders only a shell.
So a module-level `new Workbench()` constructs once per process and is cached by
Node, and every request in that process shares it. One user's open tabs reach
another.

`ssr = false` alone does not fix that; it stops components rendering, not modules
loading. Only *not constructing on the server* does. `browser` is `true` in the
client bundle and `false` in the server bundle, so under the guard there is no
instance to share — not one that exists and happens not to be read.

The consequence is that a component reading one of these cannot server-render, so
`src/routes/app/+layout.ts` sets `ssr = false`. `/` and `/demo` still
server-render; `/health` is an endpoint and is unaffected.

## What that costs, and what it does not

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

## Why not Svelte context

Context would let these components server-render, which is the only thing it
buys. It costs an accessor at every call site, a root layout load, and a cookie
instead of `localStorage` — because a cookie is the only store a server render
can read. Since `/app` does not need to server-render, the guard is the simpler
mechanism for the same guarantee, and components import the object directly.

## One composition root

`index.ts` mirrors [`runtime/server`](../server/index.server.ts) deliberately —
same shape, learned once. Each object's directory exports a `create<Object>()`
and its types, and **nothing constructs itself**. The root assembles them in
dependency order and is the only place that knows the whole set.

```ts
export const createClientRuntime = (storage: ClientStorage): ClientRuntime => {
  const preferences = createPreferences(storage);
  const workbench = createWorkbench(storage);
  return { storage, preferences, workbench,
           activities: createActivities(workbench),
           inspector: createInspector(workbench) };
};
```

Storage is a parameter rather than something this reaches for, and that is the
point of having a root at all: a test stands the whole graph up over a fake store
in one call, then asserts across objects — that the inspector's write lands on
the workbench's active tab, that switching tabs changes what the inspector sees —
without wiring five things by hand in every test.

`createClientRuntime` is not guarded. It is pure composition and runs anywhere;
the guard belongs to the accessor, so there is **exactly one `browser` check in
this tree**, and lint enforces that no other file imports `$app/environment`.

| Object | Holds `$state` | Built over |
| --- | --- | --- |
| [`storage`](storage/storage.md) | no | — |
| [`preferences`](preferences/preferences.md) | yes | storage |
| [`workbench`](workbench/workbench.md) | yes | storage |
| [`activities`](activities/activities.md) | no | workbench |
| [`inspector`](inspector/inspector.md) | no | workbench |

The two projections hold nothing and read through the workbench, which is why
they are plain `.ts`. They take their dependency rather than importing it, so two
instances can exist independently.

## What must never be written here

**A module-scope `new` or `create*()`.** The failure mode is a convenience
singleton added "just until the shell is wired": it would typecheck and behave
perfectly with one user. Build it in the composition root instead.

**A second `browser` guard.** A second check is a second way in, and the whole
isolation argument rests on there being one. Only `index.ts` may import
`$app/environment`.

`pnpm lint:capabilities` enforces both.

Two smaller ones, both of which look harmless:

- **A module-level counter.** `nextId` was one before this move. It is not user
  data, so it reads as safe — but one counter per process mints ids for every
  user at once.
- **`$state(DEFAULTS)` instead of `$state({ ...DEFAULTS })`**, which wraps the
  module constant itself in the reactive proxy so a deep write reaches every
  later reader. `DEFAULTS` is frozen so that mistake throws instead of leaking.
