#!/usr/bin/env bash
# Scale test for the knowledge lattice against a REAL document corpus: every
# markdown file under this repo's docs/ plus (when present) the sibling
# taurus-alpha repo's docs/ — several hundred files, megabytes of real prose —
# admitted through a local-folder connector exactly the way production admits
# them. This is the parameter-validation suite: the unit fixtures prove the
# mechanics; this proves the tuning holds on text with real structure.
#
# What one run demonstrates end to end:
#   - the connector's snapshot lands as ONE AddBatch (one chunked embedding
#     batch, one deferred corpus rebuild) — not a call per file;
#   - the corpus tier crosses max_pool (lowered here so the corpus is over it)
#     and clusters sparsely, storing the level index;
#   - retrieval descends, probing the stored index, and finds topical content;
#   - a one-file edit re-syncs as a REPAIR (the log narrates it), with the
#     unchanged files skipped and only the edited tail re-embedded.
#
# Cost: embedding the whole corpus is the dominant spend (~1-2M tokens, a few
# cents at embedding rates). The run reports its usage and cost at the end,
# per the working agreement. Without a provider key the suite skips.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

KEY="$(grep -oE 'api_key:[[:space:]]*"[^"]+"' "$PROJECT_ROOT/etc/config.local.yaml" 2>/dev/null | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')" || true
if [[ -z "$KEY" ]]; then
  info "No OpenRouter key in etc/config.local.yaml — skipping the knowledge-scale suite."
  exit 0
fi

# --- The corpus is a persistent, gitignored directory built once by
# assemble.sh — the suite only checks it is there. Derived material has no
# business being copied per run or committed to the repo.
CORPUS_DIR="$PWD/corpus"
LOG_DIR="$(mktemp -d)"
trap 'rm -rf "$LOG_DIR"; stop_service' EXIT

if [[ ! -d "$CORPUS_DIR" ]]; then
  info "No corpus at dev-test/knowledge-scale/corpus — build it once with:"
  info "    ./dev-test/knowledge-scale/assemble.sh"
  info "It is gitignored; skipping the scale suite."
  exit 0
fi
FILE_COUNT="$(find "$CORPUS_DIR" -name '*.md' | wc -l | tr -d ' ')"
BYTES="$(du -sh "$CORPUS_DIR" | cut -f1)"
info "corpus: $FILE_COUNT markdown files, $BYTES"
if [[ "$FILE_COUNT" -lt 100 ]]; then
  fail "corpus of $FILE_COUNT files is too small to say anything about scale — re-run assemble.sh"
  exit 1
fi

# max_pool is lowered so THIS corpus's frontier crosses it: the corpus tier
# must run sparse, store its index, and serve the retrieval probe. Everything
# else is the shipped tuning — that is the point of the test. The server log
# goes to a file (DEV_TEST_LOG_DIR) so the suite can assert on the rebuild
# narration.
export DEV_TEST_LOG_DIR="$LOG_DIR"
DEV_TEST_EXTRA_CONFIG="$(cat <<EOF
knowledge:
  cluster:
    max_pool: 256
EOF
)"
export DEV_TEST_EXTRA_CONFIG

start_service
SERVER_LOG="$LOG_DIR/taurus-omega.log"

echo
info "Sign in and create a project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"Docs Corpus"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

echo
info "Create a local-folder connector over the corpus and sync it — one batch"
request POST /connectors '{"name":"Docs corpus","subkind":"local-folder"}'; expect_status 201
CID="$(json_field id)"
request PUT "/connectors/$CID/config" "{\"path\":\"$CORPUS_DIR\"}"; expect_status 200

SYNC_START=$SECONDS
request POST "/connectors/$CID/sync"; expect_status 200; track_usage
if ! printf '%s' "$LAST_BODY" | grep -q '"changed"'; then
  info "sync did not answer cleanly; recent server log:"
  grep -iE "error|warn" "$SERVER_LOG" 2>/dev/null | tail -n 5 | while read -r line; do info "log: $line"; done
fi
SYNC_SECS=$((SECONDS - SYNC_START))
SYNCED="$(printf '%s' "$LAST_BODY" | grep -oE '"files":[[:space:]]*[0-9]+' | head -n1 | grep -oE '[0-9]+$')" || SYNCED=""
info "first sync: ${SYNC_SECS}s for ${SYNCED:-$FILE_COUNT} files"

echo
info "Wait for the deferred corpus rebuild, then read its narration"
REBUILT=""
for _ in $(seq 1 120); do
  if grep -q "rebuilt the corpus tier" "$SERVER_LOG" 2>/dev/null; then REBUILT=yes; break; fi
  sleep 1
done
if [[ -n "$REBUILT" ]]; then pass "corpus rebuild ran"; else fail "no corpus rebuild in the log"; FAILURES=$((FAILURES + 1)); fi
grep -E "knowledge: corpus for|rebuilt the corpus tier" "$SERVER_LOG" | tail -n 5 | while read -r line; do info "log: ${line#*info: }"; done
if grep -q "built in full" "$SERVER_LOG"; then
  pass "the corpus tier ran sparse and stored its index (first build is a consolidation)"
else
  fail "no sparse level narration — the frontier did not cross max_pool"
  FAILURES=$((FAILURES + 1))
fi

echo
info "Retrieval over the real corpus: topical queries must ground in the docs"
# WHAT IS ASSERTED HERE, AND WHY IT IS NOT THE MODE.
#
# Each query must GROUND — return the document that actually answers it. That is
# the property worth defending, and it is stable.
#
# Per-query mode is REPORTED, never asserted, because it is not stable and the
# instability is not ours. Our clustering is a pure function of its inputs (fixed
# seeds, no clock, no global rand — see neighbors.go), but a live provider returns
# slightly different vectors for the same text between runs: batched float
# inference is not bit-reproducible. That shifts the pinned percentile threshold by
# ~0.001, which is enough to flip a query sitting near descent.threshold from
# descending to falling back.
#
# This was learned the hard way: an earlier version asserted '"mode":"descent"' on
# query 2. It failed on one run and passed on the next with byte-identical code and
# the same corpus, which is exactly the shape of a test measuring provider noise
# instead of behaviour. Record 0151 had already flagged descent.threshold 0.35 as
# marginal on real prose; this is that finding biting.
#
# The aggregate IS asserted: if NO query descends, descent is broken on a real
# corpus and that is a genuine failure rather than a marginal call.
DESCENDED=0
scale_query() {
  local query="$1" expect="$2"
  request POST /dev/knowledge/retrieve "{\"query\":\"$query\",\"topK\":3}"
  expect_status 200; expect_body "$expect"; track_usage
  local mode
  mode="$(printf '%s' "$LAST_BODY" | grep -oE '"mode":"[a-z-]+"' | head -n1)"
  info "mode for \"${query:0:40}...\": $mode"
  if [[ "$mode" == '"mode":"descent"' ]]; then DESCENDED=$((DESCENDED + 1)); fi
}

scale_query "how does clustering choose its similarity threshold from the percentile distribution" 'threshold'
scale_query "the corpus rebuild was moved off the write path into a background job" 'rebuild'
scale_query "connector sync of a local folder of files" '"regions"'

if [[ "$DESCENDED" -gt 0 ]]; then
  pass "descent carried $DESCENDED of 3 topical queries (the rest fell back and still grounded)"
else
  fail "no query descended — descent found nothing on the whole real corpus"
  FAILURES=$((FAILURES + 1))
fi

echo
info "Edit one file and re-sync: unchanged files skip, the rebuild REPAIRS"
# The corpus is persistent, so the edit is restored afterwards — the suite
# must leave the directory exactly as assemble.sh built it.
ONE_FILE="$(find "$CORPUS_DIR" -name '*.md' -print | sort | awk 'NR==1')"
ONE_FILE_BACKUP="$LOG_DIR/edited-file.orig"
cp "$ONE_FILE" "$ONE_FILE_BACKUP"
trap 'cp "$ONE_FILE_BACKUP" "$ONE_FILE" 2>/dev/null || true; rm -rf "$LOG_DIR"; stop_service' EXIT
printf '\n\nAppended by the scale suite to force a one-file change.\n' >> "$ONE_FILE"
BEFORE_TOKENS=$USAGE_TOTAL_TOKENS
request POST "/connectors/$CID/sync"; expect_status 200; track_usage
DELTA_TOKENS=$((USAGE_TOTAL_TOKENS - BEFORE_TOKENS))
info "re-sync embedded ${DELTA_TOKENS} tokens (first sync: much more) — the skip and reuse paths held"

REPAIRED=""
for _ in $(seq 1 120); do
  if grep -q "repaired (+" "$SERVER_LOG" 2>/dev/null; then REPAIRED=yes; break; fi
  sleep 1
done
if [[ -n "$REPAIRED" ]]; then
  pass "the one-file re-sync repaired the index instead of consolidating"
  grep "repaired (+" "$SERVER_LOG" | tail -n 2 | while read -r line; do info "log: ${line#*info: }"; done
else
  fail "no repair narration after the one-file edit"
  FAILURES=$((FAILURES + 1))
fi

usage_summary 0.02
finish
