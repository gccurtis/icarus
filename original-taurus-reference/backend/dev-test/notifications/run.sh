#!/usr/bin/env bash
# Live notifications test: a completed durable task pushes one ephemeral toast to
# its requester, GET /notifications drains it exactly once, and a second drain is
# empty. A toast only exists after a real task runs, so this needs a reasoning
# model; it skips cleanly without the gitignored OpenRouter key.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

KEY="$(grep -oE 'api_key:[[:space:]]*"[^"]+"' "$PROJECT_ROOT/etc/config.local.yaml" 2>/dev/null | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')" || true
if [[ -z "$KEY" ]]; then
  info "SKIP: no OpenRouter key in etc/config.local.yaml; live notifications was not run"
  exit 0
fi

DEV_TEST_EXTRA_CONFIG="$(cat <<EOF
jobs:
  workers: 1
  poll_interval: "100ms"
  max_attempts: 1
EOF
)"
export DEV_TEST_EXTRA_CONFIG

trap stop_service EXIT
start_service

info "Register, log in, create, and select a Project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"Notifications Test"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

info "No task has run yet, so the drain is empty"
request GET /notifications; expect_status 200
N="$(printf '%s' "$LAST_BODY" | jq '.notifications | length')"
if [[ "$N" == "0" ]]; then
  pass "empty drain before any task"
else
  fail "expected 0 notifications before any task, got $N"
  FAILURES=$((FAILURES + 1))
fi

info "Create a small Plan task and let a real model finish it"
OBJ="Produce a short three-step plan for writing a one-page project status update."
BODY="$(jq -nc --arg o "$OBJ" '{objective:$o,persona:{personaId:"general"},context:[]}')"
request POST /agent/plans "$BODY"; expect_status 201
TASK_ID="$(json_field id)"

info "Poll the durable Plan task to a terminal state"
STATE="queued"
for _ in $(seq 1 180); do
  request GET "/agent/tasks/$TASK_ID"
  STATE="$(json_field state)"
  case "$STATE" in completed|partially_completed|failed|canceled) break ;; esac
  sleep 0.5
done
# Any terminal outcome is fine here — this suite verifies the notification
# contract, not that the model succeeded. Map the settled state to the toast
# level the workflow must have pushed; a provider hiccup that fails the task is
# still a legitimate settled outcome that must notify the requester.
case "$STATE" in
  completed)           EXPECT_LEVEL="success" ;;
  partially_completed) EXPECT_LEVEL="warning" ;;
  failed)              EXPECT_LEVEL="error" ;;
  *) EXPECT_LEVEL="" ;;
esac
if [[ -n "$EXPECT_LEVEL" ]]; then
  pass "plan task settled: $STATE (expecting a '$EXPECT_LEVEL' toast)"
else
  fail "plan task did not settle to a notifiable state: $STATE"
  FAILURES=$((FAILURES + 1))
fi
TOKENS="$(printf '%s' "$LAST_BODY" | jq '[.runs[].usage | (.planning.totalTokens + .retrieval.totalTokens + .answer.totalTokens)] | add // 0')"
USAGE_TOTAL_TOKENS=$((USAGE_TOTAL_TOKENS + TOKENS))
info "plan task usage: ${TOKENS} tokens"

info "Settling the task pushed one toast for this Project; the drain returns it"
request GET /notifications; expect_status 200
N="$(printf '%s' "$LAST_BODY" | jq '.notifications | length')"
LEVEL="$(printf '%s' "$LAST_BODY" | jq -r '.notifications[0].level // ""')"
TITLE="$(printf '%s' "$LAST_BODY" | jq -r '.notifications[0].title // ""')"
TPROJ="$(printf '%s' "$LAST_BODY" | jq -r '.notifications[0].projectId // ""')"
if [[ "$N" == "1" && "$LEVEL" == "$EXPECT_LEVEL" && -n "$TITLE" && "$TPROJ" == "$PROJECT_ID" ]]; then
  pass "toast delivered (level=$LEVEL title='$TITLE')"
else
  fail "toast wrong: n=$N level=$LEVEL (want $EXPECT_LEVEL) title='$TITLE' proj=$TPROJ"
  FAILURES=$((FAILURES + 1))
fi

info "Draining is destructive: a second drain is empty"
request GET /notifications; expect_status 200
N2="$(printf '%s' "$LAST_BODY" | jq '.notifications | length')"
if [[ "$N2" == "0" ]]; then
  pass "second drain is empty"
else
  fail "expected empty second drain, got $N2"
  FAILURES=$((FAILURES + 1))
fi

usage_summary "${NOTIFICATIONS_TEST_USD_PER_MILLION:-0.60}"
finish
