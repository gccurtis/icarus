# api.ts

The one `fetch` wrapper every Omega call goes through: it prefixes `/api` (proxied to the backend
same-origin, so the session cookie flows), sends the CSRF header on mutations, and turns non-2xx
responses into a thrown `ApiError` carrying the backend's message.

Being the single chokepoint is the point — it is why adopting CSRF was a few lines here rather than
an audit of every call site.

## ApiError

```ts
export type ApiError = { status: number; message: string };
export function isApiError(e: unknown): e is ApiError
```

Pairs the HTTP status with the backend's `{"error": "..."}` message. `isApiError` is a type guard
so callers (the login page, `SyncEngine.flush`) can read `.status`/`.message` safely. Note that
`flush` branches on `status === 409` — see `model/sync.ts` for why that check needs care.

## CSRF — double-submit, added 2026-07-27

```ts
const csrf = MUTATING.has(method) ? csrfToken() : '';
```

Omega applies double-submit CSRF protection to authenticated mutations: a `POST`/`PUT`/`PATCH`/
`DELETE` must echo the `to_csrf` cookie in an `X-CSRF-Token` header, or its gate answers **403
before the handler runs** (so nothing is partially applied). Contract:
`taurus-omega/docs/frontend-requests/csrf-token-header.md`.

Three details that are easy to get wrong:

- **The cookie is deliberately not `HttpOnly`** — that *is* the mechanism. A cross-site page can
  make the browser *send* our cookies, but the same-origin policy stops it *reading* them, so it
  cannot produce a matching header. (`to_session` is `HttpOnly` and invisible here by design; code
  that finds no token is usually looking at the wrong cookie.)
- **The token is issued by the gate, not by login.** `/auth/login` is a public route with no
  session yet, so the cookie appears on the first *authenticated* request. The app needs no special
  handling only because `login()` does `POST /auth/login` immediately followed by `GET /auth/me` —
  that GET is what mints the token, before any mutation can run.
- **Safe methods omit the header entirely** rather than sending it empty, which also keeps the two
  exempt routes (`register`, `login`) clean.

`csrfToken()` is guarded by `typeof document === 'undefined'` so an SSR/prerender pass cannot throw.

## Header merge order

```ts
const res = await fetch(`/api${path}`, {
  credentials: 'include',
  ...init,
  headers: { 'Content-Type': 'application/json', ...(csrf ? { [CSRF_HEADER]: csrf } : {}), ...init.headers }
});
```

`...init` now comes **before** `headers`, which fixed a latent bug: previously `...init` came last,
so any caller passing `headers` replaced the whole merged object and silently lost `Content-Type` —
and would now lose the CSRF token with it. Caller headers still win, because `...init.headers` is
spread last *within* the merged object. Pinned by `api.test.ts`.

## Response handling

A `204` returns `undefined` without parsing. The body is parsed as JSON inside a `try`, so a
non-JSON or empty body leaves it null rather than throwing. On a non-2xx the backend's `error`
field becomes the thrown message, falling back to `Request failed (<status>)`.

## The unauthorized hook — added 2026-07-28

```ts
export function setUnauthorizedHandler(handler: (() => void) | null): void
```

A mid-session **401** means Omega no longer recognizes the session cookie (expired — dev TTL is
24h — or revoked). Individually, every call site just swallows or toasts its own error, so
before this hook the app kept rendering signed-in UI on stale store state until a manual
refresh. Being the single chokepoint pays off again: the one registered handler (installed by
`$systems/session/expiry` from the root layout) fires on any 401 **before the `ApiError` is
thrown** — callers keep their local error handling, and the app-wide reaction (bounce to
`/login?expired=1&next=…`) happens exactly once.

The three `/auth/*` endpoints where a 401 is an *answer* rather than an expiry —
`login` (bad credentials), `register`, `logout` (already signed out) — never trip the handler
(`AUTH_ENDPOINTS`). Note `/auth/me` is deliberately **not** exempt: its 401 during anonymous
bootstrap is harmless (the handler no-ops when the store has no user), and its 401 during the
expiry watcher's visibility probe is the whole point. Pinned by `api.test.ts`.
