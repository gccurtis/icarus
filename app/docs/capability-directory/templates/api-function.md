# API: `{{functionName}}`

Lives at `api/{{function-name}}/{{function-name}}.md`.

{{What this function is for, who calls it, and when it should be used instead of a
neighboring function.}}

## Classification

- **Kind:** {{query — reads, subscribable, may not write / mutation — writes, one serializable transaction}}
- **Handler:** [`{{function-name}}.ts`]({{function-name}}.ts)
- **Registered as:** `api.capabilities.{{capabilityName}}.{{functionName}}`

**Every registered function is reachable by anything holding the deployment
URL.** There is no unexposed public function.

## Signature

```ts
export const {{functionName}} = async (
  ctx: {{QueryCtx / MutationCtx}},
  scope: Scope,
  {{inputName}}: {{InputType}}
): Promise<{{OutputType}}> => ...;
```

`scope` is produced by the gate before this runs. `{{InputType}}` carries no
project — the caller's payload holds a project *token*, resolved against their
own memberships, so a client cannot name authority it does not have.

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `{{inputName}}` | `{{InputType}}` | {{Meaning, and any constraint the caller must satisfy}} |

## Admission

The `args` validator in the deployment door is the security boundary — it decides
what shape reaches this handler at all.

{{What this handler rejects beyond shape: values that are well-formed but not
permitted, and the procedure that checks each one. Canonicalization belongs here
too; it is semantics rather than admission.}}

## Output

`{{OutputType}}`

{{What the caller receives, including the meaningful success variants.}}

## Failures

| Error code | Cause |
| ---------- | ----- |
| `{{error-code}}` | {{The condition that produces it}} |

{{Distinguish a decision from a fault. A refusal stated with a code reaches the
caller as a `ConvexError` payload; anything else is redacted to an opaque server
error, which is exactly the line that should be drawn.}}

## Effects

State "None" when the function is a query.

- {{What it writes.}}
- {{What it schedules, if anything.}}

## Procedure Tree

The tree is also this directory's layout. Name real paths — a rename that does
not update the tree is a detectable defect rather than a stale comment. Use `||`
for conditional branches.

```text
{{functionName}}(ctx, scope, {{input}})
├── {{firstProcedure}}()            {{first-procedure}}.ts
├── {{branchingProcedure}}()        {{branching-procedure}}/{{branching-procedure}}.ts
│   ├── {{subProcedure}}()          {{branching-procedure}}/{{sub-procedure}}.ts
│   || {{condition}}
│   │   └── {{conditionalStep}}()   {{branching-procedure}}/{{conditional-step}}.ts
│   || {{alternative condition}}
│       └── {{alternativeStep}}()   {{branching-procedure}}/{{alternative-step}}.ts
└── {{the read or write against the table}}
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
