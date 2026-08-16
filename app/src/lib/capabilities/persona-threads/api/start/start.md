# API: `start`

Opens a chat with a persona, and returns its id.

Registered as `api.capabilities.personaThreads.start`, built from
`projectMutation`.

## Procedure Tree

```text
start(ctx, scope, personaId, title)
├── personaThreadTitle(title)                      ../../types/persona-thread.ts
├── requirePersona(ctx, scope, personaId)          ../../../personas/api/shared/require-persona.ts
├── ctx.db.insert("personaThreads", { … })         start.ts
└── record(ctx, scope, "started")                  ../../../activity/api/shared/record.ts
```

## It creates one row, and that row is the thread

Nothing is created beside it. The first turn is
[`messages.post`](../../../messages/api/post/post.md) naming this id, so a chat
nobody has spoken in yet is a chat with no messages rather than an empty
conversation object.

## The persona is resolved by the capability that owns personas

Which is what makes a persona belonging to every project chattable here, and one
belonging to another project not. Repeating the rule would give this function its
own opinion about what "global" means.
