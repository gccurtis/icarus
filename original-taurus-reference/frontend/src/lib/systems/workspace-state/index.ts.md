# src/lib/systems/workspace-state/index.ts — breakdown

Companion to [index.ts](index.ts). The barrel for the workspace-state system —
re-exports the client so the rest of the app imports from `$systems/workspace-state`
rather than reaching into `./api`.

## Barrel re-export

### Re-export everything from the api client

```ts
export * from './api';
```

A single wildcard re-export lifts `getWorkspaceState`, `putWorkspaceState`, and the
`WorkspaceStatePayload` type to the package root. The directory is a "system" with the
same shape as its siblings (e.g. `documents`), so callers use the
`$systems/workspace-state` alias and never depend on the internal file layout.
