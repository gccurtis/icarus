#!/usr/bin/env bash
# Automated dev-test for document-scoped agent tasks: an Action created with a
# targetDocumentId is scoped to that document, so GET /agent/tasks?documentId=
# returns it under its document and not under another. Task execution needs a
# model, but creation and the document filter do not, so this suite always runs
# (the queued runs fail without a provider — the filter is state-independent).

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

# One attempt per run so the provider-less run failures do not retry-spam.
DEV_TEST_EXTRA_CONFIG="$(cat <<'EOF'
jobs:
  workers: 1
  max_attempts: 1
EOF
)"
export DEV_TEST_EXTRA_CONFIG

trap stop_service EXIT
start_service

info "Register, log in, create, and select a Project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"Task Scope Test"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

info "Create two documents to scope tasks to"
request POST /documents '{"name":"Doc A","rows":[]}'; expect_status 201
DOC_A="$(json_field id)"
request POST /documents '{"name":"Doc B","rows":[]}'; expect_status 201
DOC_B="$(json_field id)"

info "Create an Action scoped to Doc A, another to Doc B, and one unscoped"
request POST /agent/actions "$(jq -nc --arg d "$DOC_A" '{objective:"Edit doc A.",persona:{personaId:"general"},targetDocumentId:$d}')"
expect_status 201
TASK_A="$(json_field id)"
expect_body "\"targetDocumentId\":\"$DOC_A\""
request POST /agent/actions "$(jq -nc --arg d "$DOC_B" '{objective:"Edit doc B.",persona:{personaId:"general"},targetDocumentId:$d}')"
expect_status 201
TASK_B="$(json_field id)"
request POST /agent/actions '{"objective":"Unscoped work.","persona":{"personaId":"general"}}'
expect_status 201
TASK_C="$(json_field id)"

info "The Doc A filter returns only the Doc A task"
request GET "/agent/tasks?documentId=$DOC_A"; expect_status 200
IDS_A="$(printf '%s' "$LAST_BODY" | jq -r '[.tasks[].id] | sort | join(",")')"
if [[ "$IDS_A" == "$TASK_A" ]]; then
  pass "documentId=DocA -> only TASK_A"
else
  fail "DocA filter wrong: got [$IDS_A], want [$TASK_A]"
  FAILURES=$((FAILURES + 1))
fi

info "The Doc B filter returns only the Doc B task"
request GET "/agent/tasks?documentId=$DOC_B"; expect_status 200
IDS_B="$(printf '%s' "$LAST_BODY" | jq -r '[.tasks[].id] | join(",")')"
if [[ "$IDS_B" == "$TASK_B" ]]; then
  pass "documentId=DocB -> only TASK_B"
else
  fail "DocB filter wrong: got [$IDS_B], want [$TASK_B]"
  FAILURES=$((FAILURES + 1))
fi

info "The unfiltered list returns all three tasks"
request GET "/agent/tasks"; expect_status 200
N_ALL="$(printf '%s' "$LAST_BODY" | jq '.tasks | length')"
if [[ "$N_ALL" == "3" ]]; then
  pass "unfiltered list -> all three tasks"
else
  fail "unfiltered list wrong: got $N_ALL, want 3"
  FAILURES=$((FAILURES + 1))
fi

info "A document with no tasks filters to empty"
request GET "/agent/tasks?documentId=$PROJECT_ID"; expect_status 200
N_NONE="$(printf '%s' "$LAST_BODY" | jq '.tasks | length')"
if [[ "$N_NONE" == "0" ]]; then
  pass "documentId with no tasks -> empty"
else
  fail "empty filter wrong: got $N_NONE, want 0"
  FAILURES=$((FAILURES + 1))
fi

finish
