#!/usr/bin/env bash
# Automated dev-test for the file store: a base64 upload round-trips through
# metadata and a binary download (bytes and content type preserved), the
# uploader is recorded, and another project cannot read the file. No model is
# involved, so this suite always runs.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT
start_service

info "Register, log in, create, and select a Project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"File Test"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

PAYLOAD="hello file contents"
CONTENT_B64="$(printf '%s' "$PAYLOAD" | base64 | tr -d '\n')"

info "Upload a base64 file"
request POST /files "$(jq -nc --arg c "$CONTENT_B64" '{name:"notes.txt",contentType:"text/plain",content:$c}')"
expect_status 201
FILE_ID="$(json_field id)"
SIZE="$(printf '%s' "$LAST_BODY" | jq -r '.size')"
UPLOADER="$(printf '%s' "$LAST_BODY" | jq -r '.uploaderId')"
if [[ "$SIZE" == "${#PAYLOAD}" && -n "$UPLOADER" && "$UPLOADER" != "null" ]]; then
  pass "uploaded file: size=$SIZE, uploader recorded"
else
  fail "upload meta wrong: size=$SIZE uploader=$UPLOADER (want ${#PAYLOAD})"
  FAILURES=$((FAILURES + 1))
fi

info "Metadata reports name and content type"
request GET "/files/$FILE_ID/meta"; expect_status 200
expect_body '"name":"notes.txt"'
expect_body '"contentType":"text/plain"'

info "Binary download returns the exact bytes"
request GET "/files/$FILE_ID"; expect_status 200
if [[ "$LAST_BODY" == "$PAYLOAD" ]]; then
  pass "download bytes match the upload"
else
  fail "download mismatch: got [$LAST_BODY], want [$PAYLOAD]"
  FAILURES=$((FAILURES + 1))
fi

info "Another Project cannot read the file"
request POST /projects '{"name":"Other Project"}'; expect_status 201
OTHER="$(json_field id)"
request POST /session/project "{\"projectId\":\"$OTHER\"}"; expect_status 200
request GET "/files/$FILE_ID"; expect_status 404
request GET "/files/$FILE_ID/meta"; expect_status 404
pass "cross-project download and meta both 404"

finish
