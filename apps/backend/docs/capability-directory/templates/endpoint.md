# Endpoint: `{{METHOD}} {{/path}}`

Lives at `endpoints/{{endpoint-name}}/{{endpoint-name}}.md`.

{{What this endpoint admits and what it is for.}}

## Classification

- **Job:** [`job.ts`](job.ts)
- **Kind:** {{pass-through to a runtime method / composes its own work}}
- **Runtime method:** `{{RuntimeObjectName}}.{{methodName}}` {{or "none — see procedures/"}}
- **Admits input:** {{yes, via wire/ / no}}

A pass-through job decodes, calls one runtime method, and maps the result. If
this job does anything more, it has a [`procedures/`](procedures/procedures.md)
directory and this document explains why that work does not belong on the
runtime object.

## Request

{{The JSON the endpoint accepts. HTTP supplies untrusted JSON, not a trusted
input value, even when the two look identical in TypeScript — `wire/` exists to
make that difference real.}}

```ts
export interface {{RequestName}} {
  readonly {{fieldName}}: {{FieldType}};
}
```

## Admission Rules

`wire/decode.ts` rejects, before the runtime is called:

- {{missing or extra keys}}
- {{unknown discriminants}}
- {{values outside capability limits}}
- {{non-finite numbers, malformed identifiers}}

## Response

```ts
export interface {{ResponseName}} {
  readonly {{fieldName}}: {{FieldType}};
}
```

## Work Procedure

Use `||` for conditional branches.

```text
{{METHOD}} {{/path}}
  1. Receive the framework-neutral RequestEnvelope.
  2. Strictly decode the body as {{RequestName}}.
     || admission fails
        2.a.1. Return 400 with the stable invalid-request body.
  3. {{Call the runtime method, or run the composed procedure.}}
     || {{resource does not exist}}
        3.a.1. Return 404.
     || {{expected revision is stale}}
        3.b.1. Return 409.
     || unexpected error
        3.c.1. Throw, so the web server logs the fault and returns 500.
  4. Return {{status}} with {{response}}.
```

## Tests

| Kind | Location |
| ---- | -------- |
| Behavior | [`../../test/unit/endpoints/{{endpoint-name}}.test.ts`](../../test/unit/endpoints/{{endpoint-name}}.test.ts) |
| Request | [`../../test/bruno/`](../../test/bruno/) |
