#!/usr/bin/env bash
# Automated dev-test for the background-jobs system. Re-basing a document is an
# async operation: the request enqueues a job and returns 202 with a job id, and
# a worker runs it off the request path. This suite drives that flow over HTTP and
# polls the job to completion.
#
# Requests share a cookie jar (see ../lib.sh). The manual walkthrough is in
# manual.md.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT

start_service

echo
info "Sign in, create and select a project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 200
request POST /projects '{"name":"Jobs Project"}'
expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"
expect_status 200

echo
info "Create a document"
request POST /documents '{"name":"Notes","rows":[{"id":"r1","blocks":[{"id":"b1","kind":"text","atoms":[{"id":"a1","kind":"text","text":"hello"}]}]}]}'
expect_status 201
DOC_ID="$(json_field id)"
info "document id = $DOC_ID"

echo
info "Re-base is async: the request is accepted (202) with a job id to poll"
request POST "/dev/documents/$DOC_ID/rebase"
expect_status 202
expect_body '"jobId"'
expect_body '"status":"queued"'
JOB_ID="$(json_field jobId)"
info "job id = $JOB_ID"

echo
info "The job id is pollable at /dev/jobs/:jobID"
request GET "/dev/jobs/$JOB_ID"
expect_status 200
expect_body '"type":"document.rebase"'

echo
info "A worker runs the job off the request path; poll until it is done"
for _ in $(seq 1 20); do
  request GET "/dev/jobs/$JOB_ID"
  [[ "$LAST_BODY" == *'"status":"done"'* ]] && break
  sleep 0.3
done
expect_status 200
expect_body '"status":"done"'

echo
info "An unknown job id is 404"
request GET "/dev/jobs/does-not-exist"
expect_status 404

echo
info "Observability: the queue is listable by status, with a whole-queue summary"
request GET "/dev/jobs?status=done"
expect_status 200
expect_body "\"$JOB_ID\""
expect_body '"counts"'
expect_no_body '"payload"'

echo
info "An unknown status filter is rejected rather than returning everything"
request GET "/dev/jobs?status=nonsense"
expect_status 400

finish
