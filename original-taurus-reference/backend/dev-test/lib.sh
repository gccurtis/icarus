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
# The core always serves HTTPS (dev mode generates a self-signed cert), so the
# base URL is https and curl uses -k to accept the self-signed certificate.
BASE_URL="https://${HOST}:${PORT}"

# Seeded dev account (matches the dev_user written into the test manifest below),
# so suites can log in without signing up.
DEV_EMAIL="${DEV_EMAIL:-dev@taurus.local}"
DEV_PASSWORD="${DEV_PASSWORD:-devpassword}"

# The manifest a suite runs against. This is the SHIPPED config, not a
# test-shaped imitation of it: the cast a caller sends is hard-coded in the
# application by design — nothing exposes model strength to a user — so the cast
# is part of what we are testing, and the only thing that legitimately varies is
# which model a cast maps to. That mapping lives in a config file, so trying a
# different set of models means pointing at a different CONFIG, never rewriting
# cast rows inside a suite.
#
# Suites used to inject their own cast tables. Because the overlay replaces a
# YAML list wholesale, each suite silently discarded the shipped tables and
# tested models nobody ships — a green run was a claim about a configuration
# that did not exist.
DEV_TEST_BASE_CONFIG="${DEV_TEST_BASE_CONFIG:-$PROJECT_ROOT/etc/config.yaml}"

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

  # Per-run cookie jar so a login carries through later requests in a suite.
  JAR="$_workdir/cookies.txt"

  # The base manifest IS the shipped one, copied verbatim, so a suite exercises
  # the models and settings we actually deploy.
  cp "$DEV_TEST_BASE_CONFIG" "$cfg"

  # Everything test-specific goes in the sibling local overlay, which the loader
  # applies on top. Overlay only replaces the fields it names, so the shipped
  # cast tables survive untouched.
  #
  # Only the API KEY is taken from the developer's own etc/config.local.yaml —
  # not the whole file. That file is a full manifest on some machines, and
  # copying it would let local drift silently decide which models a test run
  # exercises, which is the very thing this is meant to prevent.
  local key
  key="$(grep -oE 'api_key:[[:space:]]*"[^"]+"' "$PROJECT_ROOT/etc/config.local.yaml" 2>/dev/null | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')" || true
  {
    cat <<EOF
mode: dev
server:
  addr: "$ADDR"
  tls:
    cert: "$_workdir/cert.pem"
    key: "$_workdir/key.pem"
logging:
  requests: true
  dir: "${DEV_TEST_LOG_DIR:-}"
storage:
  dsn: "$_workdir/test.db"
access:
  session_ttl: "168h"
EOF
    if [[ -n "$key" ]]; then
      cat <<EOF
intelligence:
  providers:
    openrouter:
      api_key: "$key"
EOF
    fi
    # A suite may add NON-MODEL sections (job pacing, a persona under test, an
    # external endpoint, lattice geometry) via DEV_TEST_EXTRA_CONFIG. Cast
    # tables do not belong here — see the note on DEV_TEST_BASE_CONFIG above.
    if [[ -n "${DEV_TEST_EXTRA_CONFIG:-}" ]]; then
      printf '%s\n' "$DEV_TEST_EXTRA_CONFIG"
    fi
  } >"$_workdir/config.local.yaml"

  info "Starting core on $BASE_URL ..."
  TAURUS_OMEGA_CONFIG="$cfg" "$bin" &
  _pid=$!

  for _ in $(seq 1 50); do
    if curl -sfk "$BASE_URL/healthz" >/dev/null 2>&1; then
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

# csrf_token — print the double-submit CSRF token the core issued, read out of
# the cookie jar (Netscape format: field 6 is the name, field 7 the value).
# Prints nothing when the jar holds no token yet.
csrf_token() {
  [[ -f "$JAR" ]] || return 0
  awk '$6 == "to_csrf" { t = $7 } END { if (t != "") print t }' "$JAR"
}

# request METHOD PATH [BODY] — make an HTTP request and print the request line,
# response status, and response body. Cookies persist across calls via a per-run
# jar, so a login carries through to later requests. Stores results in
# LAST_STATUS / LAST_BODY.
#
# Mutating requests must also pass the CSRF check: the core issues a to_csrf
# cookie on any authenticated request, and expects that same value echoed in the
# X-CSRF-Token header (double submit). We read it out of the jar; if a signed-in
# run has not picked one up yet — login is public, so it is not issued there — a
# silent read of /auth/me primes it before the first mutating call.
request() {
  local method="$1" path="$2" body="${3:-}"
  info "$method $path${body:+  ⇢  $body}"

  local jar=("-b" "$JAR" "-c" "$JAR")
  local csrf=()
  case "$method" in
    POST|PUT|PATCH|DELETE)
      local token
      token="$(csrf_token)"
      if [[ -z "$token" ]]; then
        curl -sSk "${jar[@]}" "$BASE_URL/auth/me" >/dev/null 2>&1 || true
        token="$(csrf_token)"
      fi
      [[ -n "$token" ]] && csrf=("-H" "X-CSRF-Token: $token")
      ;;
  esac

  local out
  if [[ -n "$body" ]]; then
    out="$(curl -sSk "${jar[@]}" ${csrf[@]+"${csrf[@]}"} -X "$method" "$BASE_URL$path" \
      -H 'Content-Type: application/json' -d "$body" \
      -w $'\n%{http_code}')" || out=$'\n000'
  else
    out="$(curl -sSk "${jar[@]}" ${csrf[@]+"${csrf[@]}"} -X "$method" "$BASE_URL$path" -w $'\n%{http_code}')" || out=$'\n000'
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

# expect_no_body SUBSTRING — assert the last response body does NOT contain SUBSTRING.
expect_no_body() {
  if [[ "$LAST_BODY" != *"$1"* ]]; then
    pass "body omits $1"
  else
    fail "expected body to omit '$1', got $LAST_BODY"
    FAILURES=$((FAILURES + 1))
  fi
}

# json_field NAME — extract a top-level string field from the last response body.
# Best-effort, for the simple flat JSON our endpoints return.
# Parsed with jq, not a regex. The previous version matched "name":"([^"]*)"
# and so truncated any value containing an escaped quote — a model that wrote
# the "Zephyrite" reactor with quotes around the name had its answer cut off
# mid-sentence, and the suite reported the name as missing when the stored
# document contained it. A test harness that misreads a correct answer is worse
# than no test: it accuses the product of a bug it does not have.
#
# `..|.NAME?` finds the field at any depth, matching the old behaviour of
# scanning the whole body, and `select(type=="string")` keeps it to string
# fields. Falls back to empty when absent or the body is not JSON.
json_field() {
  printf '%s' "$LAST_BODY" | jq -r --arg k "$1" '
    [.. | objects | select(has($k)) | .[$k] | select(type=="string")] | first // ""
  ' 2>/dev/null
}

# Cumulative embedding-token usage across a suite. A live suite makes real
# provider calls, so we surface exactly how many tokens (and, given a rate, how
# many dollars) a run cost. Suites call track_usage after each embedding-backed
# response and usage_summary at the end.
: "${USAGE_TOTAL_TOKENS:=0}"
: "${USAGE_PROMPT_TOKENS:=0}"

# track_usage — add the "usage" token counts from the last response to the
# running totals. Safe to call on responses without a usage block (adds nothing).
track_usage() {
  local total prompt
  total="$(printf '%s' "$LAST_BODY" | grep -oE '"totalTokens":[[:space:]]*[0-9]+' | head -n1 | grep -oE '[0-9]+$')" || true
  prompt="$(printf '%s' "$LAST_BODY" | grep -oE '"promptTokens":[[:space:]]*[0-9]+' | head -n1 | grep -oE '[0-9]+$')" || true
  [[ -n "$total" ]] && USAGE_TOTAL_TOKENS=$((USAGE_TOTAL_TOKENS + total))
  [[ -n "$prompt" ]] && USAGE_PROMPT_TOKENS=$((USAGE_PROMPT_TOKENS + prompt))
  # An if-block (not `[[ ]] && cmd`) so a response without usage leaves the
  # function's exit status at 0 — otherwise the trailing false test trips `set -e`.
  if [[ -n "$total" ]]; then
    info "usage: +${total} tokens (running total ${USAGE_TOTAL_TOKENS})"
  fi
}

# usage_summary [USD_PER_MILLION] — print the run's cumulative token usage, and,
# when a per-million-token rate is supplied, the estimated dollar cost. The cost
# of a live run is always surfaced, never hidden. If COST_FILE is set (the
# top-level runner sets it), the estimated cost is appended there so the runner
# can total the cost across the intelligence-backed suites.
usage_summary() {
  local rate="${1:-}"
  echo
  info "Token usage this run: ${USAGE_TOTAL_TOKENS} total tokens (${USAGE_PROMPT_TOKENS} prompt)"
  if [[ -n "$rate" && "$USAGE_TOTAL_TOKENS" -gt 0 ]]; then
    local cost
    cost="$(awk -v t="$USAGE_TOTAL_TOKENS" -v r="$rate" 'BEGIN{printf "%.6f", t/1000000*r}')"
    info "Estimated cost: \$${cost} (at \$${rate}/1M tokens)"
    # if-block, not `[[ ]] && cmd`: with COST_FILE unset (a direct run) the bare
    # test would return non-zero as the function's last statement and trip `set -e`
    # before finish() runs.
    if [[ -n "${COST_FILE:-}" ]]; then
      printf '%s\n' "$cost" >> "$COST_FILE"
    fi
  fi
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
