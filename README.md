# Icarus

TypeScript monorepo with strict frontend/backend separation and shared contracts.

## Structure

- `apps/backend`: backend API (Fastify)
- `apps/frontend`: frontend app (Vite)
- `packages/shared`: shared types/contracts
- `infra/devshell`: Nix flake dev environment
- `docs`: project docs — [`phase-2/`](docs/phase-2/README.md) is current, `phase-1/` is a frozen archive

## Documentation

**[`docs/phase-2/`](docs/phase-2/README.md) is the current documentation.** It was written by
reading the backend source and is verified against it; start at its
[README](docs/phase-2/README.md) for the reading order.

[`docs/phase-1/`](docs/phase-1/README.md) is a frozen archive of the tree that preceded it. It
records design intent and history. **It does not describe the current system and must not be
cited as one** — see its [README](docs/phase-1/README.md) for what is and is not reliable.

Each backend module also carries a documentation package beside its code, at
`apps/backend/src/**/docs/`. Those are live and take precedence over any design page where the
two differ.

## NixOS / Nix usage

From repo root:

```bash
nix develop
pnpm install
```

If you want to target the nested flake directly:

```bash
nix develop ./infra/devshell
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

