#!/usr/bin/env bash
# Print the shipped cast table as a cube: for each kind and purpose, which model
# actually serves each (strength, speed, cost) coordinate.
#
# It reads etc/config.yaml, so it cannot go stale the way a hand-written table
# would. What it is for is seeing whether an axis DOES anything: a column that
# reads the same all the way down is an axis a caller can set freely with no
# effect, which is worse than not having it — the caller believes they asked for
# something.
#
# Only the first row for a coordinate is the primary; later rows with the same
# tuple are its fallback chain and are not shown.
#
# Usage: ./dev-test/cast-table.sh [CONFIG]
set -euo pipefail
cfg="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/etc/config.yaml}"

for kind in reasoning inference embedding; do
  rows="$(awk -v k="  *$kind:" '
    $0 ~ "^    "substr(k,3)"$" { f=1; next }
    /^    [a-z]+:$/ { f=0 }
    f' "$cfg" \
    | sed -E 's/.*purpose: *([a-z]+) *, *strength: *([a-z]+) *, *speed: *([a-z]+) *, *cost: *([a-z]+) *,.*model: "([^"]+)".*/\1\t\2\t\3\t\4\t\5/' \
    | grep -P '^\w+\t' || true)"
  [[ -n "$rows" ]] || continue

  for purpose in $(printf '%s\n' "$rows" | cut -f1 | sort -u); do
    printf '\n## %s — purpose `%s`\n\n' "$kind" "$purpose"
    printf '| strength | speed | cost: low | cost: medium | cost: high |\n'
    printf '| --- | --- | --- | --- | --- |\n'
    for s in low medium high; do
      for sp in low medium high; do
        line="| $s | $sp |"
        for c in low medium high; do
          m="$(printf '%s\n' "$rows" | awk -F'\t' -v p="$purpose" -v s="$s" -v sp="$sp" -v c="$c" \
                '$1==p && $2==s && $3==sp && $4==c { print $5; exit }')"
          line="$line \`${m:-—}\` |"
        done
        printf '%s\n' "$line"
      done
    done

    # An axis that never changes the answer is the finding worth surfacing.
    for axis in strength speed cost; do
      col=2; [[ $axis == speed ]] && col=3; [[ $axis == cost ]] && col=4
      distinct="$(printf '%s\n' "$rows" | awk -F'\t' -v p="$purpose" -v c="$col" \
        '$1==p { key=$c; m[key]=m[key]" "$5 } END { for (k in m) { n=split(m[k],a," "); u=""; for(i=1;i<=n;i++) if (index(u,a[i])==0) u=u" "a[i]; print k":"u } }' \
        | sort)"
      varies="$(printf '%s\n' "$distinct" | awk -F: '{print $2}' | sort -u | wc -l)"
      if [[ "$varies" -le 1 ]]; then
        printf '\n`%s` is INERT here — every value routes to the same model.\n' "$axis"
      fi
    done
  done
done
