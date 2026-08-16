# Resource Sets Types

Lives at `types/types.md`.

| File | Holds |
| --- | --- |
| [`resource-set.ts`](resource-set.ts) | `ResourceSet`, `ResourceSetDraft`, and `resourceSetName` |

## The grammar is not here

`SetExpression`, `ResourceRef`, and `ResourceKind` live in
[`$shared`](../../shared/types/types.md). A persona's scope, a prompt block's,
and a derived output's inputs are all the same question, and this table — the one
that *names* an expression — is only the fourth thing to ask it. Owning the
grammar here would make three capabilities import their scope from a fifth.

What this capability owns is the row, the refusals, and the resolver.

## `ResourceSet` is not the row

It carries `id`, because a set is reached by key, and drops `projectId`, which
every row a caller receives shares with the project they asked about.

It carries no members. What a set selects is
[`resolve`](../api/resolve/resolve.md)'s answer at the moment it is asked, and a
copy on this type would be a snapshot a reader could mistake for the set.

## `resourceSetName` sits here rather than in `api/shared/`

It says what a name *is* — trimmed, and never empty — which is a statement about
the model rather than a step in a procedure, the same reason
[`documents`](../../documents/types/types.md) keeps `documentTitle` in `types/`.

A set is chosen by name in every surface that offers one, and named again in the
refusal a cycle produces, so an unnamed set is both a row nobody can pick and a
cycle nobody can read.
