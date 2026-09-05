# Capability Directory Template

**Date:** 2026-08-13
**Scope:** `apps/backend`
**Status:** Implemented. This is the design record as approved; the living
standard is
[`apps/backend/docs/capability-directory/capability-directory.md`](../../../apps/backend/docs/capability-directory/capability-directory.md),
which is what to read and keep current. Four things changed during
implementation and are recorded there rather than here: imports use each
capability's direct alias (`#web-server`) instead of `#capabilities/...`; rule 10
checks the specifiers a file actually imports rather than every declared alias;
`docs/capability/` was dissolved entirely instead of merely being drained; and
the `IdFactory` extraction listed below as a non-goal was subsequently requested
and built as the `platform/id-factory` capability.

## Problem

Four directory conventions coexist in `apps/backend/src/capabilities`, and none
of them is authoritative:

1. **DDD scaffolding** — `application/ domain/ ports/ wire/ persistence/ docs/`,
   present as `.gitkeep`-only directories under thirteen unbuilt capabilities.
2. **Rich Content** — flat `runtime.ts` / `types.ts` / `errors.ts` / `index.ts`
   at the capability root, plus `domain/`, `persistence/`, and
   `runtime-constructors/`. All eleven public methods are inline in
   `runtime.ts`.
3. **Platform** — bare files with no shared shape: `configuration.ts`,
   `database.ts`, `logger.ts`, `runtime.ts`, `context.ts`,
   `register-http-transport.ts`.
4. **The Document plan** — `the Document capability implementation plan`
   already prescribes `types/`, `procedures/<method>/`, `persistence/`,
   `work/endpoints/<name>/wire/`, `registrations/`, and a co-located `test/`.
   It was written for one capability and never generalized.

A reviewer opening a capability cannot predict what they will find, which file
holds the public contract, or where a given behavior is implemented. Tests live
in a flat `apps/backend/test/` that the capability does not own. Design docs are
split across the capability's own `docs/`, `docs/capability/**`, and
`docs/reference/**`.

Only 39 TypeScript files exist today. Standardizing now is cheap; standardizing
after the fifteen planned capabilities are built is not.

## Goals

- One directory vocabulary, used by every capability including platform ones.
- A reviewer can answer "what is public here", "where does method X live", and
  "what does this capability own in the database" by reading directory names.
- Every directory explains itself, in a document that lives inside it.
- Structure violations fail `pnpm lint`, not code review.
- New capabilities start correct via a generator.

## Non-goals

- Restoring the job queue (`queueType`, `responseMode`, `JobScheduler`) from
  `reference/workflows/`. Endpoint-jobs stay inline-executed as they are today.
- Extracting the shared `IdFactory` into `src/shared/identity/`. Deferred so
  this change stays a pure reorganization with no behavior change.
- Building any new capability. Document, project, context, intelligence, and
  the rest remain unimplemented.

## The Template

Capabilities are nested two or three levels deep under `src/capabilities`
(`data/manager`, `resource-support/rich-content`). The template applies to the
leaf directory — the one that owns code — whatever the nesting above it. The
intermediate grouping directories hold nothing but other directories.

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

A directory is **absent** when the capability has nothing for it. There are no
placeholder directories and no `.gitkeep` files. `platform/configuration`
becomes `types/ + runtime-objects/ + docs/ + test/` and nothing else.

These top-level names disappear from `src/capabilities/**`: `runtime.ts`,
`runtime-constructors/`, `domain/`, `application/`, `ports/`, `wire/`,
`projections/`, `procedures/`, `work/`, `registrations/`.

### Directory contracts

**`index.ts`** re-exports the capability's public surface: its runtime object
type, its constructor, its public types, and its error type. Nothing else. It is
the only path another capability may import.

**`errors.ts`** holds the capability's error class and its code union. It sits
at the root rather than in `types/` because a consumer catching an error is
using the public contract.

**`types/`** holds the canonical model and the runtime contract. No Kysely row
shapes, no HTTP shapes, no Fastify types. Private model types live here too;
`index.ts` decides what leaves the capability.

**`runtime-objects/<object-name>/definition.ts`** holds the public interface and
the class implementing it. Each method is a thin delegation to its `runtime-api`
entry. It contains no persistence queries, no algorithms, and no wire decoding.

**`runtime-objects/<object-name>/constructor.ts`** holds `create<Object>()`:
dependency injection, table creation, handler registration. It is the only place
that performs startup work.

**`runtime-api/<method>/`** — one directory per public method on the runtime
object's interface, named after the method in kebab-case, with an entry file of
the same name owning that method's complete orchestration. Supporting procedures
used by only this method sit beside it.

**`runtime-api/shared/`** — a procedure is promoted here once a second method
needs it. Promotion is a deliberate act: the procedure is preserving an
invariant that spans methods, and both call trees stay visible through imports.

**`persistence/`** — storage concerns only. `store.ts` performs ordered reads and
transaction-scoped writes; it does not decide capability behavior. Transactions
are started and coordinated by `runtime-api` entries.

**`endpoints/register.ts`** — the capability's `register<Capability>Endpoints(registry, ...)`
function, called from `main.ts`. It contains registration only: no decoding, no
domain behavior.

**`endpoints/<endpoint-name>/`** — one directory per endpoint, holding `job.ts`
and, when the endpoint accepts input, `wire/`. `job.ts` decodes, dispatches, and
maps expected errors to status codes; it throws on unexpected faults so the
transport logs and returns 500. An endpoint that takes no request body, params,
or query — `GET /health` — has no `wire/`, because there is nothing untrusted to
admit. A
job that merely calls one runtime method has no `procedures/`. A job that
composes work of its own gets `procedures/`, and the presence of that directory
is the review signal that this endpoint does something the runtime object does
not.

**`test/`** — the capability owns its tests. `unit/` mirrors the source
directories it covers. `regression/` holds one file per fixed defect.
`non-functional/` holds performance, concurrency, and resource tests. `bruno/`
is a self-contained Bruno collection with its own `bruno.json`.

### Exported and internal runtime objects

A runtime object is **exported** when `index.ts` re-exports its type and
constructor; other capabilities and `main.ts` hold it. It is **internal** when it
is constructed for injection inside its own capability and never leaves —
Rich Content's ID factory is the only one today.

`runtime-api/` describes the exported object's public methods. An internal
object's methods are implementation detail: it gets a `runtime-objects/`
directory but no `runtime-api/` directories, and the linter's method-to-directory
rule does not apply to it.

A capability exporting two runtime objects gets an object-level directory under
`runtime-api/`: `runtime-api/<object-name>/<method>/`. No capability needs this
today; the rule exists so the first one that does is not a redesign.

### Outside a capability

Cross-capability infrastructure lives in `src/shared/` (for example a shared
`IdFactory`). `src/registry/` holds the endpoint registry itself. `src/main.ts`
constructs runtime objects and calls each capability's `register*Endpoints`.

## Naming and import rules

- Every directory and `.ts` file under `src/` is kebab-case. This renames
  `echoCapability.ts` and `healthCapability.ts`.
- A `runtime-api/<method>/` directory name is the kebab-case form of the
  interface method it implements, and contains a file of the same name.
- A `runtime-objects/<object>/` directory contains exactly `definition.ts` and
  `constructor.ts`.
- Cross-capability imports target `#capabilities/<path>/index.js` only. Deep
  imports into another capability's internals are a lint failure. This is the
  rule that makes "review one directory" true.
- Imports within a capability continue to use the `#capabilities/*` alias, per
  the existing no-relative-imports rule.

## Endpoint-job naming

`RouteWork` is renamed `EndpointJob` and `RouteResponse` becomes
`EndpointJobResponse` in `src/registry/registry.ts`, so the directory name, the
prose, and the type agree. `RouteRegistry.register(endpoint, job)` keeps its
class name. This matches the vocabulary in `reference/workflows/registry.ts`,
where the same map held `JobFactory` values.

`src/registry/registrations/built-in.ts` is deleted; registration moves into the
capability that owns the endpoint (`capabilities/built-in/endpoints/register.ts`),
and `createRegistry()` calls it.

## Documentation

Documentation is part of the structure, not a parallel tree. **Every directory
carries a document named after itself, sitting inside it.** The capability's own
document is `overview.md` at its root; below that, `types/types.md`,
`runtime-api/apply-style/apply-style.md`, and so on.

Two exemptions: nothing under `test/` carries a document, and `wire/` does not —
its request, decode, and response files are described by the endpoint's own
document. The `docs/` directory is itself the exemption's third case; it holds
supporting documents and needs no document about documents.

`docs/` keeps only material that belongs to no single directory: a revision
model, a migration note, an algorithm derivation. Anything describing what a
directory contains belongs in that directory.

### What each document holds

The existing `capability-overview-template.md` packs all of this into one file.
The template set **splits** it rather than duplicating it:

| Document | Content, taken from the current overview template |
| --- | --- |
| `overview.md` | Description, file tree, dependency ports, the runtime objects table, the public API table, the data ownership table, capability invariants |
| `types/types.md` | The Types section: each public type and what it means |
| `runtime-objects/runtime-objects.md` | Which objects exist, which are exported, how they relate |
| `runtime-objects/<object>/<object>.md` | Runtime Object Details: what it owns and deliberately does not, fields, constructor parameters, construction steps |
| `runtime-api/runtime-api.md` | The method inventory and the shared-procedure promotion rule as applied here |
| `runtime-api/<method>/<method>.md` | API Details: classification, inputs, output, effects, procedure tree, supporting functions |
| `runtime-api/shared/shared.md` | Each shared procedure, the invariant it preserves, and which methods depend on it |
| `persistence/persistence.md` | Data ownership in detail: tables, columns, revision gates, transaction boundaries |
| `endpoints/endpoints.md` | The endpoint surface table, the error body shape, endpoint invariants |
| `endpoints/<endpoint>/<endpoint>.md` | Request and response shapes, admission rules, the work procedure, status mapping |
| `endpoints/<endpoint>/procedures/procedures.md` | Why this job composes work of its own rather than calling a runtime method |

A document states what its directory is for and what belongs in it. It does not
restate the code.

### Template directory

`apps/backend/docs/capability-directory/templates/` holds one template per document kind, plus a
`README.md` mapping each template to its destination and the name it takes
there:

| Template | Copy to | Named |
| -------- | ------- | ----- |
| `overview.md` | capability root | `overview.md` |
| `types.md` | `types/` | `types.md` |
| `runtime-objects.md` | `runtime-objects/` | `runtime-objects.md` |
| `runtime-object.md` | `runtime-objects/<object>/` | `<object>.md` |
| `runtime-api.md` | `runtime-api/` | `runtime-api.md` |
| `runtime-api-method.md` | `runtime-api/<method>/` | `<method>.md` |
| `runtime-api-shared.md` | `runtime-api/shared/` | `shared.md` |
| `persistence.md` | `persistence/` | `persistence.md` |
| `endpoints.md` | `endpoints/` | `endpoints.md` |
| `endpoint.md` | `endpoints/<endpoint>/` | `<endpoint>.md` |
| `endpoint-procedures.md` | `endpoints/<endpoint>/procedures/` | `procedures.md` |

It also holds `reviewing-a-capability.md`, the review checklist below.

The generators copy from here, so a new capability, method, or endpoint arrives
with every required document already stubbed in the right place.

**These twelve files plus the README are written.** They exist at
`apps/backend/docs/capability-directory/templates/` and are the concrete artifact to review before
approving this spec — the structure is only as good as the documents it
demands.

### Migrating existing docs

Three sources merge into the new structure:

- `docs/capability/<mirror path>/*.md` — current designs for Data Manager,
  Observability, Web Server, Rich Content, and Document. Their content is
  distributed into the per-directory documents above; what does not fit a
  directory lands in that capability's `docs/`.
- `src/capabilities/**/docs/{README,concepts,flows,invariants,runtime,types}.md`
  — thirteen legacy six-file sets describing the *archived* implementation in
  `reference/` — move to `docs/reference/capabilities/<path>/`. This is the
  convention already applied to Rich Content and recorded in
  `docs/reference/README.md`.
- `docs/capability/capability-overview-template.md` is the source material for
  the whole template set. Its sections are split across the eleven templates per
  the table above; the file itself is removed once they exist. `docs/capability/`
  is then empty and deleted.

`docs/procedures/` stays where it is: it describes cross-capability lifecycle,
not one capability. Its links into `src/` break during migration and must be
repaired; `01-initialization.md` alone references eight source paths that move.

### Designed but unbuilt capabilities

A capability directory exists as soon as a design exists, containing `docs/` and
nothing else. This gives Document's eight design documents a home and makes the
roadmap visible in the tree. Scaffolding with no design — the `.gitkeep`
directories under `agentic/`, `collaboration/`, `investigation/`, `knowledge/`,
`resources/`, `workspace/` — is deleted.

## Test tooling

- `pnpm test` currently globs `test/*.test.ts` and must become recursive over
  `src/capabilities/**/test/**/*.test.ts`.
- `apps/backend/test/rich-content.test.ts` and `test/data-manager.test.ts` move
  into their capabilities' `test/unit/`. The top-level `test/` directory is
  removed.
- `pnpm test:bruno` iterates every `src/capabilities/**/test/bruno/` collection
  and runs it against a booted backend. Bruno is not currently a dependency
  anywhere in the repository; adding the CLI is part of this work.
- Each capability's `bruno/` needs its own `bruno.json`, because a Bruno
  collection is rooted at the directory containing that file.

## Enforcement

`scripts/lint-paths.mjs` already enforces the README's path rules with no
dependencies and runs under `pnpm lint`. Structure rules are added to it:

1. Only these names appear directly under a capability directory: `docs`,
   `types`, `runtime-objects`, `runtime-api`, `persistence`, `endpoints`,
   `test`.
2. Only `overview.md`, `index.ts`, and `errors.ts` appear as files at a
   capability root.
3. `runtime-objects/<object>/` contains exactly `<object>.md`, `definition.ts`,
   and `constructor.ts`.
4. `persistence/` contains only `persistence.md`, `schema.ts`,
   `stored-types.ts`, and `store.ts`.
5. Every `runtime-api/<method>/` other than `shared/` contains an entry file
   matching its directory name.
6. For each runtime object exported from `index.ts`, every method declared on
   its interface has a matching `runtime-api/` directory, and every directory
   has a matching method. Internal runtime objects are exempt. Implemented as a
   regex over the interface block in `definition.ts` — best-effort, not
   type-aware, and documented as such in the script.
7. `endpoints/` contains `register.ts`; every other entry is a directory
   containing `job.ts`, and any other entry in it is `wire/` or `procedures/`.
8. Every directory and `.ts` file under `src/` is kebab-case.
9. No import crosses a capability root except to that capability's `index.js`.
10. Every alias import specifier a file actually uses resolves to a file on
    disk. Aliases that are declared but unused are forward declarations for
    planned capabilities and are allowed to point nowhere; the check applies the
    moment something imports one. This is the rule that catches a directory
    renamed without rewriting its importers — the failure mode that left 72 dead
    specifiers behind while lint still reported "39 files clean".
11. `*.test.ts` files appear only under a capability's `test/`.
12. Every directory under a capability contains a `.md` file named after it —
    `types/types.md`, `runtime-api/split/split.md`. The capability root's is
    `overview.md`. Exempt: `test/` and everything below it, `wire/`, and
    `docs/`.
13. A `.md` file under a capability sits either in the directory it is named
    after or in `docs/`. This catches a document left behind after its
    directory is renamed.

Each rule reports `path  message` in the existing failure format.

## Scaffolding

`pnpm new-capability <path/to/name> [--persisted] [--endpoints]` — where the
path is relative to `src/capabilities`, e.g. `resource-general/slide` — creates:

- `overview.md`, `index.ts`, and `errors.ts` with the capability's name filled
  in;
- `types/{types.md,ids.ts}`;
- `runtime-objects/{runtime-objects.md,<name>/{<name>.md,definition.ts,constructor.ts}}`;
- `test/{unit,regression,non-functional}/` and `test/bruno/bruno.json`;
- `persistence/` only with `--persisted`, `endpoints/` only with `--endpoints`.

Every document is copied from `docs/capability-directory/templates/` with its placeholders
substituted, so a generated capability passes rules 12 and 13 immediately.

Because a runtime-api method now costs three files and an endpoint four, two
smaller generators come with it:

- `pnpm new-runtime-api <capability-path> <methodName>` — creates
  `runtime-api/<method>/{<method>.md,<method>.ts}` and reminds you to declare
  the method on the interface, which rule 6 will otherwise catch.
- `pnpm new-endpoint <capability-path> <endpoint-name>` — creates
  `endpoints/<name>/{<name>.md,job.ts,wire/}` and the `register.ts` line.

All three create no empty directories, since the template says an unused
directory is absent. They are dependency-free Node scripts beside
`lint-paths.mjs`.

## Migration

Every existing capability moves. Runtime behavior is unchanged throughout,
verified by the existing tests continuing to pass. Two public *shapes* change,
both deliberately: `registerHttpTransport` becomes a method on the Web Server
runtime object, and `RouteWork` is renamed `EndpointJob`.

| Capability | Migration |
| --- | --- |
| `resource-support/rich-content` | `runtime.ts` splits into `runtime-objects/rich-content/definition.ts` plus eleven `runtime-api/` directories (`create`, `replace-text`, `apply-style`, `remove-style`, `set-link`, `remove-link`, `set-list`, `remove-list`, `split`, `combine-as-list`, `display`). `runtime-constructors/rich-content.ts` → `constructor.ts`; `runtime-constructors/id-factory.ts` becomes a second runtime object, `runtime-objects/id-factory/{definition,constructor}.ts`, still owned by the capability. `domain/model.ts` splits: the `RawContent` type to `types/`, `createRawContent` to `runtime-api/shared/`. `domain/display-range.ts` and `domain/ranges.ts` → `runtime-api/shared/`. `domain/mutations/style.ts` and `link.ts` and `list.ts` → `runtime-api/shared/` (two methods each). `domain/mutations/replace-text.ts`, `split-content.ts`, `combine-as-list.ts`, `domain/render-display.ts` → their single method's directory. `persistence/` keeps `store.ts`, gains `stored-types.ts`. |
| `data/manager` | `manager.ts` → `runtime-objects/manager/definition.ts`; `runtime-constructors/manager.ts` → `constructor.ts`; `types.ts` → `types/`; `errors.ts` stays; legacy `docs/` → `docs/reference/`; design doc from `docs/capability/data/manager/` → `docs/`. |
| `platform/configuration` | `configuration.ts` splits into `types/` and `runtime-objects/configuration/{definition,constructor}.ts`. |
| `platform/persistence` | `database.ts` splits into `runtime-objects/database/{definition,constructor}.ts`. |
| `platform/observability` | `runtime.ts` + `logger.ts` → `types/logger.ts` and `runtime-objects/observability/{definition,constructor}.ts`; `runtime-constructors/observability.ts` folds into `constructor.ts`. |
| `platform/web-server` | `context.ts` → `types/`; `errors.ts` stays; `runtime-constructors/fastify.ts` → `runtime-objects/web-server/constructor.ts`; `register-http-transport.ts` becomes the runtime-api method `register-transport/`, so the capability exposes one runtime object instead of a loose exported function. |
| `built-in` | No runtime object. `echoCapability.ts` and `healthCapability.ts` become `endpoints/echo/job.ts` and `endpoints/health/job.ts`; `endpoints/register.ts` replaces `src/registry/registrations/built-in.ts`. |
| Unbuilt, with a design | `resource-general/document` keeps only `docs/`, receiving its eight design documents from `docs/capability/`. |
| Unbuilt, no design | Deleted: the `.gitkeep` trees under `agentic/`, `collaboration/`, `data/formula`, `investigation/`, `knowledge/`, `platform/intelligence`, `resources/`, `workspace/`. Their legacy docs move to `docs/reference/capabilities/`. |

`src/main.ts` and `docs/procedures/01-initialization.md` are updated last, once
every path is settled.

## Review checklist

The payoff. Written to `docs/capability-directory/reviewing-a-capability.md` and linked
from `apps/backend/README.md`:

1. `overview.md` describes the boundary, the runtime objects, the public API,
   and the invariants — and every directory's document says what that directory
   is for without restating its code.
2. Every method on the runtime interface has exactly one `runtime-api/`
   directory, and no directory lacks a method.
3. `definition.ts` methods are delegations only — no queries, no algorithms.
4. Procedures in `runtime-api/shared/` are used by more than one method.
5. `persistence/` contains storage only; transactions are coordinated by
   `runtime-api` entries.
6. `endpoints/*/procedures/` exists only where the endpoint genuinely composes
   work the runtime object does not offer.
7. `index.ts` exports the intended surface, and no external file imports past
   it.
8. `types/` contains no Kysely or Fastify shapes.
9. Each public method has coverage in `test/unit/`, each fixed defect a file in
   `test/regression/`, each endpoint a request in `test/bruno/`.

## Trade-offs

**Rich Content becomes eleven directories holding one short file each.** Its
methods are five-line orchestrations over a shared model, so the per-method
directory rule buys less there than it will for Document's twenty-plus
procedures. This is the largest cost of the standard and it is paid mostly by
one capability.

**`runtime-api/shared/` is close to the `domain/` directory being removed.** The
difference is placement and justification: it sits inside the tree it serves, and
a file arrives there only after a second method needs it, rather than by default.

**Rule 6 in the linter is regex-based.** A type-aware check would need the
TypeScript compiler API, which `lint-paths.mjs` deliberately avoids. Method
renames done sloppily can defeat it; the review checklist covers the gap.

**The diff is large and touches every source file.** It is mechanical and
behavior-preserving, but it will conflict with any concurrent capability work.

**Per-directory documents cost 19 files for Rich Content alone** — overview,
types, runtime-objects plus two objects, runtime-api plus shared plus eleven
methods, and persistence. Eleven of those are method documents, so the cost
tracks the per-method rule rather than the documentation rule. The linter can
require a document to exist; it cannot require it to be worth reading, and a
stale document is worse than none. The mitigation is that a method document sits
in the same directory as the method it describes, so a reviewer looking at the
change sees the document that contradicts it.

## Verification

- `pnpm lint` passes, including every new structure rule.
- `pnpm typecheck` passes.
- `pnpm test` passes with both existing test files relocated, and the recursive
  glob actually finds them.
- The backend boots and `GET /health` and `POST /echo` respond as before.
- `pnpm test:bruno` runs at least one collection against the booted backend.
- `pnpm new-capability`, `pnpm new-runtime-api`, and `pnpm new-endpoint` each
  produce output that passes `pnpm lint`.
- Every document required by rules 12 and 13 exists and has been written, not
  left as an unsubstituted template.
