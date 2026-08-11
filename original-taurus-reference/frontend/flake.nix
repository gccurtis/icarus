{
  description = "taurus-alpha — front-end cockpit for the Taurus Omega engine";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
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

          shellHook = ''
            # Point Playwright at the Nix-provided browsers and stop it from
            # trying to download or host-validate them.
            export PLAYWRIGHT_BROWSERS_PATH="${pkgs.playwright-driver.browsers}"
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
            export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
            echo "taurus-alpha devShell — node $(node --version), pnpm $(pnpm --version)"
          '';
        };

        formatter = pkgs.nixpkgs-fmt;
      }
    );
}
