# Manual test: login gateway

This is the by-hand version of [`run.sh`](run.sh). It walks the gate:
**no user → only register/login reachable; signed in → the gated endpoints open;
logged out → they close again.**

The core serves **HTTPS** (self-signed cert in dev), so `curl` uses `-k`. The key
detail is the **session cookie**: log in once into a cookie jar, then reuse that
jar (`-c cookies.txt` to save, `-b cookies.txt` to send).

## Prerequisites

- Go toolchain available; run from the **project root** (`taurus-omega/`).

## 1. Start the service

```bash
go run ./core
```

Runs in dev mode on `:8080` over HTTPS. There is **no seeded user** — you create
one via the register endpoint (below), which is also what
[`scripts/dev-setup.sh`](../../scripts/dev-setup.sh) automates. Open a second
terminal for the requests.

## 2. Anonymous: gated endpoints are refused

```bash
curl -ik https://127.0.0.1:8080/auth/me
curl -ik -X POST https://127.0.0.1:8080/echo -H 'Content-Type: application/json' -d '{"hello":"world"}'
```

Both expected: **401 Unauthorized** — `{"error":"sign in required"}`.

## 3. Register an account

```bash
curl -ik -X POST https://127.0.0.1:8080/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"me@example.com","password":"password123","name":"Me"}'
```

Expected: **201 Created** — `{"id":"…","email":"me@example.com","name":"Me"}`.
`name` is an **optional** display name (≤ 80 chars); omit it and it stays empty.
Registering the same email again returns **409**; a password shorter than 8 chars
(or a name over 80 chars) returns **400**.

## 4. Log in (save the cookie)

```bash
curl -ik -c cookies.txt -X POST https://127.0.0.1:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"me@example.com","password":"password123"}'
```

Expected: **200 OK** with `{"status":"signed in"}` and a `Set-Cookie: to_session=…;
Path=/; HttpOnly; Secure; SameSite=Lax` header. `cookies.txt` now holds the session.

A wrong password — or an email that doesn't exist — returns the **same**
`401 invalid email or password`, so the response never reveals whether an account
exists.

## 5. Signed in: the gated endpoints open

Pass `-b cookies.txt` to send the session.

```bash
curl -ik -b cookies.txt https://127.0.0.1:8080/auth/me
curl -ik -b cookies.txt -X POST https://127.0.0.1:8080/echo \
  -H 'Content-Type: application/json' -d '{"hello":"world"}'
```

Expected: **200 OK** for both — `me` reports the user
(`{"id":"…","email":"me@example.com","name":"Me"}`); `echo` returns
`{"hello":"world"}`.

Change your display name with `PATCH /auth/me` (self only):

```bash
curl -ik -b cookies.txt -X PATCH https://127.0.0.1:8080/auth/me \
  -H 'Content-Type: application/json' -d '{"name":"Renamed Me"}'
```

Expected: **200 OK** with the updated user. An empty name clears it; a name over
80 chars returns **400**.

## 6. Log out

```bash
curl -ik -b cookies.txt -X POST https://127.0.0.1:8080/auth/logout
curl -ik -b cookies.txt -X POST https://127.0.0.1:8080/echo \
  -H 'Content-Type: application/json' -d '{"hello":"world"}'   # now 401 again
```

## 7. Stop the service

`Ctrl-C` in the first terminal.
