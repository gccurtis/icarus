# The Runtime

Objects, as opposed to capabilities.

A **capability** references data kept in a database and is procedural: types,
tables, and functions, with nothing held between requests. A **runtime object**
owns a resource with a lifetime — a parsed snapshot, an open log stream, a set of
open databases — and has a `close()`.

That is the whole distinction, and it is why `configuration`, `observability`,
and `persistence` live here rather than under `capabilities/`. None of them
references data in a database. Persistence *is* the database.

```text
runtime/
├── client/     browser state: identity, $state, lives across interactions
└── server/     process resources: configuration, logging, databases
```

## Server

`index.server.ts` is the composition root. It builds the three objects in
dependency order — configuration first, because everything below reports its
failures through the logger that configuration configures — and hands back one
`ServerRuntime` with a `close()`.

It is built on first use rather than at import, and the promise is cached.
Building at import time would turn a configuration error into a module-load
failure with no logger to report it, and caching the promise means concurrent
first requests share one build rather than racing to open the same log file.

Module state is safe here **because none of it is per-user**. Everything is
process infrastructure; identity arrives per request as `Scope`.

### Doors

A module's door carries `.server.ts`. Internals do not.

`src/lib/runtime/server/` is **not** `$lib/server/`, so SvelteKit's path-based
guard does not cover it — only the `*.server.*` basename pattern does, and only
on the files that carry it. Marking the door is enough because nothing should
reach past one; a deliberate deep import of an internal still fails the build,
because Node built-ins cannot be bundled for a browser, just with a worse
message than the guard's import chain.

### Scope

`scope.server.ts` answers "who is asking, and about which project". It is the
authentication seam: today it reads the single project and user from
`configuration/project.yaml`, and when the auth capability lands it resolves an
opaque route token against the caller's membership rows — which makes the lookup
itself the authorization check, since a miss is a 404 rather than a fallback.

Every capability procedure takes a `Scope` as its first parameter. No input type
carries `projectId` or `userId`: the browser's payload has no slot for them, so
a client cannot name a project it does not belong to.

## Client

Empty. The four browser modules still under `lib/capabilities/` belong here —
they hold `$state` and cross no boundary, which makes them objects rather than
capabilities. `pnpm lint:capabilities` reports them until they move.

## Structure

Enforcement of this tree's shape is deliberately deferred. A runtime object will
have types, a definition, methods, and supporting procedures, and the shape those
settle into is not yet known — so the lint covers `capabilities/**` thoroughly
and leaves this to convention rather than guessing at rules it would then have to
unpick.
