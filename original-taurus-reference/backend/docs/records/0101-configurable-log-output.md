# Configurable log output directory

A `logging.dir` config setting directs where the server's logs go, so a bundled
or containerized deployment can redirect them from a mounted config without a
code change.

## What changed

- **`config.Logging.Dir`** (`yaml: dir`) — empty by default.
- **`logOutput(dir)`** in `core/wiring`: empty dir → standard error; a non-empty
  dir is created if missing and logs are **appended** to `taurus-omega.log`
  inside it. Returns the writer plus a closer (nil for stderr).
- **`Run`** resolves it right after loading config and calls `log.SetOutput`,
  deferring the file's close on shutdown — so every log after the config load is
  captured, and stderr is never closed.

## Why stderr is the default, but production sets a dir

An unconfigured run logs to stderr (Go's default) — fine for dev. Production is
expected to point `logging.dir` at a mounted volume so logs land in a file that
can be shipped for support and then deleted, rather than streaming out of a
long-lived process. `O_APPEND` means a restart keeps prior logs rather than
truncating.

## Verification

- Unit (`core/wiring`, deterministic): empty dir returns `os.Stderr` with a nil
  closer; a dir writes to `taurus-omega.log` (content round-trips); a missing dir
  is created.
