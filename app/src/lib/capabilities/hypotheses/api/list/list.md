# API: `list`

The project's hypotheses.

Registered as `api.capabilities.hypotheses.list`, built from `projectQuery`.

## Procedure Tree

```text
list(ctx, scope)
└── ctx.db.query("hypotheses").withIndex("by_project")   list.ts
```

## Every hypothesis, attached or not

`projectId` is on the row rather than reached through a question, and this read is
what that buys: a hunch nobody has filed against a question yet comes back here
instead of being stranded outside every query.

The hypotheses bearing on a particular question are a
[research link](../../../../../../../docs/data-models/research/research-link.md)
read, and that belongs to links rather than here — there is no question argument
to add.

## Unordered beyond the index's own order

Assessment and recency are both a sort over a list the caller already holds. A
second index buys nothing until a project's hypotheses stop fitting in one read.
