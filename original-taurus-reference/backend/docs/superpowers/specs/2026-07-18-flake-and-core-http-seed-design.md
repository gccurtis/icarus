# Flake + core-layer HTTP seed

Date: 2026-07-18
Status: Approved for planning

## Goal

Stand up the first working increment of Taurus Omega:

1. A Nix development shell that provides Go and MySQL.
2. A minimal but production-minded HTTP server — the **core** of the
   application — that we can send requests to and get responses from.

This is a hands-on, incremental seed. It deliberately ignores the elaborate
target architecture in `docs/reference/`; that material is reference, not a
required sequence. We build the smallest working thing and grow from there.

## Non-goals

- No version pinning of Go or MySQL. We use whatever `nixpkgs` currently ships.
  The pinning / supply-chain ceremony described in the reference docs is out of
  scope.
- No database wiring. MySQL is available in the shell for later; nothing
  connects to it yet.
- No Cell / Control-worker / operator separation, no auth, no persistence, no
  capability packages. Those come later, if and when we decide.
- No frontend. The core has no frontend portion; a frontend, when it exists, is
  only a view onto the core.

## Naming

The Go server is the **core** of the application — canonical behavior lives
here. It goes in a top-level `core/` directory (not `cmd/`, because the point is
that it is the core, not that it is a command).

## Deliverables

### 1. `flake.nix`

A single dev shell, unpinned:

- Inputs: `nixpkgs` only, tracking `nixpkgs-unstable` (current packages, no
  version pin in the file).
- A small `forAllSystems` helper over common systems
  (`x86_64-linux`, `aarch64-linux`, `x86_64-darwin`, `aarch64-darwin`) so no
  `flake-utils` dependency is needed.
- `devShells.default` provides, from `nixpkgs`:
  - `go`
  - `mysql` (server + client; whatever attr nixpkgs exposes, e.g. `mysql80`)
  - `gopls`, `gotools`
- `flake.lock` is committed for a reproducible shell. Nothing in `flake.nix`
  itself is version-pinned.

Usage:

```sh
nix develop
```

lands you in a shell with `go` and `mysql` on `PATH`.

### 2. `go.mod`

- Module path: `github.com/gccurtis/taurus-omega`.
- Go version: whatever the flake's `go` reports (declared normally in `go.mod`,
  not pinned to an exact patch).
- One dependency: `github.com/labstack/echo/v4`.

### 3. `core/main.go`

A single file to start — split into packages only when it actually grows.

- Echo server with `middleware.Recover()` and `middleware.Logger()`.
- Listen address from the `ADDR` environment variable, default `:8080`.
- Endpoints (prove request → response both directions):
  - `GET /healthz` → `200` with JSON body `{"status":"ok"}`.
  - `POST /echo` → reads the posted JSON body and returns it unchanged with
    `200`. Malformed JSON returns `400`.
- Graceful shutdown: on `SIGINT`/`SIGTERM`, stop accepting new requests and let
  in-flight requests finish within a short timeout before exiting.

### 4. `core/main_test.go`

A single test using `net/http/httptest` + Echo:

- Assert `GET /healthz` returns `200` and body `{"status":"ok"}`.

The server does not need to be actually running for this test.

## How it's exercised

```sh
nix develop
go run ./core
# in another shell:
curl localhost:8080/healthz
# -> {"status":"ok"}
curl -X POST localhost:8080/echo -d '{"hello":"world"}' -H 'content-type: application/json'
# -> {"hello":"world"}
go test ./core
```

## Success criteria

- `nix develop` produces a shell with working `go` and `mysql` binaries.
- `go run ./core` starts, serves both endpoints, and shuts down cleanly on
  Ctrl-C.
- `go test ./core` passes.
- `go vet ./...` and `gofmt` are clean.

## Later (not now)

Explicitly deferred, noted so we remember the direction without building it yet:
connecting to MySQL, request/response typing beyond echo, structured config,
splitting `core/` into packages, auth/sessions, and anything from the reference
architecture.
