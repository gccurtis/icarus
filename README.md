# Icarus

Reset in progress. Everything that came before is preserved under [`archive/`](archive/).

## archive/

The previous system, moved wholesale on 2026-08-09 and left runnable in place. Nothing was
deleted; every file is still in git history at its original path.

| Path | What it is |
| --- | --- |
| `archive/apps/backend` | The backend service — 13 capabilities, 251 TypeScript files, 535 passing tests |
| `archive/apps/frontend` | Vite client (a stub) |
| `archive/packages/shared` | Cross-runtime contracts (one interface) |
| `archive/docs/phase-2` | Documentation written against commit `ef6d462`, **stale** — it predates the Slides Phase 3–5 work that is on `main` |
| `archive/docs/phase-1` | The documentation tier that preceded phase-2, already an archive when it was moved |
| `archive/scratch` | Design drafts |
| `archive/infra/devshell` | Nix flake dev environment |
| `archive/package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `flake.nix` | Workspace and toolchain config, moved with the code so the archive stays self-contained |

To run the archived backend, work from `archive/` rather than the repository root — the
workspace globs, the nix flake and the `#alias` imports all resolve relative to it.

## Root

The repository root is intentionally bare. There is no workspace, no build, and no test command
here until the replacement is created.
