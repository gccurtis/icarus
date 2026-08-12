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

The rule has no exceptions left. The one path that could not be an alias was the repository-root
`.env`, because an imports-map target may not escape its own package — and nothing outside this
package is read any more.

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

`OPENROUTER_API_KEY` exported in the environment still works, but only while the resolved value is
still the placeholder — so a key in `local.yaml` takes precedence over one in the environment. It is
read straight from `process.env`; there is no dotenv and no `.env` file is loaded, so the variable has
to be genuinely exported (as a container or unit file would do).

Only `server` and `logging` are read by anything today; the rest describe capabilities in
`reference/` and are kept so a returning capability finds its configuration written.

## Entry point

[`src/main.ts`](src/main.ts) is two statements: start the backend, print where it is listening.
[`createRuntime`](src/initialization/create-runtime.ts) builds it and returns a `Runtime` —
`{ config, logger, address, close() }` — rather than taking the process over, so composition stays
callable by something that is not a server process.

### There is no signal handling, on purpose

Ctrl-C already stops the process. A handler can only change what happens *on the way out*: flush the
log, drain in-flight requests. On this spine, that was measured to be nothing.

2000 keep-alive requests, then SIGINT the instant the last response landed, comparing an entry point
with no handler at all against one with a full graceful shutdown:

| | exit | log entries on disk | lost |
| --- | --- | --- | --- |
| no handler | 130 | 2001 / 2001 | 0 |
| graceful shutdown | 0 | 2001 / 2001 | 0 |

A file write stream is already on disk by the time a signal arrives unless writes are outpacing the
disk at that exact moment. Nothing here holds a transaction, and no route runs long enough to be
in flight when the signal lands.

Taking the signal over is also not free — it means owning what follows. A shutdown that blocks needs a
second signal to force past it (verifiably real: a socket holding an unfinished request stops
`app.close()` from returning), and a teardown that throws needs its own failure path. Most of that
machinery exists only to pay for the first piece of it.

**What changes the answer:** a capability returning from `reference/` that holds something a kill would
corrupt — an open transaction, a half-written file. `Runtime.close()` is the seam, and it already stops
serving before flushing so the shutdown's own entries survive. Nothing calls it yet.

A failed start throws: Node prints the error and exits 1, and `createRuntime` records
`backend.start.failed` and flushes the log before rethrowing, so the log file keeps the reason too.

## Current state

`src/` is a transport spine: 20 files serving `GET /health` and `POST /echo`. Every other path returns
404, with the registered routes listed in the body.

The previous implementation — 221 files, including all 19 capabilities and the hand-written job system
— is frozen in [`reference/`](reference/README.md), which also documents how to bring a capability
back.

## Commands

```sh
pnpm dev          # tsx watch on src/main.ts
pnpm lint         # the path rules above
pnpm typecheck
pnpm build        # tsc -> dist/
pnpm start        # node dist/main.js
```

There is no `test` script. The suite was deleted; `typecheck` plus booting the server are the only
gates, which is why the two path bugs above reached `main`.

### Your editor is not running this compiler

`typescript` is unpinned, which resolves to 7.x — the native Go compiler. It ships `tsc` and nothing
else: there is no `tsserver.js`, so no editor can load it, and "Use Workspace Version" cannot work.
Editors therefore use their own bundled TypeScript, a different major version from the one `pnpm
typecheck` runs.

So an error in the editor that `pnpm typecheck` does not reproduce is possible by construction. The
first question is which compiler is talking. To make the editor's compiler check the whole project
the way `tsc` does:

```sh
# point at the editor's bundled TypeScript — for VS Code, under resources/app/extensions
node -e '
  const ts = require(process.argv[1]), p = require("node:path");
  const c = ts.getParsedCommandLineOfConfigFile(p.resolve("tsconfig.json"), {}, {...ts.sys,
    onUnRecoverableConfigFileDiagnostic: console.log});
  const prog = ts.createProgram(c.fileNames, c.options);
  const d = [...prog.getOptionsDiagnostics(), ...prog.getSemanticDiagnostics()];
  console.log(ts.version, c.fileNames.length + " files", d.length + " diagnostics");
  for (const x of d) console.log(" TS" + x.code, ts.flattenDiagnosticMessageText(x.messageText, " "));
' /path/to/editor/typescript/lib/typescript.js
```

Both compilers were verified to agree on this tree: 20 files, 0 diagnostics each. A stale TS server
after a file rename or a `pnpm install` is the likelier explanation for a disagreement — restart it
before believing it.

Note that aliases resolve through `paths` here, not through `package.json` `imports`; the imports map
is what Node uses at runtime. That is why lint rule 3 checks the two against each other.
