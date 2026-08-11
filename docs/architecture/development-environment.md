# Development Environment

## Goal

Icarus development should begin from one reproducible command on a NixOS workstation:

```sh
nix develop
```

The repository root will own a single `flake.nix`. It supplies system tools; JavaScript application and CLI versions remain pinned by the workspace lockfile. Secrets and machine-specific configuration never enter the flake.

This document defines the planned shell. The architecture documentation PR does not add the actual flake before the workspace manifests and first executable slice exist.

## Tool ownership

| Tool | Pinned by | Reason |
| --- | --- | --- |
| Node.js | `flake.nix` | Consistent native runtime |
| pnpm | `flake.nix` and workspace `packageManager` | One root package manager |
| Git, jq, ripgrep | `flake.nix` | Baseline repository tooling |
| PostgreSQL client | `flake.nix` | Direct local inspection and migration debugging |
| OpenSSL, `pkg-config`, Python | `flake.nix` | Native dependency build support |
| Nix formatter and language server | `flake.nix` | NixOS editor and CI consistency |
| Supabase CLI | root development dependency | Version follows the repository lockfile |
| DBOS CLI and SDK | root/backend dependencies | Version follows backend code |
| Theia build packages | frontend dependencies | Version follows the frontend composition |

Supabase local development also requires a Docker-compatible container daemon available on the host. The dev shell supplies client tooling; it should not secretly start or own a privileged daemon.

## Planned flake

The initial `flake.nix` should stay small:

```nix
{
  description = "Icarus development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachSystem [ "x86_64-linux" "aarch64-linux" ] (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_24
            pnpm
            git
            jq
            ripgrep
            postgresql_17
            openssl
            pkg-config
            python3
            nil
            nixfmt-rfc-style
            shellcheck
          ];

          shellHook = ''
            export ICARUS_REPOSITORY_ROOT="$PWD"
          '';
        };
      });
}
```

The actual implementation must use versions available in the pinned `nixpkgs` input and may adjust native build tools in response to real dependencies. It must not grow into a second package manager.

## Repository scripts

The future root workspace should expose a small command surface:

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run the active frontend and backend development processes |
| `pnpm dev:frontend` | Run the Theia browser application |
| `pnpm dev:backend` | Run the TypeScript API and DBOS worker needed by the slice |
| `pnpm supabase:start` | Start the local Supabase project under `backend/supabase/` |
| `pnpm supabase:stop` | Stop the local Supabase project |
| `pnpm db:reset` | Recreate local data from migrations and seed |
| `pnpm typecheck` | Type-check all active workspaces |
| `pnpm test` | Run unit and integration tests |
| `pnpm test:e2e` | Run Playwright cross-system tests |
| `pnpm lint` | Run code and architecture checks |

Exact scripts are added with the first scaffold and must work from the repository root.

## Theia package-manager validation

Theia's official examples have historically used their own generated workspace conventions. Icarus intends to use one root pnpm workspace, but that is a validation item rather than an assumption.

The first frontend scaffold must prove that the chosen Theia browser application builds, runs, and resolves extension packages under pnpm. If an upstream Theia tool has a hard incompatibility, isolate the minimum required package-manager exception inside `frontend/` and document why; do not silently mix package managers across the repository.

## Configuration and secrets

Checked-in configuration belongs in `configuration/` or the relevant tool configuration. Local secrets belong in ignored environment files.

```text
.env.example                          # Names and safe descriptions only
.env.local                            # Local secret values; ignored
backend/supabase/config.toml          # Local Supabase project configuration
configuration/icarus.yaml             # Non-secret capability configuration
configuration/intelligence-cast.yaml  # Non-secret model routing configuration
```

The frontend receives only public Supabase configuration. Service-role, model-provider, and other trusted credentials remain backend-only. Neither Nix derivations nor `shellHook` should embed secrets, because Nix store contents are not private.

## First scaffold sequence

1. Add `flake.nix`, root workspace manifests, lockfile, and root scripts together.
2. Enter `nix develop` and verify Node, pnpm, PostgreSQL client, and formatters.
3. Initialize `backend/supabase/`; add the first migration and a cross-project RLS denial test.
4. Compose the Theia browser application and one Icarus extension under `frontend/`.
5. Add the backend initialization and one capability vertical slice.
6. Add DBOS only when that slice includes a genuinely durable or ordered operation.
7. Verify `pnpm typecheck`, `pnpm test`, and the first Playwright flow from a clean checkout.

## Clean-checkout acceptance test

On a supported NixOS machine with a Docker-compatible daemon:

```sh
git clone <repository>
cd icarus
nix develop
pnpm install --frozen-lockfile
pnpm supabase:start
pnpm db:reset
pnpm test
pnpm dev
```

The browser application must open, authenticate against local Supabase, select a project, perform one revisioned mutation, receive a private realtime invalidation, and reject a cross-project read through RLS.
