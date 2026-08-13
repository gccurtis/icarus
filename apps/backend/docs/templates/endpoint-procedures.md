# `{{METHOD}} {{/path}}` Procedures

Lives at `endpoints/{{endpoint-name}}/procedures/procedures.md`.

This directory exists only because this job composes work of its own rather than
calling a single runtime method. Its presence is a review signal, so the first
thing this document must do is justify it.

## Why This Job Composes

{{Why the work does not belong on the runtime object. Legitimate reasons: it
coordinates two capabilities neither of which should depend on the other; it is
transport-shaped work with no meaning to a non-HTTP caller; it exists only to
serve this endpoint's contract.

If the answer is "the runtime method would have been awkward to write", the work
belongs in `runtime-api/` instead and this directory should not exist.}}

## Procedures

| Procedure | Responsibility | File |
| --------- | -------------- | ---- |
| `{{functionName}}` | {{What it does}} | [{{file-name}}.ts]({{file-name}}.ts) |

## Composition

```text
job.ts
  1. {{first sub-procedure}}
  2. {{second sub-procedure}}
     || {{condition}}
        2.a.1. {{conditional behavior}}
  3. {{runtime method call, if any}}
  4. {{map to response}}
```

## Boundaries

- These procedures contain no persistence queries; they call the store through
  the runtime object or through a capability's public API.
- They contain no Fastify types.
- They are not imported by `runtime-api/`. If a runtime method needs this
  behavior, it moves to `runtime-api/` and this job calls the method instead.
