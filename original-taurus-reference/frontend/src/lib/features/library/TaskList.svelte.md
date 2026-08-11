# `TaskList.svelte` — the one task-row grammar

Rows only — the surrounding container, heading, and scroll bounds belong to the caller. Both the
Activity monitor and a personality's history render tasks through this component so a task looks
identical everywhere: state pill, objective over a `project · personality · mode` byline,
freshness on the right. `showPersonality={false}` drops the byline's personality on a
personality's own page, where it would only repeat the title.

## The state mapping

`TASK_PILL` lives in [`agents-mock`](agents-mock.ts.md), not here, because three surfaces need it
(these rows, the Task lens, the Agent lens). Omega's seven `TaskState`s collapse onto the shell's
explicit state language (`StatePill`), deliberately the same vocabulary as the rest of the app. The
one editorial choice: `waiting` renders as **"Needs you"** — the user-facing meaning of a task
blocked on review — rather than the neutral "waiting", which reads as the agent's problem instead of
yours.

Selection is reported, not owned: the row calls `onselect(id)` and the console decides what a
selected task means — which, on Agents, is both the detail panel *and* where the AI bar sends.
