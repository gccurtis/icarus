#!/usr/bin/env bash
# Automated dev-test for the intelligence endpoints — reasoning, inference, and
# embedding. The routes are gated, so anonymous calls are refused; after login, a
# request resolves its semantic cast to a configured model.
#
# The suite injects an intelligence section into the test manifest (see
# DEV_TEST_EXTRA_CONFIG in ../lib.sh). Casts come from the shipped config. It runs in two
# modes:
#
#   - No key (default, CI-safe): the provider has no credential, so a request for
#     a configured cast returns 503 "not configured". No external call is made.
#   - With key: if an OpenRouter key is found in etc/config.local.yaml, it is used
#     and each kind makes a real call — reason/infer expect 200 with text, embed
#     expects 200 with vectors.
#
# Either way, an unconfigured cast returns 400 "no model configured". Cheap models
# and tiny prompts keep the live cost negligible. The manual walkthrough is in
# manual.md.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

# Best-effort: pull a real OpenRouter key out of the gitignored local overlay so
# the live path runs when one is present. Absent → the no-key path runs.
KEY="$(grep -oE 'api_key:[[:space:]]*"[^"]+"' "$PROJECT_ROOT/etc/config.local.yaml" 2>/dev/null | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')" || true

# Inject cheap casts. Reasoning uses DeepSeek and inference a small OpenAI model
# (exercising both providers); embedding uses the single general cast the
# shipped config defines (there is exactly one embedding model on purpose —
# vectors from two models are incomparable). base_url is omitted, so the
# provider
# defaults to OpenRouter.

trap stop_service EXIT

start_service

# The configured casts (a general one and a code-purpose one for embeddings), and
# an unconfigured cast (strength high has no row).
CAST_OK='{"purpose":"general","strength":"low","speed":"high","cost":"low"}'
# The shipped config fills all 27 general coordinates for reasoning and
# inference, so an unconfigured cast has to differ by PURPOSE: only embedding
# carries a "code" purpose, and nothing serves code-purpose inference.
CAST_MISSING='{"purpose":"code","strength":"low","speed":"high","cost":"low"}'

echo
info "Anonymous: intelligence endpoints are refused"
request POST /intelligence/infer "{\"cast\":$CAST_OK,\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}"
expect_status 401
expect_body 'sign in required'

echo
info "Register and log in the dev user"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 200

echo
info "An unconfigured cast is refused with a clear error"
request POST /intelligence/infer "{\"cast\":$CAST_MISSING,\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}"
expect_status 400
expect_body 'no model configured'

# request_live METHOD PATH BODY — request with one bounded retry when the
# provider itself fails (5xx). A single upstream hiccup (an OpenRouter 502 on a
# trivial call) should not fail the suite; a provider that is actually down
# still does.
request_live() {
  request "$1" "$2" "$3"
  if [[ "$LAST_STATUS" -ge 500 ]]; then
    info "provider hiccup ($LAST_STATUS) — retrying once"
    sleep 2
    request "$1" "$2" "$3"
  fi
}

if [[ -n "$KEY" ]]; then
  echo
  info "Reasoning: a real call returns text"
  request_live POST /intelligence/reason "{\"cast\":$CAST_OK,\"messages\":[{\"role\":\"user\",\"content\":\"Reply with the single word: pong\"}]}"
  expect_status 200
  expect_body '"text"'
  track_usage

  echo
  info "Inference: a real call returns text"
  request_live POST /intelligence/infer "{\"cast\":$CAST_OK,\"messages\":[{\"role\":\"user\",\"content\":\"Reply with the single word: pong\"}]}"
  expect_status 200
  expect_body '"text"'
  track_usage

  echo
  info "Embedding (general): a real call returns vectors"
  request_live POST /intelligence/embed "{\"cast\":$CAST_OK,\"inputs\":[\"hello world\"]}"
  expect_status 200
  expect_body '"vectors":[['
  track_usage

  # Blends reasoning and embedding tokens; the estimate uses a representative rate.
  usage_summary 0.10
else
  echo
  info "No key configured: a configured cast reports the provider is unavailable"
  info "(set a real key in etc/config.local.yaml to exercise a live call)"
  request POST /intelligence/infer "{\"cast\":$CAST_OK,\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}"
  expect_status 503
  expect_body 'not configured'
fi

finish
