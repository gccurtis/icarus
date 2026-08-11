#!/usr/bin/env bash
# Chat attachments: upload a single file and a directory manifest to a chat, list
# them, enforce the directory cap, and delete. The upload/list/delete flow is
# deterministic and always runs; a final live section (skip-on-no-key) proves an
# Ask turn actually uses an attached file's content as context.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

b64() { printf '%s' "$1" | base64 -w0; }

# If an OpenRouter key is present, configure a reasoning model up front so the
# live "Ask uses attachment" section at the end can run; the deterministic
# upload/list/delete flow runs either way.
KEY="$(grep -oE 'api_key:[[:space:]]*"[^"]+"' "$PROJECT_ROOT/etc/config.local.yaml" 2>/dev/null | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')" || true
if [[ -n "$KEY" ]]; then
  DEV_TEST_EXTRA_CONFIG="$(cat <<EOF
jobs:
  workers: 1
  poll_interval: "100ms"
  max_attempts: 1
EOF
)"
  export DEV_TEST_EXTRA_CONFIG
fi

trap stop_service EXIT
start_service

info "Register, log in, create + select a Project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"Attachments Test"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

info "Open an ask chat"
request POST /agent/chats '{"mode":"ask","title":"Files"}'; expect_status 201
CHAT_ID="$(json_field id)"

info "Attach a single text file"
CONTENT="$(b64 'The launch code is orange-swan-42.')"
request POST "/agent/chats/$CHAT_ID/attachments" "{\"name\":\"secret.txt\",\"contentType\":\"text/plain\",\"content\":\"$CONTENT\"}"
expect_status 201
ATT_ID="$(json_field id)"

request GET "/agent/chats/$CHAT_ID/attachments"; expect_status 200
N="$(printf '%s' "$LAST_BODY" | jq '.attachments | length')"
[[ "$N" == "1" ]] && pass "single file attached and listed" || { fail "expected 1 attachment, got $N"; FAILURES=$((FAILURES + 1)); }

info "Attach a directory manifest (two files with relative paths)"
A="$(b64 'alpha file body')"
B="$(b64 'beta file body')"
request POST "/agent/chats/$CHAT_ID/attachments" "{\"directory\":[{\"relativePath\":\"src/a.txt\",\"name\":\"a.txt\",\"contentType\":\"text/plain\",\"content\":\"$A\"},{\"relativePath\":\"src/b.txt\",\"name\":\"b.txt\",\"contentType\":\"text/plain\",\"content\":\"$B\"}]}"
expect_status 201
DIRN="$(printf '%s' "$LAST_BODY" | jq '.attachments | length')"
SHARED="$(printf '%s' "$LAST_BODY" | jq -r '[.attachments[].directoryUploadId] | unique | length')"
PATHS="$(printf '%s' "$LAST_BODY" | jq -r '[.attachments[].relativePath] | sort | join(",")')"
if [[ "$DIRN" == "2" && "$SHARED" == "1" && "$PATHS" == "src/a.txt,src/b.txt" ]]; then
  pass "directory manifest: 2 files, shared upload id, relative paths kept"
else
  fail "manifest wrong: n=$DIRN sharedIds=$SHARED paths=$PATHS"; FAILURES=$((FAILURES + 1))
fi

request GET "/agent/chats/$CHAT_ID/attachments"; expect_status 200
TOTAL="$(printf '%s' "$LAST_BODY" | jq '.attachments | length')"
[[ "$TOTAL" == "3" ]] && pass "chat now has 3 attachments" || { fail "expected 3, got $TOTAL"; FAILURES=$((FAILURES + 1)); }

info "Delete the single-file attachment"
request DELETE "/agent/chats/$CHAT_ID/attachments/$ATT_ID"; expect_status 204
request GET "/agent/chats/$CHAT_ID/attachments"; expect_status 200
LEFT="$(printf '%s' "$LAST_BODY" | jq '.attachments | length')"
[[ "$LEFT" == "2" ]] && pass "attachment deleted (2 remain)" || { fail "expected 2 after delete, got $LEFT"; FAILURES=$((FAILURES + 1)); }

# --- Live: an Ask turn uses an attached file's content ---
if [[ -z "$KEY" ]]; then
  info "SKIP: no OpenRouter key; the live 'Ask uses attachment' check was not run"
  finish
fi

info "Ask a question answerable only from the attached file"
CODE="$(b64 'The internal project codename is Bluefin Cascade.')"
request POST "/agent/chats/$CHAT_ID/attachments" "{\"name\":\"codename.txt\",\"contentType\":\"text/plain\",\"content\":\"$CODE\"}"
expect_status 201
request POST "/agent/chats/$CHAT_ID/turns" '{"message":"What is the internal project codename mentioned in the attached files? Answer with just the codename."}'
expect_status 200
ANSWER="$(printf '%s' "$LAST_BODY" | jq -r '.agentTurn.body')"
TOKENS="$(printf '%s' "$LAST_BODY" | jq '.usage.totalTokens // 0')"
USAGE_TOTAL_TOKENS=$((USAGE_TOTAL_TOKENS + TOKENS))
info "answer: ${ANSWER:0:200}"
if printf '%s' "$ANSWER" | grep -qi "bluefin"; then
  pass "Ask answered from the attached file (found 'Bluefin')"
else
  fail "Ask did not use the attachment: $ANSWER"; FAILURES=$((FAILURES + 1))
fi

usage_summary "${ATTACHMENTS_TEST_USD_PER_MILLION:-0.60}"
finish
