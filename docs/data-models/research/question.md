# Question

The unit of inquiry. What the project is trying to find out.

```ts
interface Question {
  projectId: Id<"projects">;
  text: string;
  notes: ContentBlock[];
  status: "open" | "investigating" | "answered" | "parked";
  parentId?: Id<"questions">;
  createdBy: Actor;
  updatedAt: number;
}
```

## Text is plain, notes are blocks

`text` is the question itself, and it is a plain string because a question is
one sentence. It appears in lists, in breadcrumbs, in search results, and as a
label on a [hypothesis](hypothesis.md) — all places that want a string, none
that want to run a block renderer. A question that needs formatting to be
understood is really two questions.

`notes` are content blocks, because the surrounding context is genuinely rich:
why this is being asked, what has already been ruled out, a screenshot of the
thing that prompted it, a link to the conversation it came from.

## Status

Four values, describing where the question is rather than what was learned.
`parked` is distinct from `answered` — a question set aside is not resolved, and
collapsing them loses the fact that something is still outstanding.

What was actually learned lives in [findings](finding.md). Status is deliberately
not a place to write conclusions.

## Sub-questions

`parentId` makes questions a tree. A broad question decomposes into narrower
ones, and the narrow ones are ordinary questions with their own hypotheses and
findings — not a lesser type.

The tree is not required to be balanced or complete, and a question can be
answered while its children are open. Enforcing consistency between a parent's
status and its children's would mean the model deciding what "answered" means
for a question whose sub-questions went in unexpected directions, which is the
researcher's call.

## Related

[hypothesis](hypothesis.md) · [finding](finding.md) · [research](research.md)
