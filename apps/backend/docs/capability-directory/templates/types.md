# {{Capability Name}} Types

Lives at `types/types.md`.

`types/` holds the canonical model and the runtime contract. It contains no
Kysely row shapes and no HTTP or Fastify shapes — those live in
`persistence/stored-types.ts` and `endpoints/*/wire/` respectively. Private model
types live here too; `index.ts` decides which of them leave the capability.

## Files

| File | Holds |
| ---- | ----- |
| `ids.ts` | {{Branded or aliased identifiers this capability allocates}} |
| `{{aggregate}}.ts` | {{Canonical model types}} |
| `runtime-inputs.ts` | {{Inputs accepted by the runtime object's methods}} |
| `runtime-results.ts` | {{Values its methods return}} |

## Public Types

Types re-exported through `index.ts`. A consumer depends on these.

### Type: `{{TypeName}}`

{{What it represents and when a consumer holds one.}}

```ts
export interface {{TypeName}} {
  readonly {{fieldName}}: {{FieldType}};
}
```

## Private Types

Types used inside the capability and deliberately not exported. Say why each
stays private.

### Type: `{{PrivateTypeName}}`

{{What it represents, and what would break if a consumer depended on it.}}

```ts
export interface {{PrivateTypeName}} {
  readonly {{fieldName}}: {{FieldType}};
}
```
