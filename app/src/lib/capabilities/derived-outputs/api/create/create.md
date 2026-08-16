# API: `create`

Declares a derived output, and returns its id.

Registered as `api.capabilities.derivedOutputs.create`, built from
`projectMutation`.

## Procedure Tree

```text
create(ctx, scope, draft)
├── derivedPrompt(draft.prompt)                      ../../types/derived-output.ts
├── derivedInputs(draft.inputs)                      ../../types/derived-output.ts
├── emptyBlock()                                     ../../types/derived-output.ts
├── ctx.db.insert("derivedOutputs", …)               create.ts
└── record(ctx, scope, "declared")                   ../../../activity/api/shared/record.ts
```

## It declares and does not generate

The row starts `idle`, with an empty block and no recorded revisions. Nothing has
been generated, so there is nothing it was generated from — the output is not
stale, it has never been fresh.

That is what lets a prompt block be typed into a paragraph without a model call
in the transaction that saves it. Asking for content is
[`refresh`](../refresh/refresh.md).

## The empty block is a real block

`block` is required and nothing ever clears it, so a consumer holds a block from
the moment the output exists. An empty paragraph is what an unresolved prompt
block renders, and it is the same shape a generated one will be — no consumer has
a second case for "not yet".

## The scope is stored as an expression

A [resource set](../../../resource-sets/overview.md) expression, resolved when
retrieval uses it. "The connector-synced files" keeps meaning that after the next
sync, where a resolved list captured today would silently mean "as it was" and
start decaying immediately. What each generation actually saw is captured
separately, in `inputsAt`.
