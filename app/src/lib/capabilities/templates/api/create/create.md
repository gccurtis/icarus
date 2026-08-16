# API: `create`

Defines a template in the caller's project, and returns its id.

Registered as `api.capabilities.templates.create`, built from `projectMutation`.

## Procedure Tree

```text
create(ctx, scope, definition)
├── templateName(definition.name)            ../../types/template.ts
├── templateSlots(definition.slots)          ../../types/slot.ts
├── ctx.db.insert("templates", …)            create.ts
└── record(ctx, scope, "created")            ../../../activity/api/shared/record.ts
```

## `target` is read off the body, never accepted

That is what makes the two copies of it incapable of disagreeing. A caller able
to send both could file a template under documents that instantiation turns into
a deck — a picker that lies, and a refusal that arrives only when someone tries to
use it.

## It always stamps the caller's project

A global template is one this function cannot make. Publishing to every project
from inside one would let any member of any project put a row in everyone else's
list, and there is no sharing mechanism to ask permission through — a project
template that should be global is copied.

## The slot rules are the model's, not this procedure's

`templateSlots` refuses a duplicate key and a prompt in the wrong place, and it
lives in [`types/`](../../types/types.md) because it says what a slot list *is*.
`create` and [`revise`](../revise/revise.md) both call it, which is also why it is
not written out in either.
