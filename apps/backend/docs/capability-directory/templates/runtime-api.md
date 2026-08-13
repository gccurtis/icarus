# {{Capability Name}} Runtime API

Lives at `runtime-api/runtime-api.md`.

One directory per public method on {{`RuntimeObjectName`}}, named after the
method in kebab-case, containing an entry file of the same name that owns that
method's complete orchestration. Supporting procedures used by only one method
sit beside it in its directory.

## Methods

| Method | Directory | Execution | Description |
| ------ | --------- | --------- | ----------- |
| `{{methodName}}` | [`{{method-name}}/`]({{method-name}}/{{method-name}}.md) | {{mutator / accessor}} | {{What it does}} |

Every method on the exported interface appears here, and every directory under
`runtime-api/` appears as a method. `pnpm lint` enforces both directions.

## Shared Procedures

A supporting procedure is promoted to [`shared/`](shared/shared.md) once a
second method needs it. Promotion means the procedure preserves an invariant
that spans methods — not merely that two call sites wanted the same code.

{{Summarize what lives in shared/ and why, or state that no procedure has been
promoted yet.}}

## Common Shape

{{The orchestration pattern these methods follow — for example: load current
state under an expected revision, build a candidate, commit under a
compare-and-swap, return the result. State it once here so each method document
can describe only what it does differently.}}

```text
1. {{shared first step}}
2. {{shared second step}}
3. {{shared commit step}}
```
