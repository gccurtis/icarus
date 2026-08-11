# 2026-07-29 — Agents leaves the tab strip and becomes a library space

Agents was the workspace's second permanent tab, rendering a "coming next" placeholder. It is now
`/library/agents`, beside Context and Templates — and first in the nav, because live agent work is
the most time-sensitive thing the libraries hold.

## Why it could never have been a tab

The things this space holds cut across projects. A personality is reusable everywhere; the task
monitor spans every project you belong to. A tab inside one project's shell could not honestly show
either. That is the same argument that put Context and Templates on routes, applied to the thing
that needed it most.

```ts
// Permanent destinations — always present, not closeable.
const PERMANENT: Tab[] = [{ id: 'overview', title: 'Overview', closeable: false }];
```

`normalize()` rebuilds permanents from this set on every load, so **persisted `agents` tabs
disappear on their own** and a persisted `activeTabId` of `agents` falls back to overview. No
migration needed. `WorkSurface` lost its placeholder branch.

## Two halves: monitor the work, author the personalities

**Activity** groups tasks into *Working now* and *Recently finished* and nothing else — a monitor
earns its keep by being glanceable. Rows carry a state pill, the objective, and a
`project · personality · mode` byline. Omega's seven `TaskState`s collapse onto the shell's explicit
state language, with one editorial choice: `waiting` renders as **"Needs you"**, the user-facing
meaning of a task blocked on review, rather than the neutral "waiting" which reads as the agent's
problem instead of yours.

**Personalities are sub-routes** (`/library/agents/[id]`) because they are durable, shareable assets
— a link to one must work. Tasks deliberately are not: they are transient work, selected in place.
An unknown id falls back to Activity rather than 404ing, which is right for a deleted personality
someone still has a link to.

A personality page shows its **versioned definition** — Omega's `PersonaDefinition` fields one for
one, each with a line saying what the field *means* — over its **task history**. Edits become a new
version, never a silent rewrite: `personas.revise` is real, and a task records the version it ran
as. A page showing only the definition would be a form; showing what it has done is what makes
editing the definition feel consequential.

## What is real underneath

Personas, revisions, and per-persona task history (`GET /personas/:personaID/tasks`) all exist in
Omega — **project-scoped**. What does not exist: owner scope, a cross-project task list, and
messaging a running task. Filed in `docs/backend-requests/agents-console-scope.md`; the space
carries the shared Mock badge until they land.

## The e2e caught a real bug on its first run

`LibraryShell` mounted its own `Toaster` on top of the app-wide one the root layout already mounts,
so **every library toast rendered twice** — surfaced as a strict-mode locator resolving to two
elements. Removed, and noted in the companion so the next person does not re-add it.
