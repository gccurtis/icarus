# Routing

The frontend is a **server-rendered SvelteKit application**. SvelteKit owns
routing, mounting, and the build; nothing here is hand-rolled.

## Why a framework

The frontend previously used a hand-written hash router. It was five lines and
it worked, but route knowledge was triplicated — a URL parser, a nav array, and
a render branch, three places that could disagree with nothing making them
agree. Growing it would have meant re-solving, in order: params, nested routes,
layouts that survive navigation, and a not-found path.

Those four are SvelteKit's primary subject matter, and the core of this product
is a sophisticated client-side runtime. The routing layer is not the part worth
maintaining ourselves.

## Server-rendered

`svelte.config.js` uses `adapter-node`, and there is no `+layout.ts` setting
`ssr = false` — both SvelteKit defaults apply, so every route renders on the
server and hydrates on the client.

This is a change from the original SPA design, and the reason is that the
backend was merged into this application: capabilities run in this process, so
there is a server to render on. See
[the integration design](../../../docs/superpowers/specs/2026-08-13-capability-integration-design.md).

Server rendering has one standing obligation: a module that runs during render
must not touch `window`, `document`, or `localStorage` at module or
component-init scope. Guard those with `browser` from `$app/environment`, or
read them in an effect after mount.

## Layout

```text
src/
  app.html              document shell; carries data-theme
  app.d.ts              SvelteKit's App namespace
  routes/
    +layout.svelte      root layout — imports the stylesheet, renders children
    +page.svelte        /
    demo/+page.svelte   /demo
  lib/
    style/              the design system — see docs/style/
    simple-components/  shadcn-svelte primitives, kept verbatim
```

`app.html` sets `data-theme` as a literal attribute rather than via script,
because it must be present in the first paint or the page flashes the default
theme before the app mounts. The semantic set needs no attribute — the default
binds to bare `:root`.

## Imports

`$lib` resolves to `src/lib`. It is the only alias, and it is built in.

This replaced a `#`-prefixed pair declared in both `vite.config.ts` and
`tsconfig.json`, where nothing checked that the two agreed. SvelteKit generates
TypeScript paths from `svelte.config.js`, so the compiler and the bundler can no
longer drift. Any alias added to `kit.alias` inherits that property.

Relative imports remain banned, consistent with the backend.

## Adding a route

Create `src/routes/<path>/+page.svelte`. Nothing else — no table, no
registration, no nav entry to keep in step. A directory named `[id]` captures a
param, read via `page.params.id` from `$app/state`. A `+layout.svelte` at any
depth wraps every route beneath it and **persists across navigation** between
them, so panel and scroll state survive.

An unmatched path renders SvelteKit's not-found rather than silently falling
through to a real page, which is what the old `{:else}` branch did.

## Current routes

| Path | File | State |
| --- | --- | --- |
| `/` | `routes/+page.svelte` | Empty. The shell is not designed yet |
| `/demo` | `routes/demo/+page.svelte` | Minimal — proves the route resolves and the stylesheet applies |

The previous `/demo` rendered every token in the system — palette, the 77-token
role grid, type scale, state matrix, geometry, motion — and was the only thing
that exercised `@theme static` in `lib/style/system/color/roles.css`. Rebuilding
it, and whether to split it into sections rather than one 458-line file, is open
work.

That tree-shaking behaviour is live and worth knowing: tokens declared in plain
`@theme` are dropped from the build when no utility references them. The shell
geometry and panel-width tokens in `lib/style/system/spacing.css` are currently
absent from the emitted CSS for exactly this reason. They return when something
consumes them.

## Not here yet

No nav, no route guards, no params in use, no layouts beyond the root one, and
no shell zones. The theme and semantic-set switcher that lived in the old
`App.svelte` went with it, so only the hardcoded attribute in `app.html` selects
an axis; reinstating runtime switching belongs with the shell work.

Each has a clear insertion point in SvelteKit's own conventions, and none get
harder by waiting.

## Verification

```sh
pnpm typecheck   # svelte-kit sync && svelte-check
pnpm build       # typecheck, then vite build → build/
pnpm dev
```
