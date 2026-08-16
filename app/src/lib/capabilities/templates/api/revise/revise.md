# API: `revise`

Replaces a template with the version the author has in front of them.

Registered as `api.capabilities.templates.revise`, built from `projectMutation`.

## Procedure Tree

```text
revise(ctx, scope, id, revision, definition)
├── requireOwnTemplate(ctx, scope, id)       ../shared/require-own-template.ts
├── templateName(definition.name)            ../../types/template.ts
├── templateSlots(definition.slots)          ../../types/slot.ts
├── ctx.db.patch(id, …)                      revise.ts
└── record(ctx, scope, "revised")            ../../../activity/api/shared/record.ts
```

## Nothing already created from it changes

That is the point of instantiation being a full copy, and it is what makes this
function safe to offer at all: an edit here cannot silently rewrite a document
belonging to someone who has never seen this template.

## `revision` is the stale-form check

Convex's transactions cover a read and a write inside one mutation. They do not
cover a form someone opened before lunch, and a whole-body replacement is exactly
the write where that loses another person's work — so a caller sends the revision
it read, and a write authored against a revision that has moved is refused rather
than applied over the top.

## The target cannot change

A template that starts making decks instead of documents is a different template.
Every resource that recorded this one as provenance would be pointing at
something it did not come from, and the row's `target` — the label a picker files
it under — would have to change under readers who already listed it.
