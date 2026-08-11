{
  description = "Icarus TypeScript workspace devshell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f system);
    in {
      devShells = forAllSystems (system:
        let pkgs = import nixpkgs { inherit system; };
        in {
          default = pkgs.mkShell {
            packages = with pkgs; [
              # Node.js runtime + package manager. The version here is the single
              # source of truth: each package's `packageManager` field must match
              # the pnpm below, or pnpm self-switches to a downloaded copy and the
              # pin stops meaning anything.
              nodejs_26
              pnpm

              # Nix tooling
              nil
              nixfmt

              # Native build deps (required for better-sqlite3)
              python3
              pkg-config

              # Log inspection + data wrangling
              jq
              fx   # interactive JSON browser

              # General utilities
              ripgrep
              bat        # syntax-highlighted cat
              curl
              git
              gh
            ];

            shellHook = ''
              echo "Icarus dev shell ready: node $(node --version), pnpm $(pnpm --version)"
            '';
          };
        });
    };
}
