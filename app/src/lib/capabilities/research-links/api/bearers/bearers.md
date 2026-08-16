# API: `bearers`

Everything bearing on one question or hypothesis.

Registered as `api.capabilities.researchLinks.bearers`, built from
`projectQuery`.

## Procedure Tree

```text
bearers(ctx, scope, subject, bearerKind?)
├── ctx.db.query("researchLinks").withIndex("by_subject")  bearers.ts
└── asLink(row)                                            ../shared/as-link.ts
```

## Three of the model's four readings are this one function

The hypotheses proposed for a question, the findings bearing on that same
question, and the evidence for a hypothesis with each finding's `bearing` on it.
They differ only in what the subject is and which bearers are wanted, which is
why they are one read rather than three.

## The kind filter is applied after the read, deliberately

`by_subject` is `(projectId, subjectKind, subjectId)`, so a bearer kind is not
part of the key. Extending the index would make the filter indexed and buy
nothing measurable: the fan-in on one question is a handful of proposals and tens
of findings, already in memory by the time the filter runs, and the index would
then exist in a shape no other read asks for.

## It returns edges, not objects

A caller gets `(kind, id)` pairs with the bearing and note, and resolves what it
needs from the capability that owns each kind. Resolving here would mean this
capability reading three other tables to render a list, and returning rows for
objects a caller may already hold.
