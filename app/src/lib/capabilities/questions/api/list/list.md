# API: `list`

The project's questions, or one question's children.

Registered as `api.capabilities.questions.list`, built from `projectQuery`.

## Procedure Tree

```text
list(ctx, scope, parentId?)
├── ctx.db.query("questions").withIndex("by_parent")    list.ts
└── ctx.db.query("questions").withIndex("by_project")   list.ts
```

## The whole project is the default, rather than the roots

A tree view builds itself from the flat list it already holds. The alternative — a
read per level — is a round trip every time somebody opens a branch, for a shape
the client can compute from what it has.

The narrow form is one indexed range on `by_parent`, and it is what a
sub-question picker wants, where the rest of the tree is noise.

## Unordered beyond the index's own order

Recency and text order are both a sort over a list the caller already holds. A
second index buys nothing until a project's questions stop fitting in one read.
