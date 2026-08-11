# `presence/index.ts`

The barrel for the project-presence system.

```ts
export * from './types';
export * from './store';
export { mockPresentMembers } from './mocks';
```

Types and the store are re-exported wholesale; the mock is named explicitly rather than splatted. That
is a deliberate asymmetry: `mockPresentMembers` is exported only so its test can reach it through the
system's public surface, and naming it here keeps the fact that this system *has* a mock visible to
anyone reading the barrel instead of buried behind a wildcard.

Consumers import `$data/presence` (the one-line facade, per the import convention in AGENTS.md) or
`$systems/presence/<submodule>` for a precise import.
