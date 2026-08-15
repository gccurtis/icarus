# {{Object Name}} Shared Methods

Lives at `methods/shared/shared.md`.

A method belongs here once a second public method needs it **and** it preserves
an invariant that spans them. It sits inside `methods/` rather than an
object-wide directory because it exists to serve those methods, and both call
trees stay visible through their imports.

Two methods wanting the same code is duplication. Promotion is a claim about an
invariant: something that must hold the same way wherever it is enforced, or the
object's state stops meaning one thing. Without that claim the method belongs in
the directory of the method that owns the behavior.

Sibling method directories never import one another, so this directory is the
only path between them.

## Methods

| Method | Invariant it preserves | Used by | File |
| ------ | ---------------------- | ------- | ---- |
| `{{sharedMethodName}}` | {{What must stay true wherever it is called}} | `{{methodA}}`, `{{methodB}}` | [{{shared-method}}.ts]({{shared-method}}.ts) |

## Method: `{{sharedMethodName}}`

{{What it computes, validates, or normalizes, and what its callers are relieved
of doing themselves.}}

```ts
export const {{sharedMethodName}} = ({{parameters}}): {{ReturnType}} => ...;
```

**Preserves:** {{the invariant, stated as a condition that holds after it
returns}}

**Fails when:** {{the conditions under which it rejects, and what the caller
sees}}

**Touches state:** {{which fields it reads or assigns, or "none — it computes
from its arguments". A shared method that both reads and assigns state is the
one most able to break an invariant it was promoted to protect.}}

## Demotion

A shared method that loses its second caller has lost the reason it is here.
Move it back into the directory of the method that still uses it. Leaving it
means a later reader takes it for a rule when it is only history.
