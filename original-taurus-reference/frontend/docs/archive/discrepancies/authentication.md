# Discrepancy — authentication & session

How the sign-in UX maps onto Omega's auth API. See [backend-guide](https://github.com/gccurtis/taurus-omega/blob/main/docs/backend-guide.md)
(`taurus-omega/docs/backend-guide.md`) for the authoritative contract.

## Session is a cookie; the store is a cache

- **Backend:** the session is an opaque `to_session` cookie (`HttpOnly`, `Secure`,
  `SameSite=Lax`, `Path=/`). It is the single source of truth.
- **Front-end:** [`session.ts`](../../src/lib/data/session.ts) keeps a `session`
  store as a **cache** of the current user for the UI, hydrated from
  `GET /auth/me` on app load. It never tries to hold durable auth state itself.
- **Reconcile:** `credentials: 'include'` on every request (the cookie does the
  work); a `ready` flag gates route redirects until hydration resolves.

## Display name

- **Backend:** `GET /auth/me` → `{ id, email, name }`; `PATCH /auth/me {name}` sets it
  (the name may be empty). **Real** as of 2026-07-21.
- **Front-end:** [`session.ts`](../../src/lib/data/session.ts) reads the real `name`,
  and `updateDisplayName` persists edits (wired in the User Settings dialog). A shared
  `displayName(name, email)` helper falls back to a title-cased email local-part
  (`nameFromEmail`) only when the name is empty.
- **Reconcile:** none — this is real. The fallback just covers accounts that haven't
  set a name yet.

## Account creation

- **Backend:** `POST /auth/register` (`password ≥ 8 chars`, `409` if the email
  exists) creates accounts.
- **Front-end:** the sign-in screen is **sign-in only** for now. Accounts are made
  out-of-band (`taurus-omega/scripts/dev-setup.sh`, or a manual register call). A
  first-class sign-up flow is a deliberate future addition, not an oversight.

## Error messages

- **Backend:** a wrong password *or* an unknown email both return the identical
  `401 { "error": "invalid email or password" }` (never reveals whether an account
  exists).
- **Front-end:** shown verbatim-ish as **"Invalid email or password."** in the
  form-level alert. Other `ApiError`s show their message; format/required checks are
  validated client-side before the request.

## Dev transport (HTTPS + proxy + port)

- **Backend:** always HTTPS with a self-signed dev cert. Default `:8080`, but on
  this machine `:8080` is occupied, so `etc/config.local.yaml` (gitignored)
  overrides `server.addr` to **`:8443`**.
- **Front-end:** Vite dev serves **HTTPS** (`@vitejs/plugin-basic-ssl`) and proxies
  `/api/*` → `https://127.0.0.1:8443` (`secure: false`). This makes the browser see
  one origin so the `Secure` + `SameSite=Lax` cookie is stored and sent.
- **Reconcile (prod):** serve front-end and backend behind one origin so cookies
  work without a proxy; revisit the SvelteKit adapter then. The `:8443` override is
  local-only and must not leak into committed config.
