# Bound Knowledge ingest and admit exact artifacts

Ω-003 starts from `c55a14c2b58d4e928f8ec38cbfdb7706242782ba`. It closes the
frozen ingestion findings ING-1, ING-2, and ING-4 without trusting provider
metadata or an in-process lock for production correctness.

## `core/capability/knowledge/`

### Count decoded bytes at the reader

`build.go`, `ingest_limits.go`, and `knowledge.go` add resolved source and run
byte caps (64 MiB and 512 MiB by default). The reader receives only its remaining
allowance and one proving byte, so absent, too-small, negative, changing, and
endless `Size` claims cannot cause an unbounded read. A cancelled context remains
cancellation, rather than being converted to a skipped unreadable source.

The typed non-retryable errors are `knowledge.source_bytes_limit` and
`knowledge.run_bytes_limit`; they carry limit, observed actual count, subject,
and remediation.

### Make artifact admission exact and transactional

`artifact_limit.go`, `memory.go`, `corpus.go`, and the Store port replace the
windows-only preflight authority with two exact boundaries. A source publication
counts its candidate windows plus source-local nodes and subtracts only the
generation it replaces. A corpus rebuild separately counts its candidate corpus
nodes. The pure window projection remains advisory only.

`AddBatch` retains complete earlier slices and wraps a later refusal as explicit
partial progress; it never publishes an incomplete source. It also retains paid
usage from an uncommitted embedding prefix.

### Preserve partial provider accounting

`intelligence.go`, `wiring/intelligence.go`, and their tests introduce
`PartialEmbeddingError`. A multi-chunk provider failure returns completed-input
count and usage; the Knowledge adapter preserves that accounting even though the
incomplete source is not published. Synchronous micro-batching remains the
implemented provider path; no paid provider call was needed for verification.

## `core/platform/storage/sqlite/sqlite_knowledge.go`

### Serialize the count with publication

`AdmitAndReplaceSources` and `AdmitCorpus` count and write under the same SQLite
immediate transaction. This is the correctness authority for concurrent writers:
a loser observes the committed winner and gets the typed refusal. The existing
memory mutex mirrors this behavior only for test parity.

## `core/platform/job`

### Fail deterministic limits once

The worker recognizes `limit.Exceeded{Retryable:false}` and marks that job failed
on its first attempt. A corpus rebuild refused by the artifact policy therefore
does not consume retries or repeatedly recompute the same over-limit candidate.

## Entry-point adapters and limit transport

### `core/handlers/{knowledge,connector,chat}` and `core/platform/limit`

All three ingestion-facing HTTP paths now map `limit.From(err)` before generic
provider errors. Byte limits are HTTP 413 and the project artifact policy is HTTP
422. `limit.Exceeded` now serializes `retryable` and structured remediation.

### `core/wiring/{connector_lattice,attachment_lattice}` and connector/chat

Connector sync retains token usage and marks a failed run `partial:true` when
complete earlier slices landed; it does not advance its fingerprint. Attachments
check trusted local File metadata before materializing obviously over-limit files,
then still pass the actual bytes through Knowledge's counting reader. Binary
attachments remain legitimately unindexed.

## Configuration and documentation

`config.go`, `etc/config.yaml`, the Knowledge architecture guide, lifecycle
reference, backend guide, completion matrix, and issues register describe the
new caps, exact admission, statuses, partial semantics, and closure evidence.

## Verification

- Focused Knowledge, Intelligence, Connector, handler, wiring, and SQLite tests.
- Adversarial zero/negative/too-small provider claims, endless reads, mid-source
  run refusal, cancellation, exact source and corpus counts, replacement
  arithmetic, memory and SQLite concurrent admission, handler wire contracts,
  and partial embedding accounting.
- `go test -race ./core/capability/knowledge ./core/platform/storage/sqlite`
- `./scripts/check-format.sh`, `go build ./...`, and `go test ./...`
- `./scripts/acceptance/omega-baseline.sh` and `./dev-test/run.sh free`

The final two commands make no paid provider calls; the free development suite
uses its configured no-cost path.
