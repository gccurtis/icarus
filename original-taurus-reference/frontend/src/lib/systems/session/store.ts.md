# src/lib/systems/session/store.ts — breakdown

Companion to [store.ts](store.ts). The reactive home of the current session: a
single Svelte writable holding the signed-in `User` (or `null`) plus a `ready`
flag. Components subscribe to it for auth-driven UI, and `api.ts` is the only
writer, calling `session.set(...)` after each auth round-trip.

## Imports

### Pull in the Svelte store factory and the User type

```ts
import { writable } from 'svelte/store';
import type { User } from './types';

```

`writable` is Svelte's basic mutable store constructor, and `User` is the identity
shape defined next door in `types.ts`. Importing the type (rather than redefining it)
keeps the store and the API client agreed on exactly what a user is.

## The session store

### A single writable holding the user and a readiness flag

```ts
export const session = writable<{ user: User | null; ready: boolean }>({
  user: null,
  ready: false
});
```

`session` is the app-wide source of truth for authentication state. `user` is the
current `User` or `null` when signed out; `ready` distinguishes "we haven't checked
yet" from "we checked and nobody is signed in". It starts `{ user: null, ready: false }`
so UI can show a neutral/loading state until `hydrateSession` runs on startup and
flips `ready` to `true`. Because it is a plain writable exported as a singleton,
every component shares one instance and reacts to the same updates; the auth
functions in `api.ts` are the intended writers, keeping mutation in one place.
