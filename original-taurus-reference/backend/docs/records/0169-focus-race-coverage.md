# 0169 — Focus race coverage on concurrent boundaries

The first test-tier split made the race detector explicit, but its `--full`
implementation still instrumented every ordinary test. Profiling showed that
most of its cost came from work with no shared concurrent access. This increment
makes the regular race gate a manifest of actual concurrency tests and isolates
the exhaustive sweep as a specifically named diagnostic.

## `scripts/check-race.sh`

### Run a named concurrency manifest by default

The new runner selects tests that start concurrent Taurus Omega work across
eleven boundaries:

- background agent, session, job, and purge lifecycles;
- connector sync serialization;
- document admission, semantic rebase, redo, and asynchronous resolution;
- concurrent formula-table and knowledge-capacity writes;
- keyed dispatch and transport serialization;
- SQLite sequence and capacity transactions.

Each command uses `-race -count=1` with an exact anchored test expression.
Caching therefore cannot turn a requested race run into old evidence, and a new
slow test cannot silently join the focused gate merely because it shares a
package with one concurrent test.

The runner first lists the tests matching each expression and compares that list
to the literal manifest entries. A rename, removal, duplicate, or broadened
expression fails before race execution. This closes Go's normal behavior of
returning success when `-run` matches no tests.

Each focused package also has a 30-second test-binary timeout. Crossing that
ceiling is a failure to investigate, not a reason for a routine gate to consume
minutes.

### Isolate the exhaustive diagnostic

`./scripts/check-race.sh --exhaustive` retains the ability to instrument every
ordinary test. It uses one package at a time to bound peak memory, prints a
warning that it can take several minutes, and is not selected by either the
standard or full acceptance tier.

This path is for a suspected broad race or a change to race tooling itself. It
is not general verification.

## `scripts/acceptance/omega-baseline.sh`

### Make full certification use the focused race manifest

`--full` now combines all ordinary tests, the named focused race suite, and the
credential-free black-box suites. It no longer repeats unrelated bcrypt,
clustering, migration, and HTTP tests under race instrumentation.

The printed tier summary exposes the exhaustive diagnostic separately so its
scope and cost are not confused with full routine certification.

The standard ordinary-test pass also carries the 30-second package ceiling.

## `docs/completion/README.md`

### Explain what race evidence means

The completion contract now states that focused race tests must create
concurrent Taurus Omega work, always execute uncached, and remain explicitly
listed. It also documents why the exhaustive sweep is expensive and the narrow
circumstances in which it is appropriate.

## `AGENTS.md`

### Prevent exhaustive race runs from becoming routine again

The working agreement directs normal work to the standard tier, full
credential-free certification to the focused manifest, and the repository-wide
diagnostic only to broad-race or race-tooling investigations. It makes the
30-second ceiling an explicit review trigger: profile first, then fix accidental
cost or document and isolate justified certification.

## Measured basis

All measurements used `-race -count=1`:

| Package | Elapsed | What dominated |
|---|---:|---|
| `core/capability/access` | 34.323s | repeated production-cost bcrypt; slowest test 4.22s |
| `core/capability/knowledge` | 16.45s | deterministic clustering; slowest test 6.41s |
| `core/platform/storage/sqlite` | 43.260s | 62 separately opened and migrated database fixtures |
| `core/transport` | 50.518s | repeated authentication and SQLite-backed HTTP fixtures |

Those four packages alone contribute about 145 seconds when serialized, while
their actual concurrency tests are a small named subset. No individual test was
stuck or took minutes; the minutes came from applying race instrumentation to
many unrelated fixtures.

## Verification

- `bash -n scripts/check-race.sh scripts/acceptance/omega-baseline.sh`
- `./scripts/check-format.sh`
- `git diff --check`
- `./scripts/check-race.sh`
- `./scripts/acceptance/omega-baseline.sh`
- `./scripts/acceptance/omega-baseline.sh --full`

The fail-closed focused manifest passed all 25 named concurrency tests in 21.24
seconds with a measured 304,512 KiB peak resident set. The full no-cost
acceptance tier, including every ordinary test and every credential-free
black-box suite, passed in 64.18 seconds with a measured 314,216 KiB peak.
