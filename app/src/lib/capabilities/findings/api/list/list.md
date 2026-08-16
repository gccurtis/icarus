# API: `list`

The project's findings, as a list renders them.

Registered as `api.capabilities.findings.list`, built from `projectQuery`.

## Procedure Tree

```text
list(ctx, scope)
└── ctx.db.query("findings").withIndex("by_project")   list.ts
```

## Titles without the writeups behind them

`title` is a column of its own so lists, links, and search results get it without
loading or parsing a body, and this is the read that spends it. The row is fetched
whole either way — Convex has no column projection — so what is saved is the wire
and the client's parse, which is where a writeup holding a table and an image
actually costs something. The body is [`read`](../read/read.md).

`sourceCount` survives the trim because it is the one thing a list says about
evidence.

## Every finding, attached or not

`projectId` is on the row rather than reached through a question, and this read is
what that buys: a finding nobody was looking for comes back here instead of being
stranded outside every query.

The findings bearing on a particular question or hypothesis are a
[research link](../../../../../../../docs/data-models/research/research-link.md)
read, and that belongs to links rather than here.
