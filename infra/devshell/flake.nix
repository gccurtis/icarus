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
              # Node.js runtime + package manager, both unpinned.
              #
              # `nodejs_latest` rather than `nodejs`: the bare attribute is the
              # conservative default (24.x), so asking for "no pin" by name would
              # silently move backwards. `_latest` floats forwards instead.
              #
              # No package.json `packageManager` field exists, so this pnpm is the
              # only one in play — nothing self-switches to a downloaded copy.
              nodejs_latest
              pnpm

              # For the eventual move off PGlite. Nothing uses it today —
              # persistence is an embedded PostgreSQL per project, opened
              # in-process — but the registry is the only code that changes when
              # a real server replaces it, and this is what runs one locally.
              # `supabase start` uses the host's Docker-compatible daemon; the
              # daemon is not part of this development shell.
              supabase-cli

              # Language servers. Top-level attributes — the `nodePackages.*`
              # spellings for these are gone from nixpkgs.
              #
              # svelte-language-server's binary is `svelteserver`.
              svelte-language-server
              typescript-language-server
              tailwindcss-language-server

              # html / css / json / eslint servers in one derivation.
              vscode-langservers-extracted
              emmet-language-server

              # css, json, yaml, markdown. `.svelte` formatting comes from
              # svelte-language-server, which carries its own prettier.
              prettier

              # Nix tooling
              nil
              nixfmt

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
              echo "Language servers: svelteserver, typescript-language-server, tailwindcss-language-server, vscode-{html,css,json,eslint}-language-server, emmet-language-server"
            '';
          };
        });
    };
}
