# expiry.ts — the session-expiry watcher

Companion to [expiry.ts](expiry.ts). Added 2026-07-28 after the user's live review hit both
symptoms of an unnoticed expiry: a "Presence join failed" toast after navigating to the
Templates library and back, and a refresh that suddenly demanded sign-in. Omega sessions lapse
server-side (dev `session_ttl: "24h"`), but the client hydrated its session store **once** per
page life and every route guard trusted that store — so an expired session kept rendering
signed-in UI on stale state, with API calls failing one by one, until a manual refresh.

## Two triggers, one exit

```ts
export function watchSessionExpiry(): () => void
```

Installed once by the root layout (before `hydrateSession`), returning its teardown. It wires:

1. **The API client's unauthorized hook** (`setUnauthorizedHandler` in `$data/api`): any call
   answered 401 — a presence join, a project select, a document save — trips the bounce. In the
   workspace the 30-second presence poll makes this an effective heartbeat.
2. **A visibility probe**: when the tab becomes visible while the store still thinks it is
   signed in, a `GET /auth/me` fires and its result is ignored — success needs nothing, a 401
   trips the hook above, and any *other* failure (offline, backend restart) is not an auth
   verdict so it must not sign anyone out. This catches sessions that lapsed while the tab sat
   idle, before the user touches anything.

## The bounce is a hard navigation, on purpose

`bounceToSignIn` uses `location.assign('/login?expired=1&next=…')`, **not** SvelteKit's `goto`:

- Expiry must discard every client store, poller, and editor runtime — the full reload is the
  same clean slate as the manual refresh that already behaved correctly.
- It sidesteps racing the route guards' own `goto('/login')` (which would drop the `?next=`).
- `?expired=1` is how the sign-in screen knows to say why (a toast could not survive the
  reload); `?next=` is the existing login-page mechanism that returns the user to where they
  were. When the bounce fires while already on `/login`, `next` is omitted.

Two guards keep it a no-op in the honest cases: a `bouncing` latch (concurrent 401 bursts fire
one navigation), and **no user in the store** — during anonymous bootstrap the first
`/auth/me` 401 is the expected answer, not an expiry, and the route guards already handle the
plain signed-out redirect.

Pinned end-to-end by `e2e/session-expiry.spec.ts`: the user's exact repro (workspace →
Templates → Back → bounce → re-sign-in returns to the project) plus the idle-tab probe.
