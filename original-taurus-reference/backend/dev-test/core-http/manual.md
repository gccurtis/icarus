# Manual test: core HTTP surface (public)

This is the by-hand version of [`run.sh`](run.sh). It covers the parts of the
core reachable without signing in: the public health check, and confirming that
everything else is gated. The signed-in flow is in the
[gateway suite](../gateway/manual.md).

## Prerequisites

- Go toolchain available (`go version` works).
- Run everything from the **project root** (`taurus-omega/`).

The core always serves **HTTPS**. In dev mode it generates a self-signed
certificate under `var/`, so `curl` needs `-k` to accept it.

## 1. Start the service

The core reads its configuration from [`etc/config.yaml`](../../etc/config.yaml),
which runs in `mode: dev` on `:8080`.

```bash
go run ./core
```

You should see it generate the dev certificate and start on HTTPS:

```
config: loaded etc/config.yaml
storage: opened var/taurus-omega.db
tls: using self-signed dev certificate at var/dev-cert.pem
composition: running in dev mode
⇨ https server started on [::]:8080
```

Leave this running and open a second terminal for the requests below.

## 2. Health check (public)

```bash
curl -ik https://127.0.0.1:8080/healthz
```

Expected: **200 OK** with body

```json
{"status":"ok"}
```

## 3. Echo is gated

Everything beyond the health check and the sign-in routes requires a session.

```bash
curl -ik -X POST https://127.0.0.1:8080/echo \
  -H 'Content-Type: application/json' \
  -d '{"hello":"world"}'
```

Expected: **401 Unauthorized** with body

```json
{"error":"sign in required"}
```

## 4. Stop the service

Back in the first terminal, press `Ctrl-C`. The service drains in-flight requests
and shuts down gracefully (exit code 0).

---

To sign in and reach the gated endpoints, continue with the
[gateway manual test](../gateway/manual.md).
