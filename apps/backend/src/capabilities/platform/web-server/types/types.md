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
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  headers: Record<string, unknown>;
  body: unknown;
}
```

`path` is the URL's pathname alone — the query string has already been split off
into `query`. `params` and `query` are always present, empty when the framework
supplied nothing, so a job never guards against `undefined`. `body` stays
`unknown`: decoding it is the endpoint's job, in its own `wire/` directory.

### Type: `ListenAddress`

The interface and port to bind. Callers validate these values before construction
— this capability reads no configuration.

```ts
export interface ListenAddress {
  host: string;
  port: number;
}
```

## Private Types

### Type: `IncomingRequest`

The transport data captured from a framework request before normalization: the
raw `url` and `id`, and `params`/`query` still typed `unknown` as the framework
hands them over.

```ts
export interface IncomingRequest {
  id: string;
  method: string;
  url: string;
  params: unknown;
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
