# 2026-07-27 — Send Omega's CSRF token header on mutations

Adopting the backend's required change from
`taurus-omega/docs/frontend-requests/csrf-token-header.md`. Omega now applies **double-submit CSRF
protection** to authenticated mutations: a `POST`/`PUT`/`PATCH`/`DELETE` must echo the `to_csrf`
cookie in an `X-CSRF-Token` header, or its gate answers **403 before the handler runs**.

Confirmed against a restarted Omega before writing any client code:

```
--- cookies after login ---                to_session
--- cookies after authenticated GET ---    to_csrf  to_session
mutation WITHOUT header: 403
mutation WITH header:    201
```

## The app: one wrapper, done

Every call in the app already goes through `$data/api`, so the header is added there and nothing
else changed. Safe methods omit it entirely rather than sending it empty.

The ordering detail that matters: **the token is issued by the gate, not by the login handler**, so
it is absent on the login response. The app needs no special handling only because `login()` does
`POST /auth/login` immediately followed by `GET /auth/me` — that GET mints the cookie, before any
mutation can run. Worth stating, because a future "optimise the redundant /auth/me" would silently
break the first mutation after sign-in.

The one direct `fetch` outside the wrapper (`exportDocumentMarkdown`) is a GET, so it needs nothing.

## A latent bug fixed on the way

```ts
// before — `...init` last, so a caller passing headers replaced the whole object
headers: { 'Content-Type': 'application/json', ...init.headers },
...init
```

Any caller supplying `headers` silently lost `Content-Type` — and would now have lost the CSRF
token with it. `...init` now comes before `headers`, with `...init.headers` spread last *within*
the merged object so caller headers still win.

## The e2e suite needed it too

The specs talk to Omega directly through `APIRequestContext`, bypassing the wrapper. `e2e/api-context.ts`
is now the shared bootstrap: register → login → **one authenticated GET to be handed the cookie** →
a real context created with `storageState` plus `extraHTTPHeaders`. Five specs use it;
`smoke.spec.ts` does not need it (it only calls the exempt `/auth/register`).

`extraHTTPHeaders` is fixed at creation and the token is not known until after login, which is why
there are two contexts rather than one.

## Verification

`pnpm check` 0 errors / 0 warnings · **338 unit tests** (up from 330; +8 for the wrapper) ·
`pnpm build` clean · companions fresh · **full e2e 12/12, twice, against a CSRF-enforcing Omega** —
which exercises the header end to end, since those runs create documents, rename resources, save
names and spawn AI tasks through the browser.

`api.test.ts` pins the contract directly: the token on all four mutating methods, absent on safe
ones, lowercase methods, absent when no cookie exists, correct extraction from a multi-cookie jar,
and the header-merge order.
