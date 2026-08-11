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

24 TypeScript files — the transport spine and nothing else:

```text
index.ts                                   process entry
initialization/configuration.ts            the config schema, unchanged
initialization/create-runtime.ts           rewritten; composes only the spine
initialization/runtimes/{config,app,logger,scheduler,registry}.ts
api/{context,errors,registerHttpTransport}.ts
api/routes/registerBuiltInEndpointMappings.ts
api/routes/internal/registerEndpointMappings.ts
workflows/{registry,scheduler,types,internalRuntime,resourceRetentionScheduler}.ts
shared/persistence/resourceHistory.ts
capabilities/observability/logger.ts
capabilities/built-in/{health,echo,audit,queueStatus}Capability.ts
```

`src/` also keeps **all 101 directories** and **all 114 capability documentation files**. The design
record stays where the work happens; only the implementation moved. Empty directories carry a
`.gitkeep`.

Four endpoints are served: `GET /health`, `GET /health/queues`, and the echo and audit routes. Every
other route now returns 404 by design.

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
