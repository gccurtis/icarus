#!/usr/bin/env bash
# Build the scale suite's corpus ONCE: every markdown file from this repo's
# docs tree plus the sibling taurus-alpha's, copied into ./corpus — which is
# gitignored, because it is derived material with no reason to live in the
# repo. Re-run any time to refresh it. SCALE_MAX_FILES bounds each tree
# (debugging aid; default all).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
ROOT="$(cd ../.. && pwd)"
LIMIT="${SCALE_MAX_FILES:-1000000}"
rm -rf corpus
copy_md() {
  [[ -d "$1" ]] || return 0
  (cd "$1" && find . -name '*.md' -type f | sort | awk -v n="$LIMIT" 'NR<=n' | while read -r f; do
    mkdir -p "$2/$(dirname "$f")"
    cp "$f" "$2/$f"
  done)
}
copy_md "$ROOT/docs" "$PWD/corpus/omega"
copy_md "$ROOT/../taurus-alpha/docs" "$PWD/corpus/alpha"
echo "corpus: $(find corpus -name '*.md' | wc -l | tr -d ' ') markdown files, $(du -sh corpus | cut -f1)"
