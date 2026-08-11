#!/usr/bin/env bash
# Automated dev-test for the knowledge lattice — the /dev/knowledge/* endpoints.
# Adding a document embeds and clusters its text into a per-source subtree, a
# second source builds the cross-source top, and retrieval descends the lattice
# to grounded, cited spans.
#
# Unlike the plumbing unit tests (which use a fake embedder), this suite exists to
# verify *quality*: that real embeddings cluster and retrieve well enough that a
# topical query lands on the right source. That is only meaningful against a real
# provider, so:
#
#   - With key: an OpenRouter key in etc/config.local.yaml drives real embedding
#     calls. Two topically distinct documents are added, then a query about each
#     topic must retrieve a hit whose top source is the matching document.
#   - No key (CI-safe): the suite SKIPS — there is nothing to prove without live
#     embeddings — printing how to enable it, and exits 0.
#
# The embedding cast injected here (general / medium / medium / medium) matches
# the fixed cast the composition root binds the knowledge embedder to, so Add
# resolves to a configured model. Tiny documents keep the live cost negligible,
# and the token usage the run incurs is surfaced at the end. The manual
# walkthrough is in manual.md.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

# Best-effort: pull a real OpenRouter key out of the gitignored local overlay.
KEY="$(grep -oE 'api_key:[[:space:]]*"[^"]+"' "$PROJECT_ROOT/etc/config.local.yaml" 2>/dev/null | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')" || true

if [[ -z "$KEY" ]]; then
  info "No OpenRouter key in etc/config.local.yaml — skipping the knowledge suite."
  info "Knowledge quality can only be judged against real embeddings; add a key to"
  info "etc/config.local.yaml (api_key: \"...\") to exercise this suite."
  exit 0
fi

# The knowledge embedder resolves the general/medium/medium/medium embedding
# cast out of the shipped config — this suite does not choose a model.
DEV_TEST_EXTRA_CONFIG="$(cat <<EOF
knowledge:
  # Small windows so these short documents form several windows and cluster into
  # real lattice nodes — otherwise each document is a single window and descent
  # has nothing to walk.
  window:
    target_runes: 200
    overlap_runes: 40
EOF
)"
export DEV_TEST_EXTRA_CONFIG

trap stop_service EXIT

start_service

echo
info "Sign in, create and select a project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"
expect_status 200
request POST /projects '{"name":"Knowledge Project"}'
expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"
expect_status 200

# Two topically distinct documents. Each has enough prose to window and cluster,
# and the topics (plant biology vs. personal finance) are far apart in embedding
# space so retrieval can discriminate by source.
GARDEN='{"name":"Plants","rows":[{"blocks":[
{"kind":"text","atoms":[{"kind":"text","text":"Photosynthesis is how green plants convert sunlight, water, and carbon dioxide into glucose and oxygen. Chlorophyll in the leaves captures light energy that drives the reaction."}]},
{"kind":"text","atoms":[{"kind":"text","text":"Healthy soil gives roots the nitrogen, phosphorus, and potassium they need. Gardeners enrich beds with compost and mulch to retain moisture and feed the plants."}]},
{"kind":"text","atoms":[{"kind":"text","text":"Pruning, watering on a schedule, and enough sunlight keep a vegetable garden productive through the growing season, from seedling to harvest."}]}
]}]}'

FINANCE='{"name":"Money","rows":[{"blocks":[
{"kind":"text","atoms":[{"kind":"text","text":"When a central bank raises interest rates, borrowing becomes more expensive and savings earn more, which tends to cool inflation across the economy."}]},
{"kind":"text","atoms":[{"kind":"text","text":"Stock prices rise and fall with company earnings, investor sentiment, and expectations about future growth. Diversifying a portfolio spreads risk across assets."}]},
{"kind":"text","atoms":[{"kind":"text","text":"A budget tracks income against expenses so a household can pay down debt, build an emergency fund, and invest the surplus for retirement."}]}
]}]}'

echo
info "Create the two source documents"
request POST /documents "$GARDEN"
expect_status 201
GARDEN_ID="$(json_field id)"
info "garden document id = $GARDEN_ID"
request POST /documents "$FINANCE"
expect_status 201
FINANCE_ID="$(json_field id)"
info "finance document id = $FINANCE_ID"

echo
info "Add the first document to the lattice: it is windowed, embedded and clustered"
request POST "/dev/knowledge/documents/$GARDEN_ID"
expect_status 201
expect_body '"windows"'
expect_body '"nodes"'
expect_body '"usage"'
# With small windows this document forms several windows that cluster into at
# least one node — the lattice is real, not a flat bag of windows.
expect_no_body '"nodes":0'
track_usage

echo
info "Add the second document: this builds the cross-source top of the lattice"
request POST "/dev/knowledge/documents/$FINANCE_ID"
expect_status 201
expect_body '"windows"'
track_usage

echo
info "Retrieve a plant-biology query — the top hit must come from the garden document"
request POST /dev/knowledge/retrieve '{"query":"how do leaves turn sunlight into energy for the plant","topK":3}'
expect_status 200
expect_body "\"sourceId\":\"$GARDEN_ID\""
expect_body '"mode":"descent"'
track_usage
TOP_SOURCE="$(json_field sourceId)"
if [[ "$TOP_SOURCE" == "$GARDEN_ID" ]]; then
  pass "top hit is the garden document"
else
  fail "top hit sourceId=$TOP_SOURCE, expected garden $GARDEN_ID"
  FAILURES=$((FAILURES + 1))
fi

echo
info "Retrieve a finance query — the top hit must come from the money document"
request POST /dev/knowledge/retrieve '{"query":"what makes stock prices go up when interest rates change","topK":3}'
expect_status 200
expect_body "\"sourceId\":\"$FINANCE_ID\""
track_usage
TOP_SOURCE="$(json_field sourceId)"
if [[ "$TOP_SOURCE" == "$FINANCE_ID" ]]; then
  pass "top hit is the money document"
else
  fail "top hit sourceId=$TOP_SOURCE, expected finance $FINANCE_ID"
  FAILURES=$((FAILURES + 1))
fi

echo
info "Regions carry provenance, a byte range, density, and verbatim text"
expect_body '"regions"'
expect_body '"start"'
expect_body '"end"'
expect_body '"density"'
expect_body '"text"'

echo
info "Descent at topK=1 finds the right source (descent-vs-exact equivalence is a unit-test oracle now)"
request POST /dev/knowledge/retrieve '{"query":"central bank interest rates inflation","topK":1}'
expect_status 200
expect_body '"mode":"descent"'
expect_body "\"sourceId\":\"$FINANCE_ID\""
track_usage

echo
info "Re-adding an unchanged document reuses every embedding — nothing is re-embedded"
request POST "/dev/knowledge/documents/$GARDEN_ID"
expect_status 201
expect_body "\"sourceId\":\"$GARDEN_ID\""
expect_body '"embedded":0'
expect_body '"reused"'
track_usage

echo
info "Adding an unknown document is a 404 (write-role enforcement is covered in unit tests)"
request POST "/dev/knowledge/documents/does-not-exist"
expect_status 404

echo
info "Remove deletes a source from the lattice; it is then unretrievable"
request DELETE "/dev/knowledge/documents/$FINANCE_ID"
expect_status 200
expect_body '"removed":true'
request POST /dev/knowledge/retrieve '{"query":"what makes stock prices go up when interest rates change","topK":3}'
expect_status 200
expect_no_body "\"sourceId\":\"$FINANCE_ID\""
track_usage

echo
info "Removing a source that is not in the lattice is a 404"
request DELETE "/dev/knowledge/documents/$FINANCE_ID"
expect_status 404

# text-embedding-3-small is roughly $0.02 per million tokens; surface the run cost.
usage_summary 0.02

finish
