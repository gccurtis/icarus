# An activity event

| Selecting | What it is | Sections |
| --- | --- | --- |
| A row in the Activity view | One recorded event: who, what, to what, when | Activity · Details · Navigation |

The smallest lens on the screen. An event is a fact, and there is not much to say
about one beyond restating it precisely and offering the way to its target.

## Layout

| 300px |
| --- |
| activity |
| details |
| navigation |

## Activity

**Shows**

| | |
| --- | --- |
| Actor | Ana Reyes · user |
| Action | edited |
| Target | Q3 Resilience Memo |
| When | 4 minutes ago |

The actor kind is named beside the actor, because "edited by Nightly filing
digest" and "edited by Ana Reyes" mean different things.

**Needs** — `Activity` with an actor reference, an event kind, and a target
reference resolvable to a title.

## Details

The machine-readable form. Starts collapsed.

**Shows** — `Event · resource.updated`, `Source ID · act_2m9…c41`

**Needs** — the raw event kind and record ID.

**Open** — whether these belong in the product at all, or only in a debug view.

## Navigation

**Open target** goes to the thing the event was about.

**Open** — a target that has since been deleted has nowhere to go. The row should
say so rather than offering a dead button.
