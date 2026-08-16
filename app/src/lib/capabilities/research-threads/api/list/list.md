# API: `list`

The project's threads, or the ones working on one question.

Registered as `api.capabilities.researchThreads.list`, built from `projectQuery`.

## Procedure Tree

```text
list(ctx, scope, questionId?)
├── ctx.db.query("researchThreads").withIndex("by_question" | "by_project")  list.ts
└── asThread(row)                                                           ../shared/as-thread.ts
```

## A discover thread is in the wide form, not outside it

`projectId` is on the row rather than reached through a question, which is what
keeps a thread that is looking for things inside every read. A design that hung
threads off questions would lose exactly the threads that find the questions.

## The narrow form is a question's context panel

`by_question` makes it one indexed range rather than a filter over the project,
and it leads with `projectId` like every index here — so a read that forgot the
predicate could not stray into another project's threads.

There is no equivalent for a hypothesis. Nothing renders that list yet, and an
index nobody reads is a write cost with no reader.
