# {{Capability Name}} Endpoints

Lives at `endpoints/endpoints.md`.

Each endpoint gets a directory holding its document, `job.ts`, and — when it
admits input — `wire/`. [`register.ts`](register.ts) maps endpoint identities to
those jobs in the runtime-scoped registry; it contains registration only, no
decoding and no capability behavior.

## Endpoint Surface

| Method | Path | Job | Purpose |
| ------ | ---- | --- | ------- |
| `{{METHOD}}` | `{{/path}}` | [`{{endpoint-name}}/`]({{endpoint-name}}/{{endpoint-name}}.md) | {{What it admits and does}} |

## Registration

`{{registerCapabilityEndpoints}}(registry, {{runtimeObject}})` in
[`register.ts`](register.ts), called once from
[`build-runtime.ts`](../../../runtime/runtime.md) before the server listens, in
the same list as every other capability's registration. A duplicate endpoint key
is a startup wiring error thrown by the registry.

## Error Body

Expected failures carry stable, non-sensitive messages. Unexpected failures are
not converted here — a job throws, and the web server logs the fault and returns
500.

```ts
export interface {{CapabilityHttpError}} {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}
```

## Status Mapping

The mapping every job in this capability follows. A job that deviates says so in
its own document.

| Outcome | Status |
| ------- | ------ |
| {{resource created}} | 201 |
| {{mutation succeeded}} | 200 |
| {{permanent delete}} | 204 |
| {{admission or validation failure}} | 400 |
| {{resource does not exist}} | 404 |
| {{expected revision is stale}} | 409 |

## Endpoint Invariants

- Every admitted input is a fresh validated value; wire objects never become
  canonical state directly.
- Unknown keys and unknown discriminants are rejected.
- Expected conflicts are responses, not logged server faults.
- Jobs contain no Fastify types.
- Registration contains no domain or persistence behavior.
