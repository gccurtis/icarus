# API: `registerTransport`

Lives at `runtime-api/register-transport/register-transport.md`.

Installs the backend's HTTP behavior. Called once during startup, after the
registry has been built and observability exists, and before `listen`. Every
response the backend ever sends is shaped by something this method registers.

That is a wider claim than "installs a route", and deliberately so. The transport
used to register a catch-all handler and nothing else, which left everything
Fastify does *around* a route at its defaults: a thrown error was serialized by
the framework's error handler, a body it declined to parse was answered before
the handler ran, and neither was logged the way a routed request was. The four
things registered here exist so that no response escapes the capability's own
rules.

## Classification

- **Owner:** `WebServerRuntime`
- **Execution:** mutator
- **Transaction:** none
- **Entry:** [`register-transport.ts`](register-transport.ts)

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `registry` | `RouteRegistry` | The endpoint table to dispatch through. It is read on every request, so endpoints registered after this call are served. |

The Fastify instance and the logger are supplied by the runtime object, not by
the caller. The bounds Fastify enforces — body limit, request timeout — were
fixed at construction; see
[`web-server.md`](../../runtime-objects/web-server/web-server.md).

## Output

`void`

Registration either succeeds or throws. There is no handle to unregister with:
the transport lives as long as the server.

## Failures

None defined by this capability. Fastify throws if a `/*` route is already
registered, which only happens when the method is called twice — a wiring bug
that should stop startup.

A request that fails is not a failure of this method. See Effects.

## Effects

Four registrations, in this order:

1. **The `text/plain` body parser is removed**, leaving `application/json` as the
   only media type with a parser. Any other content type is refused with 415
   before a job runs.
2. **Request logging hooks** — see [`request-logging.ts`](request-logging.ts).
3. **An error handler**, which shapes every fault into one body.
4. **One `all("/*")` route**, which dispatches through the registry.

Thereafter each response produces exactly one log event, carrying `requestId`,
`method`, `path`, `statusCode`, and `durationMs`:

| Response | Event | Level | Adds |
| -------- | ----- | ----- | ---- |
| 2xx, 3xx | `http.request.completed` | info | — |
| 404, no endpoint registered | `http.route.not-found` | warn | `errorCode` |
| other 4xx | `http.request.rejected` | warn | `errorCode`, and `errorName`/`errorMessage` when something was thrown |
| 5xx | `http.request.failed` | error | `errorCode`, `errorName`, `errorMessage` |

## Admission

`application/json` is the only body this API accepts. A request carrying anything
else is refused with 415 without reaching a job, so an endpoint's `wire/`
decoder is never handed a value the framework parsed under different rules — a
`text/plain` body used to arrive at a decoder as a bare string.

A request with no body and no content type is unaffected: `GET /health` and a
bodyless `POST` both pass.

## The Error Body

Every fault, whether thrown by a job or raised by Fastify before routing, is
answered with one shape:

```ts
{ error: { code: string, message: string, requestId?: string } }
```

**No message from a thrown value ever reaches the response.** A 5xx answers with
`internal`, a fixed message, and the `requestId`, so an operator can join the
response to the log record that carries the detail. The detail — which for a
database fault is the statement, and sometimes its parameters — stays in the log.

Client faults are translated rather than forwarded, because a framework message
is written for a developer reading a stack trace, not for a caller reading an
API. The codes a caller can receive from the transport — the mapping onto them
lives in [`error-response.ts`](error-response.ts):

| Status | `code` |
| ------ | ------ |
| 400 | `malformed-body` |
| 404 | `endpoint-not-found` |
| 413 | `body-too-large` |
| 415 | `unsupported-media-type` |
| other 4xx | `bad-request` |
| 5xx | `internal` |

## Endpoint Lookup

The registry matches method and path exactly. One convention is applied on top of
it, here rather than there: a `HEAD` that matches no endpoint is retried as
`GET`, and the matching job answers. Fastify strips the body, so the job does not
need to know. A monitor or proxy probing with `HEAD` gets the answer it expects,
and the registry stays a table of endpoint identities rather than a model of
HTTP.

## Procedure Tree

```text
receive registry
  1. Remove the text/plain body parser.
  2. Register the request-logging hooks.
  3. Register the error handler:
     3.1. Map the thrown value to a status and a shaped body.
     3.2. Record the error code and log-safe fields on the request, for the
          response event.
     3.3. Reply with them.
  4. Register one catch-all Fastify route. On each request:
     4.1. Normalize the Fastify request into a RequestEnvelope.
     4.2. Find the job: exact match, then GET when the method is HEAD.
        || no job is registered
           4.2.a.1. Record the endpoint-not-found code on the request.
           4.2.a.2. Reply 404 with the shaped body naming the attempted endpoint.
           4.2.a.3. return
     4.3. Await the job with the envelope.
        || the job throws
           4.3.a.1. Do not catch. The error handler owns every fault, including
                    those raised before this handler was reached.
     4.4. Apply the job's headers when it set any.
     4.5. Reply with the job's status code and body.
```

The route handler no longer catches. It used to, only to log and rethrow — and
that is precisely why the requests Fastify refused before routing went
unrecorded. Logging belongs to the hooks, which see every response; fault shaping
belongs to the error handler, which sees every error.

## Supporting Procedures

| Procedure | Responsibility | File |
| --------- | -------------- | ---- |
| `buildEnvelope`, `pathOf` | Convert captured Fastify request data into a `RequestEnvelope`, deriving the pathname and dropping the framework's wildcard capture. | [build-envelope.ts](build-envelope.ts) |
| `errorResponse`, `endpointNotFoundBody` | Own the single error shape, the code table, and the rule that no thrown message is returned. | [error-response.ts](error-response.ts) |
| `registerRequestLogging` | Register the `onRequest`/`onResponse` hooks that record one event per response. | [request-logging.ts](request-logging.ts) |
| `findJob` | Registry lookup with the `HEAD` to `GET` fallback. | [register-transport.ts](register-transport.ts) |

Each is used by this method alone, so each sits beside the entry rather than in
`shared/`. `findJob` stays in the entry file: it is three lines of lookup that
step 4.2 consists of, and naming it in its own file would name the same procedure
twice.

## Shared Procedures Used

None. `errorFields` comes from [`#observability`](../../../observability/overview.md),
which owns reducing a thrown value to log-safe fields.
