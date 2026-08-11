# Front-end request: send the CSRF token header on mutations

**Status: required.** The server enforces this. A client that does not send the
header will get `403` on every authenticated write.

## What changed

Omega now applies **double-submit CSRF protection** to authenticated mutating
requests. Previously the only defence was the session cookie's `SameSite=Lax`
attribute; this adds a second, independent layer.

## What the client must do

**1. Read the `to_csrf` cookie.** The server sets it on your first *authenticated*
request — **not** on the login response, because `/auth/login` is a public route
and there is no session yet when it is handled:

```
to_csrf=<random token>; Path=/; Secure; SameSite=Lax
```

In practice: sign in, then make any authenticated `GET` (`/auth/me` works), and
the cookie will be set. Only then issue your first mutation.

It is deliberately **not** `HttpOnly` — unlike `to_session`, your JavaScript is
meant to read this one. That is the whole mechanism: an attacker's page cannot
read a cookie from our origin, so it cannot produce a matching header.

**2. Echo it in an `X-CSRF-Token` header on every mutating request** — `POST`,
`PUT`, `PATCH`, `DELETE`. `GET`/`HEAD`/`OPTIONS` need nothing.

```ts
function csrfToken(): string {
  return document.cookie
    .split('; ')
    .find(c => c.startsWith('to_csrf='))
    ?.split('=')[1] ?? '';
}

await fetch(`${BASE}/documents`, {
  method: 'POST',
  credentials: 'include',              // still required — the session cookie
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken(),       // new
  },
  body: JSON.stringify({ name: 'Untitled' }),
});
```

The cleanest adoption is a single place: if all API calls already go through one
wrapper, add the header there and you are done.

## What happens if you don't

`403` with a JSON error body. The request never reaches the handler, so nothing
is partially applied.

## Exemptions

- `GET`, `HEAD`, `OPTIONS` — never require the header.
- `POST /auth/register` and `POST /auth/login` — exempt. There is no session to
  protect yet, and this is what lets you obtain the token in the first place.
- `GET /healthz`.

Everything else behind sign-in requires it, **including `POST /auth/logout`**.

## Where the token comes from

It is issued by the **gate** — the middleware that resolves the session — rather
than by the login handler. Any authenticated request arriving without a `to_csrf`
cookie gets one set on the response.

That has a useful consequence for rollout: **sessions that already exist pick up a
token on their next request**, with no re-authentication. You do not need to log
users out to adopt this.

## How to verify

1. Sign in; confirm `to_csrf` is present in `document.cookie` (if it is missing,
   the code is reading `to_session` — that one is `HttpOnly` and invisible by
   design).
2. A mutation **without** the header → `403`.
3. The same mutation **with** `X-CSRF-Token` set to the cookie value → succeeds.

## The limitation, stated honestly

Plain double-submit is defeated by an attacker who can write cookies on our
domain — typically via a compromised or attacker-controlled subdomain. It is
defence in depth, not a replacement for `SameSite=Lax`, which remains the primary
control. If Omega is ever served alongside untrusted subdomains, this should be
upgraded to a token bound to the session (signed, not merely matched).
