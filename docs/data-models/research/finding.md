# Finding

Something established, written down with what establishes it. Findings are the
durable output of research — the thing that outlives the conversation that
produced it.

A finding is a **[resource](../special-resources/resource-set.md)**: it can be
scoped to, it is indexed by the
[lattice](../knowledge/knowledge-lattice.md), and it is cited like any other
material. That is what separates it from a [question](question.md) or a
[hypothesis](hypothesis.md), which are the project's open threads rather than its
content.

```ts
interface Finding {
  projectId: Id<"projects">;
  title: string;
  body: ContentBlock[];
  sources: FindingSource[];
  createdBy: Actor;
  updatedBy: Actor;
  revision: number;
  updatedAt: number;
}

type FindingSource =
  | { kind: "file"; fileId: Id<"externalFiles">; locator?: string; excerpt?: string }
  | { kind: "url"; url: string; title?: string; excerpt?: string; capturedAt: number }
  | { kind: "resource"; resourceType: "document" | "slides" | "spreadsheet"; resourceId: string; locator?: string }
  | { kind: "message"; threadId: Id<"researchThreads">; messageId: Id<"messages"> }
  | { kind: "manual"; note: string };
```

## Body is blocks

Unlike a question or a hypothesis, a finding's substance *is* the body. It holds
the argument, the numbers, the chart, the screenshot of the thing that proves
it. This is the object in the research group that most needs the full
[content block](../content/content-block.md) union.

It is a list rather than one block because [a block holds no
newlines](../content/content-block.md#a-block-holds-no-newlines). A finding is a
writeup — a claim, the evidence, a caveat — and that is several paragraphs, a
table, sometimes an image. One block would be one paragraph.

Blocks rather than document *rows*: a finding has no page, no margins, and no
side-by-side layout. It is read inline wherever it is cited, so it needs content
and not a page model.

`title` is separate for the same reason a [document's](../general-resources/document.md#title)
is: lists, links, and search results want it without the body.

## Sources carry their own excerpt

Each source records not just where it points but what it said. A `url` source
keeps `capturedAt` and an `excerpt`; a `file` source keeps a `locator` — a page,
a cell, a timestamp — and the passage.

Pages change and get taken down. Files get replaced. A citation that is only a
pointer degrades into an unfalsifiable claim the moment its target moves, and
the excerpt is what keeps the finding readable and checkable years later. This
is a copy, deliberately, rather than a live reference.

`manual` exists so a finding can cite something outside the system — a
conversation, a phone call, prior knowledge — rather than forcing every source
into a fake URL.

## Promotion is how conversation becomes knowledge

[Messages](../core/message.md) are not indexed by the lattice. A conversation is
working material — half-formed reasoning, abandoned turns, questions that went
nowhere — and indexing it would make retrieval return the thinking rather than
the conclusion.

A message worth keeping becomes a finding instead. That promotion is an
editorial act: someone gives it a title, attaches its sources, and links it into
the [research graph](research-link.md). Everything the lattice needs in order to
be worth searching is added at exactly that moment, which is why the finding is
the right unit to index and the message is not.

It also means there is no "starred message" state to model. The star *is* the
finding.

## Attachment lives on the edge

A finding holds no `questionId`, no `hypothesisId`, and no `bearing`. All three
are [research links](research-link.md), because all three relationships are
many-to-many.

One finding bears on several questions, and relates *differently* to different
hypotheses — supporting one explanation while undercutting another is the most
valuable kind of evidence there is, and a `bearing` field on the finding could
not say it.

A finding also needs no attachment at all. Research turns up things nobody was
looking for, and requiring a question would push those into the wrong one or lose
them.

`contradicts` is first-class among the bearings. Findings that undercut a
hypothesis are the valuable ones, and a schema expressing only support would
quietly bias the record.

A hypothesis's own [assessment](hypothesis.md#assessment-and-confidence) is not
computed from its links. Bearing records what each piece of evidence does; the
judgement about the whole is made by a person.

## No edit history

A finding has no revision model. It is not stored as a head plus change sets, so
there is nothing to replay, and keeping past versions would mean full copies of
the body each time it was edited.

This is the closest call among the objects with no history, because a finding is
the one research object that other things cite. The answer is the same principle
the `sources` field already follows: **a citation records what it read**. A
[derived output](../knowledge/derived-output.md) captures the finding revision it
generated against; a report that quotes a finding copies the quote. Pushing the
obligation onto the citer keeps one copy per actual dependency instead of one
copy per edit.

## Related

[question](question.md) · [hypothesis](hypothesis.md) ·
[research link](research-link.md) · [research](research.md) ·
[revisions](../revisions/README.md) ·
[knowledge lattice](../knowledge/knowledge-lattice.md)
