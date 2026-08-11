# src/lib/systems/ai-agent/store.ts — breakdown

Companion to [store.ts](store.ts). The single writable store backing the AI Agent
dock. It is seeded empty (no mock data) and mutated by the functions in `./actions`
against the real backend. Its one piece of behaviour is enforcing the project-isolation
design law: every field resets whenever the active project changes, so one project's
conversations, tasks, and attachments can never bleed into another's.

## Imports

### Pull in the store primitive, the workspace store, and the state type

```ts
import { writable } from 'svelte/store';
import { workspace } from '$data/workspace';
import type { AiAgentState } from './types';

```

`writable` is Svelte's store primitive. `workspace` is subscribed to below to detect
project switches. `AiAgentState` is the full shape defined in `types.ts`. The trailing
blank line separates the imports from the state factory.

## Fresh state factory

### Build a pristine, project-empty dock state

```ts
/**
 * AI Agent dock store — real Omega chats/turns/tasks (no mock seed). Actions in
 * `./actions` load and mutate it against the backend.
 *
 * Strict project isolation (design law, matches every project-scoped store):
 * all dock state resets whenever the active project changes, so one project's
 * conversations never bleed into another's.
 */
function freshState(): AiAgentState {
  return {
    mode: 'ask',
    view: 'chats',
    status: 'idle',
    error: null,
    chats: [],
    activeChatId: null,
    messages: [],
    sending: false,
    activeTask: null,
    contextSourceIds: ['document'],
    excludedContextItemIds: [],
    webEnabled: false,
    personas: [],
    personaId: null,
    defaultPersonaId: null,
    attachments: [],
    attachmentsUnavailable: false,
    activeResourceId: null,
    activeResourceKind: null
  };
}

```

`freshState` is the one source of truth for an empty dock: Ask mode, the chats pane,
an idle load status, no open conversation, and the `document` context toggle on by
default. It is used both to initialize the store and to wipe it on a project switch,
so the two paths can never diverge.

## The store

### Create the writable seeded from the factory

```ts
export const aiAgent = writable<AiAgentState>(freshState());

```

`aiAgent` is the exported store every dock surface subscribes to. It starts from a
`freshState()` so the dock renders its empty state before any backend call. The
trailing blank line separates the store from the reset subscription.

## Project-isolation reset

### Wipe the dock whenever the active project changes

```ts
// Reset all dock state on project switch (strict isolation). The bump also lets
// in-flight task polls notice the chat is gone and stop (they guard on activeChatId).
let watchedAi: string | null = null;
workspace.subscribe((ws) => {
  if (!ws) {
    watchedAi = null;
    return;
  }
  if (watchedAi !== ws.projectId) {
    watchedAi = ws.projectId;
    aiAgent.set(freshState());
  }
});
```

A module-level `watchedAi` remembers which project the dock is currently tied to. The
subscription clears that marker when there is no workspace, and on any genuine project
change it re-seeds the store with `freshState()`. Because the reset nulls
`activeChatId`, any in-flight task poll loop (which guards on `activeChatId`) notices
its chat is gone on the next tick and stops on its own.
