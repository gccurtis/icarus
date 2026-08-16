# API: `remove`

Deletes a template.

Registered as `api.capabilities.templates.remove`, built from `projectMutation`.

## Procedure Tree

```text
remove(ctx, scope, id)
├── requireOwnTemplate(ctx, scope, id)       ../shared/require-own-template.ts
├── ctx.db.delete(id)                        remove.ts
└── record(ctx, scope, "deleted")            ../../../activity/api/shared/record.ts
```

## Nothing cascades, and nothing has to

A [document's `remove`](../../../documents/api/remove/remove.md) takes its
snapshot and change sets with it, because a resource whose body outlived its row
would stay readable and editable by anyone holding its id. A template has no such
tail: every resource made from it is a full copy, and `templateId` is provenance
alone. The only loss is the answer to "what was this made from", which the
activity log still holds.

## The name is read before the row goes

The entry has to say which template was deleted, and there is nothing left to ask
afterwards. That is the whole reason activity stores labels rather than joining
for them.
