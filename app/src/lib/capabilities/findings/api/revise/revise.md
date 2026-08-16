# API: `revise`

Replaces a finding with the version the author has in front of them.

Registered as `api.capabilities.findings.revise`, built from `projectMutation`.

## Procedure Tree

```text
revise(ctx, scope, id, revision, draft)
├── requireFinding(ctx, scope, id)                ../shared/require-finding.ts
├── findingTitle(draft.title)                     ../../types/finding.ts
├── findingSources(draft.sources)                 ../../types/finding.ts
├── ctx.db.patch(id, { title, body, sources })    revise.ts
└── record(ctx, scope, "revised")                 ../../../activity/api/shared/record.ts
```

## A patch, not a new version

A finding has no edit history, so there is no snapshot to write and no change set
to append. The obligation sits with whoever cites it: a derived output records the
revision it generated against, and a report quoting a finding copies the quote.
That keeps one copy per actual dependency rather than one per edit.

## `revision` is the stale-form check

Convex's transactions cover a read and a write inside one mutation. They do not
cover a writeup somebody spends an afternoon on, which is exactly what this
edits.

**Rejection is the whole mechanism.** The client is told the finding moved and
decides what to do; there is no merging and no field-level reconciliation.

## The sources go with the body

They are edited in one form, because adding a caveat usually means adding the
source it came from. Splitting them would let a finding be saved with a claim its
citations no longer support.
