# Icarus

Independent TypeScript frontend and backend. Neither shares build configuration, dependencies, or
types with the other.

## Structure

- `apps/backend`: backend API (Fastify) — self-contained, own lockfile and tsconfig
- `apps/frontend`: frontend app (Vite) — self-contained, own lockfile and tsconfig
- `infra/devshell`: Nix flake dev environment
- `docs`: project docs

The repository root holds no workspace manifest, lockfile, or shared tsconfig. Each app is installed
and run from its own directory.

## NixOS / Nix usage

The dev shell is defined in `infra/devshell` and supplies Node and pnpm:

```bash
nix develop ./infra/devshell
```

## Install

Each app installs independently:

```bash
cd apps/backend  && pnpm install
cd apps/frontend && pnpm install
```

## Development

```bash
cd apps/backend  && pnpm dev     # tsx watch on src/main.ts
cd apps/frontend && pnpm dev     # vite
```

Both are needed for the frontend to reach the backend; run them in separate shells.

## Verify

```bash
cd apps/backend  && pnpm typecheck && pnpm test
cd apps/frontend && pnpm typecheck
```

## Build

```bash
cd apps/backend  && pnpm build
cd apps/frontend && pnpm build
```

## The backend/frontend contract

The backend owns the shapes it serves; the frontend declares its own expectation of them. For example
`ApiHealth` is defined in `apps/backend/src/3-capabilities/built-in/healthCapability.ts` and declared
again in `apps/frontend/src/main.ts`.

This is deliberate — the two sides are independent — but it means **the wire contract is not checked
by the compiler across the boundary**. A change to a response shape on one side will not fail the
other side's type-check. Endpoint contracts have to be kept in step by test or convention.

## Configuration

Each app configures itself. The backend reads every `*.yaml` under
[`apps/backend/configuration/`](apps/backend/configuration/README.md) and merges them, with real
secrets in that directory's git-ignored `local.yaml`.

The repository-root `.env` is no longer read by anything. The backend used to load it via dotenv, for
a single variable that `local.yaml` now supplies.
