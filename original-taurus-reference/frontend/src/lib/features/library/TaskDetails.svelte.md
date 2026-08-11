# `TaskDetails.svelte` — what a task is doing, and what has been said to it

The Details half of the panel while a task is selected. Content only — the `<aside>`, its scroll,
and the Details/Assistant switch belong to [`LibraryPanel`](LibraryPanel.svelte.md).

Three sections: **Task** (state pill + mode, the objective, a failure alert when there is one,
and the Project / Personality / Started / Updated facts), **Working list** (the todos in their
five states — done, doing, blocked, open, canceled — with tone carrying state alongside the
icon), and **Exchange**.

Working list is **hidden when empty**: a just-started agent has not planned anything yet, and an
empty section reads as a loading failure rather than as "nothing here yet".

## Exchange is read-only, on purpose

This section had its own textarea and Send button until the AI bar arrived on the library routes.
Two composers for one act, on one screen, is a worse answer than either alone — so the bar is now
the single place you type at an agent, and this section says so in a line beneath the transcript.

The transcript itself stays, rendered through [`TaskExchange`](TaskExchange.svelte.md) — the same
component the [Agent lens](AgentLens.svelte.md) uses, because it is the same conversation seen from
the composer's side and must not have two appearances. A `waiting` task also offers **Review plan**,
pointing at the accept-plan flow that lives in the project's dock — that is a different act from
steering, so it keeps its button. A settled task gets neither: nothing left to steer, and the panel
says that too.

The state pill comes from `TASK_PILL` in [`agents-mock`](agents-mock.ts.md), shared with the task
rows and the Agent lens so `waiting` cannot read "Needs you" in one place and "Needs review" in
another.

**Omega cannot do any of this yet** — agent tasks are create / get / list / accept-plan only, with
no way to message a running task. Filed in `docs/backend-requests/agents-console-scope.md`.
