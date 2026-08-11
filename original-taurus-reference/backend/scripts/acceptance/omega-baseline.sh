#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

mode=standard
run_race=0
with_free_dev_tests=0
for arg in "$@"; do
  case "$arg" in
    --inventory-only)
      mode=inventory
      ;;
    --full)
      run_race=1
      with_free_dev_tests=1
      ;;
    --with-free-dev-tests)
      with_free_dev_tests=1
      ;;
    *)
      echo "usage: $0 [--inventory-only | --full] [--with-free-dev-tests]" >&2
      exit 2
      ;;
  esac
done

if [[ "$mode" == "inventory" && "$run_race" == "1" ]]; then
  echo "usage: --inventory-only and --full are mutually exclusive" >&2
  exit 2
fi

scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT

pass() {
  printf 'ok  %s\n' "$1"
}

fail() {
  printf 'FAIL  %s\n' "$1" >&2
  exit 1
}

compare_files() {
  local description="$1"
  local expected="$2"
  local actual="$3"
  if ! diff -u "$expected" "$actual"; then
    fail "$description"
  fi
  pass "$description"
}

check_packet_matrix() {
  find docs/current-docs/work-packets -maxdepth 1 -type f \
    -name 'omega-[0-9][0-9][0-9]-*.md' -printf '%f\n' |
    sed -E 's/^(omega-[0-9]{3})-.*/\1/' |
    sort >"$scratch/expected-packets"

  sed -n -E 's/^\| Ω-([0-9]{3}) \|.*/omega-\1/p' \
    docs/completion/omega-completion-matrix.md |
    sort >"$scratch/matrix-packets"

  compare_files "all 44 work packets appear exactly once in the matrix" \
    "$scratch/expected-packets" "$scratch/matrix-packets"

  [[ "$(wc -l <"$scratch/matrix-packets" | tr -d ' ')" == "44" ]] ||
    fail "matrix packet count is not 44"

  if sed -n -E 's/^\| Ω-([0-9]{3}) \|.*/omega-\1/p' \
    docs/completion/omega-completion-matrix.md |
    sort | uniq -d | grep -q .; then
    fail "a packet has more than one matrix row"
  fi

  local states
  states="$(sed -n -E 's/^\| Ω-[0-9]{3} \|.*\| ([a-z-]+) \|$/\1/p' \
    docs/completion/omega-completion-matrix.md | wc -l | tr -d ' ')"
  [[ "$states" == "44" ]] || fail "a matrix row has an unclassified state"
}

check_capabilities() {
  go list ./core/capability/... |
    sed 's#^github.com/gccurtis/taurus-omega/##' |
    sort >"$scratch/capabilities"

  local count=0
  while IFS= read -r capability; do
    rg -Fq "$capability" docs/completion/omega-completion-matrix.md ||
      fail "capability is absent from matrix: $capability"
    count=$((count + 1))
  done <"$scratch/capabilities"
  [[ "$count" == "21" ]] || fail "capability package count changed from 21"
  pass "all 21 capability packages are classified"

  for finding in ING-1 ING-2 ING-3 ING-4 ING-5 ING-6; do
    rg -Fq "$finding" docs/completion/omega-completion-matrix.md ||
      fail "unowned ingest finding: $finding"
  done
  pass "ING-1 through ING-6 remain packet-owned"
}

check_architecture_imports() {
  ./scripts/check-architecture.sh
  pass "deny-by-default architecture policy and exception ceiling"

  go list -f '{{.ImportPath}} {{join .Imports " "}}' ./core/capability/... |
    awk '
      {
        source=$1
        sub("^github.com/gccurtis/taurus-omega/", "", source)
        for (i=2; i<=NF; i++) {
          if ($i ~ "^github.com/gccurtis/taurus-omega/core/capability/") {
            target=$i
            sub("^github.com/gccurtis/taurus-omega/", "", target)
            print source "\t" target
          }
        }
      }
    ' | sort >"$scratch/current-imports"

  awk -F '\t' 'NR > 1 {print $1 "\t" $2}' \
    docs/completion/architecture-import-map.tsv |
    sort >"$scratch/classified-imports"
  compare_files "capability-to-capability imports are exhaustively classified" \
    "$scratch/current-imports" "$scratch/classified-imports"

  sed -n '/if err := registry.Validate(/,/); err != nil/p' core/wiring/wiring.go |
    sed -n -E 's/^[[:space:]]*([a-z]+\.JobType[A-Za-z]+),$/\1/p' |
    sort >"$scratch/job-registry"
  cat >"$scratch/expected-job-registry" <<'EOF'
agent.JobTypeRun
document.JobTypeRebase
document.JobTypeResolve
knowledge.JobTypeRebuildCorpus
knowledge.JobTypeReembed
EOF
  compare_files "startup durable-job registry has five classified handlers" \
    "$scratch/expected-job-registry" "$scratch/job-registry"

  sed -n '/return resources.ValidateFamilies(/,/)/p' core/wiring/wiring.go |
    rg -o 'resource\.Kind[A-Za-z]+' |
    sed 's/resource\.//' |
    sort >"$scratch/resource-families"
  cat >"$scratch/expected-resource-families" <<'EOF'
KindConnector
KindDocument
KindFile
EOF
  compare_files "startup Resource registry has three required families" \
    "$scratch/expected-resource-families" "$scratch/resource-families"
}

check_startup_migrations() {
  local alter_count
  alter_count="$(rg -c '`ALTER TABLE [a-z_]+ ADD COLUMN ' \
    core/platform/storage/sqlite/sqlite_migrate.go)"
  [[ "$alter_count" == "44" ]] ||
    fail "startup additive migration count changed from 44"

  for step in \
    backfillDocumentHistory \
    backfillVectorBlobs \
    backfillWindowText \
    backfillSourceMetadata \
    blankSourceText \
    repairVisibleTimestamps; do
    [[ "$(rg -c "s\\.${step}\\(\\)" core/platform/storage/sqlite/sqlite_migrate.go)" == "1" ]] ||
      fail "startup migration step is absent or duplicated: $step"
  done
  pass "44 additive columns and all six named backfill/repair steps are inventoried"
}

check_dependencies() {
  go list -m -f '{{if not .Main}}{{.Path}}{{"\t"}}{{.Version}}{{end}}' all |
    sed '/^$/d' |
    sort >"$scratch/current-modules"
  awk -F '\t' 'NR > 1 {print $1 "\t" $2}' \
    docs/completion/dependency-license-inventory.tsv |
    sort >"$scratch/classified-modules"
  compare_files "every module/version is classified" \
    "$scratch/current-modules" "$scratch/classified-modules"

  if ! awk -F '\t' '
    NR == 1 {
      if ($0 != "module\tversion\tlicense\tlinkage\tpurpose\tsecurity_update_owner\tsource") exit 1
      next
    }
    NF != 7 || $1 == "" || $2 == "" || $4 == "" || $5 == "" || $6 == "" || $7 !~ /^https:\/\// {exit 1}
    $3 !~ /^(ISC|MIT|Apache-2.0|BSD-2-Clause|BSD-3-Clause|MPL-2.0|MIT OR Apache-2.0)$/ {exit 1}
    $4 !~ /^(linked-production|module-graph-only)$/ {exit 1}
  ' docs/completion/dependency-license-inventory.tsv; then
    fail "dependency has an incomplete, unknown, or non-FOSS classification"
  fi

  go list -deps -f '{{with .Module}}{{if not .Main}}{{.Path}}{{end}}{{end}}' ./... |
    sed '/^$/d' |
    sort -u >"$scratch/linked-modules"
  while IFS= read -r module; do
    awk -F '\t' -v module="$module" '
      NR > 1 && $1 == module && $4 == "linked-production" {found=1}
      END {exit !found}
    ' docs/completion/dependency-license-inventory.tsv ||
      fail "linked module is not marked linked-production: $module"
  done <"$scratch/linked-modules"
  pass "all linked modules are identified as production linkage"
}

check_alpha_requests() {
  local map=docs/completion/alpha-request-map.tsv
  if ! awk -F '\t' '
    NR == 1 {
      if ($0 != "request_file\tcurrent_alpha_row\tcompletion_packets\tclassification") exit 1
      next
    }
    NF != 4 || $1 !~ /\.md$/ || $2 !~ /^[0-9]+$/ || $3 !~ /^omega-[0-9][0-9][0-9](,omega-[0-9][0-9][0-9])*$/ || $4 != "open" {exit 1}
    {files[$1]++; rows[$2]++}
    END {
      if (NR != 11) exit 1
      for (file in files) if (files[file] != 1) exit 1
      for (row in rows) if (rows[row] != 1) exit 1
    }
  ' "$map"; then
    fail "Alpha request map is malformed, archived, duplicated, or not the current ten-row baseline"
  fi

  while IFS=$'\t' read -r request row packets classification; do
    [[ "$request" == "request_file" ]] && continue
    IFS=',' read -r -a packet_list <<<"$packets"
    for packet in "${packet_list[@]}"; do
      compgen -G "docs/current-docs/work-packets/${packet}-*.md" >/dev/null ||
        fail "Alpha request $request maps to absent packet $packet"
    done
  done <"$map"

  local alpha_root="${TAURUS_ALPHA_ROOT:-$repo_root/../taurus-alpha}"
  if [[ -d "$alpha_root/docs/backend-requests" ]]; then
    find "$alpha_root/docs/backend-requests" -maxdepth 1 -type f -name '*.md' \
      ! -name README.md -printf '%f\n' | sort >"$scratch/current-alpha-requests"
    awk -F '\t' 'NR > 1 {print $1}' "$map" | sort >"$scratch/classified-alpha-requests"
    compare_files "all current Alpha backend requests are packet-mapped" \
      "$scratch/current-alpha-requests" "$scratch/classified-alpha-requests"
  else
    printf 'note  Alpha checkout unavailable at %s; committed ten-row map validated, external freshness not claimed\n' "$alpha_root"
  fi
}

check_yesod_resources() {
  sed -n -E 's/^      "local_path": "(.*)",$/\1/p' \
    docs/current-docs/manifest.json >"$scratch/yesod-paths"
  [[ "$(wc -l <"$scratch/yesod-paths" | tr -d ' ')" == "176" ]] ||
    fail "Yesod manifest page count changed from 176"

  local classified=0
  while IFS= read -r path; do
    case "$path" in
      docs/current-docs/notion/work-packets/omega-[0-9][0-9][0-9]-*.md)
        local filename="${path##*/}"
        [[ -f "docs/current-docs/work-packets/$filename" ]] ||
          fail "Notion work packet has no executable mirror: $path"
        ;;
      docs/current-docs/notion/supporting/[0-9][0-9][0-9]-*.md)
        # The 67 Alpha execution packets are explicitly frontend-only for this
        # backend matrix. Cross-repo backend asks are gated separately above.
        ;;
      *)
        local matches
        matches="$(awk -F '\t' -v path="$path" 'NR > 1 && $1 == path {n++} END {print n+0}' \
          docs/completion/yesod-resource-map.tsv)"
        [[ "$matches" == "1" ]] ||
          fail "Yesod resource lacks exactly one classification: $path"
        ;;
    esac
    classified=$((classified + 1))
  done <"$scratch/yesod-paths"

  while IFS=$'\t' read -r path classification owner; do
    [[ "$path" == "local_path" ]] && continue
    [[ -n "$classification" && -n "$owner" ]] ||
      fail "empty Yesod classification for $path"
    case "$classification" in
      backend-packet | backend-packets | backend-program | frontend-only | program-index)
        ;;
      *)
        fail "invalid Yesod classification $classification for $path"
        ;;
    esac
    IFS=',' read -r -a owner_list <<<"$owner"
    for target in "${owner_list[@]}"; do
      case "$target" in
        omega-[0-9][0-9][0-9])
          compgen -G "docs/current-docs/work-packets/${target}-*.md" >/dev/null ||
            fail "Yesod resource $path maps to absent packet $target"
          ;;
        omega-program | alpha-program)
          ;;
        *)
          fail "Yesod resource $path has invalid owner $target"
          ;;
      esac
    done
    [[ "$(grep -Fxc "$path" "$scratch/yesod-paths")" == "1" ]] ||
      fail "classified Yesod resource is absent or duplicated in manifest: $path"
  done <docs/completion/yesod-resource-map.tsv
  pass "all $classified active Yesod resources are backend-mapped or explicitly frontend-only"
}

printf 'Omega completion baseline\n'
printf '  starting SHA: c0d072556919048b495e729736cf78a7d28e68d3\n'
printf '  current HEAD: %s\n' "$(git rev-parse HEAD)"
printf '  branch: %s\n' "$(git branch --show-current)"
printf '  test tier: %s\n' "$([[ "$run_race" == "1" ]] && printf full || printf "$mode")"
printf '  paid provider calls: disabled (never invoked by this script)\n\n'

go test ./core/transport -run '^TestCompletionRouteInventory$' -count=1
go test ./core/platform/storage/sqlite -run '^TestCompletionPersistenceInventory$' -count=1
pass "generated route and persistence inventories match real registries"

check_packet_matrix
check_capabilities
check_architecture_imports
check_startup_migrations
check_dependencies
check_alpha_requests
check_yesod_resources

if [[ "$mode" == "standard" ]]; then
  ./scripts/check-format.sh
  go build ./...
  go test -timeout=30s ./...
  pass "format, build, and ordinary unit/integration gates"
fi

if [[ "$run_race" == "1" ]]; then
  ./scripts/check-race.sh
  pass "focused race gate over named concurrent boundaries"
fi

if [[ "$with_free_dev_tests" == "1" ]]; then
  ./dev-test/run.sh free
  pass "credential-free dev-test group (provider-backed suites excluded)"
fi

printf '\nTest tiers:\n'
printf '  standard:          ./scripts/acceptance/omega-baseline.sh\n'
printf '  full/long no-cost: ./scripts/acceptance/omega-baseline.sh --full\n'
printf '  add black-box:     ./scripts/acceptance/omega-baseline.sh --with-free-dev-tests\n'
printf '  exhaustive race:   ./scripts/check-race.sh --exhaustive\n'
printf '  paid live models:  ./dev-test/run.sh intelligence\n'
printf '  all suites/cost:   ./dev-test/run.sh all\n'
printf '\nOmega completion baseline passed.\n'
