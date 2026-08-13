# Capability Directory Re-Design

**Status:** Adopted. Every built capability is on the template, and `pnpm lint`
enforces it. This document is the standard, not a proposal — read it before
adding a capability, a runtime method, or an endpoint.
**Design record:** [`docs/superpowers/specs/2026-08-13-capability-directory-template-design.md`](../../../../docs/superpowers/specs/2026-08-13-capability-directory-template-design.md)
**Document templates:** [`docs/capability-directory/templates/`](templates/templates.md)

## Why

Four directory conventions coexist under `src/capabilities`, and none is
authoritative:

1. **DDD scaffolding** — `application/ domain/ ports/ wire/ persistence/ docs/`,
   present as `.gitkeep`-only directories under thirteen unbuilt capabilities.
2. **Rich Content** — flat `runtime.ts` / `types.ts` / `errors.ts` / `index.ts`
   at the capability root, plus `domain/`, `persistence/`, and
   `runtime-constructors/`. All eleven public methods sit inline in
   `runtime.ts`.
3. **Platform** — bare files with no shared shape: `configuration.ts`,
   `database.ts`, `logger.ts`, `context.ts`, `register-http-transport.ts`.
4. **The Document plan** —
   [`document/docs/implementation-plan.md`](../../src/capabilities/resource-general/document/docs/implementation-plan.md)
   already prescribes most of this template, written for one capability and
   never generalized.

A reviewer opening a capability cannot predict what they will find, which file
holds the public contract, or where a behavior is implemented. Thirty-nine
TypeScript files exist today. Standardizing now is cheap.

## The Template

Capabilities are nested two or three levels deep (`data/manager`,
`resource-support/rich-content`). The template governs the leaf directory — the
one that owns code. Directories above it hold nothing but other directories.

```text
src/capabilities/<...>/<capability>/
├── overview.md                     # the capability's own document
├── index.ts                        # the only file other capabilities import
├── errors.ts                       # error type + codes; part of the public contract
├── docs/                           # supporting docs not tied to one directory
│   └── <supporting-doc>.md
├── types/
│   ├── types.md
│   ├── ids.ts
│   ├── <aggregate>.ts              # canonical model, public and private
│   ├── runtime-inputs.ts
│   └── runtime-results.ts
├── runtime-objects/
│   ├── runtime-objects.md
│   └── <object-name>/
│       ├── <object-name>.md
│       ├── definition.ts           # public interface + implementing class
│       └── constructor.ts          # create<Object>(); dependency wiring, startup work
├── runtime-api/
│   ├── runtime-api.md
│   ├── shared/                     # procedures more than one method needs
│   │   ├── shared.md
│   │   └── <procedure>.ts
│   └── <public-method-name>/
│       ├── <public-method-name>.md
│       ├── <public-method-name>.ts # entry; owns that method's whole procedure
│       └── <supporting-procedure>.ts
├── persistence/
│   ├── persistence.md
│   ├── schema.ts                   # table definitions + initialization
│   ├── stored-types.ts             # rows as stored, distinct from types/
│   └── store.ts                    # the table interface
├── endpoints/
│   ├── endpoints.md
│   ├── register.ts                 # registry.register(endpoint, job) for every endpoint
│   └── <endpoint-name>/
│       ├── <endpoint-name>.md
│       ├── job.ts
│       ├── wire/                   # no document; described by the endpoint's doc
│       │   ├── request.ts
│       │   ├── decode.ts
│       │   └── response.ts
│       └── procedures/             # only when the job is not a pass-through
│           ├── procedures.md
│           └── <sub-procedure>.ts
└── test/                           # no documents below here
    ├── unit/
    ├── regression/
    ├── non-functional/
    └── bruno/
        ├── bruno.json
        └── <request>.bru
```

**A directory is absent when the capability has nothing for it.** No placeholder
directories, no `.gitkeep`. `platform/configuration` becomes `types/ +
runtime-objects/ + docs/ + test/` and nothing else. Platform capabilities use
the same vocabulary as everything else, so a directory name means one thing
wherever it appears.

These names disappear from `src/capabilities/**`: `runtime.ts`,
`runtime-constructors/`, `domain/`, `application/`, `ports/`, `wire/` (as a
top-level directory), `projections/`, `procedures/` (as a top-level directory),
`work/`, `registrations/`.

## Directory Contracts

**`index.ts`** re-exports the public surface: runtime object types, constructors,
public types, the error type. Nothing else. It is the only path another
capability may import.

**`errors.ts`** holds the error class and code union. It sits at the root, not in
`types/`, because a consumer catching an error is using the public contract.

**`types/`** holds the canonical model and the runtime contract. No Kysely row
shapes, no HTTP or Fastify shapes. Private model types live here too; `index.ts`
decides what leaves.

**`runtime-objects/<object>/definition.ts`** holds the public interface and the
class implementing it. Each method is a thin delegation to its `runtime-api`
entry — no persistence queries, no algorithms, no wire decoding.

**`runtime-objects/<object>/constructor.ts`** holds `create<Object>()`. It is the
only place that performs startup work.

**`runtime-api/<method>/`** — one directory per public method, named after the
method in kebab-case, with an entry file of the same name owning that method's
complete orchestration. Supporting procedures used by only that method sit
beside it.

**`runtime-api/shared/`** — a procedure is promoted here once a second method
needs it. Promotion means it preserves an invariant spanning methods, not merely
that two call sites wanted the same code.

**`persistence/`** — storage only. `store.ts` performs ordered reads and
transaction-scoped writes; it does not decide capability behavior. Transactions
are started and coordinated by `runtime-api` entries.

**`endpoints/register.ts`** — the capability's
`register<Capability>Endpoints(registry, ...)`, called from `main.ts`.
Registration only.

**`endpoints/<endpoint>/`** — `job.ts`, and `wire/` when the endpoint admits
input. `GET /health` takes no body, params, or query, so it has no `wire/`. A job
that merely calls one runtime method has no `procedures/`; a job that composes
work of its own gets one, and that directory's presence is the review signal.

**`test/`** — the capability owns its tests. `unit/` mirrors the source
directories it covers, `regression/` holds one file per fixed defect,
`non-functional/` holds performance and concurrency tests, `bruno/` is a
self-contained collection with its own `bruno.json`.

### Exported and internal runtime objects

A runtime object is **exported** when `index.ts` re-exports its type and
constructor. It is **internal** when constructed for injection inside its own
capability and never leaves — Rich Content's ID factory is the only one today.

`runtime-api/` describes an exported object's public methods. An internal object
gets a `runtime-objects/` directory but no `runtime-api/` directories, and the
method-to-directory lint rule does not apply to it.

A capability exporting two runtime objects gets an object-level directory:
`runtime-api/<object-name>/<method>/`. Nothing needs this today.

## Documentation Is Part of the Structure

**Every directory carries a document named after itself, sitting inside it.** The
capability's own document is `overview.md` at its root; below that,
`types/types.md`, `runtime-api/apply-style/apply-style.md`, and so on.

Exempt: everything under `test/`, `wire/`, and `docs/` itself.

`docs/` keeps only material belonging to no single directory — a revision model,
an algorithm derivation, a migration note. Anything describing what a directory
contains belongs in that directory.

Templates for all eleven document kinds are in
[`docs/capability-directory/templates/`](templates/templates.md), which maps each template to its
destination and the name it takes there. They were split out of the former
`docs/capability/capability-overview-template.md`, which packed all of it into
one file: its sections are distributed across the set rather than duplicated, so
`overview.md` keeps orientation — boundary, file tree, dependency ports, and the
runtime-object, public-API, and data-ownership tables — while the detail lives in
the document for the directory it describes.

`docs/capability/` no longer exists. Every design it held now lives inside the
capability it describes; the superseded overviews remain in git history at the
commit that adopted the template.

## Naming and Import Rules

- Every directory and `.ts` file under `src/` is kebab-case. This renames
  `echoCapability.ts` and `healthCapability.ts`.
- A `runtime-api/<method>/` directory is the kebab-case form of the interface
  method it implements, and contains a file of the same name.
- A `runtime-objects/<object>/` directory contains exactly `<object>.md`,
  `definition.ts`, and `constructor.ts`.
- **Every capability owns a direct alias.** `#web-server` is its `index.ts`;
  `#web-server/...` reaches inside it. `#capabilities/...` is never used, and
  lint rejects it with the exact alias to use instead.
- **Cross-capability imports use the bare alias only** — `#web-server`, not
  `#web-server/runtime-objects/...`. Reaching into another capability's
  internals fails lint. This is the rule that makes "review one directory" true.
- Imports within a capability use its own subpath alias, so the grouping
  directory appears in no import. A capability can move between
  `resource-support/` and `resource-general/` without touching a single line of
  its own code — which is precisely what broke when the groups were last
  renamed and 72 specifiers were left pointing at the old paths.

One exception exists, and it is structural rather than stylistic: a
`declare module` block for Kysely declaration merging must name the module that
declares the interface, so `rich-content/persistence/schema.ts` targets
`#persistence/types/database.js` rather than the index.

`#config-files/*` serves the YAML configuration directory. It was renamed from
`#configuration/*`, which now belongs to the configuration capability like every
other capability's alias.

## Endpoint-Job Naming

`RouteWork` becomes `EndpointJob` and `RouteResponse` becomes
`EndpointJobResponse` in [`src/registry/registry.ts`](../../src/registry/registry.ts),
so the directory name, the prose, and the type agree. This matches the
vocabulary in [`reference/workflows/registry.ts`](../../../../reference/workflows/registry.ts),
where the same map held `JobFactory` values.

`src/registry/registrations/built-in.ts` is deleted; registration moves into the
capability owning the endpoint, and `createRegistry()` calls it.

## Generators

Three dependency-free Node scripts beside
[`scripts/lint-paths.mjs`](../../scripts/lint-paths.mjs). Each copies from
`docs/capability-directory/templates/` with placeholders substituted, so generated output passes lint
immediately. None of them creates an empty directory — the template says an
unused directory is absent, and a generator that violated that would train
people to ignore it.

### `pnpm new-capability <path/to/name> [--persisted] [--endpoints]`

The path is relative to `src/capabilities`, e.g. `resource-general/slide`.

```text
slide/
├── overview.md                     # from templates/overview.md
├── index.ts
├── errors.ts
├── types/
│   ├── types.md                    # from templates/types.md
│   └── ids.ts
├── runtime-objects/
│   ├── runtime-objects.md
│   └── slide/
│       ├── slide.md                # from templates/runtime-object.md
│       ├── definition.ts
│       └── constructor.ts
└── test/
    ├── unit/
    ├── regression/
    ├── non-functional/
    └── bruno/bruno.json
```

`--persisted` adds `persistence/` with its four files. `--endpoints` adds
`endpoints/` with `endpoints.md` and `register.ts`. `runtime-api/` is not
generated — it arrives with the first method.

The script also prints the two follow-up edits it cannot make: adding the
capability's construction to `src/main.ts`, and its alias to `package.json`
imports and `tsconfig.json` paths if it needs one.

### `pnpm new-runtime-api <capability-path> <methodName>`

Takes the method name in camelCase as it will appear on the interface, and
creates its kebab-case directory:

```text
runtime-api/
├── runtime-api.md                  # created if absent
└── apply-style/
    ├── apply-style.md              # from templates/runtime-api-method.md
    └── apply-style.ts              # entry stub delegating from the interface
```

It does not edit `definition.ts`. Declaring the method on the interface is the
author's decision about the public contract, and lint rule 6 catches the
omission either way.

### `pnpm new-endpoint <capability-path> <endpoint-name> [--no-wire]`

```text
endpoints/
├── endpoints.md                    # created if absent
├── register.ts                     # registration line appended
└── documents-command/
    ├── documents-command.md        # from templates/endpoint.md
    ├── job.ts
    └── wire/
        ├── request.ts
        ├── decode.ts
        └── response.ts
```

`--no-wire` omits `wire/` for an endpoint that admits no input. `procedures/` is
never generated: a job starts as a pass-through, and the directory arrives only
when someone decides the job composes work of its own — a decision that should
cost a deliberate `mkdir` and a written justification in
`procedures/procedures.md`.

## Lint Rules

`pnpm lint` runs two dependency-free Node scripts, both reporting in the same
`path  message` format:

- [`scripts/lint-paths.mjs`](../../scripts/lint-paths.mjs) — how files refer to each
  other: no relative imports, no `import.meta.url` outside `paths.ts`, the two
  alias maps agree, and every alias import resolves on disk (rules 9–11).
- [`scripts/lint-structure.mjs`](../../scripts/lint-structure.mjs) — the shape of a
  capability: rules 1–8, 12, and 13.

They are separate because they answer different questions and are read at
different times. `lint-structure.mjs` carries a `MIGRATED` list of the
capabilities already on the template, so the rules are enforced from the first
migration onward rather than only after the last; a capability is appended as its
migration lands, and the list is deleted once the whole tree conforms.

| # | Rule | Catches |
| - | ---- | ------- |
| 1 | Only `docs`, `types`, `runtime-objects`, `runtime-api`, `persistence`, `endpoints`, `test` appear directly under a capability | A returning `domain/` or `application/` |
| 2 | Only `overview.md`, `index.ts`, `errors.ts` appear as files at a capability root | A `runtime.ts` creeping back to the root |
| 3 | `runtime-objects/<object>/` contains exactly `<object>.md`, `definition.ts`, `constructor.ts` | Construction logic spreading into extra files |
| 4 | `persistence/` contains only `persistence.md`, `schema.ts`, `stored-types.ts`, `store.ts` | Capability behavior hiding in the persistence directory |
| 5 | Every `runtime-api/<method>/` except `shared/` contains an entry file matching its directory name | A method directory whose entry point is unclear |
| 6 | For each runtime object exported from `index.ts`, every interface method has a `runtime-api/` directory and every directory has a method | A method implemented inline in `definition.ts`, or a directory orphaned by a rename |
| 7 | `endpoints/` contains `register.ts`; every other entry is a directory containing `job.ts`, and its only other entries are `wire/` and `procedures/` | Endpoint logic accumulating loose beside registration |
| 8 | Every directory and `.ts` file under `src/` is kebab-case | `echoCapability.ts` |
| 9 | No `#capabilities/...` specifier; every import uses the capability's direct alias | An import that spells out the grouping directory, and so breaks when groups are renamed |
| 10 | Every alias import specifier that a file actually uses resolves to a file on disk | A directory renamed without rewriting its importers |
| 11 | `*.test.ts` files appear only under a capability's `test/` | A test file left beside the code it covers |
| 12 | Every directory under a capability contains a `.md` named after it; root's is `overview.md`. Exempt: `test/**`, `wire/`, `docs/` | An undocumented directory |
| 13 | A `.md` under a capability sits either in the directory it is named after, or in `docs/` | A document orphaned when its directory was renamed |

Example output:

```text
src/capabilities/resource-support/rich-content/domain  unknown capability directory 'domain' — see docs/capability-directory/capability-directory.md
src/capabilities/resource-support/rich-content/runtime-api/split  missing document 'split.md'
src/capabilities/data/manager/manager.ts  only overview.md, index.ts, and errors.ts belong at a capability root
package.json  imports declares "#formula", which resolves to src/capabilities/formula/index.ts — no such path
```

### Two caveats

**Rule 6 is regex-based.** It reads the exported interface block in
`definition.ts` and compares method names to directory names. A type-aware check
would need the TypeScript compiler API, which `lint-paths.mjs` deliberately
avoids having any dependency on. Sloppy renames can defeat it; the
[review checklist](reviewing-a-capability.md) covers the gap.

**Rule 12 can require a document to exist; it cannot require it to be worth
reading.** A stale document is worse than none. The mitigation is placement: a
method's document sits in the same directory as the method, so a reviewer
reading the change sees the document that contradicts it.

### Forward-declared aliases

The alias map declares one alias per capability, including twenty-six —
`#document`, `#comments`, `#slide`, `#connector` and the rest, plus
`#workflows/*` and `#shared/*` — whose `index.ts` does not exist yet. These are
forward declarations for planned capabilities, not rot, so rule 10 checks the
specifiers that files **actually import**, not every alias that is declared.

An unused alias pointing nowhere is allowed. The moment a file imports it, it
must resolve. The trade-off is deliberate: a typo in an alias nobody uses stays
invisible until first use, and in exchange the map stays a readable roadmap of
what is planned.

Rule 3 — the pre-existing check that `package.json` and `tsconfig.json` declare
the same alias keys — is what let a real breakage hide: it compares the two maps
to each other, never to the filesystem. Rule 10 closes that.

## Test Tooling

- `pnpm test` globs `test/*.test.ts` today and becomes recursive over
  `src/capabilities/**/test/**/*.test.ts`.
- `test/rich-content.test.ts` and `test/data-manager.test.ts` move into their
  capabilities' `test/unit/`. The top-level `test/` directory is removed.
- `pnpm test:bruno` iterates every `src/capabilities/**/test/bruno/` collection
  against a booted backend. Bruno is not currently a dependency anywhere in the
  repository; adding the CLI is part of this work.
- Each capability's `bruno/` needs its own `bruno.json`, because a collection is
  rooted at the directory containing that file.

## What Changed for Existing Capabilities

This is the record of the migration, kept because it explains why several files
are where they are. Runtime behavior was unchanged throughout, verified by the
existing tests. Two public shapes changed deliberately:
`registerHttpTransport` becomes a method on the Web Server runtime object, and
`RouteWork` is renamed `EndpointJob`.

| Capability | Change |
| --- | --- |
| `resource-support/rich-content` | `runtime.ts` splits into `runtime-objects/rich-content/definition.ts` plus eleven `runtime-api/` directories. `domain/` distributes: the `RawContent` type to `types/`; `display-range.ts`, `ranges.ts`, and the style, link, and list mutations to `runtime-api/shared/` (two or more methods each); `replace-text.ts`, `split-content.ts`, `combine-as-list.ts`, `render-display.ts` into their single method's directory. The ID factory becomes an internal runtime object. |
| `data/manager` | `manager.ts` → `runtime-objects/manager/definition.ts` plus four `runtime-api/` directories (`define`, `get`, `require`, `list`) — rule 6 requires one per interface method, so this is not the mechanical file move it first appeared to be. `types.ts` splits into `types/`. Its ~300-line admission tree stays whole in `define/`: it is large, but it has exactly one caller. |
| `platform/configuration`, `persistence`, `observability` | Flat files split into `types/` and `runtime-objects/<name>/{definition,constructor}.ts`. |
| `platform/web-server` | Same, plus `register-http-transport.ts` becomes the runtime-api method `register-transport/`. |
| `built-in` | No runtime object. `echoCapability.ts` and `healthCapability.ts` become `endpoints/echo/job.ts` and `endpoints/health/job.ts`, with `endpoints/register.ts` replacing `src/registry/registrations/built-in.ts`. |
| `resource-general/document` | Designed, unbuilt. Keeps only `docs/`, receiving its eight design documents. |
| Unbuilt, no design | The `.gitkeep` trees under `agentic/`, `collaboration/`, `data/formula`, `investigation/`, `knowledge/`, `platform/intelligence`, `resources/`, `workspace/` are deleted; their legacy documentation moves to `docs/reference/capabilities/`. |

A capability directory exists as soon as a design exists, containing `docs/` and
nothing else. Scaffolding with no design is deleted.

`src/main.ts` and [`src/initialization.md`](../../src/initialization.md)
are updated last, once every path is settled — the latter references eight source
paths that move.

## Reviewing

[`docs/capability-directory/reviewing-a-capability.md`](reviewing-a-capability.md)
is the checklist. Its first section is entirely machine-checked, so a green
`pnpm lint` lets a reviewer skip to the judgment items: whether a document says
anything, whether a `shared/` procedure really has two callers, whether an
endpoint's `procedures/` directory is justified.

## Verification

- `pnpm lint` passes, including every new structure rule.
- `pnpm typecheck` passes.
- `pnpm test` passes with both existing test files relocated, and the recursive
  glob actually finds them.
- The backend boots; `GET /health` and `POST /echo` respond as before.
- `pnpm test:bruno` runs at least one collection against the booted backend.
- Each generator produces output that passes `pnpm lint`.
- Every document required by rules 12 and 13 has been written, not left as an
  unsubstituted template.
