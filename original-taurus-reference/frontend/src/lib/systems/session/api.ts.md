# src/lib/systems/session/api.ts — breakdown

Companion to [api.ts](api.ts). The session/auth API client: it talks to the
`/auth/*` endpoints to hydrate the current session, sign in and out, and rename
the user, writing every result into the shared `session` store. It also owns the
logic for turning a possibly-empty backend name into a display-ready one.

## Imports

### Import the API client, the User type, and the session store

```ts
import { api } from '$data/api';
import type { User } from './types';
import { session } from './store';

```

`api` is the generic fetch wrapper from the data layer that handles the base URL,
credentials, and JSON. `User` is the identity shape this module produces, and
`session` is the writable store every function here writes to. Having the client
own the store writes means auth state only ever changes as a result of a real
server round-trip.

## Display-name derivation

### Build a friendly fallback name from an email, then prefer an explicit name

```ts
function nameFromEmail(email: string): string {
  return (
    email
      .split('@')[0]
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim() || 'Explorer'
  );
}

export function displayName(name: string | undefined, email: string): string {
  return name?.trim() || nameFromEmail(email);
}

```

`nameFromEmail` derives something human out of an address when the backend has no
real name: it takes the local part before `@`, turns `.`/`_`/`-` runs into spaces,
title-cases each word, and falls back to `'Explorer'` if that leaves nothing (e.g.
an all-symbol local part). `displayName` is the public rule the rest of the app
uses — an explicitly set, non-blank `name` always wins; otherwise it synthesizes
one from the email. It is exported because UI code sometimes needs the same
resolution for users other than the current one.

## Mapping the API user

### The `/auth/me` response shape and its conversion to a User

```ts
type MeResponse = { id: string; email: string; name: string };

function toUser(me: MeResponse): User {
  return { id: me.id, email: me.email, name: displayName(me.name, me.email) };
}

```

`MeResponse` is the raw JSON the `/auth/me` endpoint returns; it is kept private
because callers should only ever see the resolved `User`. `toUser` is the single
choke point that normalizes that raw shape into a `User`, running the possibly-empty
`name` through `displayName` so every user stored in the app already has a
display-ready name. Every function below funnels its server response through
`toUser` before calling `session.set`.

## Hydrating the session on load

### Ask the server who we are and populate the store, tolerating "nobody"

```ts
export async function hydrateSession(): Promise<void> {
  try {
    const me = await api<MeResponse>('/auth/me');
    session.set({ user: toUser(me), ready: true });
  } catch {
    session.set({ user: null, ready: true });
  }
}

```

`hydrateSession` is called once at startup to resolve the session cookie into a
user. On success it stores the mapped `User`; on any failure (no/invalid cookie,
network error) it treats the visitor as signed out. Either way it sets `ready: true`,
which is the signal the rest of the UI waits on before deciding what to render —
so a failed check still unblocks the app rather than leaving it perpetually loading.

## Sign in and sign out

### POST credentials to establish a session, and clear it on logout

```ts
export async function signIn(email: string, password: string): Promise<void> {
  await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  const me = await api<MeResponse>('/auth/me');
  session.set({ user: toUser(me), ready: true });
}

export async function signOut(): Promise<void> {
  try {
    await api('/auth/logout', { method: 'POST' });
  } finally {
    session.set({ user: null, ready: true });
  }
}

```

`signIn` posts credentials to `/auth/login` (which sets the auth cookie server-side),
then re-fetches `/auth/me` to get the canonical user rather than trusting the login
response, and stores it. `signOut` posts to `/auth/logout`, but does its store
clearing in a `finally` block so the local session is emptied even if the network
call fails — the user should end up signed out client-side regardless. Both leave
`ready: true`, since by the time either runs the readiness question is already
settled.

## Renaming the current user

### PATCH a new display name and refresh the stored user

```ts
export async function updateDisplayName(name: string): Promise<void> {
  const me = await api<MeResponse>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify({ name: name.trim() })
  });
  session.set({ user: toUser(me), ready: true });
}
```

`updateDisplayName` PATCHes `/auth/me` with a trimmed name and stores the updated
user the server returns. Using the response (again via `toUser`) rather than the
submitted string means the store reflects whatever the backend actually persisted —
including its own normalization or the `displayName` email fallback if the trimmed
name came through empty.
