# Taurus Omega completion baseline

This directory is the executable definition of “Taurus Omega complete.” It was
created by Ω-001 without implementing a product capability, route, or migration.
Later packets update the ledger and its generated evidence as their behavior
ships.

## Frozen execution baseline

| Item | Audited value |
|---|---|
| Planning anchor | `50efd18413cc47935033889e51d58e9c828733e2` (reference only; no reset was performed) |
| Actual approved `main` start | `c0d072556919048b495e729736cf78a7d28e68d3` |
| Working branch | `agent/omega-001-completion-baseline` |
| Starting worktree | Clean; no predecessor packet and no local changes |
| Go / host | `go1.26.4 linux/amd64`; `Linux 7.1.3 x86_64 GNU/Linux` |
| Shipped config | `etc/config.yaml` selects `mode: dev`; built-in default is fail-closed `prod`; dev-test writes isolated dev overlays |
| Schema source | `core/platform/storage/sqlite/sqlite_migrate.go`; starting SHA-256 `6e2951dd879526a8a66f5fedd4c06d902a4bc808079d0bbeb9a3643209aec8d1` |
| Module locks | `go.mod` SHA-256 `d35cc8d939334c8896667f439257da9a11e126074764d83a536a36225e6a85d8`; `go.sum` `c47c50c614962e5c6a7e70ee7eccd2aa68784b453bb884f71d12e8131345c106` |
| Yesod manifest | 176 active pages; SHA-256 `b0616c6469216f6a89f5b4dc7b0c9a67bf7da421ffa528c74f7bc6efc6c1769b` |
| Alpha source reviewed | Sibling Alpha `main` at `d2b1bdcd02307f29ab4a895232cbf857d8157a56`; 10 current backend asks |

The current corpus differs materially from planning-time counts: Yesod now has
47 Primary and 129 Supporting pages (including 44 Omega and 67 Alpha execution
packets), and Alpha has ten open asks rather than nine. The executable gates use
current checked-out source, preserve those differences, and fail if the maps
drift.

Relevant separate work was inventoried but not merged or rewritten:

- `workspace-capability` / `origin/workspace-capability` at
  `6db1f71938142086a85a1225296740b57d2c2954` — active divergent Workspace
  aggregate work, owned by Ω-012.
- `origin/feature/slides` at
  `44babb1f7c5b87d78610941a52f183a28ed73bbb` — an old unmerged prototype that
  cannot be treated as main evidence for Ω-023/Ω-024/Ω-037.
- Older backend-audit, intelligence-tool-use, and Quarterback branches remain
  remote history, not completion evidence.

## Ledgers and executable evidence

- [Omega completion matrix](omega-completion-matrix.md) — exactly one row for
  each of the 44 packets, covering all 21 capability packages and all six open
  ingest findings.
- [Route and authority inventory](route-scope-inventory.md) — generated from
  `routes.go`, `operationMode`, and `operationSerialKey`: 150 routes, 145
  dispatch operations, canonical SHA-256
  `b8d6ff90bc6948bae6883fbdc9989e5d93ba54fa3de5ab7c7988a0b0b0c2d583`.
- [Persistence inventory](persistence-inventory.md) — generated from a real
  fresh and upgraded Store: 46 tables, 81 indexes (30 explicit and 51 automatic
  constraint indexes), normalized schema
  SHA-256
  `b8ea2b7da33bd7deb94403828f33554495ab78b30f6d85915e502182a8141ef3`.
- [Dependency/license inventory](dependency-license-inventory.md) — all 40
  pinned external Go modules plus invoked tools and optional services.
- [Architecture/startup inventory](architecture-startup-inventory.md) — all
  capability import edges, resource families, and durable job registrations.
- [`alpha-request-map.tsv`](alpha-request-map.tsv) — all ten current Alpha asks
  mapped to live completion packets.
- [`yesod-resource-map.tsv`](yesod-resource-map.tsv) — exact classifications for
  the 65 non-packet Yesod resources; the gate additionally classifies all 44
  Omega packets and all 67 frontend Alpha packets.
- [Accepted V1 deferrals](accepted-deferrals.md) — explicit exclusions that do
  not masquerade as missing work.

## Running the contract

```bash
./scripts/acceptance/omega-baseline.sh
./scripts/acceptance/omega-route-inventory.sh
./dev-test/completion-baseline/run.sh
```

`omega-baseline.sh` runs the focused generated-inventory tests, packet,
capability, import, startup, dependency, Alpha, and Yesod gates, followed by
format, build, and all ordinary tests. This standard tier is the routine
correctness gate and makes no paid provider calls.

The deliberately broader coverage is explicit:

```bash
./scripts/acceptance/omega-baseline.sh --full
```

`--full` adds the focused race manifest in `scripts/check-race.sh` and the
no-provider black-box group. The manifest names only tests that actually start
concurrent Taurus Omega work; every invocation uses `-count=1`, so cached results
cannot masquerade as race evidence. Before starting an instrumented binary, the
runner also proves that each exact manifest entry still resolves to exactly the
named tests; Go's otherwise-successful “matched no tests” behavior cannot hide a
stale entry. Standard and focused-race package binaries have a 30-second
timeout, so a pathological test fails rather than quietly consuming minutes.
Use `--inventory-only` for only the structural contract or
`--with-free-dev-tests` to add the black-box group without the race pass. Paid
provider suites remain separate.

An exhaustive race-instrumented copy of every ordinary test is a diagnostic,
not a routine gate:

```bash
./scripts/check-race.sh --exhaustive
```

That command serializes packages to bound peak memory, but it can still take
several minutes because race instrumentation magnifies bcrypt, clustering,
database migration, and HTTP fixture costs that are unrelated to concurrent
access. Use it only when investigating a broad race or validating a race-tooling
change.

Generated route output is refreshed only by an intentional:

```bash
./scripts/acceptance/omega-route-inventory.sh --update
```

Persistence output is refreshed only by:

```bash
OMEGA_UPDATE_COMPLETION_INVENTORIES=1 \
  go test ./core/platform/storage/sqlite -run '^TestCompletionPersistenceInventory$' -count=1
```

Review the resulting diff. An update is not an automatic acceptance of a new
route, table, owner, scope, dependency, or risk.

## Baseline validation history

Before Ω-001 edits, the following all passed on the actual starting SHA:

```text
./scripts/check-format.sh
go build ./...
go test ./...
go test -race ./...
./dev-test/run.sh free
```

That `free` run exposed a runner defect: `knowledge-scale` was omitted from the
paid-suite classification and made real embedding calls when a local credential
was present (the first sync alone reported 1,207,594 prompt tokens). The full
run passed, but its label was false and it incurred provider cost. Ω-001 now
classifies both `knowledge-scale` and live `web` as provider-backed, so a future
`free` run cannot select either. A corrected `./dev-test/run.sh free` rerun
passed every selected suite with no provider/cost summary. The credential and
response bodies were not captured in the ledger.

Optional live certification is intentionally separate:

```bash
./dev-test/run.sh intelligence
```

It skips without its credential; when it runs, each suite and the runner report
tokens and estimated cost. At baseline, live web also required a configured
`agents.web.endpoint` and skipped because it was absent. A skip is reported as a
skip, not a pass.

## Interpretation

A green Ω-001 gate means the baseline is exhaustive and internally consistent.
It does not declare known risks safe. Caller-blind reads, fail-open middleware,
response-body resource references, retrieval evidence, connector filesystem/URL
admission, inline object data, and operator-route gaps are visibly assigned to
blocking completion packets in the inventories.
