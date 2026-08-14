# API: `{{functionName}}`

Lives at `api/{{function-name}}/{{function-name}}.md`.

{{What this function is for, who calls it, and when it should be used instead of a
neighboring function.}}

## Classification

- **Effect:** {{mutator / accessor}}
- **Transaction:** {{none / one PG transaction}}
- **Entry:** [`{{function-name}}.ts`]({{function-name}}.ts)
- **Browser-reachable:** {{yes, via [`{{function-name}}.remote.ts`]({{function-name}}.remote.ts) / no}}

## Signature

```ts
export const {{functionName}} = async (
  scope: Scope,
  {{inputName}}: {{InputType}}
): Promise<{{OutputType}}> => ...;
```

`scope` is derived server-side. `{{InputType}}` carries no `projectId` or
`userId` — a client cannot name its own authority.

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `{{inputName}}` | `{{InputType}}` | {{Meaning, and any constraint the caller must satisfy}} |

## Admission

Include this section when a `.remote.ts` exists. Remote functions are declared
`'unchecked'`, so this function is the only thing between a hostile payload and
the database.

{{What it rejects and where: unknown keys, unknown discriminants, out-of-range
values, values that are well-formed but not permitted for this caller. Name the
procedure that does each check.}}

## Output

`{{OutputType}}`

{{What the caller receives, including the meaningful success variants.}}

## Failures

| Error code | Cause |
| ---------- | ----- |
| `{{error-code}}` | {{The condition that produces it}} |

{{Distinguish a decision from a fault: a rejection this capability chose and
states with a code is not the same as something that went wrong. The
instrumentation records them differently.}}

## Effects

State "None" when the function is read-only and has no external effects.

- {{Canonical state mutation, if any.}}
- {{Revision created, if any.}}
- {{External call made, if any.}}

## Procedure Tree

The tree is also this directory's layout. Name real paths — a rename that does
not update the tree is a detectable defect rather than a stale comment. Use `||`
for conditional branches.

```text
{{functionName}}(scope, {{input}})
├── record()                        ../shared/record.ts
├── {{firstProcedure}}()            {{first-procedure}}.ts
├── {{branchingProcedure}}()        {{branching-procedure}}/{{branching-procedure}}.ts
│   ├── {{subProcedure}}()          {{branching-procedure}}/{{sub-procedure}}.ts
│   || {{condition}}
│   │   └── {{conditionalStep}}()   {{branching-procedure}}/{{conditional-step}}.ts
│   || {{alternative condition}}
│       └── {{alternativeStep}}()   {{branching-procedure}}/{{alternative-step}}.ts
└── {{commit or read against the table}}
```

## Supporting Procedures

Files in this directory, used by this function alone. A procedure a second
function needs moves to [`../shared/`](../shared/shared.md) rather than being
imported across function directories.

A procedure with sub-procedures of its own is a directory containing a `.ts` of
the same name, not a pile of siblings here.

| Procedure | Responsibility | File |
| --------- | -------------- | ---- |
| `{{procedureName}}` | {{What it does for this function}} | [{{file-name}}.ts]({{file-name}}.ts) |

## Shared Procedures Used

| Procedure | Why this function needs it |
| --------- | -------------------------- |
| `{{procedureName}}` | {{The invariant it preserves here}} |
