#!/usr/bin/env bash
# Live web-context test: an ask-mode chat turn with "web":true consults the
# configured live-web provider for transient context. Requires BOTH an OpenRouter
# reasoning key and a web provider (agents.web.endpoint) in etc/config.local.yaml;
# skips cleanly when either is absent.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

KEY="$(grep -oE 'api_key:[[:space:]]*"[^"]+"' "$PROJECT_ROOT/etc/config.local.yaml" 2>/dev/null | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')" || true
WEB_ENDPOINT="$(grep -oE 'endpoint:[[:space:]]*"https://[^"]+"' "$PROJECT_ROOT/etc/config.local.yaml" 2>/dev/null | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')" || true
WEB_KEY="$(grep -oE 'web_api_key:[[:space:]]*"[^"]+"' "$PROJECT_ROOT/etc/config.local.yaml" 2>/dev/null | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')" || true
if [[ -z "$KEY" || -z "$WEB_ENDPOINT" ]]; then
  info "SKIP: need an OpenRouter key and agents.web.endpoint in etc/config.local.yaml; live web was not run"
  exit 0
fi

DEV_TEST_EXTRA_CONFIG="$(cat <<EOF
jobs:
  workers: 1
  poll_interval: "100ms"
agents:
  web:
    endpoint: "${WEB_ENDPOINT}"
    api_key: "${WEB_KEY}"
    max_results: 5
EOF
)"
export DEV_TEST_EXTRA_CONFIG

trap stop_service EXIT
start_service

info "Register, log in, create, and select a Project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"Web Context Test"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

info "Open an ask-mode chat and post a turn that opts into web context"
request POST /agent/chats '{"mode":"ask","title":"Web"}'; expect_status 201
CHAT_ID="$(json_field id)"
request POST "/agent/chats/$CHAT_ID/turns" '{"message":"What is the latest stable Go release? Use the web to check.","web":true}'
expect_status 200
BODY="$(printf '%s' "$LAST_BODY" | jq -r '.agentTurn.body // .agentTurn.Body // ""')"
if [[ "${#BODY}" -ge 20 ]]; then
  pass "web-assisted ask returned an answer (${#BODY} chars)"
else
  fail "web-assisted ask returned no usable answer: $LAST_BODY"
  FAILURES=$((FAILURES + 1))
fi
TOKENS="$(printf '%s' "$LAST_BODY" | jq '[.usage | (.planning.totalTokens + .answer.totalTokens)] | add // 0')"
USAGE_TOTAL_TOKENS=$((USAGE_TOTAL_TOKENS + TOKENS))

usage_summary "${WEB_TEST_USD_PER_MILLION:-0.60}"
finish
