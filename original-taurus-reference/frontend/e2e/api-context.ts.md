# api-context.ts

One helper shared by every e2e spec: a signed-in `APIRequestContext` that carries Omega's CSRF
token. It exists because the specs talk to Omega **directly**, bypassing the app's `$data/api`
wrapper — so the header the wrapper adds for the product has to be added here by hand.

## Why the ordering is the whole trick

```ts
await bootstrap.post('/api/auth/register', { data: account });
await bootstrap.post('/api/auth/login', { … });
await bootstrap.get('/api/auth/me');          // ← this is what mints the token
const state = await bootstrap.storageState();
const token = state.cookies.find((c) => c.name === 'to_csrf')?.value;
```

The token is issued by Omega's **gate** — the middleware that resolves a session — not by the login
handler. `/auth/login` is a public route with no session yet, so **the login response does not set
`to_csrf`**. A context must sign in, make one authenticated *safe* request to be handed the cookie,
and only then mutate. Skipping that GET produces a 403 on the first `POST`, which reads as "my
login didn't work" and sends you looking in the wrong place.

`register` and `login` are themselves exempt, which is what makes this bootstrap possible at all.

## Why there are two contexts

`extraHTTPHeaders` is fixed when a context is created, and the token is not known until after the
requests above. So a throwaway context obtains it, and the returned context is created with that
token plus the bootstrap's cookies via `storageState`. The bootstrap is disposed in a `finally`.

## What it does not cover

Only `APIRequestContext` traffic. Mutations the **browser** makes go through the app's own
`$data/api`, which adds the header itself — so a spec driving the UI needs nothing extra. GETs via
`page.request` need nothing either; safe methods are never checked.

`smoke.spec.ts` deliberately does not use this: it only calls `/auth/register`, which is exempt.

## Failure modes it turns into clear errors

A missing `to_csrf` after the authenticated GET throws with a message naming the gate, rather than
letting the spec fail later on an unexplained 403. A non-201/409 register and a failed login throw
with their status, since both mean the dev stack is not in the state the suite assumes.
