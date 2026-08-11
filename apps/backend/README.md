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
const config = etcFile("configuration.yaml");
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
| `#etc/*` | `etc/` — checked-in configuration data, never compiled |
| `#package.json` | the package manifest, used only as a package-root anchor |

Filesystem paths come from [`src/initialization/paths.ts`](src/initialization/paths.ts), which
resolves them through that same map using `import.meta.resolve`. Every value it exports is identical
no matter which module asks, how deep it sits, or what the working directory is — verified by booting
from `src/`, from `dist/`, and with `cwd=/tmp`.

One exception is unavoidable: the repository-root `.env` sits outside this package, and an imports-map
target may not escape its own package. It is anchored to `packageRoot` instead of to a module, so it
survives files moving and only changes if the package itself relocates.

### Not currently enforced

No linter is selected, so nothing fails a build when this rule is broken. Until one is, the check is
`grep -rn 'from "\.' src` and `grep -rn 'import.meta.url' src` — both should return nothing outside
`paths.ts`.

## Current state

`src/` is a transport spine: 20 files serving `GET /health` and `POST /echo`. Every other path returns
404, with the registered routes listed in the body.

The previous implementation — 221 files, including all 19 capabilities and the hand-written job system
— is frozen in [`reference/`](reference/README.md), which also documents how to bring a capability
back.

## Commands

```sh
pnpm dev          # tsx watch on src/
pnpm typecheck
pnpm build        # tsc -> dist/
pnpm start        # node dist/
```

There is no `test` script. The suite was deleted; `typecheck` plus booting the server are the only
gates, which is why the two path bugs above reached `main`.
