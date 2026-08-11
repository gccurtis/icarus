# flake.nix — breakdown

Companion to [flake.nix](flake.nix). The flake defines the reproducible
development environment: a Nix devShell providing the JS runtime, package
manager, and Nix tooling. All web libraries live in `package.json`, not here.

## Flake metadata

### Opening brace and human-readable description

```nix
{
  description = "taurus-alpha — front-end cockpit for the Taurus Omega engine";

```

A flake is a single attribute set (`{ ... }`). `description` is free-text
metadata shown by `nix flake show` / `nix flake metadata`, naming the repo's role
as the cockpit for the Taurus Omega engine.

## Inputs

### External flake dependencies

```nix
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

```

`inputs` declares the other flakes this one pins. `nixpkgs` on the
`nixpkgs-unstable` branch supplies recent package versions (Node 24, pnpm).
`flake-utils` provides helpers to reduce multi-system boilerplate. Exact
revisions are locked in `flake.lock`.

## Outputs — per-system devShell

### Output function and multi-system wrapper

```nix
  outputs =
    { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
```

`outputs` is a function receiving the resolved inputs. `eachDefaultSystem`
runs the body once per common system (x86_64/aarch64 Linux and macOS), binding
`system` each time, so the devShell works cross-platform. `pkgs` imports the
nixpkgs package set for the current `system`.

## devShell packages

### The default shell and its tools

```nix
        devShells.default = pkgs.mkShell {
          # Runtime + package manager for front-end work. Everything Svelte /
          # Tailwind / icon / font related lives in package.json, not here.
          # playwright-driver.browsers supplies the E2E browser binaries so
          # Playwright never downloads them at runtime (which fails under Nix).
          packages = [
            pkgs.opencode
            pkgs.nodejs_24
            pkgs.pnpm
            pkgs.playwright-driver.browsers
            # Tooling for editing this flake itself.
            pkgs.nil
            pkgs.nixpkgs-fmt
          ];

```

`mkShell` builds the environment entered by `nix develop` / `direnv`. It carries
`opencode` (a terminal coding agent), `nodejs_24` and `pnpm` for front-end work,
plus `nil` (Nix language server) and `nixpkgs-fmt` (Nix formatter) for editing
this flake. `playwright-driver.browsers` adds the pinned Chromium/Firefox/WebKit
binaries the Playwright E2E harness drives, supplied by Nix so they are never
fetched at runtime (Playwright's own download step fails inside the Nix sandbox).
Aside from these vetted binaries the set is deliberately lean — web dependencies
belong in `package.json`.

## Shell hook

### Startup banner confirming versions

```nix
          shellHook = ''
            # Point Playwright at the Nix-provided browsers and stop it from
            # trying to download or host-validate them.
            export PLAYWRIGHT_BROWSERS_PATH="${pkgs.playwright-driver.browsers}"
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
            export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
            echo "taurus-alpha devShell — node $(node --version), pnpm $(pnpm --version)"
          '';
        };

```

`shellHook` runs when the shell is entered. It first wires Playwright to the Nix
store: `PLAYWRIGHT_BROWSERS_PATH` points at the `playwright-driver.browsers`
derivation added above so Playwright loads those binaries instead of a
per-user cache; `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` disables its runtime
download step (browsers come from Nix, never a network fetch); and
`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true` suppresses the host-library
check that assumes a Playwright-managed install on a standard distro. It then
prints the active Node and pnpm versions as a quick confirmation the environment
loaded correctly, and closes the `devShells.default` attribute set.

## Formatter

### Registering the repo formatter and closing the flake

```nix
        formatter = pkgs.nixpkgs-fmt;
      }
    );
}
```

`formatter` lets `nix fmt` format Nix files with `nixpkgs-fmt`. The closing
tokens end the per-system attribute set, the `eachDefaultSystem` call, and the
top-level flake set respectively.
