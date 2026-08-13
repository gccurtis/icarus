# {{Capability Name}} Shared Procedures

Lives at `runtime-api/shared/shared.md`.

A procedure belongs here once a second runtime-api method needs it. It sits
inside `runtime-api/` rather than a capability-wide directory because it exists
to serve those methods, and both call trees stay visible through their imports.

A procedure used by exactly one method does not belong here — it belongs in that
method's directory. Moving it here early hides which method owns the behavior.

## Procedures

| Procedure | Invariant it preserves | Used by | File |
| --------- | ---------------------- | ------- | ---- |
| `{{functionName}}` | {{What must stay true wherever it is called}} | {{methodA}}, {{methodB}} | [{{file-name}}.ts]({{file-name}}.ts) |

## Procedure: `{{functionName}}`

{{What it computes or validates, and what its callers are relieved of doing
themselves.}}

```ts
export const {{functionName}} = ({{parameters}}): {{ReturnType}} => ...;
```

**Preserves:** {{the invariant, stated as a condition that holds after it
returns}}

**Fails when:** {{the conditions under which it throws, and with which error
code}}
