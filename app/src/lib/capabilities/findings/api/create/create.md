# API: `create`

Writes a finding down, and returns its id.

Registered as `api.capabilities.findings.create`, built from `projectMutation`.

## Procedure Tree

```text
create(ctx, scope, draft)
├── findingTitle(draft.title)                     ../../types/finding.ts
├── findingSources(draft.sources)                 ../../types/finding.ts
├── ctx.db.insert("findings", { title, body })    create.ts
└── record(ctx, scope, "recorded")                ../../../activity/api/shared/record.ts
```

## It takes no attachment, and that is not an omission

Research turns up things nobody was looking for. Requiring a question here would
push those into the wrong one or lose them, and attaching to one is a
[research link](../../../../../../../docs/data-models/research/research-link.md)
added whenever the connection is made — including later, and including to several
questions at once.

This is also where a message becomes knowledge. Promotion is an editorial act:
somebody gives it a title, attaches its sources, and links it into the graph, and
those are exactly this function's arguments.

## The sources are stored as read

Canonicalizing runs over what the author typed — the note, the address — and
leaves every `excerpt`, page `title`, and `capturedAt` untouched. The excerpt is
the copy the citation exists for, so normalizing it would make it a copy of
something nobody saw.

What it does refuse is a citation pointing nowhere: a blank note, a blank
address, or a capture time of zero, which would read as 1970 and date the excerpt
to a day nothing was read.
