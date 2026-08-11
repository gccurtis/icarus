# Icarus

TypeScript monorepo with strict frontend/backend separation and shared contracts.

## Structure

- `apps/backend`: backend API (Fastify)
- `apps/frontend`: frontend app (Vite)
- `packages/shared`: shared types/contracts
- `infra/devshell`: Nix flake dev environment
- `docs`: project docs

## NixOS / Nix usage

The dev shell is defined in `infra/devshell`. From repo root:

```bash
nix develop ./infra/devshell
pnpm install
```

## Development

Run all packages (shared watcher + backend + frontend):

```bash
pnpm dev
```

Run only backend:

```bash
pnpm dev:backend
```

Run only frontend:

```bash
pnpm dev:frontend
```

## Build

```bash
pnpm build
```

