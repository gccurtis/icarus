# Hypotheses

A proposed answer, stated so that evidence can bear on it.

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `list` | query | the project's hypotheses, attached to a question or not |
| `propose` | mutation | states one, returning its id |
| `revise` | mutation | replaces the claim and the argument for it |
| `assess` | mutation | records the judgement, and how sure of it |

Registered in
[`src/convex/capabilities/hypotheses.ts`](../../../convex/capabilities/hypotheses.ts),
all four built from `projectQuery` / `projectMutation`.

There is no `remove`. See [it is refuted, not deleted](#it-is-refuted-not-deleted).

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `hypotheses` | one row per claim: the statement, the argument for it, the judgement on it |

## It stands on its own

**A hypothesis carries no `questionId`.** Questions attach through
[research links](../../../../../docs/data-models/research/research-link.md), and
the relationship is many-to-many: a claim about pricing power bears on "why did
margin fall" and "should we raise prices" at once, and duplicating it to attach it
twice would make two things that must be assessed together and cannot be.

**It also needs no question at all.** A hunch arrives before the question it
belongs to is articulated, and forcing attachment at that moment means either
inventing a question nobody asked or losing the hunch.

`projectId` is stored directly rather than reached through a question, which is
what keeps an unattached hypothesis inside [`list`](api/list/list.md) rather than
stranded outside every query.

## Assessment is one field, and it is stored

Five values splitting into three states of *work* — `untested`, `testing`, done —
and three *verdicts* once done. One field rather than two, because a verdict
implies the work happened.

**`testing` is not decoration.** Without it a hypothesis sits at `untested` while
a research thread runs against it, which reads as nobody having started.
**`inconclusive` is a real outcome**, separate from both: it records that the work
was done and did not settle the question, which `untested` would erase.

**Nothing derives it from findings.** A count of supporting against contradicting
links is not a judgement — three weak findings do not outweigh one decisive one —
and a column computed from them would assert a confidence nobody chose.
[`assess`](api/assess/assess.md) is the only thing that writes it.

## Confidence is absent until it means something

`confidence` is optional and only meaningful once an assessment exists. An
untested claim has none to report, and a default of `0` or `0.5` would be a
fabricated number that charts and summaries consume as though somebody chose it.

So [`propose`](api/propose/propose.md) does not write the column at all, a
confidence on an `untested` claim is refused, and moving back to `untested` clears
one that was there.

## It is refuted, not deleted

A [question](../questions/overview.md) nobody intends to pursue is deleted,
because there is no honest status for it. A hypothesis that did not hold is
`refuted` or `inconclusive`, and both are information the next person needs — so
this capability has no `remove` and the asymmetry is the point.

## Capability Invariants

- **A refusal is "not found", never "forbidden".** A hypothesis in another project
  answers exactly as one that never existed.
- **Attribution is built from the scope**, never accepted as an argument.
- **A statement is trimmed and never empty**, because it reads next to its
  assessment in a list.
- **`revise` is revision-checked and `assess` is not.** `rationale` is edited in a
  form over minutes, which no transaction covers; a judgement is made with the
  hypothesis in front of you. Both move `revision` on.
- **Every mutation records its activity in the same transaction.**
- **Every refusal is thrown as `HypothesesError`.** Convex serializes a
  `ConvexError`'s payload and redacts everything else, so a refusal thrown as a
  plain `Error` arrives as a server fault and stops being a refusal.

## Related

[hypothesis](../../../../../docs/data-models/research/hypothesis.md) — the model
this implements ·
[questions](../questions/overview.md) — which hold no arrays of these, for the
same reason ·
[revision on directly edited objects](../../../../../docs/data-models/README.md#revision-on-directly-edited-objects)
