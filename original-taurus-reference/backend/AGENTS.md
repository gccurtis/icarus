# Working agreement

This repository is built incrementally and by hand. Prefer small, working steps
over large scaffolding.

## How we work

- Build the smallest useful piece, get it working, then move on.
- Add code only when it is actually being built and can be exercised. Don't
  scaffold structure ahead of need.
- Keep changes easy to follow. When in doubt, ask before adding scope.

## Version control

- Work directly on `main`. After the required checks pass, commit the intended
  scope and push it to `origin/main`.
- Use Git directly. Do not invoke auxiliary publishing tools, create a side
  branch, or open a code review unless the user explicitly asks for one.

## Documentation practices

- **Change records.** Each increment gets one numbered `docs/records/NNNN-<slug>.md`
  capturing *what changed and why* — the reasoning behind the diff, alongside git
  history. See [`docs/records/README.md`](docs/records/README.md) for the shape.
  Small follow-ups are appended to the most recent relevant record rather than
  given a new number.

- **Companion docs are retired.** Every non-test file under `core/` used to need
  a sibling `FILE.go.md` kept current in the same commit as the code. That rule
  is dropped and the 191 documents are archived under
  [`archive/companions/`](archive/companions/README.md), mirroring their old
  paths. Don't write new ones, and don't treat the archived ones as current —
  they describe the code as of July 2026 and will drift from here.

## Checks to run before committing

- `./scripts/check-format.sh` — every Go file is `gofmt`-clean. Keeping this list
  empty is what makes `gofmt -l` a usable signal.
- `go build ./...` and `go test ./...` — the suite is expected green on every
  commit.
- An ordinary or focused-race package taking 30 seconds is a test defect until
  shown otherwise. The acceptance runners enforce that ceiling. Profile the
  individual tests; fix accidental waits or fixture repetition, or move a
  justified certification into an explicitly named diagnostic with its purpose
  and measured cost recorded.
- Do not run the repository-wide race detector as a routine commit check. The
  standard acceptance tier is `./scripts/acceptance/omega-baseline.sh`; its
  explicit `--full` tier runs the named concurrent tests in
  `./scripts/check-race.sh` plus no-provider black-box coverage. The
  `./scripts/check-race.sh --exhaustive` diagnostic instruments every ordinary
  test and is reserved for investigating broad races or the race tooling itself;
  it can take several minutes even with serial packages.

## Testing with real providers

Some behavior can only be trusted when it runs against a real model provider.
Embedding-backed features are the clearest case: unit tests with a fake embedder
prove the *plumbing* (windowing, storage, retrieval descent), but whether the
system **clusters and retrieves well** — whether a query lands on the right
source — is meaningless without real embeddings. For those features:

- Verify **quality** in a live `dev-test/` suite that makes real provider calls,
  not in unit tests. Keep unit tests for the deterministic plumbing.
- The suite reads the OpenRouter key from the gitignored
  `etc/config.local.yaml`. When no key is present it **skips** (exit 0) rather
  than assert on a path it cannot exercise — so CI stays green without secrets.
- Keep live inputs tiny (short documents, few queries, cheap models) so the cost
  of a run stays negligible.

### Surface the cost

A run that spends real money must say so. Every intelligence/knowledge response
carries a `usage` block (`promptTokens`, `totalTokens`); a live suite **sums the
tokens it spends and prints the total, plus an estimated dollar cost, at the
end** (`track_usage` / `usage_summary` in [`dev-test/lib.sh`](dev-test/lib.sh)).
The price of testing is never hidden — it is reported in full on every run.

## About the reference material

- [`docs/reference/`](docs/reference/README.md) is prior design and planning
  material. It grounds what we're building toward.
- It is a **reference**, not an authority over the working code. It may look
  more settled than reality. Where it conflicts with a deliberate decision or
  with code we've actually built, the current decision and the code win.
- Don't treat the earlier implementation plan as a required sequence. We decide
  what to build next together.
