# API: `create`

Starts a document, and returns its id.

Registered as `api.capabilities.documents.create`, built from `projectMutation`,
so the caller's token is resolved to a membership before this runs and the
handler receives `ctx.scope` rather than a project it could have chosen.

## Procedure Tree

```text
create(ctx, scope, title, templateId?, body?)
├── documentTitle(title)                    ../../types/document.ts
├── ctx.db.insert("documents", …)           create.ts
├── emptyDocumentBody()                     ../../types/body.ts
├── start(ctx, scope, resource, body)       ../../../revisions/api/shared/start.ts
└── record(ctx, scope, "created")           ../../../activity/api/shared/record.ts
```

`body` is the one a template supplies, and the empty one otherwise — see
[`templates.instantiate`](../../../templates/api/instantiate/instantiate.md). It
is stored as given and never read, which is what makes a document from a template
a complete copy that owes it nothing.

## The row and the body are written together

A document is spread across three tables, and the row alone is not a document
anyone can open: [`revisions.read`](../../../revisions/api/read/read.md) folds
recent change sets onto a leader snapshot, and a resource with no leader is not
found. Committing one without the other would produce exactly that — a row in
every list that opens to a refusal.

**What an empty body looks like is decided here.** Nothing in `revisions` has ever
inspected a body, and that genericity is the reason one snapshot table serves
documents, decks, and workbooks. So the emptiest document — a page with no rows —
is this capability's to state.

## It returns the id and nothing else

The id is the one thing the caller does not already know; the title and the actor
it supplied or implied. Convex re-runs `list` for every subscriber the moment
this commits, so an echoed row would be a second answer, staler than the one
already on its way.

## `createdBy` and `updatedBy` are both set

They differ from the moment someone else edits it, and equal values on day one
are not a duplication — "who made this" and "who touched it last" are different
questions a document list asks separately.
