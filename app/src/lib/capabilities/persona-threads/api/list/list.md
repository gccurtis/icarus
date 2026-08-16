# API: `list`

The project's chats, or the ones with one persona.

Registered as `api.capabilities.personaThreads.list`, built from `projectQuery`.

## Procedure Tree

```text
list(ctx, scope, personaId?)
├── db.query("personaThreads").withIndex("by_persona" | "by_project")   list.ts
└── asThread(row)                                                      ../shared/as-thread.ts
```

## The narrow form is one indexed range

`by_persona` leads with `projectId` like every index here, so a persona's own
page — "what have we been asking this one" — is a range read rather than a filter
over every chat in the project.

A thread with a global persona appears in its project's list and nowhere else:
the thread is project content even when the persona it is with is not.
