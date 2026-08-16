# Research Threads

The working conversation, aimed at something. Where questions get explored,
sources get pulled in, and findings get drafted before they are committed.

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `list` | query | the project's threads, or the ones working on one question |
| `read` | query | one thread, opened by its own address |
| `start` | mutation | opens one, returning its id |
| `revise` | mutation | restates what it is working on |

Registered in
[`src/convex/capabilities/researchThreads.ts`](../../../convex/capabilities/researchThreads.ts),
all four built from `projectQuery` / `projectMutation`.

There is no `remove`. Deleting a thread has to take its messages with it, and a
conversation is the one thing here nobody can reconstruct — so it waits until
there is a decision about whether that is an archive or a delete.

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `researchThreads` | one row per thread: its mode and what it is anchored to |

## The row is the thread

There is no `chatId` and no separate conversation object.
[Messages](../messages/overview.md) name this row, and
`by_thread(("research", id))` is the whole link — one indexed read, with no field
on either side to keep in sync and nothing to create before somebody can speak.

What the row holds is only what makes it *research*: its mode and what it is
anchored to. Messages are not embedded, because a conversation grows without
bound and embedding would walk the thread into Convex's document limit while
rewriting the whole history on every reply.

## `discover` is a job, not a missing anchor

`mode` says what the thread is working toward, and `discover` means it is
**looking for things** — driven by its prompt rather than by a specific question
or hypothesis.

It is not "unanchored". Discovery is how questions get found in the first place,
and a discover thread producing a finding is the normal case rather than a loose
end. So a discover thread with neither id is legal, and one carrying an id is
refused: `mode` and the anchor are one statement, and two of them could disagree.

`question` and `hypothesis` are pointed at something and the matching id is set,
which is what lets the thread appear in context on the object it belongs to and
gives a drafted finding somewhere obvious to attach.

## The anchor is a column, not a research link

This looks like an inconsistency next to
[findings](../findings/overview.md#attachment-lives-on-the-edge), which hold no
`questionId` at all, so it is worth stating why the answers differ.

A finding relates to *many* questions and hypotheses, and differently to each —
supporting one explanation while undercutting another. That is a many-to-many
relationship with data on the edge, which is what
[research links](../research-links/overview.md) are for.

**A thread is about one thing, and its mode says which.** An anchor is singular
by nature, so routing it through the link table would make every thread read a
join to answer something it already knows, and would let a thread accumulate a
second anchor that its mode cannot describe.

## Re-anchoring is the workflow

[`revise`](api/revise/revise.md) takes the whole thread — title, mode, and anchor
— so a discover thread that turns up the question it was looking for becomes a
question thread pointed at it. That is discovery completing rather than a mistake
being corrected, and it is why an absent anchor means *no anchor* rather than
"unchanged".

## Capability Invariants

- **A refusal is "not found", never "forbidden".** A thread in another project
  answers exactly as one that never existed; telling them apart confirms that a
  conversation about something is happening.
- **`mode` and the anchor agree.** A pointed thread has its id and a `discover`
  thread has neither — checked in one place, on every write.
- **An anchor is a row in the caller's own project.** Proved before the thread is
  written, so a thread cannot point out of its project.
- **Attribution is built from the scope**, never accepted as an argument.
- **A title is trimmed and never empty**, because it is what every list and
  mention renders without loading a message.
- **Every mutation records its activity in the same transaction.**
- **Every refusal is thrown as `ResearchThreadsError`.** Convex serializes a
  `ConvexError`'s payload and redacts everything else, so a refusal thrown as a
  plain `Error` arrives as a server fault and stops being a refusal.

## Related

[research](../../../../../docs/data-models/research/research.md) — the model this
implements ·
[messages](../messages/overview.md) — every turn in this thread ·
[questions](../questions/overview.md) · [findings](../findings/overview.md) —
what a thread is aimed at and what it produces
