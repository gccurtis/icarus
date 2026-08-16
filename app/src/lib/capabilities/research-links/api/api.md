# Research Links API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`bearers/`](bearers/bearers.md) | `bearers` | query — what bears on a question or hypothesis |
| [`subjects/`](subjects/subjects.md) | `subjects` | query — what a bearer speaks to |
| [`link/`](link/link.md) | `link` | mutation — draws one edge |
| [`unlink/`](unlink/unlink.md) | `unlink` | mutation — withdraws one |
| [`shared/`](shared/shared.md) | — | `endpointIn` and `asLink`, which both sides need |

## Two reads, because there are two directions and two indexes

`bearers` reads `by_subject` and `subjects` reads `by_bearer`. They are the same
rows from either end, and splitting them is what keeps each to one indexed read
— the property the whole table exists for.

Only `bearers` takes a kind filter, and it is applied to what was read rather
than to what was indexed. A question's bearers are two different kinds of thing
that render as two lists — proposals and evidence — while what a bearer speaks to
is one list read whole.

## There is no `revise`

An edge has a bearing and a note and nothing else, and both are part of what the
edge asserts. Correcting one is `unlink` then `link`, which is also what makes
the duplicate check simple: a stored edge is a statement somebody stands behind,
not a draft.

## Every mutation writes an activity entry

Inside the same transaction, by calling
[`record`](../../activity/api/shared/shared.md). The entry names the bearer and
carries the subject as its context, so the log reads without opening the edge.
