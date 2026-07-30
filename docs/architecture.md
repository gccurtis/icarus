# Architecture

This repository uses a monorepo with strict runtime separation:

- `apps/backend`: API service (Fastify + TypeScript)
- `apps/frontend`: client app (Vite + TypeScript)
- `packages/shared`: shared cross-runtime types/contracts
- `infra/devshell`: Nix flake-based development environment

## Why this layout

The backend and frontend are independently runnable and buildable. If the backend language changes later, frontend and shared contracts can remain in place with minimal churn.

## Detailed docs

- Backend request/job architecture: `docs/backend-architecture.md`
