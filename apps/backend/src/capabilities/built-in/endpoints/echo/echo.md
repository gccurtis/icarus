# Endpoint: `POST /echo`

Lives at `endpoints/echo/echo.md`.

Reflects a request back to its sender. It exists so the transport path can be
exercised end to end — that a body was parsed, that a route was found, that a
response was serialized — without depending on any capability that owns state.

## Classification

- **Job:** [`job.ts`](job.ts)
- **Kind:** composes its own work — there is no runtime object behind it
- **Admits input:** yes, via [`wire/`](wire/decode.ts)

The job has no `procedures/`: it decodes, builds one object, and returns. There
is nothing composed that a reviewer would need justified.

## Request

Any JSON value. Echo's purpose is to return whatever it is given, so it declares
no required key and no rejected value.

`wire/` still exists, because what arrives is untrusted JSON rather than a
trusted input value even when the two look identical in TypeScript.
[`wire/decode.ts`](wire/decode.ts) copies the three values the endpoint reflects
out of the envelope into a fresh `EchoRequest`:

```ts
export interface EchoRequest {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}
```

`body` stays `unknown`: it is carried, never inspected.

## Admission Rules

`wire/decode.ts` rejects nothing — an endpoint whose contract is "return what I
sent" has nothing to reject, and inventing a rule here would narrow the contract
callers already have.

What decoding does enforce is scope. The job receives only `method`, `path`, and
`body`; it has no access to headers, query, or params, so no request field can
reach the response by accident.

## Response

```ts
export interface EchoResponse {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
  readonly processedAt: string;
}
```

`method` and `path` are the normalized values the transport resolved, not the
raw request line — `path` is the URL pathname with any query string removed.
`processedAt` is ISO 8601, stamped when the job answers.

## Work Procedure

```text
POST /echo
  1. Receive the framework-neutral RequestEnvelope.
  2. Decode the envelope into an EchoRequest.
  3. Build the EchoResponse, stamping the current time.
  4. Return 200 with that body.
```

There is no admission failure branch and no 400. An unexpected throw is a fault
the web server logs before returning 500.

## Tests

| Kind | Location |
| ---- | -------- |
| Request | [`../../test/bruno/echo.bru`](../../test/bruno/echo.bru) |
