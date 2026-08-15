# {{Capability Name}} Types

Lives at `types/types.md`.

`types/` holds the canonical model and the public contract. It contains no stored
row shapes — a stored shape is a storage decision and must not leak into the
public contract — and no wire shapes, because there is no wire format to
describe: Convex generates the client API from the functions it pushed, so types
cross the boundary on their own.

Private model types live here too. What leaves is decided by what the deployment
door's handlers return, not by a re-export list.

## Files

| File | Holds |
| ---- | ----- |
| `ids.ts` | {{Branded or aliased identifiers this capability allocates}} |
| `{{aggregate}}.ts` | {{Canonical model types}} |
| `inputs.ts` | {{Inputs accepted by this capability's public functions}} |
| `results.ts` | {{Values those functions return}} |

## Public Types

Types a handler returns, and so a caller receives. A consumer depends on these.

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
