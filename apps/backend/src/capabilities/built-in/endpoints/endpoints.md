# Built-in Endpoints

Lives at `endpoints/endpoints.md`.

Each endpoint gets a directory holding its document, `job.ts`, and — when it
admits input — `wire/`. [`register.ts`](register.ts) maps endpoint identities to
those jobs in the runtime-scoped registry; it contains registration only, no
decoding and no capability behavior.

These are the whole capability. Built-in has no runtime object, so each job owns
its complete procedure rather than delegating to a runtime method.

## Endpoint Surface

| Method | Path | Job | Purpose |
| ------ | ---- | --- | ------- |
| `GET` | `/health` | [`health/`](health/health.md) | Admits nothing; reports process identity and the moment it answered. |
| `POST` | `/echo` | [`echo/`](echo/echo.md) | Admits any JSON body; reflects the method, path, and body with a timestamp. |

## Registration

`registerBuiltInEndpoints(registry)` in [`register.ts`](register.ts), called from
[`build-runtime.ts`](../../../runtime/runtime.md) alongside every other
capability's registration. Built-in is the one whose call takes nothing but the
registry: the others pass a runtime object for their jobs to close over, and
Built-in has none.

It was registered inside `createRegistry()` until the registry stopped importing
capabilities; [`registry.md`](../../../runtime/registry.md) records why that
moved.

A duplicate endpoint key is a startup wiring error thrown by the registry.

## Error Body

Neither endpoint declares an error shape of its own, because neither has an
expected failure: `/health` admits no input, and `/echo` admits any JSON body. An
unexpected failure is not converted here — the job throws, and
[the transport](../../platform/web-server/runtime-api/register-transport/register-transport.md)
logs the fault and answers with its own shaped body. The thrown message is never
part of it.

That transport shape is also what a caller gets when the request never reaches a
job: a body that is not JSON, a media type other than `application/json`, or a
body over the configured limit is refused before either endpoint runs.

## Status Mapping

| Outcome | Status |
| ------- | ------ |
| answered | 200 |
| refused by the transport before the job | 400, 413, 415 |
| the job threw | 500 |

Only the first row belongs to this capability. The rest are listed because they
are what a caller of these two endpoints actually sees, and they are decided
entirely by the transport.

## Endpoint Invariants

- Every admitted input is a fresh value produced by `wire/decode.ts`; the request
  envelope never reaches a job's response.
- Jobs contain no Fastify types. They see `RequestEnvelope` and return
  `EndpointJobResponse`.
- Registration contains no behavior — no decoding, no timestamps, no bodies.
- A job selects its own status code. The transport maps nothing.
