# `agents-mock.ts` — fixtures for the Agents space

The screens are real; the data is not. Everything renders under the shell's Mock badge, and this
file is replaced by real clients as the backend pieces land.

## Real-shaped where Omega has a shape

```ts
export type Personality = { …, definition: PersonaDefinition, version, isDefault, … };
export type AgentTask = { …, state: AiTaskState, todos: AiTodo[], … };
```

A personality reuses `PersonaDefinition` from `$systems/personas/types` verbatim (focus,
behavioral guidance, output preferences, verification) plus the version number —
`personas.revise` / `personas.versions` are real Omega machinery, as is the per-persona task
history (`GET /personas/:personaID/tasks`). A task reuses `AiTaskState` / `AiTodo` from
`$systems/ai-agent/types`, so the monitor speaks the same state machine as the dock.

A personality also carries the `LibraryAsset` identity fields (owner, sharing, origin, used-in),
which is what lets `LibraryDetails` render it unchanged — same lifecycle as contexts and
templates: born in a project, promoted, copied.

## The monitor reads a store, not the seed

```ts
export const agentTasks = writable<AgentTask[]>(TASKS);
export function startAgentTask(args): AgentTask   // queued, never running
```

`TASKS` is the seed; `agentTasks` is what the screens read. Starting an agent has to put a row in
front of you — a new-agent flow whose result you cannot see is not a flow — so the list has to be
mutable. Nothing persists past a reload, which is honest about there being no backend behind it.

`startAgentTask` creates the task **`queued`, never `running`**, and writes the honesty into the
task itself: its first agent line says the library cannot start agents yet. A fabricated agent
apparently at work would be the one lie this whole surface has otherwise avoided.

`tasksFor(list, personalityId)` takes the list rather than reading the store, so it stays pure and
the caller keeps its reactivity (`$agentTasks`).

## Talking to a task is not starting one

```ts
export function messageAgentTask(taskId: string, body: string): void
```

Selecting a task points the bar at *that* agent, so a send lands here rather than in
`startAgentTask`. It appends your line and then an agent line saying it went nowhere — because it
did: Omega's task API is create/get/list/accept-plan, with **no way to message a running task**. A
silent append would read as delivered, which is the one thing this surface must not imply.

## One state-pill map

```ts
export const TASK_PILL: Record<AiTaskState, { state: …; label: string }>
```

Omega's `TaskState` → the shell's explicit state language, defined once and imported by every
surface that shows a task ([`TaskList`](TaskList.svelte.md),
[`TaskDetails`](TaskDetails.svelte.md), [`AgentLens`](AgentLens.svelte.md)). It was copied into two
components and about to be copied into a third, which is exactly how `waiting` ends up reading
"Needs you" in the monitor and "Needs review" in a panel.

## The three inventions

1. **Owner scope** — every persona route is project-scoped, exactly the gap contexts and
   templates had.
2. **`AgentTask.project`** — `GET /agent/tasks` is project-scoped; a cross-project monitor has no
   backing list, so each fixture task names its project explicitly.
3. **The transcript + steering** — Omega tasks are create/get/list/accept-plan only. There is no
   message-a-running-task capability; the transcript exists so the steering surfaces have something
   honest to show, and `messageAgentTask` records a line that says it was not delivered.

## Why the fixtures span states and projects

Five tasks cover running / waiting / completed / failed across three projects and all four
personalities, so the monitor's grouping, the state-pill mapping, the failure treatment, and the
per-personality history all have something to exercise. `ACTIVE_STATES` defines the monitor's
"Working now" group in one place.
