---
title: "Work Packet — Ω-044 — Certify the backend with security, recovery, and canonical demonstrations"
notion_page_id: "3acb6410e50281f5827efb0236dc64a5"
notion_url: "https://app.notion.com/3acb6410e50281f5827efb0236dc64a5"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:58:23Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-044 — Certify the backend with security, recovery, and canonical demonstrations

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

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

