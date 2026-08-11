# `index.ts` — AI Agent barrel

Re-exports the dock surface — types, copy, the store, and the actions — so consumers
import from `$systems/ai-agent` (via the `$data/ai-agent` re-export) rather than deep
paths. The real Omega client (`./api`) stays internal: components call the store
actions, which call the client.

```ts
export * from './types';
export * from './copy';
export * from './store';
export * from './actions';
```
