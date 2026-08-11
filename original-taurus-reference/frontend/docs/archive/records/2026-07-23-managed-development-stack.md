# Managed Alpha/Omega development stack

## Add an explicit background lifecycle around the existing foreground runner

```bash
case "${1:-}" in
  start) start_stack ;;
  stop) stop_stack ;;
  restart)
    stop_stack
    start_stack
    ;;
  status) status_stack ;;
  logs) logs_stack ;;
esac
```

`scripts/dev-stack.sh` delegates service launch to the established `dev.sh` rather
than duplicating Alpha or Omega startup behavior. It detaches that runner into a
dedicated process group, records its verified PID under ignored `.taurus-dev/`,
waits for the real proxied health endpoint, and stops only that managed group.
Stale PID validation prevents an unrelated reused process ID from being signaled.

## Expose memorable package commands

```json
"dev:start": "bash scripts/dev-stack.sh start",
"dev:stop": "bash scripts/dev-stack.sh stop",
"dev:restart": "bash scripts/dev-stack.sh restart",
"dev:status": "bash scripts/dev-stack.sh status",
"dev:logs": "bash scripts/dev-stack.sh logs"
```

These commands make the combined stack usable as a background service while
leaving `pnpm dev:all` intact for foreground work and the Playwright harness.
The orientation guide documents both modes, and `.gitignore` excludes the PID and
combined log without hiding any authored source.

## Verify real startup, shutdown, and repository gates

```text
dev:start   -> health reached on https://localhost:5173/api/healthz
dev:start   -> already-running result without a duplicate stack
dev:restart -> old process group stopped; replacement reached health
dev:status  -> healthy while running; stopped after shutdown
dev:stop    -> both :5173 and :8443 listeners removed
pnpm check  -> 0 errors and 0 warnings
pnpm build  -> passed
```

The lifecycle was exercised against the sibling Omega checkout and its actual
SQLite, BlobStore, TLS, and health wiring. Shell syntax, JSON parsing, exact
Markdown companions, and `git diff --check` also passed. This verifies the script
as an operational path rather than documenting an unexecuted command sequence.
