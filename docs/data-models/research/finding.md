# Finding

Something established, written down with what establishes it. Findings are the
durable output of research — the thing that outlives the conversation that
produced it.

```ts
interface Finding {
  projectId: Id<"projects">;
  title: string;
  body: ContentBlock[];
  sources: FindingSource[];
  questionId?: Id<"questions">;
  hypothesisId?: Id<"hypotheses">;
  bearing?: "supports" | "contradicts" | "neutral";
  createdBy: Actor;
  updatedBy: Actor;
  updatedAt: number;
}

type FindingSource =
  | { kind: "file"; fileId: Id<"externalFiles">; locator?: string; excerpt?: string }
  | { kind: "url"; url: string; title?: string; excerpt?: string; capturedAt: number }
  | { kind: "resource"; resourceType: "document" | "slides" | "spreadsheet"; resourceId: string; locator?: string }
  | { kind: "message"; threadId: Id<"researchThreads">; messageId: Id<"researchMessages"> }
  | { kind: "manual"; note: string };
```

## Body is blocks

Unlike a question or a hypothesis, a finding's substance *is* the body. It holds
the argument, the numbers, the chart, the screenshot of the thing that proves
it. This is the object in the research group that most needs the full
[content block](../content/content-block.md) union.

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

## Attachment is optional

A finding does not need a question or a hypothesis. Real research turns things
up that nobody was looking for, and a model that required attachment would push
those into the wrong question or lose them.

`bearing` says how the finding relates to the hypothesis it is attached to, and
only means anything when `hypothesisId` is set. `contradicts` is first-class:
findings that undercut a hypothesis are the valuable ones, and a schema that
only expressed support would quietly bias the record.

The hypothesis's own [assessment](hypothesis.md#assessment-and-confidence) is not
computed from these. Bearing records what each piece of evidence does; the
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

[question](question.md) · [hypothesis](hypothesis.md) · [research](research.md) ·
[revisions](../revisions/README.md) ·
[knowledge lattice](../knowledge/knowledge-lattice.md)
