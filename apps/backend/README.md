# Backend

The Icarus backend package.

## Run

```sh
pnpm dev
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm start
```

## Orientation

- [`src/main.ts`](src/main.ts) is the process entry point.
- [`src/`](src/) contains the live backend implementation.
- [`configuration/`](configuration/README.md) contains runtime configuration
  input files.
- [`docs/procedures/`](docs/procedures/) explains the executable lifecycle and
  infrastructure procedures.
- [`docs/capability/`](docs/capability/) documents current capability designs
  and implementations.
- [`reference/`](reference/README.md) contains archived material; it is not
  part of the live backend.

## Conventions

Use package-import aliases for application code; do not use relative imports.
Keep a package-owned filesystem location beside the module that consumes it.
Keep `package.json` imports and `tsconfig.json` paths aligned; `pnpm lint`
checks these rules.
