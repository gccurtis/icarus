# A task, from a persona

| Selecting | What it is | Sections |
| --- | --- | --- |
| A row in the Work view | One piece of work this agent did | Task · Asked to · Plan · Produced · Actions |

The same task lens the Copilot uses. See
[`_shared/inspector/copilot-task.md`](../../_shared/inspector/copilot-task.md) —
that is the authoritative description, and changes to what a task shows belong
there. This file records only what is different when the task is reached from a
persona rather than from the bar.

**Open** — whether the difference is worth having at all. Two lenses for one
object is a maintenance cost, and the honest alternative is one lens that hides
the agent row whenever the breadcrumb already names it, and keeps the tool trace
everywhere.

## Layout

| 300px |
| --- |
| task |
| asked to |
| plan |
| plan |
| produced |
| actions |

The shared lens has one more region — *tools used* — between plan and produced.

## Task

**Different here.** The breadcrumb already names the persona, so this region drops
the *Agent* row the Copilot's version carries. State, title, dispatching actor and
start time are unchanged.

## Asked to

Unchanged. The instruction, verbatim and immutable.

## Plan

Unchanged. The steps with their states.

## Produced

Unchanged. What came out, and the reminder that a task result is not a resource
until it is promoted.

## Actions

Unchanged. **Follow** and **Cancel**; no Retry.
