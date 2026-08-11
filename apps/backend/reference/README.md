# reference

A complete, frozen copy of the backend implementation as it stood before the rebuild began:
**221 TypeScript files, 114 documentation files, 101 directories.**

Nothing here is compiled, type-checked, imported, or executed. `tsconfig.json` excludes this
directory, so `pnpm typecheck` and `pnpm build` do not see it. It is a place to read from and copy
out of — not a second source tree.

## Why it exists

`src/` was reduced to a working skeleton so the backend builds, type-checks, and boots with no
capability wired. Capabilities are pulled back in one at a time, deliberately, rather than all
carried forward at once. This directory is what they are pulled from.

## What `src/` kept

19 TypeScript files, 1,152 lines — the transport spine and nothing else:

```text
index.ts                                   process entry
initialization/create-runtime.ts           rewritten; composes only the spine
initialization/configuration/              the 639-line file, split; all 12 sections kept
  {index,types,defaults,parse,capabilities}.ts
initialization/runtimes/{config,app,logger,registry}.ts
api/{context,errors,registerHttpTransport}.ts
api/routes/{registry,registerBuiltInRoutes}.ts
capabilities/observability/logger.ts
capabilities/built-in/{health,echo}Capability.ts
```

`src/` also keeps **all 101 directories** and **all 114 capability documentation files**. The design
record stays where the work happens; only the implementation moved. Empty directories carry a
`.gitkeep`.

Two endpoints are served: `GET /health` and `POST /echo`. Every other path returns 404, and the 404
body lists the registered routes.

## What went to reference beyond the capabilities

**The whole job system.** `workflows/{registry,scheduler,types,internalRuntime,resourceRetentionScheduler}.ts`
is here, and `api/registerHttpTransport.ts` in `src/` was rewritten to dispatch directly: look up the
route, call it, respond. Queue ordering, bounded concurrency, deferred responses, and 429 capacity
rejection were real features of that system — nothing the spine serves needs them, so they come back
with the first capability that does, or are replaced by a durable workflow engine.

That removed two built-in endpoints along with it: `GET /health/queues` reported queue state, and
`POST /audit` existed to demonstrate deferred serial execution. Both described a scheduler that no
longer runs.

**`shared/persistence/resourceHistory.ts`**, the current/revision table convention. Nothing in the
spine reached it.

The per-capability configuration sections stayed in `src/` deliberately — `initialization/configuration/capabilities.ts`
and the section interfaces in `types.ts` — so a returning capability finds its config already
described. Eight of the twelve sections are read nowhere in `src/` today.

## Pulling a capability back in

1. Read its documentation in `src/capabilities/<name>/docs/` — that stayed in `src/`.
2. Copy the implementation from `reference/capabilities/<name>/` into `src/capabilities/<name>/`.
3. Copy its initialization function from `reference/initialization/runtimes/<name>.ts`.
4. Copy its routes from `reference/api/routes/<name>/`.
5. Add its construction and route registration to `src/initialization/create-runtime.ts`.
6. `pnpm typecheck && pnpm build`, then boot and exercise its endpoints.

Expect to change things on the way in rather than copying verbatim. Two changes are already known to
be wanted: persistence access is being standardized and centralized, and every store's synchronous
methods are to become async. Copying a capability unchanged reintroduces the pattern that is being
replaced.

## Two things to know

**Searches hit this directory.** A grep for a symbol will match both the live copy and the frozen one.
When a result looks stale, check whether the path starts with `reference/`.

**It will rot.** Nothing type-checks it, so it does not follow the toolchain forward. It already
predates the interface changes described above, and the further `src/` moves, the less this compiles
against it. It is a record of what the code was, not a library.

The same content is also in git history at the commit that created this directory, so deleting it
loses nothing permanent.
