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
pnpm dev                     # vite, on :3000 — one process, nothing to start first
pnpm lint && pnpm typecheck && pnpm test && pnpm test:scripts
pnpm build && node build/index.js
```

`pnpm build` produces a Node server at `build/index.js` via `adapter-node`.
Set `ORIGIN` when running it: kit refuses a mutation whose `Origin` header does
not match.

## How it is put together

Trees under `app/src/lib`, each with a written standard and a linter behind it:

| Tree | Holds | Standard |
| --- | --- | --- |
| `representation/` | what the system knows — declarations, and the store over them | none yet |
| `capabilities/` | stored data, **procedurally** — types and functions | [capability-directory](app/docs/capability-directory/capability-directory.md) |
| `model/` | things with a real lifetime — browser state, and process-held server resources | [model-directory](app/docs/model-directory/model-directory.md) |
| `views/` | what a person sees | [view-directory](app/docs/view-directory/view-directory.md) |

`pnpm lint` runs four linters (the fourth covers
[styles](app/docs/styles-directory/styles-directory.md)). They are the machine-checked
half of each standard; the checklists cover the rest.

### Nothing is connected yet

The 213 panels under `views/` read `capabilities/`, and every capability answers
from sample rows rather than from anything stored. Not one of them reaches the
store.

`representation/` holds the vocabulary in `data/` and a JSON-file store in
`store/`, behind five ungated remote functions that nothing on screen calls.
Reconnecting the two — an `api/` beneath each capability — is the work in front
of us, and the capability standard above still describes the Convex arrangement
that has been removed.

## Configuration

`app/configuration/` holds YAML read at startup, merged lexicographically with
the git-ignored `local.yaml` last. See
[its README](app/configuration/README.md).
