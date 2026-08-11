# 2026-07-28 — Session expiry now forces a return to sign-in

First finding from the user's live review: after leaving a workspace for the Templates
library and coming back, a **"Presence join failed"** toast appeared — and after the same
round-trip via Context, a refresh suddenly demanded sign-in. Diagnosis: the session had
expired server-side (Omega dev `session_ttl: "24h"`, `taurus-omega/etc/config.yaml`) and the
app **kept running on stale signed-in state**. The user asked for the obvious right behavior:
*force return to sign-in — no access while the session is technically expired.*

## Root cause

Three layers conspired, none individually wrong:

- `hydrateSession()` runs **once** per page life (root layout `onMount`); nothing ever
  re-verifies.
- Every route guard (`/projects`, `/projects/[id]`, `LibrarySpace`) trusts the **client**
  session store, which still said signed-in.
- `api()` throws per-call `ApiError`s and every call site swallows or toasts locally — the
  presence join's catch produced the toast; nothing reacted app-wide to a 401.

So an expired session degraded into a half-alive UI: navigation worked, cached data rendered,
and API calls failed one by one, until a manual refresh re-ran hydration and bounced properly.

## The fix

- **`$data/api` gains an unauthorized hook** (`setUnauthorizedHandler`). Any 401 — except from
  `/auth/login`, `/auth/register`, `/auth/logout`, where 401 is an answer, not an expiry —
  fires the one registered handler before the error is thrown. Callers keep their local
  handling. Pinned by four new `api.test.ts` cases (unit suite 346 → **350**).
- **`$systems/session/expiry.ts` (new)** — `watchSessionExpiry()`, installed by the root
  layout. Two triggers: the 401 hook, and a **visibility probe** (tab becomes visible while
  the store thinks it is signed in → outcome-ignored `GET /auth/me`, so an idle-lapsed session
  is caught the moment the user returns, before they touch anything). One exit:
  a **hard** `location.assign('/login?expired=1&next=…')` — a full reload deliberately wipes
  every store, poller, and editor runtime (the same clean slate as the refresh that already
  behaved), and dodges racing the route guards' own plain `goto('/login')`. No-ops while
  anonymous (bootstrap 401s) and latches against concurrent 401 bursts.
- **Sign-in screen explains the bounce**: `?expired=1` renders an attention Alert — "Your
  session expired — sign in to continue." (a toast could not survive the hard reload). The
  existing `?next=` handling then returns the user to where they were after re-auth.
- **`joinSession` no longer toasts on 401** — the watcher owns that moment; the stale-data
  toast remains for genuine presence failures.

In the workspace the 30-second presence poll now doubles as an expiry heartbeat: even with no
user action, a lapsed session gets bounced within half a minute.

## e2e (suite 17 → 19)

`session-expiry.spec.ts`, simulating expiry by deleting the `to_session` cookie mid-session
(Omega's gate treats it identically — anonymous → 401):

1. **The user's exact repro**: workspace → Templates → Back → bounced to
   `/login?expired=1&next=/projects/<id>` with the notice visible → re-sign-in lands straight
   back in the project.
2. **Idle tab**: on `/projects`, cookie deleted, a `visibilitychange` dispatch alone bounces
   to sign-in.

One in-suite flake was seen and hardened honestly (condition waits, not sleeps): the
reload-spanning URL asserts get explicit 10s timeouts, and the post-bounce re-sign-in waits
for the reloaded login page's hydration `/auth/me` before clicking — the same
click-before-hydration class the sign-in theme toggle hit, which here would native-submit the
form and drop `?next=`. Five subsequent full-suite runs: clean (one unrelated
persona-spec real-model flake, the documented warmup class).

## Verification

`pnpm check` 0/0 · vitest **350/350** · build clean · companions verifier OK · e2e **19/19**.
