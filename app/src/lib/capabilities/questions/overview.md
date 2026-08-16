# Questions

The unit of inquiry: what the project is trying to find out, and where each one
stands.

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `list` | query | the project's questions, or one question's children |
| `ask` | mutation | writes one down, returning its id |
| `revise` | mutation | replaces its wording, notes, and place in the tree |
| `setStatus` | mutation | says where it stands |
| `remove` | mutation | deletes it |

Registered in
[`src/convex/capabilities/questions.ts`](../../../convex/capabilities/questions.ts),
all five built from `projectQuery` / `projectMutation`.

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `questions` | one row per question: the text, its context, where it stands, and its one parent |

## Three statuses, and none of them is `parked`

`open`, `investigating`, `answered` — where the question is, never what was
learned. Conclusions live in findings.

A question nobody intends to pursue is **deleted**, which is why `remove` exists
and matters. A state meaning "we are not doing this" fills the list with things
that look like work and are not, and the honest signal is the question's absence.
`open` already covers one that is waiting.

## It holds no arrays

Hypotheses and findings attach through [research links](../../../../../docs/data-models/research/research-link.md),
where the question is the subject. Both relationships are many-to-many — a
hypothesis addresses several questions, a finding bears on several — so a column
here would force someone to pick the one it "really" belongs to and lose the rest.

The link also carries what the relationship itself knows, which nothing on either
end can hold: a note for why it exists, and for a finding a `bearing`, since one
finding relates differently to different hypotheses.

## `parentId` is a field, not a link

A question has exactly one parent, and a decomposition producing two would be two
questions. So the tree is a column, unlike everything else pointing at a question.

**A parent's status is not enforced against its children's.** A question can be
answered while its sub-questions are open; ruling otherwise would be the model
deciding what "answered" means for a decomposition that went somewhere
unexpected, which is the researcher's call.

Two things are enforced, because both produce a tree nothing can render:
[`resolveParent`](api/shared/shared.md) refuses a cycle, and
[`remove`](api/remove/remove.md) refuses to strand children.

## `revise` is revision-checked and `setStatus` is not

`notes` are edited in a form over minutes, which no Convex transaction covers —
so `revise` takes the revision the author read and a write against a stale one is
rejected outright. No merging: the client is told the question moved.

`setStatus` is one click from a list with nothing staged behind it, so there is
no stale form to catch. It still moves `revision` on, because the question a form
was opened against is no longer the question on the row.

## Capability Invariants

- **A refusal is "not found", never "forbidden".** A question in another project
  answers exactly as one that never existed; telling them apart confirms what
  somebody else is trying to find out.
- **Attribution is built from the scope**, never accepted as an argument.
- **A question is trimmed and never empty**, because the text is the label every
  surface renders.
- **Every mutation records its activity in the same transaction**, and `remove`
  reads the text before deleting so the entry can still say what went.
- **Every refusal is thrown as `QuestionsError`.** Convex serializes a
  `ConvexError`'s payload and redacts everything else, so a stale-revision
  rejection thrown as a plain `Error` arrives as a server fault — and rejection
  is the whole of the stale-form mechanism.

## Related

[question](../../../../../docs/data-models/research/question.md) — the model this
implements ·
[hypotheses](../hypotheses/overview.md) — the proposed answers, which carry no
question id ·
[revision on directly edited objects](../../../../../docs/data-models/README.md#revision-on-directly-edited-objects)
