# Agent Task Types

Lives at `types/types.md`.

| File | Holds |
| --- | --- |
| [`agent-task.ts`](agent-task.ts) | `agentTaskStatusValidator`, `planStepValidator`, `branchPointValidator`, `AgentTask`, `AgentTaskSummary`, `TaskDispatch`, `taskTitle`, `taskPrompt`, `hasFinished`, `taskActor` |

## `taskPrompt` refuses and never rewrites

It is the only stored string here that is not trimmed. The prompt is what goes to
the model and it is the task's provenance, so the first normalization would be
the precedent for every later one. A blank prompt is refused instead — there is
nothing to run.

`taskTitle` trims, because it is a label somebody reads in a list.

## `taskActor` is the load-bearing line

It answers "who acted" with the task, never with the person in `origin`. Undo
selects change sets whose `actor.kind` is `"user"`, so this one function is what
keeps an agent's edits out of the dispatcher's Ctrl-Z — and it is tested against a
real change set for exactly that reason.

## `AgentTask` is not the row

It carries `id`, drops `projectId`, and renames `_creationTime` to `createdAt`,
which is one of the three moments a reader compares. `AgentTaskSummary` is the
same shape without the prompt, the plan, and the result: all three are read on
the task itself, and carrying every deliverable's blocks would make a directory
of tasks the most expensive read in the capability.

## The status union is the whole lifecycle

Six literals, and the reason each exists is written beside it. Which moves
between them are legal is not here — that is
[`transition.ts`](../api/shared/shared.md), because it is a rule about what a
mutation may do rather than about what a task is.
