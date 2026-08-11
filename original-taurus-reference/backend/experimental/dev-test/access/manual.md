# Manual test: access flow

This is the by-hand version of [`run.sh`](run.sh). It walks the whole access
state machine — **anonymous → authenticated → project-selected** — with `curl`,
so you can watch a request earn its way to a project-scoped route.

The key detail is the **session cookie**: log in once into a cookie jar, then
reuse that jar on every later request. The commands below use `-c cookies.txt`
(save) and `-b cookies.txt` (send).

## Prerequisites

- Go toolchain available; run from the **project root** (`taurus-omega/`).

## 1. Start the service

```bash
go run ./core
```

Listens on `:8080` by default. Open a second terminal for the requests below, and
`cd` to any working directory (the cookie jar is written there).

## 2. Before sign-in, protected routes are refused

```bash
curl -i http://127.0.0.1:8080/auth/me
```

Expected: **401 Unauthorized** — `{"error":"sign in required"}`.

## 3. Register an account

```bash
curl -i -X POST http://127.0.0.1:8080/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@example.com","password":"password123"}'
```

Expected: **201 Created** with `{"id":"…","email":"dev@example.com"}`.
Registering the same email again returns **409 Conflict**.

## 4. Log in (save the session cookie)

```bash
curl -i -c cookies.txt -X POST http://127.0.0.1:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@example.com","password":"password123"}'
```

Expected: **200 OK** with `{"status":"signed in"}` and a `Set-Cookie: to_session=…`
header. `cookies.txt` now holds the session.

## 5. Confirm you're signed in

From here on, pass `-b cookies.txt` to send the session.

```bash
curl -i -b cookies.txt http://127.0.0.1:8080/auth/me
```

Expected: **200 OK** with your user.

## 6. Create a project

```bash
curl -i -b cookies.txt -X POST http://127.0.0.1:8080/projects \
  -H 'Content-Type: application/json' \
  -d '{"name":"First Project"}'
```

Expected: **201 Created** with `{"id":"<PROJECT_ID>","name":"First Project",…}`.
Note the `id` — call it `<PROJECT_ID>` below. It also shows up in:

```bash
curl -i -b cookies.txt http://127.0.0.1:8080/projects
```

## 7. Selecting is required before reaching the project

Try the project-scoped route *before* selecting:

```bash
curl -i -b cookies.txt http://127.0.0.1:8080/projects/<PROJECT_ID>/whoami
```

Expected: **409 Conflict** — `{"error":"select a project first"}`.

Now select it (this is what creates the cell):

```bash
curl -i -b cookies.txt -X POST http://127.0.0.1:8080/session/project \
  -H 'Content-Type: application/json' \
  -d '{"projectId":"<PROJECT_ID>"}'
```

Expected: **200 OK** — `{"status":"project selected",…}`.

## 8. Reach the project-scoped route

```bash
curl -i -b cookies.txt http://127.0.0.1:8080/projects/<PROJECT_ID>/whoami
```

Expected: **200 OK** with the resolved `user`, `project`, and `cell` — the cell's
`userId`/`projectId` prove the request is scoped to you and this project.

## 9. Project isolation

Use a *different* project id in the path than the one you selected:

```bash
curl -i -b cookies.txt http://127.0.0.1:8080/projects/some-other-project/whoami
```

Expected: **403 Forbidden** — the session may only reach the project it selected.

## 10. The scoped echo endpoint

```bash
curl -i -b cookies.txt -X POST http://127.0.0.1:8080/projects/<PROJECT_ID>/echo \
  -H 'Content-Type: application/json' \
  -d '{"hello":"cell"}'
```

Expected: **200 OK** echoing `{"hello":"cell"}` — the same round-trip check, now
inside a project cell.

## 11. Log out

```bash
curl -i -b cookies.txt -X POST http://127.0.0.1:8080/auth/logout
curl -i -b cookies.txt http://127.0.0.1:8080/auth/me   # now 401 again
```

## 12. Stop the service

`Ctrl-C` in the first terminal.
