---
title: "Execute Ω-044 — Certify the backend with security, recovery, and canonical demonstrations"
packet_id: "Ω-044"
status: "ready-for-execution"
wave: "Wave 6 — Production and certification"
depends_on: "Ω-001, Ω-002, Ω-003, Ω-004, Ω-005, Ω-006, Ω-007, Ω-008, Ω-009, Ω-010, Ω-011, Ω-012, Ω-013, Ω-014, Ω-015, Ω-016, Ω-017, Ω-018, Ω-019, Ω-020, Ω-021, Ω-022, Ω-023, Ω-024, Ω-025, Ω-026, Ω-027, Ω-028, Ω-029, Ω-030, Ω-031, Ω-032, Ω-033, Ω-034, Ω-035, Ω-036, Ω-037, Ω-038, Ω-039, Ω-040, Ω-041, Ω-042, Ω-043"
source_mirror: "docs/current-docs/notion/work-packets/omega-044-certify-the-backend-with-security-recovery-and-canonical-demonstrations.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-044 — Certify the backend with security, recovery, and canonical demonstrations

## Mission

Produce one reproducible certification dossier proving the backend described by the 44 work packets is implemented, integrated, secure, recoverable, operable, and demonstrable without relying on Alpha mocks.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-001, Ω-002, Ω-003, Ω-004, Ω-005, Ω-006, Ω-007, Ω-008, Ω-009, Ω-010, Ω-011, Ω-012, Ω-013, Ω-014, Ω-015, Ω-016, Ω-017, Ω-018, Ω-019, Ω-020, Ω-021, Ω-022, Ω-023, Ω-024, Ω-025, Ω-026, Ω-027, Ω-028, Ω-029, Ω-030, Ω-031, Ω-032, Ω-033, Ω-034, Ω-035, Ω-036, Ω-037, Ω-038, Ω-039, Ω-040, Ω-041, Ω-042, Ω-043**.

Source dependency statement: - Ω-001 through Ω-043 closed with evidence.

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
- `docs/current-docs/notion/work-packets/omega-044-certify-the-backend-with-security-recovery-and-canonical-demonstrations.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.

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

Source mirror: `docs/current-docs/notion/work-packets/omega-044-certify-the-backend-with-security-recovery-and-canonical-demonstrations.md`

<callout icon="✅" color="green_bg">
	**Frozen-baseline certification additions.** Prove: two simultaneous Projects under one authenticated User; distinct collaborator subcells for the same Project; multiple connections to one logical subcell; cell eviction/restart and duplicate physical incarnation; missed-notification recovery from durable cursor; cross-node CAS/idempotency; no per-cell store/worker/provider lifecycle; direct read of an unindexed Resource; same-Project restricted read denial; 284 projected versus 723 actual capacity reproduction; unknown/lying/growing size; same-size/no-hash provider edit; partial-embedding usage; concurrent evidence replacement; and shadow re-embed/swap/rollback with fixed-ID reproducibility.
</callout>
<callout icon="✅" color="green_bg">
	**Queued — final certification.** Product Backend Complete requires security, recovery, concurrency, cell-lifecycle, and canonical backend demonstrations across all 44 packets. The proof explicitly uses distinct collaborator Project Subcells and durable convergence.
</callout>
## Outcome
Produce one reproducible certification dossier proving the backend described by the 44 work packets is implemented, integrated, secure, recoverable, operable, and demonstrable without relying on Alpha mocks.
## Dependencies
- Ω-001 through Ω-043 closed with evidence.
## Certification invariants
1. Alpha is an optimistic projection; Omega is authoritative.
2. Every Project request has explicit Project ID, authenticated User, named Action, current admission, and caller-aware results.
3. One logical User Cell is keyed by User ID; within it, one logical Project Subcell exists per Project.
4. Different Users on one Project have distinct subcells; same-User devices reuse one logical subcell.
5. Durable resource truth is never cell memory only.
6. Revision/CAS and idempotency govern mutations.
7. State, ChangeSet, Activity, and Project outbox publish atomically.
8. A durable cursor closes gaps from dropped/duplicate wake-ups, reconnect, restart, and failover.
9. Workspace cannot perform invisible content undo.
10. Jobs are durable, bounded, reauthorized, and idempotently published.
11. User/Organization/Project/library scopes fail closed and do not leak through lists, search, history, presence, evidence, errors, or derived artifacts.
12. All conversion/runtime dependencies are free/open-source and pinned.
13. Backup, restore, corruption detection, and object/change/job integrity are proven.
## Required demonstration suite
### Identity and access
- authenticate a User;
- discover only authorized Projects;
- show User-owned and Organization-owned Project admission;
- prove Organization administration without content grant cannot read content;
- revoke access and prove next command/live subscription/job publication fails;
- exercise user-level Personality, Context, and Template libraries before Project selection, then copy/materialize into a Project with provenance.
### Cell hierarchy and lifecycle
- Alice opens Helios on two devices: one logical Alice User Cell and one logical Alice×Helios subcell;
- Bob opens Helios: separate Bob User Cell and Bob×Helios subcell;
- evict Alice's idle subcell/User Cell and rehydrate Workspace, resources, and cursor;
- restart Omega during active work and reconnect without accepted-data loss;
- prove no Project placement record or shared Project runtime is involved.
### Concurrency and live convergence
- Alice and Bob race from one document revision: one accepted commit and one typed conflict/rebase;
- Alice commits while Bob's live wake-ups are dropped;
- Bob reconnects with his last cursor and catches up from the durable outbox;
- duplicate/out-of-order wake-ups do not double-apply;
- retention expiry produces snapshot-required and a correct new cursor;
- slow consumer memory remains bounded.
### Project capabilities
- Document, Spreadsheet, Slides, and Chat create/read/edit/history/undo flows;
- stable resource IDs/revisions and caller-aware Activity/History;
- Spreadsheet computation/overlays/templates;
- Slides stable unnamed slide IDs, sections, templates, rendering;
- Chat turn tree, context/personality execution, streaming finalization;
- Project Overview and Agent/Task/Run behavior;
- automatic Document publication to Text lattice.
### Ingestion, retrieval, and connectors
- Text, structured-data, and media lattice routing and mutual separation;
- CSV/XLSX structured descriptors with referenced raw artifacts;
- PNG/JPEG/WebP media descriptors and bounded OCR-derived Text evidence;
- cross-lattice Agent search without vector-score normalization;
- source lifecycle, disconnect/reconnect, deletion, reingestion, and provenance;
- Google Drive and Microsoft connector flows, provider limits, and SSRF/path/security boundaries.
### Interchange
- DOCX, XLSX, PPTX import/export and PDF export;
- sandboxed conversion worker limits, timeouts, and malformed-input handling;
- unsupported Office features drop with diagnostics rather than corrupting canonical state;
- derived exports never mutate source revisions;
- dependency licenses/SBOM are recorded.
### Jobs and recovery
- worker death, lease expiry, retry, duplicate delivery, and stale-result rejection;
- cell eviction while a job continues;
- reauthorization before job publication;
- staged object failure/reaper behavior;
- database restart, migration failure, backup/restore, and integrity verification;
- full P1 graceful drain, restart, overload, and soak proof.
## Security suite
- authentication/session fixation/CSRF/CORS/request parsing limits;
- authorization matrix and cross-User/cross-Project negative tests;
- list/search/history/presence/evidence/error redaction;
- connector URL, path, credential, archive, parser, and decompression limits;
- conversion/ingestion worker sandbox boundaries;
- SQL/injection and object-reference validation;
- secrets/log/redaction inspection;
- dependency/SBOM/vulnerability/license review;
- data retention/deletion and backup implications;
- rate limit, quota, queue, cache, and connection exhaustion.
## Performance and capacity suite
Measure at the supported P1 profile:
- request/command latency and throughput;
- CAS conflict/rebase rate;
- active User Cells, subcells, activation/eviction latency, cache bytes;
- live connection rate, outbox rows/second, cursor lag, snapshot fallback;
- PostgreSQL pool/transaction/index behavior;
- object storage rate/bytes;
- job queue depth/age and worker saturation;
- connector/provider rate limits;
- conversion/ingestion CPU/memory and timeout behavior.
Publish limits and reject/backpressure behavior. Do not claim P2/P3 scale from P1 evidence.
## Certification procedure
1. Pin all repository, schema, image, worker, fixture, and dependency versions.
2. Verify every packet evidence link and run its required commands.
3. Build and deploy the exact P1 artifact.
4. Seed canonical demo fixtures through public/backend contracts.
5. Run access, cell, concurrency, capability, ingestion, connector, conversion, job, security, load, failure, and recovery suites.
6. Re-run after backup/restore.
7. Produce a route/schema/capability coverage matrix mapping every demonstrated behavior to packet and test.
8. Record limitations and explicitly deferred features.
9. Mark Product Backend Complete only if every gate passes or has an approved, non-security-critical exception with owner and deadline.
## Explicitly deferred
- audio/video transcription;
- legacy XLS;
- slide animations/transitions;
- editable PDF import;
- macros/executable Office content;
- organization-owned library masters;
- live cross-Project template/context links;
- generic untyped Resource mutation;
- a separate microservice per capability;
- chain-of-thought storage/exposure;
- lossless Office round-trip, PDF/A, or PDF/UA claims without independent evidence.
Distributed Project placement is not deferred—it is intentionally absent from this architecture. P2 may add User affinity and a remote wake-up adapter; data partitioning may evolve behind store ports.
## Completion evidence
The dossier contains:
- exact commits/images/migrations/SBOM;
- packet coverage matrix for all 44 packets;
- commands, test artifacts, traces, logs, metrics, screenshots where useful;
- access/revocation and security findings;
- Alice/Bob subcell and durable-catch-up proof;
- load/soak/capacity results and supported limits;
- backup/restore checksums and recovery timing;
- known limitations, accepted exceptions, residual risks, owners, and dates;
- final sign-off that Project Backend Complete and Product Backend Complete gates are met.

