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
cd apps/backend  && pnpm dev     # tsx watch on src/index.ts
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

Local secrets live in `.env` at the repository root, which is git-ignored. The backend loads it from
its own directory upward, so the root location is intentional.
