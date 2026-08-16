# Findings API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`list/`](list/list.md) | `list` | query — the project's findings, without their writeups |
| [`read/`](read/read.md) | `read` | query — one finding whole |
| [`create/`](create/create.md) | `create` | mutation — writes one down |
| [`revise/`](revise/revise.md) | `revise` | mutation — replaces the writeup and its citations |
| [`shared/`](shared/shared.md) | — | `requireFinding`, which `read` and `revise` start with |

## `list` and `read` are separate

A finding's body *is* its substance — several paragraphs, a table, sometimes an
image — so a list carrying it would ship every writeup in the project to print a
column of titles. That is the whole reason `title` is a column of its own, and
this is the pair of reads that spends it.

## Nothing here takes a question, a hypothesis, or a bearing

All three are research links. The relationships are many-to-many and a finding
needs no attachment at all, so no argument anywhere in this capability names one.

## `revise` replaces the sources with the writeup

They are edited together in one form — adding a caveat usually means adding the
source it came from — and a separate mutation per side would let a finding be
saved with a claim its citations no longer support.

## Every mutation writes an activity entry

Inside the same transaction, by calling
[`record`](../../activity/api/shared/shared.md). An entry cannot be missing from
a write that happened or present for one that did not.
