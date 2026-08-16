# API: `revise`

Replaces a persona with the version the author has in front of them.

Registered as `api.capabilities.personas.revise`, built from `projectMutation`.

## Procedure Tree

```text
revise(ctx, scope, id, revision, draft)
├── requireOwnPersona(ctx, scope, id)                 require-own-persona.ts
│   └── requirePersona(ctx, scope, id)                ../shared/require-persona.ts
├── personaName(draft.name)                           ../../types/persona.ts
├── personaDefinition(draft.definition, draft.scope)  ../../types/definition.ts
├── personaTools(draft.tools)                         ../../types/persona.ts
├── ctx.db.patch(id, { revision: n + 1, … })          revise.ts
└── record(ctx, scope, "revised")                     ../../../activity/api/shared/record.ts
```

## Everything referencing it shows the new one

A task holds an id rather than a copy, so this write changes what every past task
displays. That is the point — a persona is an identity — and it is exactly why
`revision` is a stale-form check here: Convex's transactions cover a read and a
write in one mutation, not a form opened before lunch, and a whole replacement is
the write where that quietly restates somebody else's work.

## A global is refused as "not editable"

Not as absent. It is in the list the caller just read, so denying it exists would
withhold the one thing they need told: copy it, then edit the copy. There is no
sharing mechanism between the two, which is what keeps "who can edit this"
answerable from the row alone.

`requireOwnPersona` sits here rather than in `shared/` because one function calls
it. Promotion means an invariant spans functions, not that a name reads well.
