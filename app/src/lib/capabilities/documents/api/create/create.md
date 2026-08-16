# API: `create`

Starts a document, and returns its id.

Registered as `api.capabilities.documents.create`, built from `projectMutation`,
so the caller's token is resolved to a membership before this runs and the
handler receives `ctx.scope` rather than a project it could have chosen.

## Procedure Tree

```text
create(ctx, scope, title, templateId?)
├── documentTitle(title)                    ../../types/document.ts
├── ctx.db.insert("documents", …)           create.ts
└── record(ctx, scope, "created")           ../../../activity/api/shared/record.ts
```

## A new document has no body

Nothing is written to `resourceSnapshots` here, and nothing will be. Pass 2's
first change set is what gives a document content, so creating and opening are
separate writes rather than one that has to guess at an empty body's shape — and
a document that was never opened costs one row.

## It returns the id and nothing else

The id is the one thing the caller does not already know; the title and the actor
it supplied or implied. Convex re-runs `list` for every subscriber the moment
this commits, so an echoed row would be a second answer, staler than the one
already on its way.

## `createdBy` and `updatedBy` are both set

They differ from the moment someone else edits it, and equal values on day one
are not a duplication — "who made this" and "who touched it last" are different
questions a document list asks separately.
