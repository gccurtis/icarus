# 0120 — CSRF protection (DEF-2)

Closes the last open item in the architecture review
([`issues-and-gaps.md`](../architecture/issues-and-gaps.md)) — the one that could
not be done unilaterally, because it changes the request contract and the client
lives in a separate repository.

## Why it waited, and why it is being done now

CSRF defence rested entirely on the session cookie's `SameSite=Lax` attribute.
That is a genuine control and blocks the common vectors, but it is a single layer,
and a single layer protecting the whole authenticated write surface is thin.

Adding a real second layer means every client must send a header, so it was held
back until the product owner accepted the coordination cost. They did, with the
instruction to build it and tell the front end what to adopt.

## The mechanism: double-submit cookie

1. **`to_csrf` cookie** (`access.CSRFCookieName`) — `Path=/`, `Secure`,
   `SameSite=Lax`, and deliberately **not** `HttpOnly`. That last part is the
   whole mechanism: the browser client must be able to read it, and an attacker's
   page cannot read a cookie from our origin, so it cannot produce a matching
   header.
2. **Issued by the gate, not the login handler.** `resolve` sets it on any
   authenticated request that arrives without one. Two reasons: `endpoint.Response`
   carries a single cookie, so issuing at login would have meant widening the
   transport contract; and issuing from the gate means **sessions that already
   exist self-heal** — no forced re-login to adopt this.
3. **`requireCSRF` middleware** on the gated and project-scoped groups. On
   `POST`/`PUT`/`PATCH`/`DELETE` it requires an `X-CSRF-Token` header equal to the
   cookie, compared with `subtle.ConstantTimeCompare`; otherwise `403`. Safe
   methods pass untouched.
4. **Public routes stay exempt** — `/healthz`, `/auth/register`, `/auth/login`.
   There is no session to protect yet, and login is how a client gets far enough
   to be issued a token. `POST /auth/logout` is on the gated group and therefore
   *is* protected, which is correct.

## The limitation, recorded in the code

Plain double-submit is defeated by an attacker who can write cookies on our
domain — typically a compromised or attacker-controlled subdomain. `SameSite=Lax`
remains the primary control; this is defence in depth. The middleware's doc
comment says so, so the next reader does not mistake it for a complete solution.
If Omega is ever served alongside untrusted subdomains, the token should be bound
to the session (signed) rather than merely matched.

## Keeping the blast radius honest

Enforcing a new required header could have meant touching hundreds of call sites.
Two shared helpers absorbed nearly all of it:

- `core/transport/transport_test.go` has one `do(...)` helper behind ~161 mutating
  calls. It now attaches a matching `to_csrf` cookie and header whenever a session
  cookie is passed, so the existing suite needed **no other changes**.
- `dev-test/lib.sh` has one `request()` helper behind all 41 live suites. It gained
  `csrf_token()` (reads the cookie jar) and primes the jar with a silent
  `GET /auth/me` when no token is present yet.

That the whole change fits behind two helpers is itself a useful signal about the
shape of the test surface.

## Verification

Tests written first, each watched failing: `TestGateIssuesCSRFCookie`,
`TestCSRFMutationWithoutTokenIsForbidden`,
`TestCSRFMutationWithMismatchedTokenIsForbidden`,
`TestCSRFMutationWithMatchingTokenSucceeds` (gated *and* scoped groups),
`TestCSRFSafeMethodsNeedNoToken`, `TestCSRFPublicRoutesNeedNoToken`.

Beyond the unit suite, this was exercised **against a running server**: the
`core-http`, `projects`, `documents` and `resource-access` dev-test suites were
run live and pass (none needs an API key). For a change to the request contract,
a green unit suite alone would not have been convincing.

## The front end must adopt this

`docs/frontend-requests/csrf-token-header.md` states exactly what the cockpit has
to send, what happens if it does not, and how to verify — written for someone who
will not read the Go. That directory is new: it is the mirror of the "backend
requests" the cockpit files against Omega, for changes that flow the other way.
