#!/usr/bin/env bash
# Automated dev-test for the public HTTP surface: the health check is open, and
# everything else is gated behind sign-in. The signed-in flow (logging in and
# reaching the gated echo endpoint) lives in the gateway suite.
#
# The manual, walk-through-by-hand version of this test lives in manual.md.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

trap stop_service EXIT

start_service

echo
info "Health check is public and reports the service is up"
request GET /healthz
expect_status 200
expect_body '"status":"ok"'

echo
info "Echo is gated: an anonymous caller is refused"
request POST /echo '{"hello":"world"}'
expect_status 401
expect_body 'sign in required'

finish
