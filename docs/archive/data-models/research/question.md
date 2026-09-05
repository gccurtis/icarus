# Question

The unit of inquiry. What the project is trying to find out.

```ts
interface Question {
  projectId: Id<"projects">;
  text: string;
  notes: ContentBlock[];
  status: "open" | "investigating" | "answered";
  parentId?: Id<"questions">;
  createdBy: Actor;
  revision: number;
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

Three values, describing where the question is rather than what was learned.

There is no `parked`. A question nobody intends to pursue is deleted — keeping it
in a state that means "we are not doing this" fills the list with things that
look like work and are not, and the honest signal is its absence. `open` already
covers a question that is waiting.

What was actually learned lives in [findings](finding.md). Status is deliberately
not a place to write conclusions.

## Hypotheses and findings attach through links

A question holds no arrays. Its hypotheses and its findings are
[research links](research-link.md) where the question is the **subject**, read by
`by_subject("question", id)`.

Both relationships are many-to-many. A hypothesis addresses several questions at
once; a finding bears on several. A foreign key on the narrower object would
force someone to pick the one it "really" belongs to and lose the rest.

The link also carries what the relationship itself knows — a `note` for why it
exists, and for findings a `bearing`, which cannot live on the finding because
one finding relates differently to different hypotheses.

## Sub-questions

`parentId` makes questions a tree, and it stays a direct field rather than a
link. A question has one parent; decomposition that produced two parents would be
two questions. A broad question decomposes into narrower ones, and the narrow
ones are ordinary questions with their own hypotheses and findings — not a lesser
type.

The tree is not required to be balanced or complete, and a question can be
answered while its children are open. Enforcing consistency between a parent's
status and its children's would mean the model deciding what "answered" means
for a question whose sub-questions went in unexpected directions, which is the
researcher's call.

## Related

[hypothesis](hypothesis.md) · [finding](finding.md) ·
[research link](research-link.md) · [research](research.md)
