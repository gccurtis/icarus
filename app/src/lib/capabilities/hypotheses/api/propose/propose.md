# API: `propose`

States a claim, and returns its id.

Registered as `api.capabilities.hypotheses.propose`, built from
`projectMutation`, so the caller's token is resolved to a membership before this
runs.

## Procedure Tree

```text
propose(ctx, scope, draft)
├── hypothesisStatement(draft.statement)     ../../types/hypothesis.ts
├── ctx.db.insert("hypotheses", …)           propose.ts
└── record(ctx, scope, "proposed")           ../../../activity/api/shared/record.ts
```

## It takes no question

A hunch arrives before the question it belongs to is articulated. Requiring one
here means either inventing a question nobody asked or losing the hunch, so
attachment is a research link made whenever the connection is.

## `confidence` is not written, rather than written as zero

There is nothing to be confident about at the moment a claim is stated. Writing a
`0` or a `0.5` would put a number nobody chose into every chart and summary that
reads the column, and an absent field is the only honest way to say "not yet".

`assessment` starts at `untested` for the same reason: it is the one value that
does not claim work happened.
