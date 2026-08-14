# {{Capability Name}} Types

Lives at `types/types.md`.

`types/` holds the canonical model and the public contract. It contains no Kysely
row shapes — those live in [`persistence/stored-types.ts`](../persistence/persistence.md)
— and no wire shapes, because there is no wire format to describe: types cross
the boundary on their own when a function is re-exported through a `.remote.ts`.

Private model types live here too; the doors decide which of them leave.

## Files

| File | Holds |
| ---- | ----- |
| `ids.ts` | {{Branded or aliased identifiers this capability allocates}} |
| `{{aggregate}}.ts` | {{Canonical model types}} |
| `inputs.ts` | {{Inputs accepted by this capability's public functions}} |
| `results.ts` | {{Values those functions return}} |

## Public Types

Types re-exported through `index.server.ts`. A consumer depends on these.

### Type: `{{TypeName}}`

{{What it represents and when a consumer holds one.}}

```ts
export interface {{TypeName}} {
  readonly {{fieldName}}: {{FieldType}};
}
```

## Input Types

The shapes a browser can send, once a function is browser-reachable. Two rules
bind every one of them:

- **No `projectId` or `userId` field.** Scope is a separate first parameter,
  derived server-side. A scope field on an input is a client naming its own
  authority.
- **The type is a claim, not a check.** Admission is `'unchecked'`, so
  TypeScript's opinion of this shape does not survive the wire — the function
  that receives it validates it.

### Type: `{{InputTypeName}}`

{{What it represents, and which function admits it.}}

```ts
export interface {{InputTypeName}} {
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
