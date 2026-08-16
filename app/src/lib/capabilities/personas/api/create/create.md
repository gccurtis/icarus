# API: `create`

Defines a persona in the caller's project, and returns its id.

Registered as `api.capabilities.personas.create`, built from `projectMutation`.

## Procedure Tree

```text
create(ctx, scope, persona)
├── personaName(persona.name)                          ../../types/persona.ts
├── personaDefinition(persona.definition, scope)       ../../types/definition.ts
├── personaTools(persona.tools)                        ../../types/persona.ts
├── ctx.db.insert("personas", { … })                   create.ts
└── record(ctx, scope, "created")                      ../../../activity/api/shared/record.ts
```

## It always stamps the caller's project

A global persona is one this function cannot make. Publishing to every project
from inside one would let any member of any project put a row in everyone else's
list, and there is no reviewing step for that to pass through.

## A persona with nothing to say is refused here

Not at the point where something tries to run it. The definition and the scope
are checked together, because "carries something" is a statement about the pair:
five empty sections **with** a scope is a pure scope persona and legal, and five
with neither is a row that means nothing.
