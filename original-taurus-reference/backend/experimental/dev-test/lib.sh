#!/usr/bin/env bash
# Shared helpers for dev-test suites: build and run the core service, make
# logged HTTP requests against it, and assert the results. Source this from a
# suite's run.sh.
#
# Every request and response is printed, so a run doubles as a readable log of
# the platform actually answering calls.

set -euo pipefail

# Resolve the dev-test directory and project root from this file's location, so
# suites work regardless of the current working directory.
DEV_TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$DEV_TEST_DIR/.." && pwd)"

# Address the test instance listens on. Override with ADDR to avoid clashes with
# a dev server on the default port.
ADDR="${ADDR:-:8091}"
HOST="127.0.0.1"
PORT="${ADDR##*:}"
BASE_URL="http://${HOST}:${PORT}"

# Assertion counter and last-response state, referenced by the expect_* helpers.
: "${FAILURES:=0}"
LAST_STATUS=""
LAST_BODY=""

# Internal run state.
_pid=""
_workdir=""
JAR=""

info() { printf '\033[1;34m▶ %s\033[0m\n' "$*"; }
pass() { printf '\033[1;32m  ✓ %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m  ✗ %s\033[0m\n' "$*"; }

# start_service builds the core binary, writes a temp manifest pinned to $ADDR,
# launches the service, and waits until /healthz responds.
start_service() {
  _workdir="$(mktemp -d)"
  local bin="$_workdir/core"
  local cfg="$_workdir/config.yaml"

  info "Building core..."
  ( cd "$PROJECT_ROOT" && go build -o "$bin" ./core )

  # Isolate persistence and cookies per run so suites never share state.
  JAR="$_workdir/cookies.txt"
  cat >"$cfg" <<EOF
server:
  addr: "$ADDR"
logging:
  requests: true
storage:
  dsn: "$_workdir/test.db"
access:
  session_ttl: "168h"
EOF

  info "Starting core on $BASE_URL ..."
  TAURUS_OMEGA_CONFIG="$cfg" "$bin" &
  _pid=$!

  for _ in $(seq 1 50); do
    if curl -sf "$BASE_URL/healthz" >/dev/null 2>&1; then
      pass "core ready (pid $_pid)"
      return 0
    fi
    sleep 0.1
  done

  fail "core did not become ready on $BASE_URL"
  return 1
}

# stop_service shuts the service down gracefully and removes temp files. Safe to
# call from an EXIT trap.
stop_service() {
  if [[ -n "$_pid" ]] && kill -0 "$_pid" 2>/dev/null; then
    info "Stopping core (pid $_pid)..."
    kill -INT "$_pid" 2>/dev/null || true
    wait "$_pid" 2>/dev/null || true
  fi
  [[ -n "$_workdir" ]] && rm -rf "$_workdir"
}

# request METHOD PATH [BODY] — make an HTTP request and print the request line,
# response status, and response body. Cookies persist across calls via a per-run
# jar, so a login carries through to later requests. Stores results in
# LAST_STATUS / LAST_BODY.
request() {
  local method="$1" path="$2" body="${3:-}"
  info "$method $path${body:+  ⇢  $body}"

  local jar=("-b" "$JAR" "-c" "$JAR")
  local out
  if [[ -n "$body" ]]; then
    out="$(curl -sS "${jar[@]}" -X "$method" "$BASE_URL$path" \
      -H 'Content-Type: application/json' -d "$body" \
      -w $'\n%{http_code}')" || out=$'\n000'
  else
    out="$(curl -sS "${jar[@]}" -X "$method" "$BASE_URL$path" -w $'\n%{http_code}')" || out=$'\n000'
  fi

  LAST_STATUS="${out##*$'\n'}"
  LAST_BODY="${out%$'\n'*}"
  printf '  ← %s  %s\n' "$LAST_STATUS" "$LAST_BODY"
}

# expect_status CODE — assert the last response status equals CODE.
expect_status() {
  if [[ "$LAST_STATUS" == "$1" ]]; then
    pass "status $LAST_STATUS"
  else
    fail "expected status $1, got $LAST_STATUS"
    FAILURES=$((FAILURES + 1))
  fi
}

# expect_body SUBSTRING — assert the last response body contains SUBSTRING.
expect_body() {
  if [[ "$LAST_BODY" == *"$1"* ]]; then
    pass "body contains $1"
  else
    fail "expected body to contain '$1', got $LAST_BODY"
    FAILURES=$((FAILURES + 1))
  fi
}

# json_field NAME — extract a top-level string field from the last response body.
# Best-effort, for the simple flat JSON our endpoints return.
json_field() {
  printf '%s' "$LAST_BODY" \
    | grep -o "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" \
    | head -n1 \
    | sed 's/.*:[[:space:]]*"//; s/"$//'
}

# finish — print a summary and exit non-zero if any assertion failed. Call at the
# end of a suite's run.sh.
finish() {
  echo
  if [[ "$FAILURES" -eq 0 ]]; then
    pass "all checks passed"
  else
    fail "$FAILURES check(s) failed"
    exit 1
  fi
}
