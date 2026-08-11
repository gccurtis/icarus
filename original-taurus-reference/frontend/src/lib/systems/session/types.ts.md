# src/lib/systems/session/types.ts — breakdown

Companion to [types.ts](types.ts). The lone domain type for the session system:
the shape of an authenticated `User`. Kept in its own module so both the store
(`store.ts`) and the API client (`api.ts`) can import it without a cycle, and so
`index.ts` can re-export it as part of the system's public surface.

## User

### The authenticated user shape

```ts
export type User = { id: string; email: string; name: string };
```

`User` is the minimal identity the app carries for whoever is signed in: a stable
`id`, the `email` used to authenticate, and a `name` for display. It is deliberately
flat and small — the session store holds either one of these or `null`, and every
other module in the system treats this as the single source of truth for "who am I".
The `name` is always a resolved, display-ready string (never blank); `api.ts` fills
it in from the email when the backend returns an empty name.
