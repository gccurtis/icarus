# Hypotheses API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`list/`](list/list.md) | `list` | query — the project's hypotheses |
| [`propose/`](propose/propose.md) | `propose` | mutation — states one |
| [`revise/`](revise/revise.md) | `revise` | mutation — replaces the draft |
| [`assess/`](assess/assess.md) | `assess` | mutation — records the judgement |
| [`shared/`](shared/shared.md) | — | `requireHypothesis`, which `revise` and `assess` start with |

## `assess` is separate from `revise`

Rewording a claim and judging it are different acts by different people at
different times, and folding them together would mean every typo fix restated a
verdict. It is also what decides which one takes a revision — see
[`revise`](revise/revise.md).

## Nothing here takes a question

Attaching a hypothesis to a question is a research link. The relationship is
many-to-many and a hypothesis needs no question at all, so there is no argument
anywhere in this capability that names one.

## Every mutation writes an activity entry

Inside the same transaction, by calling
[`record`](../../activity/api/shared/shared.md). An entry cannot be missing from
a write that happened or present for one that did not.
