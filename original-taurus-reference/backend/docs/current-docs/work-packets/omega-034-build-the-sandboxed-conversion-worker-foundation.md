---
title: "Execute Ω-034 — Build the sandboxed conversion-worker foundation"
packet_id: "Ω-034"
status: "ready-for-execution"
wave: "Wave 4 — Complete conversion"
depends_on: "Ω-009, Ω-011, Ω-014, Ω-015"
source_mirror: "docs/current-docs/notion/work-packets/omega-034-build-the-sandboxed-conversion-worker-foundation.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-034 — Build the sandboxed conversion-worker foundation

## Mission

Omega has one production-grade substrate for Office imports, Office exports, and PDF exports. Capability packages remain the authority for resource semantics and immutable snapshots. A shared conversion integration owns durable orchestration, attempt directories, subprocess isolation, bounded file-based protocols, diagnostics, artifact validation, object persistence, and delivery receipts. Format adapters can be implemented without gaining database, Project, authorization, or object-store authority. This packet does not ship a customer format by itself. It makes Ω-035 through Ω-037 small enough to be format-mapping work rather than three reinventions of security and job infrastructure.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-009, Ω-011, Ω-014, Ω-015**.

Source dependency statement: Ω-009, Ω-011, Ω-014, Ω-015, and the File/Object port

No later-packet integration gate was detected in the source dependency statement.

Start only after every hard predecessor is present on `main`. If a predecessor is intentionally being developed in parallel, do not guess across its contract: stop until it lands on `main` or request an agreed interface.

## Authority order

When sources disagree, use this order:

1. The latest explicit product decision from the user.
2. The current Primary documents under `docs/current-docs/notion/primary/`.
3. This execution directive and the packet-specific implementation specification below.
4. Current code, tests, migrations, and as-built architecture records on the actual starting `main`.
5. Supporting documents and frozen historical links.

`AGENTS.md` remains authoritative for repository workflow. The SHA in this file is the planning baseline, not an instruction to reset: always begin from the latest approved `main` that contains the required predecessors, and record the actual starting SHA.

## Required reading before editing

- `AGENTS.md` — repository rules; this is authoritative for workflow, validation, and documentation records.
- `docs/current-docs/README.md` — authority model and corpus layout.
- `docs/current-docs/notion/work-packets/omega-034-build-the-sandboxed-conversion-worker-foundation.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `docs/current-docs/notion/primary/architecture-taurus-layered-application-model--3acb6410e502.md`
- `docs/current-docs/notion/primary/architecture-user-cell-and-project-subcell-runtime--3acb6410e502.md`
- `docs/current-docs/notion/primary/deployment-taurus-topology-and-scaling-model--3acb6410e502.md`
- `docs/current-docs/notion/primary/export-document-to-docx--3acb6410e502.md`
- `docs/current-docs/notion/primary/export-document-to-pdf--3acb6410e502.md`
- `docs/current-docs/notion/primary/export-slides-to-pdf--3acb6410e502.md`
- `docs/current-docs/notion/primary/export-slides-to-pptx--3acb6410e502.md`
- `docs/current-docs/notion/primary/export-spreadsheet-to-pdf--3acb6410e502.md`
- `docs/current-docs/notion/primary/export-spreadsheet-to-xlsx--3acb6410e502.md`
- `docs/current-docs/notion/primary/import-docx-to-document--3acb6410e502.md`
- `docs/current-docs/notion/primary/import-pptx-to-slides--3acb6410e502.md`
- `docs/current-docs/notion/primary/import-xlsx-to-spreadsheet--3acb6410e502.md`

Follow links inside the embedded specification when they resolve to additional local mirrors. Search the current repository for every type, route, table, tool, and invariant named below; do not rely on an old path or assume absence without checking.

## Preflight

Before changing code:

1. Record the starting `main` HEAD SHA, merged predecessor packets, and relevant existing records.
2. Reproduce or characterize the current gap with a focused test, probe, route inventory, or schema inspection.
3. Compare the packet against current code. Preserve correct partial implementations and delete or migrate only what the specification makes obsolete.
4. Identify the capability owner, its inbound ports, outbound ports, adapters, durable state, authorization point, transaction boundary, and observability boundary.
5. Confirm every proposed third-party dependency is free/open-source, pinned, and compatible with product distribution. Prefer the standard library or existing dependencies.
6. Write the smallest ordered implementation plan that can land without leaving accepted-but-unusable intermediate states.

If the gap is already fully closed, do not manufacture changes. Prove it with the required tests/evidence, reconcile stale documentation, and produce the normal change record and a verified commit on `main`.

## Execution contract

- Stay inside this packet's scope and explicit prerequisites. Do not opportunistically implement later packets.
- Preserve the modular-monolith, ports-and-adapters boundary. User Cells and per-user Project Subcells are logical runtime scopes; durable database state, revisions, CAS/idempotency, jobs, and outbox/change streams are correctness authorities.
- Enforce authorization at the owning application service/store boundary, not only in HTTP handlers. Reads, listings, search, events, history, jobs, and model/tool hydration must be caller-aware.
- Make durable mutations atomic at the stated aggregate boundary. Couple canonical state and required outbox/audit/idempotency writes in one transaction where the specification requires it.
- Keep retries, pagination, resource limits, concurrency, shutdown, and failure behavior explicit and bounded. No correctness may depend on sticky routing or one in-memory cell.
- Add or update typed errors and stable wire mappings without leaking hidden resource existence or secrets.
- Prefer focused tests first, then implementation, then broader integration, race, recovery, and load evidence required by the specification.
- Do not add placeholder handlers, no-op adapters, unbounded defaults, silent fallbacks, or TODO-only completion.
- Do not create companion `.go.md` files; that convention is retired. Add the numbered change record required by `AGENTS.md`.

## Decision authority

You may decide internal naming, package decomposition, private helper design, migration mechanics, indexes, test fixtures, and the exact FOSS library when the packet leaves those open. Choose the smallest production-grade option consistent with existing conventions. Record every material choice and rejected alternative in the change record.

Stop and ask for direction before proceeding if any choice would:

- contradict a settled Product/Primary architecture decision or another merged packet;
- weaken tenant, user, organization, project, or resource privacy boundaries;
- introduce destructive or irreversible migration without a tested rollback/restore path;
- add a non-FOSS, source-available-only, or materially costly external dependency/service;
- change a public contract outside this packet or make a later packet impossible;
- require guessing an unmerged predecessor's interface; or
- make an acceptance criterion impossible or only cosmetically satisfied.

## Validation and evidence

Run the narrowest relevant tests while iterating. Before commit, run the repository gates from `AGENTS.md`:

```bash
./scripts/check-format.sh
go build ./...
go test ./...
```

Also run every packet-specific test, race test, integration test, migration test, recovery test, load test, or live-provider certification required below. Live-provider tests may be skipped only when the required credential is unavailable; report the skip, fixture coverage, token/cost estimate where applicable, and the exact command for a credentialed rerun. Never claim a skipped gate passed.

Review the final diff for secret leakage, hidden-resource inference, unsafe logs, accidental broad scope, stale generated files, and unclassified dependencies.

## Required deliverables

1. Production implementation and migrations/adapters required by the specification.
2. Focused and broad automated tests proving the acceptance criteria.
3. API/schema/error/operations documentation actually changed by the implementation.
4. One new numbered `docs/records/NNNN-<slug>.md` record describing baseline, decisions, files, tests, operational effects, and remaining risks.
5. A commit scoped to this packet, pushed directly to `origin/main`.

The change record and completion handoff must state:

- actual baseline SHA and prerequisite packet status;
- outcome and user-visible/operational behavior;
- architecture and data-model decisions;
- migrations, compatibility, rollback, and rollout notes;
- security/privacy analysis;
- tests and exact commands/results, including skips;
- observability and operator impact;
- unresolved risks or follow-up packets; and
- a checklist mapping every acceptance criterion below to code/tests/evidence.

## Completion response

Return a concise handoff containing: commit SHA, changed areas, test results, migration/rollout notes, record path, and any explicit residual risk. Do not report this packet complete while an acceptance criterion is unproven or a required gate is failing.

---

## Embedded implementation specification

Source mirror: `docs/current-docs/notion/work-packets/omega-034-build-the-sandboxed-conversion-worker-foundation.md`

### Outcome
Omega has one production-grade substrate for Office imports, Office exports,
and PDF exports. Capability packages remain the authority for resource
semantics and immutable snapshots. A shared conversion integration owns
durable orchestration, attempt directories, subprocess isolation, bounded
file-based protocols, diagnostics, artifact validation, object persistence,
and delivery receipts. Format adapters can be implemented without gaining
database, Project, authorization, or object-store authority.
This packet does not ship a customer format by itself. It makes Ω-035 through
Ω-037 small enough to be format-mapping work rather than three reinventions of
security and job infrastructure.
### Reviewed evidence
The nine active conversion authorities agree on the same runtime boundary:
- [Export - Document to DOCX](https://app.notion.com/p/3acb6410e5028134aedfe63676d5418c)
- [Export - Document to PDF](https://app.notion.com/p/3acb6410e502817fbde1f33e76f61b82)
- [Export - Slides to PPTX](https://app.notion.com/p/3acb6410e5028156bee8c6cca9f2ab87)
- [Export - Slides to PDF](https://app.notion.com/p/3acb6410e50281419ce6ed5fd51edf09)
- [Export - Spreadsheet to XLSX](https://app.notion.com/p/3acb6410e50281bf9ebed3037d6cb114)
- [Export - Spreadsheet to PDF](https://app.notion.com/p/3acb6410e50281ffb153c8565943f650)
- [Import - DOCX to Document](https://app.notion.com/p/3acb6410e50281038192e08fc89b605a)
- [Import - PPTX to Slides](https://app.notion.com/p/3acb6410e5028108b8bdc90ce4eeec9c)
- [Import - XLSX to Spreadsheet](https://app.notion.com/p/3acb6410e5028182b958fcd202736a6c)
Current Omega already has durable jobs and Project capability boundaries.
Those remain authoritative. Conversion must extend the existing queue rather
than add one queue per worker language. Production object storage is delivered
by Ω-042, but this packet requires and tests the port now; no adapter may pass a
local canonical path to a worker.
### Scope
- A common Project-scoped conversion job and receipt model.
- Exact source-file hash or exact resource revision pinning before enqueue.
- A versioned request/result/diagnostic manifest and attempt-local URI scheme.
- Direct process launch, cancellation, limits, cleanup, and crash recovery.
- Shared Office ZIP preflight and shared PDF/package validation hooks.
- Immutable artifact persistence through the File/Object port.
- Authorization at submission and delivery, and reauthorization at protected
	execution.
- Contract fixtures and a reusable hostile-input test harness.
### Non-goals
- Format-specific semantic mapping.
- Editable PDF import. PDF is ingested elsewhere as reference/text and exported
	here only.
- Calling Microsoft Office, LibreOffice, a hosted converter, or an external URL.
- Commercial SDKs or services.
- Letting workers mutate an existing resource or choose canonical IDs.
- Distributed worker placement. A bounded local worker pool is sufficient for
	V1; the job contract must remain transportable.
### Invariants
1. Go/Omega owns caller identity, Project admission, authorization,
	idempotency, source/revision selection, canonical IDs, commits, and delivery.
2. A worker receives only a bounded attempt directory, a versioned manifest,
	declared inputs, limits, and a declared output path.
3. A worker has no network, database, queue, Project store, provider key,
	object-store credential, shell, or ambient filesystem authority.
4. Imports publish one complete canonical base or nothing. They never expose a
	partially imported resource and never emit one ChangeSet per source element.
5. Exports are derived artifacts. They never mutate the source aggregate,
	advance its revision, or execute prompts.
6. “Latest” is resolved to a concrete revision before enqueue. Retries use that
	revision even if the head advances.
7. Every declared file is size- and digest-checked. Undeclared output,
	traversal, symlink escape, absolute path, remote URL, duplicate normalized
	path, trailing JSON, and unknown schema version fail closed.
8. Worker diagnostics are untrusted bounded strings. They cannot smuggle
	content into logs or authorize a lossy import.
9. A retry with the same semantic fingerprint returns the same receipt or
	resumes the same operation; it does not create duplicate resources or files.
10. Format libraries and their transitive dependencies are pinned, scanned,
	licensed, and replaceable behind Taurus-owned ports.
### Target packages and contracts
```plain text
core/platform/conversion/
  model.go              job, attempt, receipt, diagnostic, limits
  service.go            submission, cancellation, delivery
  worker.go             process runner and file protocol
  sandbox.go            platform isolation profile
  artifacts.go          File/Object-store adapter
  validation.go         manifest and output validation
core/integration/office/
  packageinspect/       ZIP/OOXML preflight and relationship policy
  contracts/            generated JSON schemas
core/integration/pdf/
  validate/             qpdf adapter and Taurus PDF policy
workers/
  office-ts/            pinned TypeScript DOCX/PPTX emitters and DOCX parser
  office-py/            pinned Python PPTX/PDF workers
  office-xlsx-go/       pinned Excelize import worker
  office-xlsx-py/       pinned XlsxWriter export worker
  contracts/            checked-in protocol schemas and examples
tests/fixtures/conversion/
  canonical/ lossy/ producer/ adversarial/ scale/
```
```go
type Direction string
const (
    Import Direction = "import"
    Export Direction = "export"
)

type Request struct {
    ProjectID       string
    ActorUserID     string
    ActingPrincipal PrincipalRef
    Action          Action
    Direction       Direction
    ResourceKind    string
    Format          string
    Source          SourceRef       // immutable File hash or resource revision
    Options         json.RawMessage // capability-validated, versioned schema
    ClientRequestID string
    ContractVersion string
    MappingVersion  string
}

type WorkerPlan struct {
    Executable       string
    Argv             []string
    AttemptRoot      string
    RequestManifest  string
    ResultManifest   string
    Limits           Limits
    SandboxProfile   string
}

type Runner interface {
    Run(ctx context.Context, plan WorkerPlan) (WorkerResult, error)
}

type ArtifactStore interface {
    PutImmutable(ctx context.Context, r io.Reader, meta ArtifactMetadata) (FileRef, error)
    OpenAuthorized(ctx context.Context, actor Actor, ref FileRef) (io.ReadCloser, error)
}
```
Launch only with `exec.CommandContext(ctx, executable, argv...)`. No handler,
manifest field, filename, or source content may influence `Executable`; each
argument is a distinct argv element and no shell is involved.
The attempt contract uses `request.json`, declared inputs under `input/`,
declared staged assets under `assets/`, outputs under `output/`, and
`result.json` written last as the completion sentinel. Large tabular streams
use NDJSON with declared row/count/byte limits. Valid locators are only
`input://`, `asset://`, `draft://`, and `output://` opaque IDs resolved by the
parent beneath the attempt root.
```json
{
  "schema": "taurus.conversion.result/v1",
  "status": "succeeded",
  "sourceSha256": "…",
  "worker": {"name": "taurus-office-py", "version": "…"},
  "contractVersion": "v1",
  "mappingVersion": "2026-07-29",
  "outputs": [
    {"uri": "output://artifact", "mediaType": "application/pdf",
     "bytes": 48122, "sha256": "…"}
  ],
  "diagnostics": [],
  "counts": {"resources": 1, "pages": 4}
}
```
Use the existing Project job queue as the execution authority. Add
conversion-owned records only for attempts, derived artifacts, and semantic
idempotency:
```sql
CREATE TABLE conversion_attempts (
    id                 TEXT PRIMARY KEY,
    job_id             TEXT NOT NULL,
    project_id         TEXT NOT NULL,
    attempt_number     INTEGER NOT NULL,
    worker_name        TEXT NOT NULL,
    contract_version   TEXT NOT NULL,
    mapping_version    TEXT NOT NULL,
    sandbox_profile    TEXT NOT NULL,
    status             TEXT NOT NULL,
    started_at         TIMESTAMP,
    finished_at        TIMESTAMP,
    safe_error_code    TEXT,
    metrics_json       TEXT NOT NULL,
    UNIQUE (job_id, attempt_number)
);

CREATE TABLE conversion_receipts (
    id                   TEXT PRIMARY KEY,
    project_id           TEXT NOT NULL,
    actor_user_id        TEXT NOT NULL,
    semantic_fingerprint TEXT NOT NULL,
    direction            TEXT NOT NULL,
    resource_kind        TEXT NOT NULL,
    format               TEXT NOT NULL,
    source_identity      TEXT NOT NULL,
    result_identity      TEXT,
    status               TEXT NOT NULL,
    created_at           TIMESTAMP NOT NULL,
    updated_at           TIMESTAMP NOT NULL,
    UNIQUE (project_id, semantic_fingerprint)
);

CREATE TABLE conversion_artifacts (
    receipt_id        TEXT NOT NULL,
    ordinal           INTEGER NOT NULL,
    file_id           TEXT NOT NULL,
    media_type        TEXT NOT NULL,
    sha256            TEXT NOT NULL,
    bytes             BIGINT NOT NULL,
    expires_at        TIMESTAMP,
    PRIMARY KEY (receipt_id, ordinal)
);
```
The SQL is a logical schema. Ω-042 supplies PostgreSQL migrations and the D0
SQLite adapter. Capability code uses ports and cannot depend on SQLite paths or
connection identity.
### Sequential implementation tasks
1. Freeze the request, result, diagnostic, limit, URI, fingerprint, and receipt
	schemas; generate strict Go/TypeScript/Python validators from checked-in
	JSON Schema where practical.
2. Extend the existing durable Project job with conversion kind, actor,
	requested action, access epoch, policy version, source identity, and payload
	reference. Add attempt/receipt/artifact stores and contract tests.
3. Implement immutable File/Object staging. Compute SHA-256 while streaming;
	never buffer an unbounded source or hand a canonical object path to a worker.
4. Implement Office ZIP preflight: entry/count/compressed/uncompressed/XML/media
	limits, normalized-name uniqueness, encryption and active-content detection,
	content-type verification, relationship policy, DTD/entity rejection.
5. Implement attempt creation with restrictive permissions, deterministic
	filenames, read-only inputs, quota accounting, and crash-safe cleanup.
6. Implement the direct process runner, process-group cancellation, wall/CPU/
	memory/output limits, bounded stdout/stderr capture, and no-egress sandbox.
7. Implement strict result validation and atomic artifact promotion. Result
	validation precedes any capability commit.
8. Add qpdf and Taurus PDF-policy hooks plus OOXML package validation hooks.
9. Add job status, cancellation, receipt, diagnostic, and authorized artifact
	delivery endpoints used by all format adapters.
10. Add SBOM/license/hash checks and the reusable canonical/loss/producer/
	adversarial/scale fixture harness.
Each task lands with a green tree and a compatibility note for the next task.
### Security, privacy, concurrency, idempotency, and observability
Authorize the requested import/export action before source metadata is exposed.
Capture the admission epoch and reauthorize when a worker is about to consume
protected source data. Reauthorize again before delivery because a user may
lose access while a long export runs. A revoked job is cancelled or allowed to
finish into a quarantined object that cannot be delivered and is later reaped.
Workers run as an unprivileged identity with a read-only root filesystem,
attempt-local writable mount, no inherited secrets, no network namespace, and
bounded resources. Logs contain job/attempt/project/resource/revision IDs,
counts, timings, safe error codes, and digests—not source text, cell values,
prompts, filenames, diagnostics bodies, or generated document content.
The semantic fingerprint includes Project, actor-visible source identity,
direction, format, exact revision or source hash, normalized options, contract
version, mapping policy, and caller idempotency key. Claim attempts are leased;
lease expiry permits retry. Only one receipt may publish a result for a
fingerprint. Capability commit and receipt completion occur in one unit of
work where an import creates canonical state.
Metrics cover queue latency, attempt duration, CPU/memory high-water marks,
input/output bytes, package entries, pages/slides/sheets/cells, diagnostic
counts by code, sandbox denials, retries, cancellations, validation failures,
artifact cache hits, and cleanup lag. Traces cross submission, staging,
worker, validation, commit, and delivery without content attributes.
### Tests and failure drills
- Store contracts run against SQLite D0 and PostgreSQL P1.
- Protocol tests reject unknown versions, trailing JSON, undeclared files,
	symlink/path escapes, digest mismatches, count mismatches, non-finite numbers,
	oversized NDJSON lines, and worker-supplied canonical IDs.
- Hostile package fixtures cover ZIP bombs, duplicate paths, traversal,
	encrypted files, macros, external relationships, DTD/entity payloads,
	malformed XML, decompression overrun, and huge dimensions/counts.
- Process tests cover timeout, SIGTERM/SIGKILL escalation, OOM/CPU/output limit,
	truncated result, crash after outputs but before sentinel, crash after
	capability commit but before acknowledgement, and orphan cleanup.
- Authorization tests revoke Project or source access before claim, during
	execution, and before download.
- Idempotency tests submit concurrently, redeliver queue messages, expire a
	lease, and replay after restart; exactly one canonical result is visible.
- Object-store tests inject partial writes, digest corruption, unavailable
	reads, and promotion failure.
- Load tests run many small jobs and several maximum-size jobs together and
	prove bounded worker concurrency and admission backpressure.
### Migration and rollback
Add the conversion schema and endpoints dark. Existing Markdown export remains
unchanged. Enable one fixture-only worker first, then format adapters behind
per-format feature gates. No customer source is backfilled. Rollback stops new
claims, drains or cancels attempts, leaves immutable source and completed
artifacts intact, and rolls routing back; schema remains additive until the
supported rollback window closes. A newer worker contract is deployed
read-compatible with in-flight older jobs or those jobs are drained before
cutover.
### Completion evidence
- Reproducible worker images and binaries with lockfiles, hashes, licenses, and
	SBOM.
- A published threat model and sandbox test report.
- Green protocol/store/authorization/race/fault/load suites on SQLite and
	PostgreSQL adapters.
- A deliberately crashing fixture worker proves safe retry and cleanup.
- No worker can reach the network, database, object store, credentials, or a
	path outside its attempt root.
- Ω-035, Ω-036, and Ω-037 can register an adapter without creating a queue,
	sandbox, receipt, or artifact implementation.
### Dependencies
Depends on Ω-009, Ω-011, Ω-014, Ω-015, and the File/Object port. Blocks Ω-035
through Ω-037 and is production-hardened by Ω-042 and Ω-043.
### Linked sources
In addition to the nine reviewed conversion pages above:
- [Architecture — Taurus Layered Application Model](https://app.notion.com/p/3acb6410e502812bb4e0ff2c91ff753f)
- [Architecture — User Cell & Project Subcell Runtime](https://app.notion.com/p/3acb6410e5028147909ef7214406baad)
- [Deployment — Taurus Topology & Scaling Model](https://app.notion.com/p/3acb6410e502816585d9e96ff02921d8)

