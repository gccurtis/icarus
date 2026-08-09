{
  description = "Icarus monorepo (frontend + backend + shared)";

  inputs.devshell.url = "path:./infra/devshell";

  outputs = { self, devshell }: {
    devShells = devshell.devShells;
  };
}
