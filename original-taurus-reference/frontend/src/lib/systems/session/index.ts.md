# src/lib/systems/session/index.ts — breakdown

Companion to [index.ts](index.ts). The barrel for the session system: it re-exports
the three internal modules so consumers import from `$lib/systems/session` (or the
configured alias) rather than reaching into individual files. This keeps the file
layout an implementation detail and gives the system one stable public entry point.

## Re-exports

### Re-export the types, store, API, and expiry watcher in dependency order

```ts
export * from './types';
export * from './store';
export * from './api';
export * from './expiry';
```

Each line forwards everything a sibling module exports. The order mirrors the
dependency chain — `types` (the `User` shape) has no dependencies, `store` builds
on `types`, `api` builds on both, and `expiry` (2026-07-28: the session-expiry
watcher that bounces to sign-in on a mid-session 401) sits on top of the store —
so a reader scanning the barrel sees the system from its foundation up. Because
the modules export disjoint names (`User`; `session`; the auth functions and
`displayName`; `watchSessionExpiry`), the wildcard re-exports never collide.
