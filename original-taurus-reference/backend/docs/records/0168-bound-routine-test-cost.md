# 0168 — Bound routine test cost

The completion baseline repeated every package under the race detector on every
routine run. That made the default gate pay the repository's largest time and
memory cost even when ordinary correctness was all the change needed. This
increment separates routine verification from deliberate long certification
without removing tests from either tier.

## `scripts/acceptance/omega-baseline.sh`

### Make the standard tier the default

The no-argument command still validates generated inventories, completion
ledgers, architecture, migrations, dependencies, format, build, and every
ordinary Go test. It no longer starts a second repository-wide race-instrumented
pass.

This keeps the default gate meaningful: it exercises all deterministic unit and
integration behavior and remains the normal pre-commit contract.

### Add an explicit full/long tier

`--full` adds both expensive no-cost layers:

- `go test -race -p 1 ./...`
- `./dev-test/run.sh free`

Race-instrumented binaries are constrained to one package at a time. The full
tier may take longer, but it cannot launch the largest package binaries in
parallel and create an avoidable peak-memory spike. Paid provider suites are
still never selected by the completion baseline.

`--with-free-dev-tests` remains available when black-box behavior is wanted
without the full race pass. `--inventory-only` and `--full` are rejected
together because their meanings conflict.

## `core/platform/job/job_test.go`

### Stop testing retry semantics through a one-second idle wait

`TestPoolRetriesThenFails` was the slowest ordinary test at one second because it
waited for the production retry backoff, despite never asserting the duration.
Its test-only Store wrapper now preserves the same retry transition and attempt
count while making the retry immediately due.

The test still proves the important behavior—one initial attempt, one retry,
then terminal failure—without spending wall time on timing it does not inspect.
Production backoff behavior and production code are unchanged.

## `docs/completion/README.md`

### Document the three useful scopes

The executable completion contract now names the structural, standard, and
full/long scopes, including exactly which no-cost checks the long tier adds and
why race package parallelism is bounded.

## `AGENTS.md`

### Keep routine verification routine

The working agreement retains format, build, and all ordinary tests on every
commit. It now says that repository-wide race detection belongs to explicit
full certification, while focused race runs remain appropriate for
concurrency-sensitive changes.

## Measured basis

Before this change, a cold-count ordinary run (`go test -json -count=1 ./...`)
completed in 5.98 seconds with a 264,448 KiB measured peak resident set, and its
slowest individual test was the one-second retry test. The immediately following
repository-wide race pass exceeded one minute while the access, SQLite, and
transport test binaries were all active concurrently.

That profile did not justify excluding ordinary tests: the complete ordinary
suite was already small and fast. It justified moving the second,
race-instrumented copy to an explicit tier and bounding its package concurrency.

## Verification

- `bash -n scripts/acceptance/omega-baseline.sh`
- `./scripts/check-format.sh`
- `git diff --check`
- `go test -count=1 ./core/platform/job`
- `go test -json -count=1 ./...`
- `./scripts/acceptance/omega-baseline.sh`
- `./scripts/acceptance/omega-baseline.sh --full`

Both acceptance tiers passed. The full run completed the serial
repository-wide race pass and every credential-free dev-test suite; it made no
provider calls.
