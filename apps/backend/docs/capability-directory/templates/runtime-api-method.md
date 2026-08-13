# API: `{{methodName}}`

Lives at `runtime-api/{{method-name}}/{{method-name}}.md`.

{{What this method is for, who calls it, and when it should be used instead of a
neighboring method.}}

## Classification

- **Owner:** `{{RuntimeObjectName}}`
- **Execution:** {{mutator / accessor}}
- **Transaction:** {{none / PG transaction}}
- **Entry:** [`{{method-name}}.ts`]({{method-name}}.ts)

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `{{inputName}}` | `{{InputType}}` | {{Meaning, and any constraint the caller must satisfy}} |

## Output

`{{OutputType}}`

{{What the caller receives, including the meaningful success variants.}}

## Failures

| Error code | Cause |
| ---------- | ----- |
| `{{error-code}}` | {{The condition that produces it}} |

## Effects

State "None" when the method is read-only and has no external effects.

- {{Canonical state mutation, if any.}}
- {{Revision created, if any.}}
- {{Job submitted or external call made, if any.}}

## Procedure Tree

Use `||` for conditional branches. Link supporting procedures to their files.

```text
receive {{input}}
  1. {{first operation}}
  2. {{next operation}}
     || {{condition}}
        2.a.1. {{conditional behavior}}
     || {{alternative condition}}
        2.b.1. {{alternative behavior}}
  3. {{commit or finalize}}
  4. return {{output}}
```

## Supporting Procedures

Files in this directory, used by this method alone. A procedure a second method
needs moves to [`../shared/`](../shared/shared.md) instead of being imported
across method directories.

| Procedure | Responsibility | File |
| --------- | -------------- | ---- |
| `{{functionName}}` | {{What it does for this method}} | [{{file-name}}.ts]({{file-name}}.ts) |

## Shared Procedures Used

| Procedure | Why this method needs it |
| --------- | ------------------------ |
| `{{functionName}}` | {{The invariant it preserves here}} |
