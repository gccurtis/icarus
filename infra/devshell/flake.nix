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
              nodejs_22
              pnpm
              nil
              nixfmt
            ];

            shellHook = ''
              echo "Icarus dev shell ready: node $(node --version), pnpm $(pnpm --version)"
            '';
          };
        });
    };
}
