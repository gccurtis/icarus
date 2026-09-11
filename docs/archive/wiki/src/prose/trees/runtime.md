## What it is

The two places an object graph is built, and the only two places that hold one. Eleven files. Everything definitional lives elsewhere; this tree only composes it, in dependency order, once ([[check:objects-are-built-in-order]]), and hands it out through an accessor that refuses rather than returning nothing ([[check:accessor-refuses-twice]]).

## What it owns

- **Client:** [[file:app/src/lib/runtime/client/start.ts]] builds `buildClientModel` (not exported — [[check:builder-is-not-exported]]), `initClientModel` (called once, by the `/app/[project]` layout — [[check:one-caller-of-the-initializer]]) and `clientModel()`; [[file:app/src/lib/runtime/client/types.ts]] declares `ClientModel`, and what it names is exactly what the builder returns ([[check:graph-matches-its-aggregate]]).
- **Server:** [[file:app/src/lib/runtime/server/start.server.ts]] builds configuration, observability and the store, holds the instance and a `closed` latch, and exports `initServerModel`, `serverModel` and `closeServerModel`; [[file:app/src/lib/runtime/server/scope.server.ts]] turns a request into a `Scope` — the session from the cookie, the project from the pathname — and is what every capability procedure calls first.

One place holds the instance ([[check:one-holder-of-the-instance]]): a mutable module-scope binding appears in `start*` and nowhere else in the repository.

## What it may and may not import

Only `start*` imports `$app/*` ([[check:framework-only-at-the-root]]); an object taking its identity from ambient routing is one that cannot be built twice. The roots import model constructors — they are the only importers of a `constructor.ts` outside an object's own files.

## Shape on disk

```
runtime/
  runtime.md
  client/
    client.md
    start.ts          buildClientModel, initClientModel, clientModel
    types.ts          ClientModel, ClientModelInput
  server/
    server.md
    start.server.ts   buildServerModel, initServerModel, serverModel, closeServerModel
    scope.server.ts   Session, Scope, resolveSession, resolveScope, requireScope
    types.ts          ServerModel
    test/construction.test.ts, lifetime.test.ts, scope.test.ts
```

Only the named files exist ([[check:runtime-layout]]). Something new here is a decision, not an addition.

## Invariants

Eight checks under `scripts/lint/runtime/`. `objects-are-built-in-order` reads the builder's `const x = createX(...)` lines and refuses an object constructed before something it is passed, a constructor called twice, or a cycle. The extractor reads the same lines, so the construction order below is the real one.

## What to open first

1. [[file:app/src/lib/runtime/runtime.md]], then [[file:app/src/lib/runtime/client/client.md]] and [[file:app/src/lib/runtime/server/server.md]].
2. [[file:app/src/lib/runtime/client/start.ts]] — read the builder top to bottom; it is the dependency graph.
3. [[file:app/src/lib/runtime/server/scope.server.ts]] — why a scope is the authorization, and why a 404 rather than a 403.
4. [[file:app/src/hooks.server.ts]] — `init` builds, `handle` attaches the model and the session, `sveltekit:shutdown` closes.

## Units
