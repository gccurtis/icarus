# Endpoint: `GET /health`

Lives at `endpoints/health/health.md`.

Reports that this backend process is running and answering HTTP. It is the
liveness check — a monitor, load balancer, or developer asking whether the
process is up.

It is not a readiness check. A 200 says nothing about the database, configured
providers, or whether any other capability was constructed successfully.
Widening it to mean that would change what every existing caller is told, so a
dependency-aware check belongs at a different path.

## Classification

- **Job:** [`job.ts`](job.ts)
- **Kind:** composes its own work — there is no runtime object behind it
- **Admits input:** no

The job has no `wire/` because the endpoint admits nothing: no body, no
parameters, no query. It never reads the request envelope. It has no
`procedures/` either — the whole procedure is three fixed fields, and splitting
it would hide it rather than clarify it.

## Response

`ApiHealth`, declared in [`job.ts`](job.ts) beside the job that produces it,
since there is no `wire/` to hold it. It is the one type Built-in exports.

```ts
export interface ApiHealth {
  service: "backend";
  status: "ok";
  timestamp: string;
}
```

`service` and `status` are literal types: this endpoint has exactly one
successful answer, and a caller narrowing on `status` gets no false branch.
`timestamp` is ISO 8601, produced when the job answers — a caller can use it to
detect a stale or cached response.

## Work Procedure

```text
GET /health
  1. Build the fixed ApiHealth body, stamping the current time.
  2. Return 200 with that body.
```

There is no failure branch. If a call ever throws, that is a fault in the
process, and the web server logs it and returns 500.

## Tests

| Kind | Location |
| ---- | -------- |
| Request | [`../../test/bruno/health.bru`](../../test/bruno/health.bru) |
