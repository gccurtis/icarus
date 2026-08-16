# Research Links Types

Lives at `types/types.md`.

| File | Holds |
| --- | --- |
| [`research-link.ts`](research-link.ts) | `linkBearerKindValidator`, `linkSubjectKindValidator`, `linkBearingValidator`, `LinkBearer`, `LinkSubject`, `ResearchLink`, `NewLink`, `researchLinkPair`, `researchLinkBearing`, `researchLinkNote` |

## Two kind validators are the direction

One list of three kinds would admit a question bearing on a finding. Splitting it
in two says the direction in the type: `bearerKind` has no `question` and
`subjectKind` has no `finding`, so [`schema.ts`](../schema.ts) and the deployment
door refuse a reversed edge without either of them restating the rule.

## `researchLinkPair` states the rule the validators cannot

The kinds still allow one pairing the model does not have — a hypothesis bearing
on a hypothesis — because both are legal kinds. It is a constraint *between* two
fields, which no validator expresses.

It is written as an order over `finding → hypothesis → question`: a link is legal
exactly when its bearer sits strictly before its subject. That is one statement
rather than a list of three pairs, so the legality table cannot drift from the
prose that explains it, and it refuses a question bearer and a finding subject a
step further in than the validators do.

## `researchLinkBearing` is where "findings only" lives

A hypothesis addressing a question has no bearing to record. Keeping the check
here rather than in `api/` says what a bearing *is* — the bearer's property
toward its subject, and only evidence has one — which is a statement about the
model rather than a step in a procedure.

## `ResearchLink` is not the row

It carries `id`, drops `projectId`, and turns `_creationTime` into `at`. There is
no `rank` to carry: ordering evidence is a view concern, and `at` is the recency
half of what it sorts by.
