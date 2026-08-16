# Findings

Something established, written down with what establishes it — the durable
output of research, and the thing that outlives the conversation that produced
it.

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `list` | query | the project's findings, titles without their writeups |
| `read` | query | one finding whole, body and citations |
| `create` | mutation | writes one down, returning its id |
| `revise` | mutation | replaces the writeup and its citations |

Registered in
[`src/convex/capabilities/findings.ts`](../../../convex/capabilities/findings.ts),
all four built from `projectQuery` / `projectMutation`.

There is no `remove`. A finding is what other things cite, and deleting one has
to take its [research links](../../../../../docs/data-models/research/research-link.md)
with it — that table arrives with the next capability, and a delete leaving links
pointing at nothing is worse than no delete.

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `findings` | one row per finding: the claim, the writeup, and every source behind it |

## A finding is a resource; a question and a hypothesis are not

It is durable project content with a body, it is cited, and it is indexed by the
lattice, so `finding` is in
[`resourceKindValidator`](../shared/types/types.md) and a scope can select it.
[Questions](../questions/overview.md) and [hypotheses](../hypotheses/overview.md)
are the project's *open threads* rather than its material — retrieving over a
question would return the asking rather than an answer.

It is not one of the **general** resources, though. Those three have a body a
change set edits, and a finding has no edit history at all.

## Attachment lives on the edge

**No `questionId`, no `hypothesisId`, and no `bearing`.** All three are research
links, because all three relationships are many-to-many. One finding relates
*differently* to different hypotheses — supporting one explanation while
undercutting another is the most valuable kind of evidence there is, and a
`bearing` column here could say only one of those at a time.

**A finding also needs no attachment at all.** Research turns up things nobody
was looking for, and requiring a question would push those into the wrong one or
lose them. `projectId` is on the row rather than reached through a question,
which is what keeps an unattached finding inside [`list`](api/list/list.md).

## Sources carry their own excerpt

Each source records not just where it points but what it said. Pages change and
get taken down, files get replaced, and a citation that is only a pointer
degrades into an unfalsifiable claim the moment its target moves.

**The excerpt is a copy, deliberately, rather than a live reference** — which is
why nothing here normalizes one. What the author typed is trimmed; what the
source said is stored exactly as it was read, and `capturedAt` is what dates it.

A `resource` source names both `resourceType` and `resourceId`, because the pair
is the key: two resources of different kinds may carry the same id. `manual`
exists so a finding can cite a conversation, a phone call, or prior knowledge
rather than forcing it into a fake URL.

## No edit history

A finding is not stored as a head plus change sets. There is nothing to replay,
and keeping past versions would mean a full copy of the body every time a
sentence was fixed.

This is the closest call among the objects with no history, because a finding is
the one research object other things cite. The answer is the principle its
`sources` already follow: **a citation records what it read.** A derived output
captures the revision it generated against; a report quoting a finding copies the
quote. Pushing the obligation onto the citer keeps one copy per actual dependency
instead of one copy per edit.

`revision` is therefore a stale-form check and not a pointer into anything.

## Capability Invariants

- **A refusal is "not found", never "forbidden".** A finding in another project
  answers exactly as one that never existed.
- **Attribution is built from the scope**, never accepted as an argument.
- **A title is trimmed and never empty**, because lists, links, and search
  results render it without loading the body.
- **Every source points at something.** A citation with a blank note, a blank
  address, or a capture time of zero is refused rather than stored as a pointer
  to nowhere.
- **Every mutation records its activity in the same transaction.**
- **Every refusal is thrown as `FindingsError`.** Convex serializes a
  `ConvexError`'s payload and redacts everything else, so a refusal thrown as a
  plain `Error` arrives as a server fault and stops being a refusal.

## Related

[finding](../../../../../docs/data-models/research/finding.md) — the model this
implements ·
[resource set](../../../../../docs/data-models/special-resources/resource-set.md#findings-are-resources-questions-and-hypotheses-are-not) —
why this is a resource kind and its neighbours are not ·
[hypotheses](../hypotheses/overview.md) — which hold no arrays of these, for the
same reason
