# 00 · Orientation

*Verified against source at commit ef6d462, 2026-08-09.*

Where the code lives, how much of it there is, how to run it, and the two ways to silently run the
wrong copy of it.

## Repository map

```text
icarus/
  apps/backend/         @icarus/backend — the subject of this documentation set
  apps/frontend/        @icarus/frontend — 5 tracked files; src/main.ts is a 24-line health probe
  packages/shared/      @icarus/shared  — 3 tracked files; src/index.ts is one 5-line interface
  infra/devshell/       The Nix dev shell. Exactly two files: flake.nix, flake.lock
  docs/phase-1/         Archived documentation — superseded, much of it false. See README.md
  docs/phase-2/         This documentation set
  logs/                 Repo-root log directory. Holds only .gitkeep; the backend writes elsewhere
  scratch/              The owner's private design drafts. Not read, not cited, not linked
  .env                  Gitignored. One key: OPENROUTER_API_KEY
  flake.nix             195 B — a thin re-export of infra/devshell
  package.json          Workspace root. packageManager: pnpm@9.12.0
  pnpm-workspace.yaml   packages: [apps/*, packages/*]
  tsconfig.base.json    ES2022 · NodeNext · strict · skipLibCheck — shared by all three packages
```

The workspace is pnpm with three members. [`README.md`](../../README.md) at the repo root (53 lines)
is accurate as written — its structure list, its `nix develop` instructions and all five of its
`pnpm` commands were checked against source — and it is the shortest correct statement of how to get
started. Its one omission is the same one the whole repository has: **nothing tells a new
contributor that `OPENROUTER_API_KEY` exists.** `.gitignore` reserves `!.env.example`, and no
`.env.example` has ever been committed; the only `.env` in the tree is gitignored and holds that one
key.

| Package | Path | Tracked source | What it actually is |
| --- | --- | --- | --- |
| `@icarus/backend` | `apps/backend` | 236 `.ts` / 47,936 lines, plus 28 test files / 16,502 lines | The whole system. Everything else in this set is about this directory |
| `@icarus/frontend` | `apps/frontend` | 5 files; `src/main.ts` is 24 lines | A stub. See below |
| `@icarus/shared` | `packages/shared` | 3 files; `src/index.ts` is 5 lines | One interface. See below |

### The frontend is a 24-line stub

[`apps/frontend/src/main.ts`](../../apps/frontend/src/main.ts) is the entire application. It fetches
the hard-coded absolute URL `http://localhost:4000/health`, casts the response to `ApiHealth`, and
writes `Backend status: <status> at <timestamp>` — or `Backend unreachable: <error>` — into the one
`<p id="status">` in a 15-line `index.html`. There is no router, no framework, no state and no
styling. [`vite.config.ts`](../../apps/frontend/vite.config.ts) is 7 lines and sets exactly one
thing, `server.port: 3000`; there is **no dev-server proxy**.

That leaves an unresolved question this set will not paper over: the page fetches cross-origin from
`:3000` to `:4000`, and **no CORS plugin is registered anywhere in the backend** (`grep -rn -i cors
apps/backend/src` returns nothing). Nothing in the repository tests that path.

### `packages/shared` holds exactly one interface

[`packages/shared/src/index.ts`](../../packages/shared/src/index.ts), complete:

```ts
export interface ApiHealth {
  service: "backend";
  status: "ok";
  timestamp: string;
}
```

It has exactly two consumers, and both import it **type-only**:
[`apps/backend/src/3-capabilities/built-in/healthCapability.ts:1`](../../apps/backend/src/3-capabilities/built-in/healthCapability.ts)
and [`apps/frontend/src/main.ts:1`](../../apps/frontend/src/main.ts). Because both imports are
erased at compile time, a gap in the package manifest has never been felt:
[`packages/shared/package.json`](../../packages/shared/package.json) declares `"types":
"src/index.ts"` and **no `main`, no `exports`, no `module`**. The first runtime import of
`@icarus/shared` from either app would fail to resolve.

The emptiness is deliberate — a type stays capability-owned until two or more consumers need the
same contract — and in practice one type has met that bar in the life of the project.

## Backend layout

```text
apps/backend/
  etc/
    configuration.yaml    212 lines. Every tunable value and limit. See 09-configuration.md
    README.md             31 lines. Documents 4 of the 13 YAML sections; accurate on those 4
  data/                   SQLite files, gitignored. The runtime opens 12 (see 04-state-and-persistence.md)
  logs/                   backend-YYYY-MM-DD.log, one per calendar day, gitignored, never pruned
  dist/                   tsc output, gitignored. STALE in this checkout — see below
  src/
    0-platform/     database formula intelligence knowledge observability rich-text web-retrieval
    0-utils/        config jobs persistence types
    1-init/         create/ (23 files) + startBackend.ts (238 lines)
    2-transport/    registerHttpTransport.ts (125 lines — the entire transport layer)
    3-capabilities/ activity built-in comments connector context derived-outputs document
                    general-files investigation persona slides structured-data templates
    4-job-wiring/   activity comments connector context derived-outputs document general-files
                    internal investigation persona structured-data templates
                    + registerBuiltInEndpointMappings.ts
    index.ts        14 lines — loads .env twice, calls startBackend(), swallows the error
  test/
    capabilities/*.test.ts   26 files, 16,054 lines, node:test
    helpers/testDoubles.ts   52 lines — the entire double library
    smoke/http-smoke.mjs     396 lines — separate script, NOT part of `pnpm test`
  package.json      32 `imports` aliases; 5 runtime deps; 4 dev deps
  tsconfig.json     include: ["src/**/*.ts"] — and nothing else
```

Two things a directory listing will lie to you about:

- **`src/4-job-wiring/formula/` and `src/4-job-wiring/name-manager/` are empty directories.**
  `find src/4-job-wiring -type d -empty` returns exactly those two, and `git ls-files` does not list
  them — git does not track empty directories, so they exist only in this working tree and will not
  appear in a fresh clone. There is no Formula job wiring and no name-manager job wiring.
- **`src/0-platform/web-retrieval/` contains no TypeScript.** Seven files: a zero-byte `.gitkeep`
  and a six-page `docs/` package. Nothing in the tree imports it. See
  [06-platform-services.md](06-platform-services.md).

`3-capabilities/` holds **13** directories. Twelve of them are reachable over HTTP; `slides/` is
built, typechecked and covered by 87 passing tests, and **nothing constructs it** — no
`application/` layer, no `index.ts`, no `#slides` alias, no `1-init/create/slides.ts`, no
`4-job-wiring/slides/`, no mention in `startBackend.ts`, and no `docs/` package. See
[07-capabilities/slides.md](07-capabilities/slides.md).

## Source volume by layer

Measured with `find src/<layer> -name '*.ts' | wc -l` and `-exec cat {} + | wc -l`.

| Layer | `.ts` files | Lines | Share |
| --- | ---: | ---: | ---: |
| `3-capabilities` | 133 | 32,246 | 67.3% |
| `0-platform` | 52 | 9,301 | 19.4% |
| `4-job-wiring` | 16 | 2,938 | 6.1% |
| `1-init` | 24 | 1,680 | 3.5% |
| `0-utils` | 9 | 1,632 | 3.4% |
| `2-transport` | 1 | 125 | 0.26% |
| `src/index.ts` | 1 | 14 | 0.03% |
| **Total** | **236** | **47,936** | **100%** |

The distribution is the architecture. Transport is one file of 125 lines because it normalises a
Fastify request into an envelope and delegates; it knows no capability and imports only `#utils` (3
specifiers) and `#platform` (1). Composition is 238 lines of explicit constructor calls. Two thirds
of the weight sits in capability domain logic, where it is meant to. See
[01-layers-and-boundaries.md](01-layers-and-boundaries.md).

## Tests

| Measure | Value |
| --- | --- |
| Test files | 26 `*.test.ts` (16,054 lines) + 1 helper (52 lines) + 1 smoke script (396 lines) |
| Tests | **444** — 325 top-level, 119 subtests, 0 suites, 0 skipped, 0 todo |
| Result on 2026-08-09 | **444 pass, 0 fail** |
| Framework | `node:test` + `node:assert/strict`. No test framework, no assertion library, no mocking library |
| Import style | Every test file imports source by **relative path**. `grep -rn 'from "#' test/` → 0 matches |

The single exception to the relative-import rule is one *dynamic* import,
`await import("#init/startBackend.js")` in `test/capabilities/runtime-wiring.test.ts:57` — the only
place in the suite that exercises the alias map, and the only test that touches the composition
root.

**`test/` is never typechecked.** `apps/backend/tsconfig.json`'s `include` is exactly
`["src/**/*.ts"]`, so the 16,502-line test tree is outside both `pnpm typecheck` and `pnpm build`,
and `tsx` strips its types through esbuild without checking them. Two drifts are already sitting in
the tree as a result — see [10-verified-status.md](10-verified-status.md) and
[11-known-issues.md](11-known-issues.md).

Note also that `src/3-capabilities/slides/**` **is** inside `include`, which is why 6,765 lines of
unreachable code are typechecked on every build.

## Toolchain

| Task | Command | What it actually runs |
| --- | --- | --- |
| Dev (all) | `pnpm dev` | `pnpm -r --parallel dev` — shared `tsc -w`, backend `tsx watch`, frontend `vite` |
| Dev (backend) | `pnpm dev:backend` | `tsx --conditions=development watch src/index.ts` |
| Test | `pnpm --filter @icarus/backend test` | `tsx --conditions=development --test --test-concurrency=1 test/capabilities/*.test.ts` |
| Typecheck | `pnpm --filter @icarus/backend typecheck` | `tsc --noEmit -p tsconfig.json` |
| Build | `pnpm --filter @icarus/backend build` | `tsc -p tsconfig.json` → `dist/` (`rootDir: src`, `outDir: dist`) |
| Start | `pnpm --filter @icarus/backend start` | `node dist/index.js` — **no `--conditions`**, so it runs `dist/`. Read the hazard below first |
| Smoke | `pnpm --filter @icarus/backend test:smoke` | `node test/smoke/http-smoke.mjs` — plain `node`, no tsx. **Requires a backend already listening** |
| Clean | `pnpm clean` | `pnpm -r clean` → `rm -rf dist` in each package |

Root-level `pnpm test` is `pnpm -r --if-present test`, which reaches **the backend only** — neither
the frontend nor `packages/shared` defines a `test` script. Root `pnpm typecheck` reaches all three;
note that `packages/shared` sets `composite: true`, so `tsc --noEmit` there still writes
`tsconfig.tsbuildinfo`. Harmless (it is gitignored), but "typecheck writes nothing" is a reasonable
and wrong assumption.

The smoke runner deserves its own warning: it is **not part of `pnpm test`**, it is not a
`node:test` file (it is a straight-line script that throws on the first failed assertion), it makes
41 requests asserting exact status codes against a live server, and **it cleans up nothing** — it
leaves rows in Structured Data, Investigation, Knowledge, Templates and Activity. Point it at a
throwaway `data/`.

Backend dependencies, in full — five at runtime, four for development:

```json
"dependencies":    { "@icarus/shared": "workspace:*", "better-sqlite3": "^13.0.2",
                     "dotenv": "^16.6.1", "fastify": "^5.0.0", "yaml": "^2.8.1" }
"devDependencies": { "@types/better-sqlite3": "^7.6.13", "@types/node": "^22.7.4",
                     "tsx": "^4.19.1", "typescript": "^5.6.3" }
```

There is **no CI configuration anywhere in the repository** — no `.github/`, no pipeline file.
Nothing enforces `pnpm test` or `pnpm typecheck`.

## The Nix dev shell, and how to work without it

The canonical entry, and the one the root `README.md` gives, is correct:

```bash
cd /home/jakul/cyberia/icarus
nix develop            # or: nix develop ./infra/devshell
pnpm install
```

[`infra/devshell/flake.nix`](../../infra/devshell/flake.nix) is a single `mkShell` for
`x86_64-linux` and `aarch64-linux` providing `nodejs_22`, `pnpm`, `nil`, `nixfmt`, `python3`,
`pkg-config`, `jq`, `fx`, `ripgrep`, `bat`, `curl`, `git`, `gh`. Its own comment explains the two
non-obvious entries: `python3` and `pkg-config` are grouped under
`# Native build deps (required for better-sqlite3)`. The `shellHook` prints
`Icarus dev shell ready: node <version>, pnpm <version>`. The root
[`flake.nix`](../../flake.nix) is 195 B and does nothing but re-export it.

**Outside the dev shell, `node` and `pnpm` are usually not on `PATH`.** The workaround is to put a
Nix store path in front of it:

```bash
ls -d /nix/store/*-nodejs-2*/bin/node
# several are present on this machine; the one matching the dev shell is nodejs-22.23.1:
export PATH="/nix/store/l7b3cb5p19qnlykasxwqdggck3ijilqq-nodejs-22.23.1/bin:$PATH"
```

Use the `/bin/node` form shown above rather than a bare `/nix/store/*nodejs-2*/bin` glob, which also
matches `.drv` paths. The store hash is machine-specific; re-run the `ls` rather than copying the
path from this page.

One version subtlety worth knowing before you file a bug about it: the `pnpm` binary on `PATH` comes
from a `pnpm-11.17.0` store path, but `pnpm --version` reports **9.12.0**, because the root
`package.json` pins `"packageManager": "pnpm@9.12.0"` and pnpm self-manages to it. Report the
version pnpm prints, not the one in the store path.

A second gotcha, only relevant if you boot the backend by hand: `node --import tsx` resolves `tsx`
from the *current directory's* package scope, so running from outside the repo fails with
`ERR_MODULE_NOT_FOUND: Cannot find package 'tsx'`. The form that works everywhere passes an absolute
loader path:

```bash
node --conditions=development \
     --import /home/jakul/cyberia/icarus/apps/backend/node_modules/tsx/dist/loader.mjs \
     /home/jakul/cyberia/icarus/apps/backend/src/index.ts
```

## Module resolution: `--conditions=development`

`apps/backend/package.json` has **32 `imports` aliases**, and `apps/backend/tsconfig.json` has a
`paths` map with the same 32 entries, in the same order, with byte-identical targets. Every alias is
a three-way conditional in this declaration order:

```json
"#document": {
  "development": "./src/3-capabilities/document/index.ts",
  "types":       "./src/3-capabilities/document/index.ts",
  "default":     "./dist/3-capabilities/document/index.js"
}
```

Node picks the first matching condition. `types` is a TypeScript-only condition that Node never
activates. So:

| Invocation | Condition matched | Resolves to |
| --- | --- | --- |
| `node …` | `default` | `./dist/**` |
| `node --conditions=development …` | `development` | `./src/**` |
| `tsc` | `types` (and `paths` agrees) | `./src/**` |

Measured in this checkout on 2026-08-09:

```text
$ node --input-type=module -e "console.log(import.meta.resolve('#document'))"
file:///home/jakul/cyberia/icarus/apps/backend/dist/3-capabilities/document/index.js

$ node --conditions=development --input-type=module -e "console.log(import.meta.resolve('#document'))"
file:///home/jakul/cyberia/icarus/apps/backend/src/3-capabilities/document/index.ts
```

**The `development` condition only works under a `.js` → `.ts` resolver.** Wildcard aliases
substitute the specifier verbatim, so `#utils/types/request.js` becomes
`src/0-utils/types/request.js`, which does not exist. Plain Node fails outright:

```text
$ node --conditions=development -e "await import('#utils/types/request.js')"
FAIL ERR_MODULE_NOT_FOUND Cannot find module
  '/home/jakul/cyberia/icarus/apps/backend/src/0-utils/types/request.js'
```

`tsx` rewrites the extension, which is exactly why **every script that passes
`--conditions=development` also runs under `tsx`**. Bare aliases such as `#document` point straight
at an `index.ts` and need no rewrite; the 6 wildcard layer aliases and the 13 wildcard module
aliases do.

### The stale-`dist/` hazard

Drop the flag and you do not get an error — you get *old code*, silently.

In this checkout that is not hypothetical. Measured 2026-08-09:

| Fact | Value |
| --- | --- |
| `dist/index.js` last written | **2026-08-02 11:31:35** |
| `find src -name '*.ts' -newer dist/index.js \| wc -l` | **63** source files are newer |
| `ls dist/3-capabilities` | 12 directories — **no `slides`** |

`pnpm start` runs `node dist/index.js` with no conditions, so today it would boot a week-old binary
that predates every slides commit and 63 other source changes. `dist/` is gitignored, so this is a
local hazard rather than a shipped one — but it is the failure mode that
[`test/capabilities/runtime-wiring.test.ts:33`](../../apps/backend/test/capabilities/runtime-wiring.test.ts)
exists to guard:

```ts
test("the backend dev command selects TypeScript source imports instead of stale dist files", () => {
  assert.match(
    backendPackage.scripts?.dev ?? "",
    /--conditions=(?:types|development)/
  );
});
```

**Note what that guard covers: the `dev` script only.** The `test` script does currently pass
`--conditions=development`, but no assertion requires it to keep doing so, and neither script is
protected by CI because there is none.

## `--test-concurrency=1`, and whether it is required

The shipped test script passes `--test-concurrency=1`. The archived documentation gives a reason for
it — `docs/phase-1/claude-notes/00-orientation.md:75-77` and
`docs/phase-1/claude-notes/08-conventions.md:144` both say the capability suites open real SQLite
files under `data/` and would contend if run in parallel.

**That reason is false, and it appears never to have been true.**

| Check | Result |
| --- | --- |
| `grep -rn "data/" apps/backend/test/` | No test opens anything under `apps/backend/data/`. Every hit is an unrelated string literal or a `#structured-data` import path |
| Where the tests actually put their databases | `mkdtempSync(join(tmpdir(), "icarus-<capability>-"))` in 15 files; `new Database(":memory:")` in `resource-retention.test.ts:26` |
| `git log -S'"./data/' -- apps/backend/test` | No commit ever added a `./data/` path to a test |
| `node:test` process model | Each file runs in its own child process, so interference would require a shared on-disk path |

Empirically, the suite was run 8 times without the flag — three at default concurrency
(`availableParallelism()` = 8) and five at `--test-concurrency=16` — and reported
`# tests 444 # pass 444 # fail 0` every time, in about 1.5 s. With the flag it reports the same
444/444 in about 5.1 s. **The flag costs roughly 3.4× wall clock for a stated rationale that does
not hold.**

What can be said honestly, and is the only defensible argument for keeping it: several tests use
real timers, promise barriers and `durationMs` assertions, so serial execution makes their timing
deterministic and is plausible flake insurance under CPU contention. That is a *different* claim
from the documented one, and it is **unverified** — the suite did not flake in eight parallel runs
on an eight-core machine. It is recorded here as an open question, not as a justification.

## Where the runtime reads and writes

This trips people up because the two halves resolve differently.

| Path | Resolved relative to | Consequence |
| --- | --- | --- |
| `etc/configuration.yaml` | **The module** — `defaultConfigPath = resolve(moduleDir, "../../../etc/configuration.yaml")` (`0-utils/config/loadBackendConfig.ts:261`) | The backend reads the repo's config file no matter what directory it is started from |
| `./data/*.db` | **The process working directory** | Starting from the repo root creates `<repo>/data/`, not `apps/backend/data/`. There is no guard |
| `./logs/backend-YYYY-MM-DD.log` | **The process working directory** | Same |

`apps/backend/data/` and `apps/backend/logs/` in this checkout are gitignored local state left over
from a boot on 2026-08-02; the `data/` directory holds 10 `.db` files, not the 12 the runtime opens,
so do not read it as an inventory. The authoritative list of the 12 is in
[04-state-and-persistence.md](04-state-and-persistence.md). The repo-root `logs/` directory contains
only a `.gitkeep`.

Log files accumulate **one per calendar day, forever**. The retention scheduler governs deleted
*resources*, not logs; nothing prunes `logs/`.

## Configuration, in one line

Everything tunable is in [`apps/backend/etc/configuration.yaml`](../../apps/backend/etc/configuration.yaml)
(212 lines, 13 top-level sections), parsed by
[`0-utils/config/loadBackendConfig.ts`](../../apps/backend/src/0-utils/config/loadBackendConfig.ts)
(653 lines) into a single 14-field `BackendConfig`. There is exactly one environment variable —
`OPENROUTER_API_KEY` — and it only wins when the YAML still holds the literal placeholder.

Read [09-configuration.md](09-configuration.md) before changing any of it. The loader has sharp
edges that the YAML does not hint at: **no numeric tunable can be set to `0`**, an empty or
comment-only config file crashes with a raw `TypeError`, unknown sections are silently ignored,
`logging.level` is never validated (a typo disables level filtering entirely), and `logging.detail`
— the switch that decides whether authored user content is written to the log file — **is not in the
shipped configuration file at all** and defaults to `"content"`.

## Things a first reader will otherwise assume wrongly

| Assumption | Reality | Where it is covered |
| --- | --- | --- |
| The `3-capabilities/slides/` directory is a working capability | 15 files, 6,765 lines, 87 passing tests, **zero endpoints, nothing constructs it** | [07-capabilities/slides.md](07-capabilities/slides.md) |
| `4-job-wiring/formula/` and `/name-manager/` are job wiring | Empty, untracked directories | above |
| `0-platform/database/` is a database platform | One SQLite adapter for Knowledge. No shared `Database`, no migration runner, no pool | [06-platform-services.md](06-platform-services.md) |
| `0-platform/web-retrieval/` is a module | `.gitkeep` plus six doc pages. Zero TypeScript | [06-platform-services.md](06-platform-services.md) |
| `pnpm start` runs the current code | It runs `dist/`, which is from 2026-08-02 here | above |
| A green test suite means the tree compiles | `test/` is not typechecked, and `tsx` erases its types. The composition-root test catches unresolvable *used* imports only — esbuild elides unused and type-only ones | [10-verified-status.md](10-verified-status.md) |
| A failed startup will tell you why | `createConfig()` and `createLogger()` run at `1-init/startBackend.ts:48-49`, **outside** the `try` that opens on line 51, and `src/index.ts:12-14` swallows the error with `.catch(() => { process.exitCode = 1; })`. A misconfigured backend exits 1 with no output on any stream and no log-file entry | [11-known-issues.md](11-known-issues.md) |

## Next

[01-layers-and-boundaries.md](01-layers-and-boundaries.md) — what the six numbered directories mean,
the full alias map, and which import directions the code actually obeys.
