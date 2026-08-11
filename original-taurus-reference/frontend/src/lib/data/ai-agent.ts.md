# src/lib/data/ai-agent.ts — breakdown

Companion to [ai-agent.ts](ai-agent.ts). The data-layer entry point for the AI Agent
dock: a thin re-export of the `systems/ai-agent` surface so components import from
`$data/ai-agent`. The real implementation — types, copy, the store, the async
actions, and the Omega client — lives under `$systems/ai-agent/`, each file with its
own companion (`types.ts.md`, `copy.ts.md`, `store.ts.md`, `actions.ts.md`,
`api.ts.md`, `index.ts.md`).

```ts
export * from '$systems/ai-agent/index';
```

Historically this file held the whole mock session model; that implementation moved
into `systems/ai-agent/*` and was **un-mocked against Omega's chat + agent-task API**
(B2): real chats/turns (`/agent/chats`), live task polling and plan accept
(`/agent/tasks`), the requester's default persona, and the per-turn live-web flag.
