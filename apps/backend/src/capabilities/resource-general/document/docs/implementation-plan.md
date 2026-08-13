# Document Implementation Plan

> **Rewritten to the directory standard.** The tree this plan first prescribed —
> `procedures/`, `work/endpoints/`, `registrations/`, `runtime-constructors/`,
> `runtime.ts` — was written before
> [`docs/capability-directory-redesign.md`](../../../../../docs/capability-directory-redesign.md)
> existed, and none of those names survives anywhere under `src/capabilities`.
> Every path below is now the standard's, and `pnpm lint` enforces it from the
> moment step 1 lists this capability as migrated. The design is unchanged: the
> same public methods, the same Rich Content prerequisites, the same test matrix.

| This plan used to say | The standard says |
| --------------------- | ----------------- |
| `procedures/<method>/` | `runtime-api/<method>/` |
| `runtime.ts` | `runtime-objects/document/definition.ts` |
| `runtime-constructors/document.ts` | `runtime-objects/document/constructor.ts` |
| `work/endpoints/<name>/work.ts` | `endpoints/<name>/job.ts` |
| `registrations/endpoints.ts` | `endpoints/register.ts` |
| `shared/identity/` | deferred; an internal `runtime-objects/id-factory/` |
| `test/procedures/*.test.ts` | `test/unit/runtime-api/<method>/<method>.test.ts` |
| `RouteWork`, `RouteResponse` | `EndpointJob`, `EndpointJobResponse` |

[`endpoints.md`](endpoints.md) still spells several of the left-hand names. Its
command and query envelopes, admission rules, and status mapping are current;
read its paths from here.

## Architectural Shape

The implementation is organized around the public runtime object and the
directory that owns each of its methods:

```text
DocumentRuntime method                    runtime-objects/document/definition.ts
└── runtime-api/<method>/<method>.ts      one directory per public method
    ├── <supporting-procedure>.ts         this method is its only caller
    ├── ../shared/<procedure>.ts          two or more methods need it
    ├── persistence/store.ts              ordered reads, transaction-scoped writes
    └── #rich-content                     the bare alias — never inside it

HTTP request
└── endpoints/<endpoint>/wire/decode.ts   untrusted JSON becomes a runtime input
    └── endpoints/<endpoint>/job.ts       dispatch and expected-status mapping
        └── DocumentRuntime method
```

These directory names mean the same thing in every capability, so a reviewer who
has read [Rich Content](../../../resource-support/rich-content/overview.md)
already knows where Document keeps things. Nothing here is a Document-specific
layering convention to be learned first.

## Expected Source Tree

```text
src/capabilities/resource-general/document/
├── overview.md
├── index.ts
├── errors.ts
├── docs/                            # these eight design documents
├── types/
│   ├── types.md
│   ├── ids.ts
│   ├── aggregate.ts
│   ├── page.ts
│   ├── styles.ts
│   ├── display.ts
│   ├── placements.ts
│   ├── runtime-inputs.ts
│   └── runtime-results.ts
├── runtime-objects/
│   ├── runtime-objects.md
│   ├── document/
│   │   ├── document.md
│   │   ├── definition.ts
│   │   └── constructor.ts
│   └── id-factory/
│       ├── id-factory.md
│       ├── definition.ts
│       └── constructor.ts
├── runtime-api/
│   ├── runtime-api.md
│   ├── shared/
│   │   ├── shared.md
│   │   └── <procedure>.ts           # arrives on its second caller, not before
│   ├── create/
│   │   ├── create.md
│   │   └── create.ts
│   ├── display/
│   │   ├── display.md
│   │   ├── display.ts
│   │   ├── resolve-block-styles.ts
│   │   ├── estimate-block-layout.ts
│   │   └── place-rows-on-pages.ts
│   ├── split-block-into-rows/
│   │   ├── split-block-into-rows.md
│   │   └── split-block-into-rows.ts
│   └── …                            # nineteen more, one per public method
├── persistence/
│   ├── persistence.md
│   ├── schema.ts
│   ├── stored-types.ts
│   └── store.ts
├── endpoints/
│   ├── endpoints.md
│   ├── register.ts
│   ├── documents-command/
│   │   ├── documents-command.md
│   │   ├── job.ts
│   │   ├── wire/
│   │   │   ├── request.ts
│   │   │   ├── decode.ts
│   │   │   └── response.ts
│   │   └── procedures/
│   │       ├── procedures.md
│   │       ├── dispatch.ts
│   │       └── status.ts
│   └── documents-query/
│       ├── documents-query.md
│       ├── job.ts
│       └── wire/
│           ├── request.ts
│           ├── decode.ts
│           └── response.ts
└── test/
    ├── unit/
    ├── non-functional/
    └── bruno/
        ├── bruno.json
        └── documents-command.bru
```

This is an expected organization, not a mandate to create empty files. A
supporting procedure is introduced when the named method actually needs it, and
**a directory is absent when the capability has nothing for it** — there is no
`regression/` until a defect is fixed, and no `.gitkeep` anywhere.

Every directory except `test/**`, `wire/`, and `docs/` carries a document named
after itself and sitting inside it. That is lint rule 12, not a preference.

### The cost this makes explicit

Document has **twenty-two public runtime methods**
([`runtime-procedures.md`](runtime-procedures.md)), so it gets twenty-two
`runtime-api/` directories, twenty-two entry files, and twenty-two documents,
before a single supporting procedure. Rich Content has eleven. Document is twice
the largest capability on the axis the standard is strictest about, and lint rule
6 admits no shortcut: a method implemented inline in `definition.ts` fails, and a
directory with no matching method fails.

This is the single biggest difference from how this plan used to read. It is
worth stating rather than discovering at step 4. Two things make it bearable:

- `pnpm new-runtime-api resource-general/document <methodName>` creates the
  directory, the entry stub, and the document from the template, so the cost per
  method is writing the document, not the scaffolding.
- The twenty-two documents are not new work. Each is a section that already
  exists in [`runtime-procedures.md`](runtime-procedures.md), relocated to sit
  beside the code it describes — which is the placement that keeps it from going
  stale, because a reviewer reading the change sees the document that
  contradicts it.

## ID Factory

**The shared extraction is deferred and unbuilt.** This plan originally proposed
one UUID-backed `IdFactory` under `shared/identity/`, constructed per backend
runtime and injected into every capability. That was deferred, not settled:
`src/shared/` does not exist, and `#shared/*` is a forward-declared alias
pointing at nothing. Document must not be planned as though it were agreed.

What exists is the pattern Document copies. Rich Content owns an **internal**
runtime object at
[`runtime-objects/id-factory/`](../../../resource-support/rich-content/runtime-objects/id-factory/id-factory.md):
constructed inside `createRichContentRuntime`, injected into the runtime class,
and never re-exported, so no consumer can hold one or substitute one.
Consequently it has no `runtime-api/` directories and the method-per-directory
rule does not apply to it.

Document does the same, with its own identities:

```ts
export interface DocumentIdFactory {
  documentId(): DocumentId;
  rowId(): DocumentRowId;
  blockId(): DocumentBlockId;
  styleId(): DocumentStyleId;
}
```

Capabilities still own identity semantics:

- Document decides when to allocate a Document, Row, Block, or library Style ID;
- Rich Content decides when to allocate content, atom, mark, or list IDs;
- a factory only generates collision-resistant values.

Tests inject one deterministic implementation. Being internal is exactly what
lets a test substitute a counting factory and assert on generated IDs without
touching any other behavior.

The duplication this leaves is two constructors, each wrapping `randomUUID()`
with prefixed strings. That is the price of not blocking Document on a
shared-infrastructure refactor, and it is a cheap price: when the extraction does
happen it replaces two constructors and no procedure, because no procedure asks a
factory for anything but a value.

## Runtime Objects

Document has two runtime objects and exports one.

| Object | Directory | Exported | Responsibility |
| ------ | --------- | -------- | -------------- |
| `DocumentRuntime` | `runtime-objects/document/` | yes | The twenty-two public methods. Holds the store, the ID factory, the Rich Content runtime, and the Rich Content transaction participant. |
| `DocumentIdFactory` | `runtime-objects/id-factory/` | internal | Allocates every Document, Row, Block, and library Style ID. |

Because exactly one object is exported, `runtime-api/` stays flat:
`runtime-api/<method>/`, not `runtime-api/<object>/<method>/`. The object-level
nesting is only for a capability exporting two, and nothing needs it today.

`runtime-objects/document/definition.ts` contains:

1. the `DocumentRuntime` public interface;
2. one implementation class holding its injected dependencies;
3. one thin method per public API that delegates to its `runtime-api` entry.

It does not contain persistence queries, layout algorithms, wire decoding, or
the bodies of twenty-two procedures. Lint rule 3 keeps the directory to exactly
`document.md`, `definition.ts`, and `constructor.ts`, so there is nowhere for a
fourth file to accumulate.

Conceptually:

```ts
class PersistedDocumentRuntime implements DocumentRuntime {
  create(input) {
    return createDocument(this.dependencies, input);
  }

  display(documentId) {
    return displayDocument(this.dependencies, documentId);
  }

  // one equivalent delegation for each remaining runtime method
}
```

## Types

`types/` contains values that support the runtime contract and canonical model:

| File | Responsibility |
| ---- | -------------- |
| `types.md` | What belongs in this directory and what does not. |
| `ids.ts` | Branded or aliased Document-owned IDs. |
| `aggregate.ts` | Rows, Blocks, Row tracks, and Style Library aggregate types. |
| `page.ts` | Mutable page geometry. |
| `styles.ts` | Both Style families and Block applications. |
| `display.ts` | Composed public Display Document projection. |
| `placements.ts` | Identity-based Row and Block placements. |
| `runtime-inputs.ts` | Inputs accepted by `DocumentRuntime`. |
| `runtime-results.ts` | Mutation and creation results. |

Types contain no database or HTTP-framework shapes. Private model types live
here too; `index.ts` decides what leaves the capability.

## Runtime API Directories

Every public runtime method maps to exactly one directory under `runtime-api/`,
named in kebab-case after the interface method. Its entry file has the same name
and owns that method's complete orchestration. Supporting procedures used by
only that method sit beside it.

| Method | Directory | Supporting procedures beside the entry |
| ------ | --------- | -------------------------------------- |
| `create` | `create/` | — |
| `display` | `display/` | `resolve-block-styles.ts`, `estimate-block-layout.ts`, `place-rows-on-pages.ts` |
| `rename` | `rename/` | — |
| `updatePage` | `update-page/` | — |
| `delete` | `delete/` | — |
| `createLibraryStyle` | `create-library-style/` | — |
| `updateLibraryStyle` | `update-library-style/` | — |
| `deleteLibraryStyle` | `delete-library-style/` | — |
| `setBlockStyleApplications` | `set-block-style-applications/` | — |
| `insertTextRows` | `insert-text-rows/` | — |
| `insertHorizontalRuleRow` | `insert-horizontal-rule-row/` | — |
| `insertPageBreakRow` | `insert-page-break-row/` | — |
| `moveRow` | `move-row/` | — |
| `deleteRows` | `delete-rows/` | — |
| `insertBlock` | `insert-block/` | — |
| `moveBlock` | `move-block/` | — |
| `deleteBlocks` | `delete-blocks/` | — |
| `setRowWidths` | `set-row-widths/` | — |
| `mutateContent` | `mutate-content/` | `validate-owned-mutation.ts` |
| `splitBlockIntoRows` | `split-block-into-rows/` | — |
| `separateBlockLines` | `separate-block-lines/` | — |
| `combineRowsAsList` | `combine-rows-as-list/` | — |

Each entry is a plain function taking the dependencies it needs — the store, the
ID factory when it allocates identity, the Rich Content runtime or transaction
participant when it crosses the boundary — followed by the method's input. The
runtime object supplies them; nothing here reaches for a singleton.

For example:

```text
runtime.display(documentId)
└── runtime-api/display/display.ts
    ├── resolve-block-styles.ts
    ├── estimate-block-layout.ts
    ├── place-rows-on-pages.ts
    ├── persistence/store.ts
    └── #rich-content — display with base characteristics

runtime.splitBlockIntoRows(input)
└── runtime-api/split-block-into-rows/split-block-into-rows.ts
    ├── persistence/store.ts
    └── #rich-content — transaction participant
```

Each method's document follows
[`runtime-api-method.md`](../../../../../docs/templates/runtime-api-method.md):
classification, inputs, output, failures, effects, and the procedure tree with
`||` branches. The trees are already written in
[`runtime-procedures.md`](runtime-procedures.md) and move into their directories
as each method lands.

### Shared Procedures

`runtime-api/shared/` holds a procedure **once a second method needs it**, and
only when it preserves an invariant spanning those methods. Two call sites
wanting the same code is not promotion; it is copying that should be looked at
again.

The first version of this plan listed the same file name inside two method
directories — `validate-style-graph.ts` under both `create-library-style/` and
`update-library-style/`, `create-text-rows.ts` under both `create/` and
`insert-text-rows/`, `normalize-affected-rows.ts` under both `move-block/` and
`delete-blocks/`. Under the standard that is exactly the signal for `shared/`: a
method directory never imports from another method directory.

These are the candidates the design already implies. None is created before its
second caller exists:

| Candidate | Invariant it would preserve | Methods that need it |
| --------- | --------------------------- | -------------------- |
| `revisions.ts` | A structural write happens only under a Document compare-and-swap that advances the version by exactly one. | every mutator |
| `ownership.ts` | A `contentId` is resolved from Block ownership, never accepted from a caller. | `mutateContent`, `splitBlockIntoRows`, `separateBlockLines`, `deleteRows`, `deleteBlocks`, `delete` |
| `placements.ts` | A placement names identities in the expected revision; array offsets are never admitted. | the four insert methods, `moveRow`, `moveBlock` |
| `row-widths.ts` | Widths sum exactly to `FULL_ROW_WIDTH_UNITS` and normalize deterministically. | `insertBlock`, `moveBlock`, `deleteBlocks`, `setRowWidths` |
| `style-applications.ts` | Both Block applications resolve in library-then-ad-hoc order. | `create`, `insertTextRows`, `insertBlock`, `setBlockStyleApplications`, `display` |
| `style-graph.ts` | Same-family inheritance only, and no cycle. | `createLibraryStyle`, `updateLibraryStyle` |
| `create-text-rows.ts` | The selected line-break mode produces the same Rows wherever text is admitted. | `create`, `insertTextRows` |

A promotion keeps both procedure trees explicit through imports and through the
`Shared Procedures Used` table in each method's document.
[Rich Content's `shared/`](../../../resource-support/rich-content/runtime-api/shared/shared.md)
is the worked example, including the four procedures it deliberately leaves
unpromoted because exactly one method calls each.

## Persistence

`persistence/` is capability-owned and contains only storage concerns. Lint rule
4 restricts it to exactly four files:

- `persistence.md`: what the directory is for, the tables, and the concurrency
  discipline;
- `schema.ts`: Kysely table augmentation and initialization;
- `stored-types.ts`: rows as stored, distinct from public aggregate types;
- `store.ts`: ordered reads and transaction-scoped writes.

The store does not perform HTTP admission or choose Document API behavior.
`runtime-api` entries start and coordinate transactions through store
operations. Tables, keys, revision gates, and cross-capability atomicity are in
[`persistence.md`](persistence.md).

`schema.ts` carries the one permitted exception to the bare-alias import rule: a
`declare module` for Kysely declaration merging must name the module that
*declares* the interface, so it targets `#persistence/types/database.js` rather
than `#persistence`. Every other reference to `BackendDatabase` uses the bare
alias.

## Endpoints and Wire

Endpoints live in `endpoints/`, one directory per endpoint, each holding its
document, `job.ts`, and — when it admits input — `wire/`. Both Document
endpoints admit a JSON body, so both have one.

```text
endpoints/documents-command/
├── documents-command.md
├── job.ts
├── wire/
│   ├── request.ts
│   ├── decode.ts
│   └── response.ts
└── procedures/
    ├── procedures.md
    ├── dispatch.ts
    └── status.ts
```

"Wire" means transport-boundary representation and admission:

- `request.ts` describes the JSON-compatible request shape;
- `decode.ts` copies and validates untrusted JSON into a runtime input;
- `response.ts` describes endpoint success and expected error bodies.

Wire does not mean networking, routing, domain logic, or persistence. It carries
no document of its own — the endpoint's document describes it — and keeping it
under its endpoint makes its consumer unambiguous.

`job.ts` receives the framework-neutral `RequestEnvelope`, invokes its decoder,
dispatches to `DocumentRuntime`, and returns `EndpointJobResponse`. It contains
no Fastify types.

### Why the command endpoint gets `procedures/`

A `procedures/` directory under an endpoint is the review signal that its job
composes work rather than calling one runtime method, and the standard says it
should cost a deliberate decision and a written justification in
`procedures/procedures.md`. Here is that justification.

`documents-query` does not get one: it decodes one discriminant and calls
`display`, which is a pass-through.

`documents-command` does. Its job resolves a twenty-two-arm command union onto
twenty-two runtime methods and maps five outcome classes onto status codes
(201 create, 204 delete, 200 other success, 400/404/409 expected failure, throw
for the 500 path). Both tables are behavior the endpoint owns and neither
belongs to any one runtime method, so `dispatch.ts` and `status.ts` sit beside
the job. Leaving them inline would put a twenty-two-arm switch in a file whose
stated job is to decode, dispatch, and answer.

## Registration

`endpoints/register.ts` holds the capability's registration and nothing else:

```text
endpoints/register.ts
  registerDocumentEndpoints(registry, documentRuntime)
    POST /documents/command → documents-command/job.ts
    POST /documents/query   → documents-query/job.ts
```

`index.ts` re-exports `registerDocumentEndpoints`, and
[`main.ts`](../../../../../src/main.ts) calls it after constructing Document and
before the web server listens. Registration lives in the capability that owns
the endpoints; there is no `src/registry/registrations/` any more.

Document is registered from `main.ts` rather than from `createRegistry()`
because it needs a constructed runtime.
[Built-in](../../../built-in/endpoints/endpoints.md) is registered inside
`createRegistry()` instead, because it takes no argument and depends on nothing —
which is what keeps the endpoint table from ever being empty. Document cannot
follow it, and should not try.

The registry remains execution-agnostic, and a duplicate endpoint key remains a
startup wiring error thrown by
[`RouteRegistry.register`](../../../../../src/registry/registry.ts).

## Capability-Local Tests

Tests live under `test/` inside the capability they verify. Nothing below it
carries a document, and lint rule 11 rejects a `*.test.ts` anywhere else.

```text
document/test/
├── unit/                     # mirrors the source directories it covers
│   ├── runtime-api/<method>/<method>.test.ts
│   ├── persistence/store.test.ts
│   └── endpoints/documents-command/job.test.ts
├── non-functional/           # concurrent writers racing a Document CAS
└── bruno/
    ├── bruno.json            # a collection is rooted at its own bruno.json
    └── documents-command.bru
```

`unit/` mirrors the directories it covers, so the test for a method sits at the
same path as the method. `regression/` is absent until a defect is fixed and
gets one file per defect thereafter. Shared fixtures sit at `test/fixture.ts`,
as they do in Rich Content.

`pnpm test` already globs `src/capabilities/**/test/**/*.test.ts` recursively, so
unit tests are discovered the moment they land. `pnpm test:bruno` is not a script
yet — Bruno is not a dependency anywhere in the repository, and adding the CLI is
outstanding work the redesign names. The `.bru` requests can be written before
the runner exists; they just are not executed by CI until it does.

Cross-capability startup tests may remain at a backend-level integration location
when no single capability owns them.

## Why Rich Content Has Prerequisite Work

Document does not own Rich Content internals and should not absorb them. Three
Document requirements currently cannot be satisfied by the existing Rich
Content API:

1. **Style order:** Document Block-wide text characteristics must be applied
   before inline Rich Content marks. Current Display Content is already fully
   resolved, so Document cannot safely overlay its base afterward.
2. **Atomic ownership:** splitting, combining, and deleting Blocks must change
   Document references and Rich Content rows in one transaction. Independent
   commits can create dangling references or orphaned content.
3. **Line partition:** Document cannot inspect raw `LineBreakAtom`s because they
   are correctly private to Rich Content.

Therefore Rich Content needs narrowly scoped public capabilities: base-style
display, transaction participation, exact-revision destruction, and semantic
line partition. These changes are designed and tested under Rich Content, not
implemented inside the Document directory.

If we reject those Rich Content changes, the Document design must give up
correct style precedence, atomic ownership, or raw-state encapsulation. The
current design keeps all three.

Each new Rich Content capability is a new public method, so each is a new
`runtime-api/` directory under Rich Content with its own document — the same
cost accounting as above, on the other side of the boundary.

## Implementation Sequence

### 1. Capability Skeleton

- `pnpm new-capability resource-general/document --persisted --endpoints`. It
  writes `overview.md`, `index.ts`, `errors.ts`, `types/`,
  `runtime-objects/document/`, `persistence/`, `endpoints/`, and `test/`. It
  refuses to overwrite a file it planned to write, and `docs/` is not among
  them, so it runs cleanly into the directory these design documents already
  occupy. `runtime-api/` is not generated — it arrives with the first method.
- Add `runtime-objects/id-factory/` by hand. The generator writes one runtime
  object; the internal factory is the second.
- Append `resource-general/document` to `MIGRATED` in
  [`scripts/lint-structure.mjs`](../../../../../scripts/lint-structure.mjs) in
  the same change. Until it is listed, none of the structure rules run against
  this capability.
- `#document` and `#document/*` are already declared in
  [`package.json`](../../../../../package.json) and `tsconfig.json` as forward
  declarations. Rule 10 checks the specifiers files actually import, so they must
  resolve the moment the first import lands — which is why `index.ts` belongs in
  this step.

### 2. Rich Content Prerequisites

- Define point semantics at the Document integration boundary for `fontSize`.
- Add base-style Display Content rendering.
- Add transaction-scoped operations, exact-revision destruction, and line
  partition.
- Keep all code and tests under Rich Content, each new method in its own
  `runtime-api/` directory with its document.

### 3. Document Types and Runtime Skeleton

- Add the closed aggregate types, runtime inputs/results, and `errors.ts`.
- Declare `DocumentRuntime` in `runtime-objects/document/definition.ts` with one
  unimplemented delegation per method, and create the twenty-two `runtime-api/`
  directories with `pnpm new-runtime-api`. Rule 6 checks both directions, so the
  interface and the directory set land together.
- Add `runtime-objects/document/constructor.ts`, which receives the shared
  database, the Rich Content runtime, and the Rich Content transaction
  participant; constructs and initializes `DocumentStore`; creates the internal
  ID factory; and returns one `PersistedDocumentRuntime` singleton. It is the
  only place performing startup work, and it does not register endpoints —
  construction and registration remain separate startup operations.

### 4. Foundational Procedures

- Implement the `create/`, `display/`, `rename/`, `update-page/`, and `delete/`
  directories.
- Implement font-size-derived capacities and page placement inside `display/`.
- Implement PGlite schema, ordered reads, and Document CAS in `persistence/`.

### 5. Style Library Procedures

- Implement both library graphs and Block application resolution.
- Verify base Rich Content styling precedes inline marks.
- Promote `style-graph.ts` to `runtime-api/shared/` when `update-library-style/`
  becomes its second caller.

### 6. Row and Block Procedures

- Implement insertion, movement, deletion, structural Blocks, and Row widths.
- Verify Row composition and normalized-width invariants.
- Promote `placements.ts` and `row-widths.ts` to `runtime-api/shared/` as their
  second callers arrive.

### 7. Owned Content Procedures

- Implement routed inline mutation, split, line separation, and list grouping.
- Verify multi-capability rollback and identity ownership.

### 8. Endpoints and Registration

- Implement both endpoints with `pnpm new-endpoint resource-general/document
  documents-command` and `… documents-query`, writing each `wire/` decoder under
  its endpoint.
- Implement both jobs, and `documents-command/procedures/` with its written
  justification.
- Register both through `endpoints/register.ts`, re-export
  `registerDocumentEndpoints` from `index.ts`, and call it from `main.ts`.

### 9. Verification

- Run capability-local unit, persistence, and endpoint tests, plus the Bruno
  collection against a booted backend.
- Run `pnpm lint` — both path and structure rules — then typecheck, build,
  startup, and HTTP smoke tests.
- Confirm every document required by rules 12 and 13 says something, rather than
  being an unsubstituted template. Lint can require a document to exist; it
  cannot require it to be worth reading.

## Test Matrix

### Document Procedures

- mutable page geometry validates positive usable dimensions;
- capacities respond to font size, margins, width, height, and line spacing;
- Style families resolve independently and reject cycles;
- library plus ad hoc applications resolve in order;
- widths sum exactly and normalize deterministically;
- Horizontal Rule and Page Break Rows reject companion Blocks;
- empty Rich Content Blocks remain editable;
- page placement honors Page Break Blocks;
- independent Document and Rich Content revisions behave correctly;
- split, combine, and delete roll back across both capabilities.

### Endpoint Jobs

- strict wire decoders reject unknown keys and discriminants;
- create returns 201, delete returns 204, other success returns 200;
- validation maps to 400, missing state to 404, and conflict to 409;
- unexpected faults remain on the Web Server 500 path;
- neither endpoint accepts an arbitrary owned `contentId`.

## Deferred Decisions

- the shared `IdFactory` extraction, and with it `src/shared/`;
- authoritative font metrics and exact glyph placement;
- Row splitting across pages;
- headers, footers, and page-number content;
- advanced relational styles;
- nested Rows or layout templates;
- history, undo, and collaborative rebasing;
- formulas, prompt blocks, and their ownership models;
- authorization and external resource sharing.
