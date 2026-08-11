---
title: "Work Packet — Ω-034 — Build the sandboxed conversion-worker foundation"
notion_page_id: "3acb6410e50281ef9dffdd761e59cb5c"
notion_url: "https://app.notion.com/3acb6410e50281ef9dffdd761e59cb5c"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:47:54Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-034 — Build the sandboxed conversion-worker foundation

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

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

