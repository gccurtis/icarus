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
[`createRegistry()`](../../../registry/registry-constructor.ts) — not from
`main.ts`, as other capabilities are. Built-in takes no constructor argument and
depends on nothing, so registering it where the registry is built means the
endpoint table is never empty and every runtime serves these two endpoints
without a wiring step that could be forgotten.

A duplicate endpoint key is a startup wiring error thrown by the registry.

## Error Body

Neither endpoint has an expected failure: `/health` admits no input, and `/echo`
admits any body. There is no error shape to declare. An unexpected failure is
not converted here — the job throws, and the web server logs the fault and
returns 500.

## Status Mapping

| Outcome | Status |
| ------- | ------ |
| answered | 200 |

## Endpoint Invariants

- Every admitted input is a fresh value produced by `wire/decode.ts`; the request
  envelope never reaches a job's response.
- Jobs contain no Fastify types. They see `RequestEnvelope` and return
  `EndpointJobResponse`.
- Registration contains no behavior — no decoding, no timestamps, no bodies.
- A job selects its own status code. The transport maps nothing.
