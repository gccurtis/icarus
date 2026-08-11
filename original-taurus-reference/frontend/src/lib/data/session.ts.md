# src/lib/data/session.ts — breakdown

Companion to [session.ts](session.ts). A data-layer barrel: it re-exports the session
system so the legacy `$data/session` import path keeps resolving after the data-layer →
systems migration. The `session` store, the `User`/`MeResponse` shapes, the
`displayName`/`nameFromEmail` helpers, and the auth operations (hydrate, sign in, sign
out, update display name) that this file once held now live across
`src/lib/systems/session/` (`types.ts`, `store.ts`, `api.ts`).

## Re-export

### Forward everything from the session systems barrel

```ts
export * from '$systems/session/index';
```

`$systems/session/index` is the single session surface, re-exporting the session shape
types, the session store, and the HTTP/auth client. Re-exporting it here keeps existing
`$data/session` importers resolving unchanged while the implementation lives under
`src/lib/systems/session/`.
