# The Model

Objects, as opposed to capabilities.

A **capability** references data kept in a database and is procedural: types,
tables, and functions, with nothing held between calls. A **model object** owns
something with a lifetime — a parsed snapshot, an open log stream, a set of open
databases, what a person has open in front of them.

That is the whole distinction, and it is why `configuration`, `observability`,
and `persistence` live here rather than under `capabilities/`. None of them
references data in a database. Persistence *is* the database.

```text
model/
├── client/     one person's application state, for as long as their tab lives
└── server/     process resources: configuration, logging, databases
```

The written standard is
[`docs/model-directory/model-directory.md`](../../docs/model-directory/model-directory.md),
and it is enforced — `scripts/lint/model/` checks twelve rules against this tree.
This document is the map, not the standard: it says what is here and why the two
halves differ, and defers every rule to the standard.

## The two halves are not symmetric

They look alike and are governed by one template, which makes the difference easy
to lose: **what varies is how many of each thing exists, and for how long.**

The server holds one of everything for the life of the process, and identity
arrives per request as a `Scope`. Module state is safe there precisely because
none of it is per-user.

The client holds one of everything for the life of a *client instance* — a
browser tab now, a desktop window later — and all of it is one person's. There is
no second user to leak to inside a tab, which is why the same shape that would be
a defect on the server is correct here.

## Server

Built on first use rather than at import, and the build promise is cached.
Building at import time would turn a configuration error into a module-load
failure with no logger to report it; caching the promise means concurrent first
requests share one build rather than racing to open the same log file.

Three failure behaviours here exist because each was once a defect, and they are
easy to break while refactoring:

- **A rejected build is not cached.** It evicts itself, so a corrected
  configuration file does not require a restart.
- **Shutdown is one-way.** Once it begins the model is gone; clearing the cache
  instead would let a request arriving mid-shutdown build a second model against
  a directory the first is concurrently closing.
- **Databases close before logging**, so the database's own close records still
  reach the destination.

### Doors, and the guard that does not cover them

A door carries `.server.ts`. Internals do not.

`model/server/` is **not** `$lib/server/`, so SvelteKit's path-based guard does
not cover it — only the `*.server.*` basename pattern does, and only on files
carrying it. Several internals import nothing but types, so after erasure they
have no runtime imports at all and would bundle cleanly into a browser build.

That gap used to be convention. It is now the `environment` rule, which walks the
browser's actual import graph rather than trusting a filename.

## Client

Two objects: `storage` owns what survives a reload, `workbench` owns what is
open. Three more used to exist and were folded into `workbench` — they held no
state of their own, which is the test for whether something is an object at all.

**Nothing here builds itself.** The layout that owns a client instance calls
`initClientModel`; everything else calls `clientModel()`, which throws until that
has happened. A module-level instance that built itself on first touch could not
take the project as a construction argument, and the project is what a client
instance is scoped to.

`/app` sets `ssr = false`, so the layout script never runs on the server and the
instance is never built there. That costs content in the first paint and nothing
else: load functions, remote functions, and endpoints all still work.

## Scope

`scope.server.ts` answers "who is asking, and about which project", and is a door
of its own — narrow, and unavoidably separate. It imports the composition root,
so folding it behind `index.server.ts` would close an import cycle.

Authority and selection arrive differently, and the difference is the point. Who
you are comes from the session cookie and is never a parameter. Which project a
call is about comes from the request, because a person has more than one — and it
is resolved *within that user's own handles*, so the lookup is the authorization
and there is no separate check to forget.

Every capability procedure takes a `Scope` first. No input type carries a
`projectId` or a `userId`, so a client cannot name authority it does not have.
