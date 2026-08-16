# Questions Types

Lives at `types/types.md`.

| File | Holds |
| --- | --- |
| [`question.ts`](question.ts) | `questionStatusValidator`, `QuestionStatus`, `Question`, `QuestionDraft`, `questionText`, `questionStatus` |

## The status validator is the model, not a schema detail

`schema.ts` imports it and so does the deployment door, which is what makes the
door's refusal of `parked` and the column's three literals the same statement.
`questionStatus` reads its set off the validator's own members, so there is one
list and it cannot drift.

## `Question` is not the row

It carries `id` and drops `projectId`, which every row a caller receives shares
with the project they asked about. It carries `revision`, because a client cannot
send back a revision it was never given.

## `QuestionDraft` is what an author writes

`ask` and `revise` take the same shape: revising a question is replacing it, and
a partial edit would need an absent field to mean either "unchanged" or "cleared"
without being able to say which. That is why an absent `parentId` on `revise` is
a move to the root.
