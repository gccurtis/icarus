# 2026-07-29 — Library fixtures: the data the three library spaces run on

First of four commits building the `/library/*` spaces. This one is data only — two modules and
their companions, imported by nothing yet — so the screens that follow can be read without also
reading a wall of fixtures.

## `library-mock.ts` — contexts, templates, owners, and the shared asset identity

```ts
export type MemberKind = ResourceKind | 'context';
export const memberMeta = { ...kindMeta, context: { icon: Layers, tone: 'intel', label: 'Context' } };
export type LibraryAsset = { name; description; ownerId; sharedWith; origin; usedIn; lastEdited; editedBy };
```

The shapes deliberately mirror Omega's real models so the UI cannot quietly assume something the
backend cannot express. A context is `{name, description, includes[], excludes[]}` over
`Ref{kind,id,name}` (`core/capability/contexts`) with a `resolved` leaf list standing in for
`GET /contexts/:contextID/resolved`; a template follows `core/capability/document/template.go`,
including `ContextVariable`. Resource kinds defer to the shared `features/shared/kinds.ts` rather
than restating the icon/tone table, so a document looks the same in the library as in the resource
table.

`LibraryAsset` is the structural identity every library asset shares, which is what later lets one
detail panel serve contexts, templates, and personalities.

**Two fields are invented and named as such**: `Owner` and `Shared`. Every context and template
route in Omega is project-scoped, and there is no per-asset sharing model at all. Isolating them in
named types keeps the gap visible instead of letting it blend into the fixtures.

## `agents-mock.ts` — personalities, cross-project tasks, and a mutable task list

```ts
export const agentTasks = writable<AgentTask[]>(TASKS);
export function startAgentTask(args): AgentTask   // queued, never running
```

A personality reuses `PersonaDefinition` from `$systems/personas/types` verbatim and carries the
`LibraryAsset` fields; a task reuses `AiTaskState` / `AiTodo` from `$systems/ai-agent/types`, so the
monitor speaks the same state machine as the AI dock.

The monitor reads a **store**, not the seed array, because starting an agent has to put a row in
front of you — a flow whose result you cannot see is not a flow. `startAgentTask` creates the task
`queued`, never `running`, and writes the honesty into the task itself: its first agent line says
the library cannot start agents yet. A fabricated agent apparently at work would have been the one
lie this surface otherwise avoids.

**Three inventions here**: owner scope (personas are project-scoped, like contexts and templates),
`AgentTask.project` (`GET /agent/tasks` is project-scoped, so a cross-project monitor has no backing
list), and messaging a running task (Omega has create/get/list/accept-plan only). All three are
filed in `docs/backend-requests/agents-console-scope.md`.
