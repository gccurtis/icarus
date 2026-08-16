# The Deployment Root

Convex's functions directory, named by [`convex.json`](../../convex.json). Everything here
is pushed to the deployment; nothing else in the repository is.

```text
src/convex/
├── convex.md
├── tsconfig.json      compiler options and the alias map for the Convex bundler
├── functions.ts       projectQuery / projectMutation — the gate
├── schema.ts          composes one table fragment per capability
├── capabilities/      one file per capability: its public surface
└── _generated/        Convex-owned; regenerated on every push
```

## `functions.ts` is the access control story

**It is the only module that imports `query` or `mutation`**, and every
capability function is built from what it exports.

That is not a convention, it is where the decision has to live. A Convex function
is public the moment it is registered, and there is no request pipeline for a
middleware to sit in — so "is this call allowed" belongs in what the function is
*made of*. Lint enforces the rest: nothing under `src/lib/capabilities/` may
import a registration builder at all.

The gate declares `projectToken`, resolves it against the caller's own
memberships, and consumes it. The handler's argument type has no project in it,
so it cannot act on one it was not scoped to.

`access` registers unscoped, and has to: `seed` creates the first membership the
gate resolves against, so a scoped `seed` could not run until it already had.

## A file's path is its public name

`capabilities/settings.ts` exporting `list` is `api.capabilities.settings.list`, and a
browser holding the deployment URL can call it. So **moving a file here is an API change**,
which is why capability *internals* live in `$lib/capabilities/<name>/` and only the
registration lives here. A module under this directory that merely exports something still
becomes an addressable entry point; keeping the procedure trees out means they cannot become
public by accident, and keeps `test/` out of the deployment entirely.

Each registration is written here as a real `query({...})` or `mutation({...})` call rather
than re-exported from its capability. Codegen types a definition properly; a re-export
through a path alias can degrade the generated API to `AnyApi`.

## Names here are camelCase, not kebab-case

**Convex rejects a hyphen in a module path** — `Path component probe-nested.js can only
contain alphanumeric characters, underscores, or periods`. The rest of the repository is
kebab-case, and this directory cannot be. A capability named `name-manager` is
`capabilities/nameManager.ts` and answers to `api.capabilities.nameManager.*`.

## There are two alias maps, and they must agree

Everywhere else, `svelte.config.js` is the only place aliases are declared, and SvelteKit
generates the TypeScript paths from it so the compiler and the bundler cannot drift.

**The Convex bundler does not read that map.** It resolves `paths` from the nearest
`tsconfig.json`, and it does not follow the `extends` chain up to the generated SvelteKit
config. Without the `paths` block in [`tsconfig.json`](tsconfig.json) here, a `$settings/…`
import fails the push with `Could not resolve`.

So this file's `paths` block duplicates the aliases Convex code actually uses, and adding an
alias that Convex code imports means adding it in both places. That is a real drift risk and
the only one this layout carries.

**It covers `src/convex/**` only.** The bundler resolves aliases from the *nearest* tsconfig,
and a capability handler's nearest is `app/tsconfig.json`, which extends the generated
`.svelte-kit/tsconfig.json`. So a push from an unsynced checkout fails on
`Could not resolve "$access/types/access"` while this block sits there looking correct — run
`svelte-kit sync` first. `pnpm test` and `pnpm typecheck` do it; `pnpm dev:convex` does not.

`noEmit` is set for a mechanical reason worth keeping: Convex runs `tsc` for its typecheck,
and without it `tsc` writes `.js` beside every `.ts`, which the bundler then sees as a second
entry point for the same module — `Two output files share the same path`.

## The deployment is local

`convex dev` downloads the backend binary and runs it on `127.0.0.1:3210`. **No Convex
account is involved**, and no data leaves the machine. It writes `CONVEX_DEPLOYMENT`,
`PUBLIC_CONVEX_URL`, and `PUBLIC_CONVEX_SITE_URL` to a git-ignored `.env.local`, and the
deployment's state to a git-ignored `.convex/`.

Both are per-checkout, so a worktree provisions its own backend on the next free ports and
can push a schema the main tree has never seen.

```sh
pnpm dev:convex   # pushes schema and functions, then watches
pnpm seed         # once — creates the development user, project, and membership
pnpm dev          # in a second terminal
```

`pnpm seed` is not optional on a fresh deployment. The gate refuses a token with
no membership behind it, so until it runs, every call to every capability answers
`no-such-project` and nothing renders.

`_generated/` must exist before `pnpm typecheck` runs, because the app's tsconfig includes
`src/**/*.ts`. `npx convex codegen` produces it without a deployment running — but it does
read `CONVEX_DEPLOYMENT` from `.env.local`, so a checkout that has never run `convex dev`
has to do that once first.
