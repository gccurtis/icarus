# middleware.go

The pieces of Echo middleware that belong to the transport itself, installed on
the gated and project-scoped groups in `routes.go`. They sit here rather than in
a capability because they work on the request *after* the gate has resolved it —
and two of them read the `access.Context` the gate stashed, which only the
transport layer may do. A capability may not import another capability, so logic
that spans the gate's identity and some other capability's service has to sit in
transport, where both are already in scope.

They occupy different positions in the chain. `requireCSRF` and
`documentAccessGuard` run *before* the handler and can refuse the request;
`sessionActivity` runs *after* it and only reacts to what the handler produced.
None of them belongs in `gate.go`, which answers "who is this?" — these answer
"did this request really come from them?", "and may they touch *this* thing?",
and "what should that visit record?".

The latter two read the resolved context the same way, with a comma-ok type
assertion and a project check:

```go
ctx, ok := c.Get(ctxKey).(access.Context)
if !ok || !ctx.HasProject() {
	// pass through
}
```

`ctxKey` is the Echo-context key defined in `gate.go`. Neither middleware ever
resolves a session itself — that already happened upstream.

## Code breakdown

### `csrfHeader` — the header a client echoes the token back in

The one constant in the file, `X-CSRF-Token`. It is named here because
`requireCSRF` both reads it and quotes it back in its own error message, so the
client is told exactly what it failed to send.

### `requireCSRF` — the second layer of cross-site request-forgery defence

Plain Echo middleware (no service dependency, so it is a bare function rather
than a constructor), installed on *both* the gated and the project-scoped groups.
It implements the **double-submit cookie** pattern: a mutating request must carry
the `X-CSRF-Token` header with a value equal to the `to_csrf` cookie the gate
issued. A cross-site attacker's page can make a browser *send* our cookies, but
the same-origin policy stops it *reading* them, so it cannot put the matching
value in a header.

What passes and what does not:

- **Safe methods** (anything other than POST, PUT, PATCH, DELETE) fall straight
  through — they change no state, and gating reads would break every page load.
- **Missing header, missing or empty cookie, or a mismatch** are one branch, all
  answering `403` with a JSON error naming the cookie and the header. Failing
  these identically means the response never tells an attacker *which* half of
  the check they got wrong.
- **An exact match** proceeds. The comparison uses
  `subtle.ConstantTimeCompare`, so the reply's timing leaks nothing about how
  much of a guessed token was right.

Public routes are simply not wrapped: `/healthz`, `/auth/register`, and
`/auth/login` have no session to protect yet. Logout *is* on the gated group and
so is protected — a forced logout is a real, if minor, forgery.

**The limitation, stated honestly** (and repeated in the code's own doc comment,
because it must not be lost): plain double-submit is defeated by an attacker who
can write cookies on this site's domain — cookies are not isolated by origin, so
a compromised or attacker-controlled subdomain can overwrite `to_csrf` with a
known value and then match it in the header. `SameSite=Lax` on the session cookie
remains the *primary* defence; this check is defence in depth against its gaps
(browsers without Lax-by-default, and the cross-site paths Lax still permits).
Binding the token to the session — a signed or per-session value — closes the
cookie-writing hole and is the natural next step if we ever serve untrusted
subdomains.

### `documentAccessGuard` — per-document access scoping on every scoped route

Group middleware constructed with the `*resource.Resources` service. It enforces
a document's per-resource access scope on every project-scoped route that names a
`:documentID`, which is what makes catalog-level restriction real: without it, a
document hidden from a member in the listing could still be opened, edited, or
read by URL. `routes.go` installs it once on the whole scoped group rather than
per route, so a newly added document route is covered by default.

The order matters. It runs *after* `requireProject`, so the caller is already a
confirmed project member; this adds one narrowing check on top of membership, not
a replacement for it.

Three of its four paths deliberately fall through to `next(c)`:

- **No `:documentID` param** — the route is not about a document, so there is
  nothing to narrow.
- **No resolved context, or no selected project** — the gate would already have
  rejected this; the guard does not duplicate that judgment.
- **A resolver error** — for example a not-found document. Passing through lets
  the handler produce the real response (a `404`), rather than converting every
  lookup failure into a misleading `403`.

Only an explicit `allowed == false` stops the chain, answering `403` with `"you
do not have access to this document"` through `writeResponse`, so the refusal is
shaped like every other response in the package.

### `sessionActivity` — record presence on successful mutating requests

Constructed with the `*session.Sessions` service and installed on the scoped
group only when sessions are wired. Unlike the guard, it calls `next(c)` **first**
and inspects the result, because it is recording what happened rather than
deciding whether it may.

It filters on three conditions before recording anything, and returns the
handler's own error untouched in every case:

1. **Status must be 2xx** — a failed request is not activity.
2. **Method must be POST, PUT, DELETE, or PATCH** — reads do not count as
   presence, so merely polling does not keep a user "present".
3. **A resolved context with a project** — the event is project-scoped.

When all three hold it pushes a `session.Event` carrying the project id, the
user's id and name, kind `"request"`, and `time.Now()`. The session consumer
turns that into a last-activity bump, which is the point: a user editing a
document stays present without the client repolling the session endpoints.

Note that the middleware never swallows or replaces the handler's error — every
branch returns the `err` from `next(c)` — so adding presence tracking cannot
change what the client sees.
