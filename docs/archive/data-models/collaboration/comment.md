# Comment

Discussion attached to a place in the project. Threads anchor; comments hang off
them.

```ts
interface CommentThread {
  projectId: Id<"projects">;
  anchor: CommentAnchor;
  status: "open" | "resolved";
  resolvedBy?: Id<"users">;
  resolvedAt?: number;
  createdBy: Actor;
  updatedAt: number;
}

interface CommentAnchor {
  targetType: "document" | "slides" | "spreadsheet" | "externalFile"
            | "question" | "hypothesis" | "finding";
  targetId: string;
  within?: AnchorWithin;       // absent = the whole thing
  quote?: string;              // the selected text, when there was a selection
}

type AnchorWithin =
  | { kind: "slide"; slideId: string }
  | { kind: "element"; elementId: string }
  | { kind: "cell"; sheetId: string; ref: string }      // "B7"
  | { kind: "text"; blockId: string; from: number; to: number };

interface Comment {
  threadId: Id<"commentThreads">;
  blocks: ContentBlock[];
  author: Actor;
  editedAt?: number;
}
```

## Thread and comment are separate

The thread owns the anchor and the resolved state; comments are the replies. A
single-comment model would have to nominate one comment as the one that carries
the anchor, and resolving a conversation would mean resolving an individual
remark.

## Body is blocks

Comments get links, mentions, code snippets, and pasted screenshots. Those are
the ordinary content of a review remark, and blocks are what already express
them.

**A mention is inside the blocks**, as a
[mark](../content/content-block.md) carrying a
[`Mention`](../core/actor.md#mentions-are-the-mirror-image) — not a field
extracted alongside them. There was one, to make "comments mentioning me" an
index rather than a scan, and it went: a denormalized copy of what the text says
can disagree with the text, and a mention outside the text cannot say *where* in
the remark it appeared. The query is real and can have its field back when
something actually needs it.

`author` is an [`Actor`](../core/actor.md), not a user id — an agent reviewing a
document and leaving remarks on it is an ordinary thing to want, and a comment is
the natural place for those to land.

`Mention` addresses users, personas, and running tasks. Mentioning a persona from
a comment opens a [chat](../ai/persona-chat.md) with it carrying the comment as
context; mentioning a task delivers into that task's thread. So "@Researcher, is
this consistent with the Q3 scan?" on a paragraph is a complete interaction
rather than a note nobody reads.

## What you can comment on

`within` is absent for a comment on the whole object, and otherwise names the
smallest thing the person actually pointed at. Which variants are legal depends
on the target:

| Target | `within` may be |
| --- | --- |
| document | `text`, or absent |
| slides | `slide`, `element`, `text`, or absent |
| spreadsheet | `cell`, `text`, or absent |
| external file | absent |
| question, hypothesis, finding | `text`, or absent |

A slide can be commented on as a slide, which is the case that matters — "this
one needs rework" is about the slide, not about anything on it. A deck-level
comment and a slide-level comment are different remarks and the model has to keep
them apart.

There is no `row` variant for documents. Nobody points at a row; they select
text, or they comment on the document. Rows are layout.

## Anchoring is exact

An anchor names an [id](../content/content-block.md#one-id-space-per-resource) —
`#b7x2` is that block wherever it moves and whatever gets inserted above it — so
a comment cannot drift onto the wrong paragraph.

This was not always true. Blocks were positional, `blocks/4` moved when anything
was inserted above, and `quote` existed as a repair mechanism for anchors that
had silently gone wrong. Block ids removed that class of problem entirely.

The one part still positional is `text`'s `from`/`to`, which shift when the text
before them is edited. That is the same
[offset arithmetic](../content/content-block.md#marks-index-the-display-string)
marks already require, handled the same way.

`quote` is what was selected. It renders in the comment list so a thread reads on
its own without loading its target, and it makes a range that has drifted
recognizable as drifted. It is absent when nothing was selected.

Anchors reach all the way down to a text range rather than stopping at a block
because commenting is a textual act — a person selects a phrase, not a container.
Anchoring at block granularity would make every comment about a paragraph.

`resolvedBy` stays a user while `createdBy` and `author` are actors. Anything can
raise a remark; closing one is a judgement that a person makes.

## Resolved rather than deleted

`resolved` hides a thread without destroying it. Review discussions are often
the only record of why something is the way it is, and deleting on resolve
throws that away at precisely the moment it starts being useful.

## Editing

`editedAt` marks a comment as changed. The prior text is not kept — a comment is
a remark in a conversation, not a document, and version history for it would be
storage nobody reads.

## Related

[content block](../content/content-block.md) · [activity](activity.md)
