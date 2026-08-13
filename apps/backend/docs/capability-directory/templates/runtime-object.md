# Runtime Object: `{{RuntimeObjectName}}`

Lives at `runtime-objects/{{object-name}}/{{object-name}}.md`.

## Responsibility

{{What this object owns, what it coordinates, and how consumers use it.}}

It deliberately does not own {{the concerns a reader might expect here but that
belong to another capability or directory}}.

## Interface

Declared in [`definition.ts`](definition.ts). Each method is a delegation to its
[`runtime-api`](../../runtime-api/runtime-api.md) entry; this file holds no
persistence queries, no algorithms, and no wire decoding.

```ts
export interface {{RuntimeObjectName}} {
  {{methodName}}(input: {{InputType}}): Promise<{{OutputType}}>;
}
```

## Fields

| Field | Type | Description |
| ----- | ---- | ----------- |
| `{{fieldName}}` | `{{FieldType}}` | {{What it holds and why the object needs it}} |

## Constructor

`{{createObjectName}}()` in [`constructor.ts`](constructor.ts).

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `{{parameterName}}` | `{{ParameterType}}` | {{Dependency or configuration supplied at startup}} |

### Construction Steps

Use `||` for conditional branches.

```text
1. {{Receive required ports and configuration.}}
2. {{Create controlled runtime state or registries.}}
3. {{Create tables or register handlers when applicable.}}
   || {{initialization condition fails}}
      3.a.1. {{Return or throw the defined initialization error.}}
4. {{Return the initialized runtime object.}}
```

## Invariants

- {{What must remain true of this object's state for its whole lifetime.}}
- {{What it guarantees to callers regardless of which method they call.}}
