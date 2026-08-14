# {{Capability Name}} Shared Procedures

Lives at `api/shared/shared.md`.

A procedure belongs here once a second function in this capability needs it. It
sits inside `api/` rather than a capability-wide directory because it exists to
serve those functions, and both call trees stay visible through their imports.

A procedure used by exactly one function does not belong here — it belongs in that
function's directory. Moving it here early hides which function owns the
behavior.

## Procedures

| Procedure | Invariant it preserves | Used by | File |
| --------- | ---------------------- | ------- | ---- |
| `{{procedureName}}` | {{What must stay true wherever it is called}} | {{functionA}}, {{functionB}} | [{{file-name}}.ts]({{file-name}}.ts) |

## Procedure: `{{procedureName}}`

{{What it computes or validates, and what its callers are relieved of doing
themselves.}}

```ts
export const {{procedureName}} = ({{parameters}}): {{ReturnType}} => ...;
```

**Preserves:** {{the invariant, stated as a condition that holds after it
returns}}

**Fails when:** {{the conditions under which it throws, and with which error
code}}

## Procedure: `record`

Every capability has this one, and it is why instrumentation lives here rather
than wrapping the entries: a wrapper above a procedure can be bypassed, and a
call inside it cannot.

```ts
export const record = async <T>(
  {{operation}}: string,
  {{fields}}: Record<string, unknown>,
  run: () => Promise<T>
): Promise<T> => ...;
```

**Records:** {{what it writes on start, on completion, and on failure}}

**Never records:** {{the values it deliberately omits. A log is copied, shipped,
and retained far longer than the data it describes, so authored content, secrets,
and personal fields stay out of it — names, shapes, and counts are enough to
diagnose with.}}

**Classifies:** a failure this capability chose and stated with a code is a
decision and is recorded as such; anything else is a fault. Collapsing the two
means every ordinary rejection reads like a bug and real bugs stop standing out.
