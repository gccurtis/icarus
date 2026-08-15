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
pnpm dev:convex              # backend on :3210, pushes and watches — run this first
pnpm dev                     # vite, on :3000, in a second terminal
pnpm lint && pnpm typecheck && pnpm test && pnpm test:scripts
pnpm build && node build/index.js
```

`pnpm dev:convex` downloads the Convex backend binary and runs it **locally**.
No Convex account is involved and no data leaves the machine. It writes the
deployment URL to a git-ignored `app/.env.local`, which the app reads as
`PUBLIC_CONVEX_URL`, and it generates `src/convex/_generated/` — which must exist
before `pnpm typecheck` runs, since the app's tsconfig includes it.

`pnpm build` produces a Node server at `build/index.js` via `adapter-node`.
Set `ORIGIN` when running it: kit refuses a mutation whose `Origin` header does
not match.

## How it is put together

Three trees under `app/src/lib`, each with a written standard, a review
checklist, and a linter behind it:

| Tree | Holds | Standard |
| --- | --- | --- |
| `capabilities/` | stored data, **procedurally** — types and functions | [capability-directory](app/docs/capability-directory/capability-directory.md) |
| `model/` | things with a real lifetime — browser state, and process-held server resources | [model-directory](app/docs/model-directory/model-directory.md) |
| `views/` | what a person sees | [view-directory](app/docs/view-directory/view-directory.md) |

`pnpm lint` runs all four linters (the fourth covers
[styles](app/docs/styles-directory/styles-directory.md)). They are the machine-checked
half of each standard; the checklists cover the rest.

### A view subscribes to a capability

Convex is the store. A capability holds its table declaration and its handlers;
[`app/src/convex/`](app/src/convex/convex.md) holds the registration that makes
one callable, and a file's path there is its public name.

A view subscribes rather than fetches, so a write arriving from anywhere — this
tab, another tab, another machine — lands without being asked for:

```svelte
const settings = useQuery(api.capabilities.settings.list, () => ({ projectId }));
```

Types flow from the handler, because Convex generates the client API from the
functions it pushed.

### Project isolation is a field, and it is not yet enforced

Every scoped table carries `projectId` and every index leads with it, because one
deployment holds every project and a read that forgets the predicate reads
everyone's rows.

**The membership check that should sit in front of that does not exist yet.**
Today's functions take `projectId` as an argument and trust it, so anything
holding the deployment URL can read and write any project. `resolveScope` still
resolves a project token within one user's own handles — the lookup *is* the
authorization — but nothing on the Convex side consults it. Closing that is the
next piece of work.

## Configuration

`app/configuration/` holds YAML read at startup, merged lexicographically with
the git-ignored `local.yaml` last. See
[its README](app/configuration/README.md).
