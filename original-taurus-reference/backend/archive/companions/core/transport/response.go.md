# response.go

The translation layer between Echo and the neutral `endpoint` contract. This is
the boundary that keeps every application handler in `core/handlers` free of
Echo: a handler receives an `endpoint.Request`, returns an `endpoint.Response`,
and never touches an `echo.Context`. The functions here are the only ones that
see both sides.

Two adapters go inbound (`adapt`, `adaptScoped`), one function builds the neutral
request (`buildRequest`), and one writes the result back (`writeResponse`) with
two small helpers for its trickier cases. The serial and async adapters live in
`dispatch.go` but funnel through the same `buildRequest`/`writeResponse` pair, so
**every** response in the package is written by one function.

The neutral request is deliberately thin — three function values, no request
object:

```go
return endpoint.Request{Bind: c.Bind, Param: c.Param, Query: c.QueryParam}
```

A handler can bind a body, read a path parameter, and read a query parameter, and
that is all. Anything a handler cannot reach through those three is, by
construction, not part of the contract.

## Code breakdown

### `adapt` — the context-free adapter

Wraps a plain `endpoint.Handler` into an `echo.HandlerFunc`: build the request,
call the handler, write the response. It passes no access context, which is
exactly why it is used for the public routes (`/healthz`, register, login) and
the trivial `/echo` — those handlers have no user to act as.

### `adaptScoped` — the access-scoped adapter

The workhorse: most routes in `routes.go` use it. It reads the `access.Context`
that `requireUser` (or `requireProject`) stashed under `ctxKey` and passes it to
an `access.ScopedHandler` alongside the built request.

The type assertion is intentionally forgiving — `ctx, _ := c.Get(ctxKey).(access.Context)`
— because a scoped route is only ever reached through a gate that already
established the context. A zero context here would mean the gate was bypassed,
which is a wiring error, not a runtime case to branch on.

### `buildRequest` — the Echo context as three function values

Constructs the `endpoint.Request` from `c.Bind`, `c.Param`, and `c.QueryParam`.
Handing over *method values* rather than the context itself is what enforces the
boundary: the handler holds three closures over the live request and has no way
to reach anything else on it.

### `writeResponse` — cause, cookies, then body

The single exit point for every response the package produces. It runs in four
stages.

**Cause.** Before anything is written, the response's `Err` is handed to
`requestlog.AttachError`:

```go
requestlog.AttachError(c, resp.Err)
```

This is the one place in the codebase where a handler's private explanation of a
failure meets the request log, and it belongs here for the same reason the rest
of this function does: `writeResponse` is the single choke point every response
passes through, so wiring the cause here means no handler has to remember to log
anything, and no future exit path can silently lose it. `AttachError` ignores a
nil error, so the overwhelming majority of responses — the successful ones —
pass through untouched.

Note what this does *not* do: `Err` never reaches the body. The response written
below is built from `resp.Body` alone, so attaching a cause changes what the
operator can see and nothing about what the client receives.

**Cookie.** If the response set one, it is translated into an `http.Cookie`, with
an empty path defaulting to `"/"`. The one non-mechanical decision is `Secure`:

```go
Secure: sc.Secure || c.IsTLS(),
```

Secure is *forced on* over HTTPS, so production always gets secure cookies, while
local HTTP development and tests — where `IsTLS()` is false — still work. A
handler can ask for Secure, but it can never turn it off on a TLS connection.

**Raw body.** A response carrying `Raw` bytes is a binary payload (a file
download). The content type defaults to `application/octet-stream` when unset,
and if a filename is present the response gets a `Content-Disposition:
attachment` header. Serving uploaded bytes as an attachment is a security
decision, not a convenience: it means an attacker-supplied content type such as
`text/html` can never render inline in the app's own origin.

**JSON.** Everything else is `c.JSON(resp.Status, resp.Body)`.

### `sanitizeFilename` — a filename cannot forge a header

Maps every rune below `0x20`, plus `0x7f`, `"`, and `\`, to an underscore. Those
are precisely the characters that could break out of the quoted
`Content-Disposition` filename or — via CR/LF — inject an entirely new header, so
an attacker-named upload cannot control the response headers. A name that
sanitizes to empty falls back to `"download"`, so the header is always
well-formed.

### `toSameSite` — the neutral enum onto `net/http`'s

A three-case switch mapping `endpoint.SameSiteLax`, `SameSiteStrict`, and
`SameSiteNone` onto their `http.SameSite*Mode` counterparts, with
`http.SameSiteDefaultMode` as the default. It exists so `endpoint` can express
cookie policy without importing `net/http` semantics into the handler contract.
