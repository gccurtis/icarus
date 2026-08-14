# Web Server Types

Lives at `types/types.md`.

`types/` holds the framework-neutral request shapes and the address the server
binds to. No Fastify type appears here — that is the point of the directory: the
registry and every endpoint job depend on these types, and none of them depends
on the framework. The runtime object's own interface, `WebServerRuntime`, is
declared with the class implementing it in
[`runtime-objects/web-server/definition.ts`](../runtime-objects/web-server/definition.ts).

## Files

| File | Holds |
| ---- | ----- |
| `request.ts` | `RequestEndpoint`, `RequestEnvelope`, and the pre-normalization `IncomingRequest` |
| `listen-address.ts` | `ListenAddress`, the host and port `listen` binds to |
| `web-server-options.ts` | `WebServerOptions`, the bounds the server is constructed with |

`TransportErrorBody` is the one public type that does not live here. It sits in
[`runtime-api/register-transport/error-response.ts`](../runtime-api/register-transport/error-response.ts)
beside the table of codes that produces it, because a shape and the rules that
fill it go stale separately when they are filed apart.

## Public Types

### Type: `RequestEndpoint`

The identity of an endpoint: a method and a path. The registry keys its table by
this, and a `RequestEnvelope` is one of these with a payload attached.

```ts
export interface RequestEndpoint {
  method: string;
  path: string;
}
```

### Type: `RequestEnvelope`

The request as an endpoint job sees it. A job receives one of these and nothing
else.

```ts
export interface RequestEnvelope extends RequestEndpoint {
  requestId?: string;
  query: Record<string, unknown>;
  headers: Record<string, unknown>;
  body: unknown;
}
```

`path` is the URL's pathname alone — the query string has already been split off
into `query`, which is always present and empty when the framework supplied
nothing, so a job never guards against `undefined`. `body` stays `unknown`:
decoding it is the endpoint's job, in its own `wire/` directory.

**There is no `params`, and none is planned.** Identity travels in the JSON body,
not in the path.

There was a `params`, and it held the only thing it could: the transport
registers one `/*` route and the registry matches an endpoint by exact method and
path, so Fastify's wildcard capture — `{"*": "health"}` — was what every job
received. That is a routing artifact of the framework this envelope exists to
hide. But removing it is not merely cleanup, because the reason nothing ever
populated it is a decision rather than an omission.

Endpoints take their input as a JSON body. `documentId` is a field on the command
that needs it, not a URL segment — see
[the Document endpoints design](../../../resource-general/document/docs/endpoints.md),
where twenty-two commands arrive through `POST /documents/command` as a tagged
union. What that buys is **one admission path**: every value reaching a runtime
method has passed through an endpoint's `wire/decode.ts`, which rejects unknown
keys, unknown discriminants, and out-of-range values. A path parameter would
bypass it, arriving as a raw string from the router and needing a second,
parallel validation route to the same runtime method. It also keeps the registry
a table rather than a matching strategy, with no precedence to reason about
between `/documents/new` and `/documents/:id`.

The cost is real and worth naming. `GET /documents/{id}` is cacheable by
browsers, proxies, and CDNs and supports `ETag`/`If-None-Match`; a `POST` query is
not, so conditional revalidation is unavailable. Path-grouped metrics also cannot
distinguish one query from another, since every read logs as
`POST /documents/query` — the mitigation is to put the command kind in the log
record, which is Document's to do when it lands.

So the condition for revisiting this is specific: read caching becoming something
the frontend actually needs. That would mean adding narrow `GET` reads, and
`params` would return then — with a matching strategy chosen deliberately in the
registry, rather than inherited from a wildcard.

### Type: `ListenAddress`

The interface and port to bind. Callers validate these values before construction
— this capability reads no configuration.

```ts
export interface ListenAddress {
  host: string;
  port: number;
}
```

### Type: `WebServerOptions`

The bounds the server is created with, validated by the caller from the same
configuration the address comes from.

```ts
export interface WebServerOptions {
  bodyLimitBytes: number;
  requestTimeoutMs: number;
}
```

They are constructor arguments rather than transport behavior because the
framework enforces them before a request reaches any handler: an oversized body
is refused with 413 and a slow request is aborted, without an endpoint job
running. Passing them explicitly is what keeps them chosen rather than inherited
— they were Fastify's defaults, by omission, until they were named here.

## Private Types

### Type: `IncomingRequest`

The transport data captured from a framework request before normalization: the
raw `url` and `id`, and `query` still typed `unknown` as the framework hands it
over.

```ts
export interface IncomingRequest {
  id: string;
  method: string;
  url: string;
  query: unknown;
  headers: Record<string, unknown>;
  body: unknown;
}
```

It stays private because it exists for exactly one step — the boundary between
Fastify and `RequestEnvelope` inside
[`register-transport.ts`](../runtime-api/register-transport/register-transport.ts).
A consumer holding one would be holding a half-normalized request, which is the
state this capability exists to eliminate.
