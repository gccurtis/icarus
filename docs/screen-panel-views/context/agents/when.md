# When

| View | What it is for | Sections |
| --- | --- | --- |
| When | The five things that can start a rule | On a schedule · Something changes · A connector syncs · A finding is accepted · Only when I say |

The trigger half. A rule has exactly one trigger, so this is a chooser: the
chosen one is expanded and marked, the rest are collapsed to their names.

Each is named for what happens, not for the event it corresponds to.

## Layout

| 300px |
| --- |
| on a schedule |
| on a schedule |
| something changes |
| a connector syncs |
| a finding is accepted |
| only when i say |

## On a schedule

**Shows** — `At · 02:00 daily`, `Timezone · America/New_York`, `Next · Tomorrow,
02:00`, marked **Chosen**

**Needs** — schedule fields and a next-fire time from the scheduler.

## Something changes

A kind of resource, or one exact resource. Starts collapsed.

**Needs** — a resource-kind or resource reference on the trigger.

**Open** — "changes" needs defining. Created, edited, renamed and deleted are four
different things and a rule that fires on all of them is rarely what anyone
meant.

## A connector syncs

One connector. Starts collapsed.

**Needs** — a `Connector` reference.

## A finding is accepted

Optionally only under one question. Starts collapsed.

**Needs** — an optional `Question` reference.

## Only when I say

Never fires on its own. **Run now** is the point of it. Starts collapsed.

**Needs** — nothing. It is the absence of a trigger, named so it does not look
like a misconfiguration.
