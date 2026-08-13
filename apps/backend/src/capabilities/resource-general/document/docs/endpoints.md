# Document HTTP Endpoints and Registration

## Endpoint Surface

The first increment registers two exact routes:

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `POST` | `/documents/command` | Admit one tagged Document mutation and execute it. |
| `POST` | `/documents/query` | Admit one tagged Document read and execute it. |

Fixed paths match the current exact-key
[`RouteRegistry`](../../../../../src/registry/registry.ts). The
[Fastify transport](../../../../../src/capabilities/platform/web-server/register-http-transport.ts)
continues to translate HTTP into a framework-neutral request envelope and
execute registered work directly.

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

The body has one `command` key. Each command has exactly `type` and `input`.
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

## Command Work Procedure

```text
POST /documents/command
  1. Receive framework-neutral RequestEnvelope from Web Server.
  2. Strictly decode body as DocumentCommandRequest.
  || admission fails
     2.a.1. Return 400 with stable invalid-request error body.
  3. Dispatch command.type to exactly one DocumentRuntime method.
  4. Await the runtime result.
  || Document or Row/Block/Style does not exist
     4.a.1. Return 404.
  || expected Document or Rich Content revision is stale
     4.b.1. Return 409.
  || domain validation or Rich Content selection validation fails
     4.c.1. Return 400.
  || unexpected error
     4.d.1. Throw so Web Server logs and maps the fault as 500.
  5. Map successful create to 201.
  6. Map successful permanent delete to 204 with no body.
  7. Map every other successful mutation to 200 with its typed result.
```

## Query Work Procedure

```text
POST /documents/query
  1. Strictly decode body as DocumentQueryRequest.
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

Expected errors contain stable, non-sensitive messages. Unexpected failures are
not converted by Document work; they follow the existing Web Server fault path
and observability logging.

## Work Functions

The capability owns transport-neutral work factories:

```ts
export const createDocumentCommandWork = (
  runtime: DocumentRuntime
): RouteWork => ...;

export const createDocumentQueryWork = (
  runtime: DocumentRuntime
): RouteWork => ...;
```

They depend on `RequestEnvelope` and `RouteResponse`, not Fastify. Decoding,
dispatch, and expected error mapping belong here; database and domain logic do
not.

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
work/endpoints/command/
├── work.ts
└── wire/
    ├── request.ts
    ├── decode.ts
    └── response.ts
```

If an endpoint remains simple enough to keep these concerns clear in one file,
the files may start combined inside its directory and split only as needed.

## Registration

A new registration file wires those work functions into the runtime-scoped
registry:

```ts
// src/capabilities/resources/general/document/registrations/endpoints.ts
export const registerDocumentEndpoints = (
  registry: RouteRegistry,
  document: DocumentRuntime
): void => {
  registry.register(
    { method: "POST", path: "/documents/command" },
    createDocumentCommandWork(document)
  );
  registry.register(
    { method: "POST", path: "/documents/query" },
    createDocumentQueryWork(document)
  );
};
```

The current [built-in registration](../../../../../src/registry/registrations/built-in.ts)
continues to own health and echo routes.

## Startup Procedure

```text
[buildRuntime()](../../../../../src/main.ts)
  1. Construct database and Rich Content.
  2. Construct DocumentRuntime.
  3. createRegistry() registers built-in routes.
  4. registerDocumentEndpoints(registry, documentRuntime).
  5. registerHttpTransport(app, { registry, logger }).
  6. Start Fastify.
```

Registration occurs once before the server listens. Duplicate endpoint keys
remain a startup wiring error enforced by `RouteRegistry.register`.

## Expected Endpoint Files

```text
src/capabilities/resources/general/document/
├── work/
│   └── endpoints/
│       ├── command/
│       │   ├── work.ts
│       │   └── wire/
│       │       ├── request.ts
│       │       ├── decode.ts
│       │       └── response.ts
│       └── query/
│           ├── work.ts
│           └── wire/
│               ├── request.ts
│               ├── decode.ts
│               └── response.ts
└── registrations/
    └── endpoints.ts
```

## Endpoint Invariants

- Every admitted input is a fresh validated value; wire objects do not become
  canonical state directly.
- Unknown keys and command types are rejected.
- Request paths never select arbitrary Rich Content IDs.
- Expected conflicts are responses, not logged server faults.
- Work functions contain no Fastify types.
- Registration contains no domain or persistence behavior.
- The Registry remains unaware of whether work is executed directly today or
  through another execution mechanism later.
