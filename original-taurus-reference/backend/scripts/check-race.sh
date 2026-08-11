#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

mode="${1:-focused}"
case "$mode" in
  focused)
    ;;
  --exhaustive)
    printf 'Running the exhaustive repository race diagnostic.\n'
    printf 'This intentionally instruments every test and can take several minutes.\n'
    exec go test -race -count=1 -p 1 ./...
    ;;
  *)
    echo "usage: $0 [--exhaustive]" >&2
    exit 2
    ;;
esac

scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
race_group=0

run_race_tests() {
  local package="$1"
  local tests="$2"
  local boundary="$3"
  local expected="$scratch/expected-$race_group"
  local actual="$scratch/actual-$race_group"
  race_group=$((race_group + 1))

  printf '%s\n' "$tests" | tr '|' '\n' | sort >"$expected"
  go test "$package" -list "^(${tests})$" |
    sed -n '/^Test/p' |
    sort >"$actual"
  if ! diff -u "$expected" "$actual"; then
    printf 'FAIL  stale or broadened race manifest: %s\n' "$boundary" >&2
    exit 1
  fi

  printf 'race  %s (%s tests)\n' "$boundary" "$(wc -l <"$actual" | tr -d ' ')"
  go test -race -count=1 -timeout=30s "$package" -run "^(${tests})$"
}

# This is an intentional manifest, not a broad package list. Every selected test
# starts concurrent work against state owned by Taurus Omega. Pure computation,
# bcrypt cost, migration certification, and ordinary HTTP behavior remain in the
# normal suite, where race instrumentation provides no additional evidence.
run_race_tests ./core/capability/agent \
  'TestStartReaperStopsWhenContextCancelled' \
  'agent reaper lifecycle'

run_race_tests ./core/capability/connector \
  'TestConcurrentSyncsDoNotRace' \
  'connector sync serialization'

run_race_tests ./core/capability/document \
  'TestConcurrentExactRevisionAdmission|TestConcurrentSemanticRebaseProofBoundaries|TestConcurrentRedoAcceptsOneCompensation|TestResolveBlockDoesNotOverwriteAChangedRevision' \
  'document concurrent admission and resolution'

run_race_tests ./core/capability/formula/names \
  'TestAppendRowsConcurrentNoLostUpdate' \
  'formula table concurrent append'

run_race_tests ./core/capability/knowledge \
  'TestConcurrentExactAdmissionsCannotOverspendProjectCapacity' \
  'knowledge concurrent capacity admission'

run_race_tests ./core/capability/session \
  'TestStartListClose|TestPushEventProcessed|TestQueueOverflowDoesNotBlock|TestPushEventAfterStop|TestSweeperDeletesStale' \
  'session event consumer and sweeper lifecycle'

run_race_tests ./core/platform/dispatch \
  'TestKeyedMutexSerializesSameKey|TestKeyedMutexDifferentKeysRunConcurrently' \
  'keyed dispatch mutex'

run_race_tests ./core/platform/job \
  'TestQueueEnqueueAndPoolRun|TestPoolRetriesThenFails|TestPoolDoesNotRetryANonRetryableTypedLimit|TestPoolUnknownTypeFails|TestPoolRequeuesOrphanedJobOnStart' \
  'durable job workers and recovery'

run_race_tests ./core/platform/storage/sqlite \
  'TestConcurrentAppendAssignsUniqueSeqs|TestKnowledgeAdmissionTransactionPreventsConcurrentOverspend' \
  'SQLite concurrent writers'

run_race_tests ./core/transport \
  'TestAdaptSerialScopedSerializesSameKey|TestAdaptSerialScopedDifferentKeysConcurrent' \
  'transport serial dispatch'

run_race_tests ./core/wiring \
  'TestTrashPurgeSweepsPeriodicallyAndStops' \
  'wiring background purge lifecycle'

printf 'Focused race suite passed.\n'
