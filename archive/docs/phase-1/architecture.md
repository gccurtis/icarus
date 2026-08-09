# Architecture

This repository uses a monorepo with strict runtime separation:

- `apps/backend`: API service (Fastify + TypeScript)
- `apps/frontend`: client app (Vite + TypeScript)
- `packages/shared`: shared cross-runtime types/contracts
- `infra/devshell`: Nix flake-based development environment

## Why this layout

The backend and frontend are independently runnable and buildable. If the backend language changes later, frontend and shared contracts can remain in place with minimal churn.

## Detailed docs

- [Backend request and Job architecture](backend-architecture.md)
- [Capability reference](capabilities/README.md)
- [Intelligence platform reference](platform/intelligence.md)

## Target runtime reference

The capability references mirror the current Icarus runtime model from Notion. They describe the target contracts that guide implementation as the repository evolves.

- [Backend runtime and capability build map](runtime/backend-map.md)
- [Capability build groups and order](runtime/build-order.md)
- [Repository boundaries](runtime/repository-boundaries.md)
- [Request, Job, and dual-queue runtime](runtime/dual-queue.md)
- [Complete product definition](product/definition.md)
