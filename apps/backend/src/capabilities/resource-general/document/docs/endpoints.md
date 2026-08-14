# Document Endpoints

Design document for `endpoints/`. It becomes `endpoints/endpoints.md` when that
directory lands; until then it sits in `docs/` with the rest of the Document
design.

Each endpoint gets a directory holding its document, `job.ts`, and — when it
admits input — `wire/`. `register.ts` maps endpoint identities to those jobs in
the runtime-scoped registry; it contains registration only, no decoding and no
capability behavior.

## Endpoint Surface

The first increment registers two exact endpoints:

| Method | Path | Job | Purpose |
| ------ | ---- | --- | ------- |
| `POST` | `/documents/command` | `endpoints/documents-command/` | Admit one tagged Document mutation and execute it. |
| `POST` | `/documents/query` | `endpoints/documents-query/` | Admit one tagged Document read and execute it. |

Fixed paths match the exact-key
[`RouteRegistry`](../../../../../src/runtime/registry.md). The
[Fastify transport](../../../platform/web-server/runtime-api/register-transport/register-transport.md)
translates HTTP into a framework-neutral `RequestEnvelope` and invokes the
registered job directly.

Two endpoints rather than twenty-two is a deliberate narrowing: the tagged union
below is the surface, so adding a runtime method adds an arm and a decoder
rather than a path, and the registry stays a table a reviewer can read in one
screen.

## Command Envelope

```ts
export interface DocumentCommandRequest {
  readonly command: DocumentCommand;
}

export type DocumentCommand =
  | { readonly type: "document.create"; readonly input: CreateDocumentInput }
  | { readonly type: "document.rename"; readonly input: RenameDocumentInput }
  | { readonly type: "document.update-page"; readonly input: UpdateDocumentPageInput }
  | { readonly type: "document.delete"; readonly input: DeleteDocumentInput }
  | { readonly type: "document.style-library.create"; readonly input: CreateLibraryStyleInput }
  | { readonly type: "document.style-library.update"; readonly input: UpdateLibraryStyleInput }
  | { readonly type: "document.style-library.delete"; readonly input: DeleteLibraryStyleInput }
  | { readonly type: "document.block.set-styles"; readonly input: SetBlockStyleApplicationsInput }
  | { readonly type: "document.row.insert-text"; readonly input: InsertDocumentTextRowsInput }
  | { readonly type: "document.row.insert-horizontal-rule"; readonly input: InsertHorizontalRuleRowInput }
  | { readonly type: "document.row.insert-page-break"; readonly input: InsertPageBreakRowInput }
  | { readonly type: "document.row.move"; readonly input: MoveDocumentRowInput }
  | { readonly type: "document.row.delete"; readonly input: DeleteDocumentRowsInput }
  | { readonly type: "document.block.insert"; readonly input: InsertDocumentBlockInput }
  | { readonly type: "document.block.move"; readonly input: MoveDocumentBlockInput }
  | { readonly type: "document.block.delete"; readonly input: DeleteDocumentBlocksInput }
  | { readonly type: "document.row.set-widths"; readonly input: SetDocumentRowWidthsInput }
  | { readonly type: "document.content.mutate"; readonly input: DocumentContentMutationInput }
  | { readonly type: "document.content.split-into-rows"; readonly input: SplitDocumentBlockInput }
  | { readonly type: "document.content.separate-lines"; readonly input: SeparateDocumentBlockLinesInput }
  | { readonly type: "document.content.combine-as-list"; readonly input: CombineDocumentRowsAsListInput };
```

The body has one `command` key. Each command has exactly `type` and `input`. The
input types are the ones `DocumentRuntime` accepts, declared in
`types/runtime-inputs.ts` and listed in
[runtime procedures](runtime-procedures.md); the wire shapes in
`documents-command/wire/request.ts` are their JSON-compatible counterparts, not
the same declarations.

Decoders reject unknown discriminants, missing keys, extra keys, invalid nested
types, non-finite numbers, and values outside capability limits before calling
the runtime.

## Query Envelope

```ts
export interface DocumentQueryRequest {
  readonly query: DocumentQuery;
}

export type DocumentQuery = {
  readonly type: "document.display";
  readonly input: { readonly documentId: DocumentId };
};
```

Only the composed Display Document is public. There is no endpoint exposing raw
Document persistence, raw Rich Content atoms, or marks.

## Status Mapping

The mapping both jobs follow. A job that deviates says so in its own document.

| Outcome | Status |
| ------- | ------ |
| Document created | 201 |
| permanent delete | 204 |
| any other successful mutation, and every query | 200 |
| admission, domain validation, or Rich Content selection failure | 400 |
| Document, Row, Block, or library Style does not exist | 404 |
| expected Document or Rich Content revision is stale | 409 |
| unexpected fault | not mapped — the job throws and the web server returns 500 |

The last row is the one that matters: an expected conflict is an answer, and
only a fault is allowed to reach the transport's error path.

## Work Procedures

These trees move into `documents-command/documents-command.md` and
`documents-query/documents-query.md` as each endpoint lands.

```text
POST /documents/command
  1. Receive the framework-neutral RequestEnvelope from the web server.
  2. Strictly decode the body as DocumentCommandRequest.
  || admission fails
     2.a.1. Return 400 with the stable invalid-request body.
  3. Dispatch command.type to exactly one DocumentRuntime method.
  4. Await the runtime result.
  || Document or Row/Block/Style does not exist
     4.a.1. Return 404.
  || expected Document or Rich Content revision is stale
     4.b.1. Return 409.
  || domain validation or Rich Content selection validation fails
     4.c.1. Return 400.
  || unexpected error
     4.d.1. Throw, so the web server logs the fault and returns 500.
  5. Map a successful create to 201.
  6. Map a successful permanent delete to 204 with no body.
  7. Map every other successful mutation to 200 with its typed result.
```

```text
POST /documents/query
  1. Strictly decode the body as DocumentQueryRequest.
  2. Dispatch document.display to DocumentRuntime.display.
  || Document does not exist
     2.a.1. Return 404.
  3. Return 200 with DisplayDocument.
```

## Error Body

```ts
export interface DocumentHttpError {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}
```

`code` is a `DocumentErrorCode` from `errors.ts`, which is why that file sits at
the capability root rather than in `types/`: a consumer catching an error is
using the public contract. Expected errors carry stable, non-sensitive messages.
Unexpected failures are not converted here — the job throws, and the web server
logs the fault and returns 500.

## Endpoint Jobs

The capability owns transport-neutral endpoint jobs. An endpoint job is the unit
registered against one endpoint identity — the project's term for what the
registry holds.

```ts
export const documentsCommandJob = (runtime: DocumentRuntime): EndpointJob => ...;

export const documentsQueryJob = (runtime: DocumentRuntime): EndpointJob => ...;
```

Each is typed as `EndpointJob` from
[`#registry`](../../../../../src/runtime/registry.md), which
supplies the `RequestEnvelope` parameter and the `EndpointJobResponse` result.
Neither job names a Fastify type. Decoding, dispatch, and expected error mapping
belong here; database and domain logic do not.

Both jobs take the runtime as an argument rather than reaching for it, which is
what lets a unit test drive one against a stub `DocumentRuntime` with no server
and no database.

`documents-command` is the one job with a `procedures/` directory —
`dispatch.ts` and `status.ts` — because it resolves a twenty-two-arm union and
maps five outcome classes rather than calling a single runtime method. That
directory's presence is a review signal, and
[the implementation plan](implementation-plan.md) carries the justification that
`procedures/procedures.md` will hold. `documents-query` decodes one discriminant
and calls `display`, so it has none.

### What `wire` Means

`wire` is the representation at a transport boundary. HTTP supplies untrusted
JSON rather than a trusted `DocumentCommand` object, even when both values look
similar in TypeScript.

For each endpoint, its `wire/` directory:

- describes the JSON-compatible request and response shapes;
- rejects missing, extra, malformed, or unknown values;
- copies admitted data into trusted runtime input values;
- contains no Document procedures or persistence behavior.

It lives under the endpoint it supports:

```text
endpoints/documents-command/
├── documents-command.md
├── job.ts
└── wire/
    ├── request.ts
    ├── decode.ts
    └── response.ts
```

`wire/` carries no document of its own; the endpoint's document describes it.

## Registration

`endpoints/register.ts` wires the jobs into the runtime-scoped registry.
Registration lives in the capability that owns the endpoint, not in
`src/runtime/`:

```ts
// src/capabilities/resource-general/document/endpoints/register.ts
import { documentsCommandJob } from "#document/endpoints/documents-command/job.js";
import { documentsQueryJob } from "#document/endpoints/documents-query/job.js";
import type { DocumentRuntime } from "#document/runtime-objects/document/definition.js";
import type { RouteRegistry } from "#registry";

export const registerDocumentEndpoints = (
  registry: RouteRegistry,
  document: DocumentRuntime
): void => {
  registry.register(
    { method: "POST", path: "/documents/command" },
    documentsCommandJob(document)
  );
  registry.register(
    { method: "POST", path: "/documents/query" },
    documentsQueryJob(document)
  );
};
```

Every specifier there is an alias: `#document/...` inside the capability, and
`#registry` for the registry, which is not a capability and is one file, so its
alias has no subpath form — it stays `#registry` wherever the spine keeps the
file. `#capabilities/...` is rejected by lint.

`index.ts` re-exports `registerDocumentEndpoints`, and the composition root calls
it once before the server listens, in the same list as every other capability's
registration — [Built-in](../../../built-in/endpoints/endpoints.md) included.

## Startup Procedure

`buildRuntime()` in [`build-runtime.ts`](../../../../../src/runtime/runtime.md):

```text
buildRuntime()
  1. Construct the database, the ID factory, and Rich Content.
  2. Construct DocumentRuntime.
  3. createRegistry() — an empty table.
  4. registerBuiltInEndpoints(registry).
  5. registerDocumentEndpoints(registry, document).
  6. webServer.registerTransport(registry, logger).
  7. webServer.listen(address).
```

Registration occurs once before the server listens. Construction and
registration stay separate startup operations: the constructor performs the
capability's startup work, and `register.ts` performs none of it. A duplicate
endpoint key remains a startup wiring error thrown by `RouteRegistry.register`.

## Expected Endpoint Files

```text
src/capabilities/resource-general/document/endpoints/
├── endpoints.md
├── register.ts
├── documents-command/
│   ├── documents-command.md
│   ├── job.ts
│   ├── wire/
│   │   ├── request.ts
│   │   ├── decode.ts
│   │   └── response.ts
│   └── procedures/
│       ├── procedures.md
│       ├── dispatch.ts
│       └── status.ts
└── documents-query/
    ├── documents-query.md
    ├── job.ts
    └── wire/
        ├── request.ts
        ├── decode.ts
        └── response.ts
```

Lint rule 7 keeps this shape: `endpoints/` contains `register.ts`, every other
entry is a directory containing `job.ts`, and its only other entries are `wire/`
and `procedures/`. Rule 12 requires the document beside each directory except
`wire/`.

Bruno requests for both endpoints live at `test/bruno/`, which carries its own
`bruno.json` because a collection is rooted at the directory holding that file.

## Endpoint Invariants

- Every admitted input is a fresh validated value; wire objects never become
  canonical state directly.
- Unknown keys and unknown command types are rejected.
- Request paths never select arbitrary Rich Content IDs — a `contentId` is
  resolved from Block ownership inside the runtime.
- Expected conflicts are responses, not logged server faults.
- Jobs contain no Fastify types. They see `RequestEnvelope` and return
  `EndpointJobResponse`.
- Registration contains no domain or persistence behavior.
- A job selects its own status code; the transport maps nothing.
- The registry remains unaware of whether a job is executed directly today or
  through another execution mechanism later.
