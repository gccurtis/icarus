# API: `remove`

Takes a name out of the project's vocabulary.

Registered as `api.capabilities.nameManager.remove`, built from
`projectMutation`.

## Procedure Tree

```text
remove(ctx, scope, id)
├── ctx.db.get(id)                    remove.ts — not found, never forbidden
├── ctx.db.delete(id)                 remove.ts
└── record(ctx, scope, "removed")     ../../../activity/api/shared/record.ts
```

## By id, not by name

A caller holding a list holds ids. A delete addressed by a name is a delete a
concurrent redefinition can point at something else between the read and the
write.

## The name is read before the row goes

The entry has to say what was removed, and there is nothing left to ask
afterwards. That is why activity stores labels rather than joining for them.

## Nothing is cascaded

A formula naming a removed variable fails to resolve it, which is the correct
answer and the one a reader can act on. Rewriting expressions that mention a
name would edit documents nobody asked to change.
