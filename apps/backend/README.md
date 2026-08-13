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
- [`src/capabilities/`](src/capabilities/) holds the capabilities. Every one has
  the same shape; start at its `overview.md`.
- [`configuration/`](configuration/README.md) contains runtime configuration
  input files.
- [`docs/capability-directory/capability-directory.md`](docs/capability-directory/capability-directory.md)
  is the directory standard: the template, the generators, and the lint rules.
- [`docs/capability-directory/templates/`](docs/capability-directory/templates/templates.md) holds the document templates and
  [the review checklist](docs/capability-directory/reviewing-a-capability.md).
- [`src/initialization.md`](src/initialization.md) explains the startup path; it
  sits beside `main.ts`, which it describes.
- [`configuration/configuration.md`](configuration/configuration.md) explains
  how configuration is read, beside the files it reads.
- [`docs/reference/`](docs/reference/README.md) and
  [`reference/`](../../reference/README.md) are archived material; neither is part of
  the live backend.

## Capabilities

A capability is one directory holding everything it owns:

```text
<capability>/
├── overview.md          # start here
├── index.ts             # the only file other capabilities import
├── types/               # canonical model and runtime contract
├── runtime-objects/     # definition.ts + constructor.ts per object
├── runtime-api/         # one directory per public method
├── persistence/         # schema, stored types, store
├── endpoints/           # register.ts + one directory per endpoint
└── test/                # unit, regression, non-functional, bruno
```

A directory is absent when the capability has nothing for it, and every
directory carries a document named after itself.

Create one with `pnpm new-capability <path/to/name>`, add a method with
`pnpm new-runtime-api`, add an endpoint with `pnpm new-endpoint`.

## Conventions

Use package-import aliases for application code; do not use relative imports.
Each capability owns a direct alias: `#web-server` is its `index.ts`, and
`#web-server/...` reaches inside it. Cross-capability imports use the bare
alias only. `#capabilities/...` is not used — spelling out the grouping
directory means regrouping a capability rewrites every import that mentions it.

Keep a package-owned filesystem location beside the module that consumes it.
Keep `package.json` imports and `tsconfig.json` paths aligned.

`pnpm lint` checks all of the above: `scripts/lint-paths.mjs` for how files refer
to each other — including that every alias import resolves to a file that exists
— and `scripts/lint-structure.mjs` for the shape of each capability.
