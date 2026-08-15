# Icarus

One TypeScript application. SvelteKit serves the browser and runs the server
code behind it, so there is no wire contract to keep in step and no second
process to start.

## Structure

- `app/` — the application: `src/`, `scripts/`, `docs/`, `configuration/`
- `infra/devshell/` — Nix flake dev environment
- `docs/` — repository-level design records
- `reference/` — a frozen copy of the pre-rebuild tree. Nothing here is
  compiled, type-checked, imported, or executed

The repository root holds no workspace manifest, lockfile, or shared tsconfig.
`app/` is installed and run from its own directory.

## Nix

```bash
nix develop ./infra/devshell
```

Supplies Node and pnpm. Everything below assumes it.

## Install, develop, verify, build

```bash
cd app
pnpm install
pnpm dev                     # vite, on :3000
pnpm lint && pnpm typecheck && pnpm test && pnpm test:scripts
pnpm build && node build/index.js
```

`pnpm build` produces a Node server at `build/index.js` via `adapter-node`.
Set `ORIGIN` when running it: kit refuses a mutation whose `Origin` header does
not match.

## How it is put together

Three trees under `app/src/lib`, each with a written standard, a review
checklist, and a linter behind it:

| Tree | Holds | Standard |
| --- | --- | --- |
| `capabilities/` | database-backed data, **procedurally** — types, tables, and functions | [capability-directory](app/docs/capability-directory/capability-directory.md) |
| `model/` | things with a real lifetime — browser state, and process-held server resources | [model-directory](app/docs/model-directory/model-directory.md) |
| `views/` | what a person sees | [view-directory](app/docs/view-directory/view-directory.md) |

`pnpm lint` runs all four linters (the fourth covers
[styles](app/docs/styles-directory/styles-directory.md)). They are the machine-checked
half of each standard; the checklists cover the rest.

### A view reaches a capability by calling a function

There are no endpoints and no hand-written wire types. A capability exposes each
public function through a SvelteKit **remote function**, and a view imports it
from the capability's browser door:

```ts
import { list } from "$name-manager";

const variables = list({ project });
```

Types flow from the server implementation, because the client module is
regenerated from it at build time.

### Two doors, and they cannot be merged

`index.server.ts` exports the procedures, for load functions and other
capabilities. `index.ts` re-exports only the remote wrappers, for views. A view
importing the server door would pull Kysely into the client graph, and kit's
server-only guard fails the build rather than tree-shaking it.

### One database per project

Project isolation is **structural**: a project is its own PGlite database, so no
query carries a `project_id` predicate and no table has the column.

A browser call names a project with an opaque **token** it holds in its URL.
`resolveScope` looks that token up within the asking user's own handles — the
lookup *is* the authorization, and a token the user does not hold resolves to no
project at all. Below that line a procedure has a `Scope` and the token no longer
exists.

## Configuration

`app/configuration/` holds YAML read at startup, merged lexicographically with
the git-ignored `local.yaml` last. See
[its README](app/configuration/README.md).
