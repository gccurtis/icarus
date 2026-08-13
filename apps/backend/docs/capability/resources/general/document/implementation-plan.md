# Document Implementation Plan

## Architectural Shape

The implementation is organized around the public runtime object and its
procedures:

```text
DocumentRuntime method
└── one API procedure directory
    ├── public procedure entry
    └── procedure-specific supporting procedures
        ├── Document persistence
        └── dependent capability APIs

HTTP endpoint work
└── endpoint-local wire admission
    └── DocumentRuntime method
```

The directory tree should make this call tree visible without first learning a
generic application/domain/wire layering convention.

## Expected Source Tree

```text
apps/backend/src/
├── shared/identity/
│   ├── id-factory.ts
│   └── runtime-constructors/
│       └── id-factory.ts
├── capabilities/resources/general/document/
│   ├── index.ts
│   ├── runtime.ts
│   ├── errors.ts
│   ├── types/
│   │   ├── ids.ts
│   │   ├── aggregate.ts
│   │   ├── page.ts
│   │   ├── styles.ts
│   │   ├── display.ts
│   │   ├── placements.ts
│   │   ├── runtime-inputs.ts
│   │   └── runtime-results.ts
│   ├── procedures/
│   │   ├── create/
│   │   │   ├── create.ts
│   │   │   └── create-text-rows.ts
│   │   ├── display/
│   │   │   ├── display.ts
│   │   │   ├── resolve-block-styles.ts
│   │   │   ├── estimate-block-layout.ts
│   │   │   └── place-rows-on-pages.ts
│   │   ├── rename/
│   │   │   └── rename.ts
│   │   ├── update-page/
│   │   │   └── update-page.ts
│   │   ├── delete/
│   │   │   └── delete.ts
│   │   ├── create-library-style/
│   │   │   ├── create-library-style.ts
│   │   │   └── validate-style-graph.ts
│   │   ├── update-library-style/
│   │   │   ├── update-library-style.ts
│   │   │   └── validate-style-graph.ts
│   │   ├── delete-library-style/
│   │   │   └── delete-library-style.ts
│   │   ├── set-block-style-applications/
│   │   │   ├── set-block-style-applications.ts
│   │   │   └── resolve-style-applications.ts
│   │   ├── insert-text-rows/
│   │   │   ├── insert-text-rows.ts
│   │   │   └── create-text-rows.ts
│   │   ├── insert-horizontal-rule-row/
│   │   │   └── insert-horizontal-rule-row.ts
│   │   ├── insert-page-break-row/
│   │   │   └── insert-page-break-row.ts
│   │   ├── move-row/
│   │   │   └── move-row.ts
│   │   ├── delete-rows/
│   │   │   └── delete-rows.ts
│   │   ├── insert-block/
│   │   │   ├── insert-block.ts
│   │   │   └── normalize-row-widths.ts
│   │   ├── move-block/
│   │   │   ├── move-block.ts
│   │   │   └── normalize-affected-rows.ts
│   │   ├── delete-blocks/
│   │   │   ├── delete-blocks.ts
│   │   │   └── normalize-affected-rows.ts
│   │   ├── set-row-widths/
│   │   │   ├── set-row-widths.ts
│   │   │   └── normalize-widths.ts
│   │   ├── mutate-content/
│   │   │   ├── mutate-content.ts
│   │   │   └── validate-owned-mutation.ts
│   │   ├── split-block-into-rows/
│   │   │   └── split-block-into-rows.ts
│   │   ├── separate-block-lines/
│   │   │   └── separate-block-lines.ts
│   │   └── combine-rows-as-list/
│   │       └── combine-rows-as-list.ts
│   ├── persistence/
│   │   ├── schema.ts
│   │   ├── stored-types.ts
│   │   └── store.ts
│   ├── work/
│   │   └── endpoints/
│   │       ├── command/
│   │       │   ├── work.ts
│   │       │   └── wire/
│   │       │       ├── request.ts
│   │       │       ├── decode.ts
│   │       │       └── response.ts
│   │       └── query/
│   │           ├── work.ts
│   │           └── wire/
│   │               ├── request.ts
│   │               ├── decode.ts
│   │               └── response.ts
│   ├── registrations/
│   │   └── endpoints.ts
│   ├── runtime-constructors/
│   │   └── document.ts
│   └── test/
│       ├── runtime.test.ts
│       ├── persistence/
│       │   └── store.test.ts
│       ├── procedures/
│       │   ├── create.test.ts
│       │   ├── display.test.ts
│       │   ├── styles.test.ts
│       │   ├── rows.test.ts
│       │   ├── blocks.test.ts
│       │   └── content.test.ts
│       └── work/endpoints/
│           ├── command.test.ts
│           └── query.test.ts
└── main.ts
```

This is an expected organization, not a mandate to create empty files. A
supporting file is introduced when the named procedure actually needs it.

## Central ID Factory

ID generation is shared infrastructure and should not be recreated inside each
capability:

```ts
export interface IdFactory {
  create(): string;
}
```

One UUID-backed `IdFactory` is constructed per backend runtime under
`shared/identity/runtime-constructors`. It is injected into Rich Content and
Document runtime constructors. Tests inject one deterministic implementation.

Capabilities still own identity semantics:

- Document decides when to allocate a Document, Row, Block, or library Style ID;
- Rich Content decides when to allocate content, atom, mark, or list IDs;
- the centralized factory only generates collision-resistant values.

This removes the capability-specific ID-factory duplication without moving
identity lifecycle rules into shared infrastructure.

Migrating the existing Rich Content ID factory is a separate shared-infrastructure
refactor performed before Document construction. It must preserve current Rich
Content behavior.

## Runtime Object

The planned `runtime.ts` contains:

1. the `DocumentRuntime` public interface;
2. one implementation object holding its injected dependencies;
3. one thin method per public API that delegates to the matching procedure.

It does not contain persistence queries, layout algorithms, wire decoding, or
the bodies of twenty API procedures.

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
| `ids.ts` | Branded or aliased Document-owned IDs. |
| `aggregate.ts` | Rows, Blocks, Row tracks, and Style Library aggregate types. |
| `page.ts` | Mutable page geometry. |
| `styles.ts` | Both Style families and Block applications. |
| `display.ts` | Composed public Display Document projection. |
| `placements.ts` | Identity-based Row and Block placements. |
| `runtime-inputs.ts` | Inputs accepted by `DocumentRuntime`. |
| `runtime-results.ts` | Mutation and creation results. |

Types contain no database or HTTP-framework shapes.

## API Procedure Directories

Every public runtime method maps to exactly one top-level directory under
`procedures/`. Its entry file has the same functional name and owns that API's
complete orchestration.

For example:

```text
runtime.display(documentId)
└── procedures/display/display.ts
    ├── resolve-block-styles.ts
    ├── estimate-block-layout.ts
    ├── place-rows-on-pages.ts
    ├── persistence/store.ts
    └── richContent.display(...)
```

```text
runtime.splitBlockIntoRows(input)
└── procedures/split-block-into-rows/split-block-into-rows.ts
    ├── persistence/store.ts
    └── richContent transaction participant
```

Supporting procedures live beside the API procedure they explain. A helper is
promoted to a capability-wide shared location only after multiple API
procedures genuinely require the same invariant-preserving behavior. That
promotion must keep both procedure trees explicit through imports and docs.

## Persistence

`persistence/` is capability-owned and contains only storage concerns:

- `schema.ts`: Kysely table augmentation and initialization;
- `stored-types.ts`: rows as stored, distinct from public aggregate types;
- `store.ts`: ordered reads and transaction-scoped writes.

The store does not perform HTTP admission or choose Document API behavior. API
procedure entries start and coordinate transactions through store operations.

## Work, Endpoints, and Wire

`work/` contains externally executable work functions. The first Document work
is HTTP endpoint work, so it lives below `work/endpoints/`.

Each endpoint owns its wire boundary:

```text
work/endpoints/command/
├── work.ts
└── wire/
    ├── request.ts
    ├── decode.ts
    └── response.ts
```

“Wire” means transport-boundary representation and admission:

- `request.ts` describes the JSON-compatible request shape;
- `decode.ts` copies and validates untrusted JSON into a runtime input;
- `response.ts` describes endpoint success and expected error bodies.

Wire does not mean networking, routing, domain logic, or persistence. Keeping
it under its endpoint makes its consumer unambiguous.

`work.ts` receives the framework-neutral `RequestEnvelope`, invokes its decoder,
dispatches to `DocumentRuntime`, and returns `RouteResponse`. It contains no
Fastify types.

## Registrations

Endpoint registration belongs to Document because it wires Document work:

```text
document/registrations/endpoints.ts
  registerDocumentEndpoints(registry, documentRuntime)
    POST /documents/command → command/work.ts
    POST /documents/query   → query/work.ts
```

The backend [main runtime](../../../../../src/main.ts) calls this registration
after constructing Document and before starting the Web Server. The registry
remains execution-agnostic.

## Runtime Constructor

`runtime-constructors/document.ts`:

1. receives the shared database, centralized `IdFactory`, Rich Content runtime,
   and Rich Content transaction participant;
2. constructs and initializes `DocumentStore`;
3. builds the dependency object used by API procedures;
4. returns one `PersistedDocumentRuntime` singleton.

It does not register routes. Construction and registration remain separate
startup operations.

## Capability-Local Tests

Tests live beneath the capability they verify:

```text
document/test/
├── runtime.test.ts
├── persistence/store.test.ts
├── procedures/*.test.ts
└── work/endpoints/*.test.ts
```

The backend test script will discover `src/**/test/**/*.test.ts`. Rich Content
tests should move to its own `rich-content/test/` directory as a separate
organization change, preserving their behavior.

This keeps tests, fixtures, and expected behavior discoverable from the
capability tree. Cross-capability startup tests may remain at a backend-level
integration-test location when no single capability owns them.

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

## Implementation Sequence

### 1. Shared Identity

- Add the centralized runtime-scoped `IdFactory`.
- Inject it into Rich Content without changing identity semantics.
- Move Rich Content tests under its capability and verify behavior.

### 2. Rich Content Prerequisites

- Define point semantics at the Document integration boundary for `fontSize`.
- Add base-style Display Content rendering.
- Add transaction-scoped operations, exact-revision destruction, and line
  partition.
- Keep all code and tests under Rich Content.

### 3. Document Types and Runtime Skeleton

- Add the closed aggregate types, runtime inputs/results, and errors.
- Add the thin runtime object and one unimplemented delegation point per API.
- Add the runtime constructor with injected dependencies.

### 4. Foundational Procedures

- Implement create, display, rename, update-page, and delete directories.
- Implement font-size-derived capacities and page placement within display.
- Implement PGlite schema, ordered reads, and Document CAS.

### 5. Style Library Procedures

- Implement both library graphs and Block application resolution.
- Verify base Rich Content styling precedes inline marks.

### 6. Row and Block Procedures

- Implement insertion, movement, deletion, structural Blocks, and Row widths.
- Verify Row composition and normalized-width invariants.

### 7. Owned Content Procedures

- Implement routed inline mutation, split, line separation, and list grouping.
- Verify multi-capability rollback and identity ownership.

### 8. Work and Registration

- Implement command/query wire decoders under their endpoint directories.
- Implement endpoint work and expected error mapping.
- Register both routes through `registrations/endpoints.ts`.

### 9. Verification

- Run capability-local domain, persistence, runtime, and endpoint tests.
- Run backend typecheck, lint, build, startup, and HTTP smoke tests.

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

### Endpoint Work

- strict wire decoders reject unknown keys and discriminants;
- create returns 201, delete returns 204, other success returns 200;
- validation maps to 400, missing state to 404, and conflict to 409;
- unexpected faults remain on the Web Server 500 path;
- neither endpoint accepts an arbitrary owned `contentId`.

## Deferred Decisions

- authoritative font metrics and exact glyph placement;
- Row splitting across pages;
- headers, footers, and page-number content;
- advanced relational styles;
- nested Rows or layout templates;
- history, undo, and collaborative rebasing;
- formulas, prompt blocks, and their ownership models;
- authorization and external resource sharing.
