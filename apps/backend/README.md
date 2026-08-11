# backend

## Never use a relative path

**No relative imports. No module-relative filesystem paths.** Both are banned, and the second one is
the reason the first one matters.

```ts
// no
import { parseNumber } from "./parse.js";
const config = resolve(dirname(fileURLToPath(import.meta.url)), "../../etc/configuration.yaml");

// yes
import { parseNumber } from "#initialization/configuration/parse.js";
const config = configurationFile("server.yaml");
```

### Why

A relative path encodes *where the reading file sits*, so moving that file changes what the path
means. This broke startup twice during the restructure:

- `configuration.ts` moved from `src/0-utils/config/` to `src/initialization/`, one level shallower.
  Its `../../../etc/configuration.yaml` then pointed at `apps/etc/` and the backend could not boot.
- Splitting it into `src/initialization/configuration/` moved it one level deeper and broke the same
  line again, in the opposite direction.

`tsc` caught neither. A path is a string, and a string is valid wherever it points. Type-checking
cannot tell you that a file moved out from under one.

### How paths work here

`package.json` `imports` is the single resolution map. TypeScript mirrors it in `tsconfig.json`
`paths`; **both must be edited together**, because Node resolves `imports` and TypeScript resolves
`paths`, and a mismatch fails at runtime rather than at compile time.

| Alias | Points at |
| --- | --- |
| `#initialization/*`, `#api/*`, `#capabilities/*` | the matching directory under `src/` (or `dist/`) |
| `#configuration/*` | `configuration/` — checked-in YAML, never compiled |
| `#package.json` | the package manifest, used only as a package-root anchor |

Filesystem paths come from [`src/initialization/paths.ts`](src/initialization/paths.ts), which
resolves them through that same map using `import.meta.resolve`. Every value it exports is identical
no matter which module asks, how deep it sits, or what the working directory is — verified by booting
from `src/`, from `dist/`, and with `cwd=/tmp`.

One exception is unavoidable: the repository-root `.env` sits outside this package, and an imports-map
target may not escape its own package. It is anchored to `packageRoot` instead of to a module, so it
survives files moving and only changes if the package itself relocates.

### Enforced by `pnpm lint`

[`scripts/lint-paths.mjs`](scripts/lint-paths.mjs) fails the three ways this can go wrong. No
dependencies — it is plain Node.

1. **No relative imports** anywhere under `src/`.
2. **No `import.meta.url`** outside `paths.ts`.
3. **`package.json` imports and `tsconfig.json` paths declare the same aliases.** Node resolves one
   and TypeScript the other, so a mismatch compiles cleanly and fails at runtime.

Check 3 found a real defect on its first run: the configuration and package-root aliases had been
added to `package.json` only. `tsc` was silent because both are used solely as runtime strings passed
to `import.meta.resolve`, never as import specifiers — exactly the blind spot the check exists for.

## Configuration

[`configuration/`](configuration/README.md) holds one YAML file per section. Every `*.yaml` in it is
merged into a single object, with `local.yaml` applied last.

```text
configuration/
├── server.yaml           server, workerPool, queue
├── logging.yaml
├── project.yaml          projectId, userId
├── intelligence.yaml     providers and routing
├── formula.yaml  structured-data.yaml  rich-text.yaml
├── context.yaml  document.yaml  retention.yaml
└── local.yaml            GIT-IGNORED — real secrets
```

Objects merge key by key, while arrays and scalars replace outright, so overriding a list of routes
replaces it rather than appending. Only changed values need to appear in `local.yaml`, and its
absence is not an error.

Put the real OpenRouter key there:

```yaml
intelligence:
  providers:
    openrouter:
      apiKey: sk-or-...
```

`OPENROUTER_API_KEY` in the environment still works, but only while the resolved value is still the
placeholder — so a key in `local.yaml` takes precedence over one in the environment.

Only `server` and `logging` are read by anything today; the rest describe capabilities in
`reference/` and are kept so a returning capability finds its configuration written.

## Current state

`src/` is a transport spine: 20 files serving `GET /health` and `POST /echo`. Every other path returns
404, with the registered routes listed in the body.

The previous implementation — 221 files, including all 19 capabilities and the hand-written job system
— is frozen in [`reference/`](reference/README.md), which also documents how to bring a capability
back.

## Commands

```sh
pnpm dev          # tsx watch on src/
pnpm lint         # the path rules above
pnpm typecheck
pnpm build        # tsc -> dist/
pnpm start        # node dist/
```

There is no `test` script. The suite was deleted; `typecheck` plus booting the server are the only
gates, which is why the two path bugs above reached `main`.
