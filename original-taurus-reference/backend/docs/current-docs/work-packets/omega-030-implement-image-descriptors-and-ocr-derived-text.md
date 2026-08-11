---
title: "Execute Ω-030 — Implement image descriptors and OCR-derived text"
packet_id: "Ω-030"
status: "ready-for-execution"
wave: "Wave 3 — Complete ingestion, retrieval, and connectors"
depends_on: "Ω-004, Ω-009, Ω-014, Ω-028"
source_mirror: "docs/current-docs/notion/work-packets/omega-030-implement-image-descriptors-and-ocr-derived-text.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-030 — Implement image descriptors and OCR-derived text

## Mission

Media becomes an independent Project capability and lattice for PNG, JPEG, and WebP still images. A vision-capable inference cast generates a validated description for discovery. The original authorized image remains the artifact the Agent opens. When policy selects OCR, a separate OCR cast emits literal regioned text into the Text lattice with explicit OCR provenance. V1 does not directly embed image pixels and does not support audio or video.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-004, Ω-009, Ω-014, Ω-028**.

Source dependency statement: Ω-004, Ω-009, Ω-014, Ω-028.

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
- `docs/current-docs/notion/work-packets/omega-030-implement-image-descriptors-and-ocr-derived-text.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `core/capability/file` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/intelligence` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

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

Source mirror: `docs/current-docs/notion/work-packets/omega-030-implement-image-descriptors-and-ocr-derived-text.md`

**Type:** Supporting  
**Wave:** 3 — Complete ingestion, retrieval, and connectors  
**Gate:** Project Backend Complete  
**Depends on:** Ω-004, Ω-009, Ω-014, Ω-028  
**Unblocks:** Ω-031, Ω-032
## Outcome
Media becomes an independent Project capability and lattice for PNG, JPEG, and
WebP still images. A vision-capable inference cast generates a validated
description for discovery. The original authorized image remains the artifact
the Agent opens. When policy selects OCR, a separate OCR cast emits literal
regioned text into the Text lattice with explicit OCR provenance.
V1 does not directly embed image pixels and does not support audio or video.
## Current evidence
Files can store opaque bytes, and Document/Slides/Chat can reference images, but
Omega has no Media capability, multimodal Intelligence message parts, image
descriptor schema, OCR policy, Media lattice, or OCR Text provenance.
## Before and after
```plain text
core/capability/media/
  model.go descriptor.go ingestion_image.go ocr.go
  service.go store.go tools.go lattice_adapter.go errors.go
core/integration/media/image/
core/platform/storage/sqlite/sqlite_media.go
core/handlers/media/
Intelligence typed image parts and media casts
```
## Scope
- Safe PNG/JPEG/WebP metadata decode and normalized model input.
- Image descriptor, tags, visible-text assessment, and Media lattice.
- OCR policy `never | auto | always`, regioned result, and Text admission.
- Original File reference hydration and parent Resource locators.
- Jobs, receipts, replacement/removal, API, authorization, telemetry.
## Non-goals
- No audio, video, audio transcription, animated frame analysis, image editing,
	chart-data extraction, or direct image-vector embedding.
- Generated descriptions never become Text-lattice source evidence.
- No arbitrary remote image URLs in capability/provider contracts.
## Governing invariants
1. The descriptor discovers an image; grounded visual use opens the original
	authorized immutable image.
2. Media descriptor and OCR Text are distinct projections with distinct IDs,
	rows, vectors, generations, and provenance.
3. OCR is literal transcription, not description, summary, translation, or
	inferred completion.
4. The provider sees a server-authorized normalized image input, not a
	caller-provided URL/base64 authority.
5. Source and File access are checked at ingestion and every hydration.
6. Decode dimensions/bytes/pixels precede expensive model calls.
7. Descriptor/OCR results validate against strict JSON/size/region schemas.
8. Replacement publishes atomically and retracts superseded projections.
## Core model
```go
type MediaArtifact struct {
    ID, ProjectID, SourceID string
    Kind        string // image
    Locator     MediaLocator
    Payload     MediaPayloadRef
    ContentHash string
    Descriptor  MediaDescriptor
}

type MediaDescriptor struct {
    Name, Summary, MediaKind, Setting, Purpose string
    Subjects         []DescriptorSubject
    Composition      []string
    VisualAttributes []string
    Tags             []MediaTag
    VisibleText      VisibleTextAssessment
    Confidence       float32
    Status           string
    Provenance       DescriptorProvenance
}

type OCRResult struct {
    Text       string
    Regions    []OCRRegion
    Language   string
    Confidence float32
    Provenance OCRProvenance
}
```
## Intelligence contracts
```plain text
inference / media.describe.image
inference / media.ocr.image
embedding / media.index
```
```go
type MessagePart struct {
    Kind  string // text | image
    Text  string
    Image *AuthorizedImageInput
}

type AuthorizedImageInput struct {
    FileID, SHA256, MIMEType string
}
```
Provider adapters resolve bytes through an infrastructure FileReader. Decode and
re-encode pixels to a bounded canonical model-input format to strip EXIF,
profiles, comments, and parser-ambiguous payloads; preserve the untouched
original File for artifact reads.
Default OCR policy is `auto`. The descriptor call already returns
`VisibleTextAssessment`; do not add a third call merely to decide whether to run
OCR.
## Persistence
```sql
CREATE TABLE media_sources (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
  source_ref_json TEXT NOT NULL, format TEXT NOT NULL,
  width INTEGER NOT NULL, height INTEGER NOT NULL, byte_size INTEGER NOT NULL,
  policy_version TEXT NOT NULL, generation INTEGER NOT NULL,
  status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE media_artifacts (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, source_id TEXT NOT NULL,
  locator_json TEXT NOT NULL, payload_ref_json TEXT NOT NULL,
  content_hash TEXT NOT NULL, descriptor_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE media_ocr_projections (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, source_id TEXT NOT NULL,
  text_projection_id TEXT, status TEXT NOT NULL,
  result_json TEXT, policy_version TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
```
Add a separate `media_lattice_*` table family. Original bytes remain in
File/object storage.
## HTTP surface
```javascript
GET  /media/artifacts?sourceID=&cursor=&limit=
GET  /media/artifacts/:artifactID
GET  /media/artifacts/:artifactID/content
POST /media/search
POST /media/artifacts/:artifactID/ocr
GET  /media/artifacts/:artifactID/ocr
PATCH /media/artifacts/:artifactID/descriptor
```
## Ordered implementation tasks
1. Freeze image/descriptor/OCR/provenance schemas, limits, and fixture corpus.
2. Add typed Intelligence image parts and startup route-capability validation.
3. Implement safe PNG/JPEG decoders with standard library and WebP using a
	pinned BSD-licensed `golang.org/x/image/webp` dependency if retained.
4. Implement normalized provider input, description job, JSON validator, and
	Media artifact/lattice store.
5. Implement OCR policy/job, region validator, and narrow Text-admission port.
6. Add parent Resource locators, replacement/retraction, API, authorization,
	pagination, telemetry, and Agent open port.
7. Add adversarial image/OCR, recovery, load, live, and companion tests.
## Security, concurrency, jobs, and observability
- Bound compressed bytes, decoded pixels, dimensions, frames, metadata, model
	input, OCR text, region count, and output JSON before allocation/publication.
- Reject polyglots, invalid signatures, animated formats, external references,
	and decompression bombs.
- Do not send EXIF GPS or hidden metadata to providers or return it unless an
	explicit future contract authorizes it.
- Jobs are Project/source/policy scoped, idempotent, cancellable, retry/cost
	bounded, and stale-generation safe.
- Emit image dimensions/bytes, normalization bytes, descriptor/OCR state,
	visible-text decision, regions/text length, tokens/cost, and safe failure
	code—not image content or OCR text.
## Verification
- Valid PNG/JPEG/WebP and adversarial/truncated/polyglot/huge-dimension corpus.
- Descriptor schema hallucination/malformed-output rejection.
- OCR exact-text/region/confidence/provenance fixtures and empty OCR.
- Media and OCR Text rows are physically separate yet share the same immutable
	source reference.
- Access revocation blocks original open and OCR retrieval.
- Crash/retry/supersede/delete; no stale projection publish.
- Backend E2E: ingest image, search descriptor, open original, auto-OCR, retrieve
	literal OCR text with source region.
## Migration and rollback
All tables/routes are additive. Enable each image format only after its decoder
suite is green. OCR may be disabled by policy without disabling Media. Derived
descriptors/OCR can be regenerated; user-verified edits and provenance must be
backed up. Rollback unregisters the projector and leaves isolated rows.
## Completion evidence
- Security/parser/model/store/lattice/live matrices pass.
- A dual-projection E2E proves no record is shared across lattices.
- Provider input contains normalized pixels and no arbitrary URL.
- FOSS license/SBOM review is attached; audio/video are absent.
## Sources
- Taurus Yesod Model — Media capability
- Taurus Yesod Design/Implementation — Multi-lattice ingestion
- [`golang.org/x/image/webp`](https://pkg.go.dev/golang.org/x/image/webp)[ package and BSD-3-Clause license](https://pkg.go.dev/golang.org/x/image/webp)
- `core/capability/file`
- `core/capability/intelligence`
- Ω-028 typed router
---

