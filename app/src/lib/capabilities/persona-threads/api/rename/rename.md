# API: `rename`

Retitles a chat.

Registered as `api.capabilities.personaThreads.rename`, built from
`projectMutation`.

## Procedure Tree

```text
rename(ctx, scope, id, title)
├── requireThread(ctx, scope, id)         ../shared/require-thread.ts
├── personaThreadTitle(title)             ../../types/persona-thread.ts
├── ctx.db.patch(id, { title, … })        rename.ts
└── record(ctx, scope, "renamed")         ../../../activity/api/shared/record.ts
```

## The title is the only field that can change

Which is why this is a rename and not a revise. A chat is usually opened with
whatever the first question was and named properly once it turns out to be about
something — so retitling is the ordinary case, and there is nothing else on the
row it could sensibly be bundled with.
