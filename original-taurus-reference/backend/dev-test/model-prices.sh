#!/usr/bin/env bash
# Refresh dev-test/model-prices.tsv from OpenRouter's live catalogue.
#
# The report generators price a run by multiplying measured tokens by a rate, so
# a model missing from the rate table silently costs 0.00 — which reads as "free"
# rather than "unknown", and is the worst possible failure for a document whose
# whole purpose is comparing cost. A sweep over twenty models cannot rely on a
# hand-maintained list, so the list is fetched.
#
# Rates are USD per 1M tokens. The key comes from etc/config.local.yaml, the same
# gitignored file the suites read.
#
# Usage: ./dev-test/model-prices.sh [OUT]
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
out="${1:-$here/model-prices.tsv}"
key="$(grep -oE 'api_key:[[:space:]]*"[^"]+"' "$here/../etc/config.local.yaml" 2>/dev/null | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')" || true
[[ -n "$key" ]] || { echo "no OpenRouter key in etc/config.local.yaml" >&2; exit 1; }

tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT
curl -sf https://openrouter.ai/api/v1/models -H "Authorization: Bearer $key" -o "$tmp"

# Emitted per 1M tokens, which is the unit every published rate card uses and the
# unit the reports print — converting here means no generator has to remember it.
{
  jq -r '.data[]
    | select(.pricing.prompt != null and .pricing.completion != null)
    | [.id, ((.pricing.prompt|tonumber)*1000000), ((.pricing.completion|tonumber)*1000000)]
    | @tsv' "$tmp"

  # Embedding models are not in this listing at all — /models enumerates chat and
  # completion models only, and returns zero results matching "embed".
  #
  # The call itself still goes through OpenRouter: we POST to
  # /api/v1/embeddings with model openai/text-embedding-3-small, and OpenRouter
  # bills it. Only the RATE is unavailable from the catalogue, so it is stated
  # here from OpenAI's published price, which is what OpenRouter passes through.
  # Without this line every embedding in every report costs 0.00, which reads as
  # free rather than unlisted. An embedding has no output, hence the 0.
  printf 'openai/text-embedding-3-small\t0.02\t0.00\n'
} | sort -u > "$out"

printf 'wrote %s (%d models)\n' "$out" "$(wc -l < "$out")"
