---
title: "Program — Taurus Omega Backend Completion Work Packets"
notion_page_id: "3adb6410e50281e286aff541de343991"
notion_url: "https://app.notion.com/3adb6410e50281e286aff541de343991"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-30 00:10:08Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Program — Taurus Omega Backend Completion Work Packets

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="🔗" color="blue_bg">
	**Repo-native execution handoff prepared.** The repository mirrors all **176 active Yesod pages** under `docs/current-docs/notion/` and includes the 44 files that should be handed directly to coding agents under `docs/current-docs/work-packets/`. Each execution file embeds its source specification and adds hard dependency gates, required reading, decision boundaries, validation, a numbered-record requirement, and a direct-to-`main` commit contract.
</callout>
<callout icon="🔒" color="green_bg">
	**Frozen planning baseline — 30 July 2026.** Taurus Omega commit [`50efd18413cc47935033889e51d58e9c828733e2`](https://github.com/gccurtis/taurus-omega/commit/50efd18413cc47935033889e51d58e9c828733e2) is the planning baseline for this program. It is not a reset target: each packet begins from the latest approved `main` containing its hard predecessors and records that actual starting SHA. The resilient-ingest work previously assigned to Ω-002–Ω-005 has substantially shipped; those slots are repurposed to the remaining specialized outcomes. The program remains **44 packets**.
</callout>
<callout icon="⬡" color="purple_bg">
	**Deployment/architecture decision.** Use one modular Omega product with hexagonal ports-and-adapters boundaries. `UserCell(UserID)` and `ProjectSubcell(UserID, ProjectID)` are logical, disposable runtime façades hosted by an Omega replica—not separate applications, processes, stores, worker pools, or provider clients. Identical replicas may host temporary physical incarnations of the same logical cell; database revision/CAS, idempotency, and durable outbox/change cursors remain the only correctness authorities.
</callout>
<callout icon="🧭" color="blue_bg">
	**Execution authority for completing Taurus Omega.** This is an ordered,
	dependency-aware backend completion program, not a loose backlog or a frontend
	roadmap. Each linked Work Packet is a self-contained assignment with its own
	proof gate. A packet is complete only when its behavior is observable through
	Omega's real contracts and its repository documentation describes what actually
	shipped.
</callout>
## Outcome
The campaign has two explicit gates:
1. **Project Backend Complete.** Every current Project-scoped resource,
	operation, Workspace behavior, Agent/Task behavior, ingestion route,
	connector, and interchange adapter is authoritative in Omega and testable
	end to end without Alpha. Alpha can become a projection that calls typed
	endpoints rather than inventing product truth.
2. **Product Backend Complete.** The minimum stable user/control plane, production
	storage, deployment, security, recovery, and canonical backend demonstrations
	are also proven. Later enterprise-policy changes remain modular rather than
	forcing changes inside Project capabilities.
## Reviewed source of truth
This program reconciles:
- Taurus Omega main, captured initially during a moving ingest sequence and
	refreshed through
	[`67cb84d`](https://github.com/gccurtis/taurus-omega/commit/67cb84da35625c781b15ef655c7a6a393a58f4ce)
	during planning, then re-pinned by Ω-001 immediately before execution;
- all nine current files in Taurus Alpha `docs/backend-requests/`;
- all 176 active, non-archived Resources related to Taurus Yesod: 47 Primary and 129 Supporting, including the 44 work-packet source pages;
- the attached Workspace aggregate design and coding-agent plan;
- prior Taurus architecture decisions recovered from the project record.
Authority when sources disagree:
1. the user's latest explicit decision;
2. current Primary Taurus Yesod architecture/model/implementation pages;
3. current Alpha backend request pages for frontend-required Omega behavior;
4. current Omega code and as-built repository documentation as implementation
	evidence;
5. older Workstreams, archived Alpha requests, Nova references, and historical
	design pages only where they do not conflict.
## Settled planning decisions
- Alpha is an optimistic projection; Omega is authoritative.
- Sessions authenticate a User. Every Project request names its Project
	explicitly and receives fresh admission.
- One logical User Cell is keyed by User ID. It contains one logical Project
	Subcell per Project for that User, keyed by `(UserID, ProjectID)`. Different
	Users collaborating in the same Project have distinct subcells.
- Complete the Project execution plane before hardening the broader mutable
	enterprise surface.
- Workspace is a typed User × Project aggregate with revision CAS, immutable
	ChangeSets, global action ordering, and visible-only undo. The legacy
	whole-state blob is not a completion state.
- Spreadsheet is one sparse grid, never a workbook or nested set of sheets.
- Slides have stable IDs and ranks but no names; sections and templates may be
	named. Animations and transitions are excluded.
- Chat becomes a revisioned parent-turn tree in which every Turn contains one
	Prompt and one Response. Streaming is transient; accepted final state is
	canonical.
- Text, structured-data, and media lattices are persisted and retrieved
	separately. Descriptors aid discovery but are never evidence.
- V1 structured data is CSV, XLSX, and native Spreadsheet. Legacy XLS, macros,
	executable workbook code, and opaque binary formulas are excluded.
- V1 media is PNG, JPEG, and WebP with description plus bounded OCR. Audio,
	video, and transcription are excluded.
- Office import/export and PDF export are in scope despite Alpha's older
	deferral. Editable PDF import is out; PDF may enter the Text lattice as a
	reference source.
- Every third-party dependency must be free/open-source. Prefer permissive
	MIT/BSD/Apache licensing; any copyleft dependency requires an explicit
	distribution review before adoption. Commercial conversion fallbacks are
	excluded.
- User libraries have user-owned canonical originals, grants to users or
	organizations, and independent copies in Projects. No live cross-Project
	links and no organization-owned canonical masters in V1.
- No implicit Project Context inheritance in V1. Context enters a Project
	through explicit grant, selection, connection, or copy with visible
	provenance.
- Managed first production uses PostgreSQL and an object-store port. SQLite/WAL
	remains local-development authority and may qualify only as a sealed
	single-node profile after load, locking, backup, and restore proof.
- There is no distributed Project placement model. Cells are user-oriented,
	disposable execution façades; Project data converges through revision/CAS and
	a durable Project change/outbox cursor. Best-effort User affinity and a
	cross-node wake-up adapter may be added when multiple Omega nodes are measured
	to be necessary, without becoming correctness authorities.
## Sequence and gates
### Wave 0 — Stabilize current truth
Ω-001 pins the frozen repository. Ω-002 through Ω-005 now close the remaining
specialized baseline outcomes: exact Resource reading independent of Knowledge,
actual byte/artifact admission safety, enforceable ports-and-adapters boundaries,
and embedding-space generation/rebuild certification. Ω-006 through Ω-010 retain
their Document, connector, Ask, caller-authorization, and wire-contract outcomes.
No automatic ingestion of restricted or unbounded content may ship before the
caller-aware evidence and capacity gates.
### Wave 1 — Establish the user-bound Project execution boundary
Ω-011 through Ω-019 make Project ID explicit, land the User × Project Workspace
aggregate, introduce the in-process User Cell and per-user Project Subcell
registries, add durable Project change/outbox cursors, repair jobs/realtime,
complete the Resource kernel, close automatic Document publication and the
Document vertical, and serve Overview plus Project-local Agent/Task behavior.
### Wave 2 — Implement every resource capability
Ω-020 through Ω-027 freeze shared Template parameter/materialization semantics,
then implement Spreadsheet, Slides, and Chat as revisioned Project resources and
extend Workspace history coordination to them.
### Wave 3 — Complete ingestion, retrieval, and connectors
Ω-028 through Ω-033 introduce the multi-lattice coordinator, structured and
image capabilities, cross-lattice Agent tools, source lifecycle, and Google plus
Microsoft provider adapters.
### Wave 4 — Complete customer interchange
Ω-034 through Ω-037 build one sandboxed conversion runtime and its DOCX, XLSX,
PPTX, and PDF export adapters. Import publishes one validated canonical base
atomically; export creates a derived artifact and never mutates the source.
**Project Backend Complete gate:** Ω-001 through Ω-037 are closed with proof.
### Wave 5 — Minimum stable user/control plane
Ω-038 through Ω-041 add the common library/grant/lineage kernel, migrate
Personality/Context/Template libraries, and establish the minimum identity,
Organization, ownership, grants, settings, entitlement, admin, and audit
contracts needed by the product. Enterprise embellishment remains outside the
Project domain.
### Wave 6 — Production and release proof
Ω-042 through Ω-044 add production data adapters and migration/backup/restore,
package and operate the modular single-node system, and run the complete
security/recovery/backend demonstration gate.
**Product Backend Complete gate:** all 44 packets are closed with proof.
## Sequencing rules
- After Ω-001, Ω-002 through Ω-007 can land as independent commits on `main`
	when their touched paths do not overlap; Ω-008/009 wait on the caller-scope
	contract.
- After Ω-010 and Ω-014 stabilize the user-bound Project execution, durable
	change-stream, and Resource boundaries, Spreadsheet, Slides, and Chat aggregate
	work may proceed in parallel.
- Structured, media, and conversion-worker research may start early; canonical
	publication waits for the target resource/lattice contracts.
- User-library work may proceed in parallel after the Project copy/materialize
	contracts are stable, but it cannot change Project capability internals.
- Deployment spikes begin early. Formal production closure waits for
	representative resources, jobs, objects, connectors, and conversions.
## Work Packet execution contract
Every packet requires:
- a baseline commit and explicit before-state;
- a target directory/runtime state and bounded non-goals;
- typed interfaces and stable error codes rather than prose-only behavior;
- one authoritative mutation path with revision/CAS/idempotency where state
	changes;
- caller- and Project-scoped reads, lists, history, presence, jobs, and errors;
- transactional state/activity/outbox publication where atomicity is required;
- durable jobs for expensive work, with bounded payload references, leases,
	retry budgets, reauthorization, and stale-result rejection;
- unit, pure reducer, store-contract, handler/transport, integration, race,
	negative-access, failure-recovery, and load tests as applicable;
- numbered change records, architecture docs, route/schema inventories, migration
	notes, change record, and rollback instructions updated in the same work;
- clean `./scripts/check-format.sh`, `go build ./...`, and `go test ./...` gates, plus relevant
	live suites, and packet-specific backend E2E proof;
- an evidence note naming commit(s), commands, fixtures, measurements,
	migrations, known limitations, and residual risks.
Mocks, uncalled code, a schema without behavior, or an endpoint without
authorization/recovery proof do not close a packet.
## Completion dashboards
Track packet state by its title prefix and `Role = Supporting`:
- `Queued`
- `In progress`
- `Blocked`
- `Review`
- `Complete`
The Resources database does not currently contain a Status property, so the
ordered registry declares every packet initially `Queued`. The packet owner
records later state in the packet's opening block and completion evidence. Add a
database Status property only if the project owner wants Resources to become an
execution tracker; do not silently change the shared database schema.
## Deferred beyond this program
- audio/video/media transcription;
- legacy XLS;
- slide animations/transitions;
- editable PDF import;
- macros or executable Office content;
- organization-owned library masters;
- live cross-Project template/context links;
- generic untyped Resource property mutation;
- correctness that depends on sticky sessions, one physical User Cell, or one
	shared Project runtime;
- a separate microservice per capability;
- chain-of-thought storage or exposure;
- a promise of lossless Office round trips, PDF/A, or PDF/UA without independent
	validation evidence.
## Governing sources
- Workstreams — Taurus Product Completion
- Architecture — Taurus Layered Application Model
- Architecture — Enterprise Control Plane
- Architecture — User Cell & Project Subcell Runtime
- Deployment — Taurus Topology & Scaling Model
- Implementation — Control Plane, User Cell & Project Subcell Integration
- Model/Implementation — Workspace
- Spreadsheet, Slides, and Chat runtime models
- Multi-lattice architecture/models/migration
- Office/PDF import/export specifications
- Identity, settings, organization administration, and user-library specifications
- Taurus Alpha current backend-request index
- Taurus Omega current runtime, persistence, transport, and in-flight ingest design
## Ordered packet registry
All packets are initially **Queued**. Their numeric title prefix is the execution order; `Role = Supporting` keeps them easy to filter away from governing design resources.
### Wave 0 — Stabilize current truth
1. [Ω-001 — Freeze Completion Baseline & Executable Contract](https://app.notion.com/p/3acb6410e50281dea887f4a804e87faa)
2. [Ω-002 — Separate exact Resource reading from Knowledge](https://app.notion.com/p/3acb6410e502817e9b48ca0a34cf6729)
3. [Ω-003 — Close Knowledge capacity, bounded-read, and refusal safety](https://app.notion.com/p/3acb6410e50281189f27db1c10eb228d)
4. [Ω-004 — Enforce ports-and-adapters boundaries and architecture tests](https://app.notion.com/p/3acb6410e5028134b99ef90126e27abb)
5. [Ω-005 — Establish Knowledge embedding-space lifecycle and certification](https://app.notion.com/p/3acb6410e50281a89ceefd5195698360)
6. [Ω-006 — Validate Document marks and custom typography](https://app.notion.com/p/3acb6410e502811e88ddf350c279c873)
7. [Ω-007 — Harden connector source admission, filesystem, and SSRF boundaries](https://app.notion.com/p/3acb6410e5028134b55bcbcdc6aeefe6)
8. [Ω-008 — Make Ask-turn failures diagnosable and recoverable](https://app.notion.com/p/3acb6410e5028193843bd6a0fd035b44)
9. [Ω-009 — Make Project reads and retrieval evidence caller-aware](https://app.notion.com/p/3acb6410e50281ab8fe4f7d97dcc0f91)
10. [Ω-010 — Define redaction, pagination, Activity, and History wire contracts](https://app.notion.com/p/3acb6410e50281ff8cb3c5528c9470f6)
### Wave 1 — Establish the user-bound Project execution boundary
1. [Ω-011 — Make Project scope explicit per request](https://app.notion.com/p/3acb6410e5028181902fd66656bb1f67)
2. [Ω-012 — Land the Workspace aggregate and unified undo](https://app.notion.com/p/3acb6410e50281c5a79ff934a7c64058)
3. [Ω-013 — Introduce the in-process User Cell and Project Subcell registries](https://app.notion.com/p/3acb6410e5028126b080c561a30f01f4)
4. [Ω-014 — Make jobs, collaboration, and live delivery subcell-safe](https://app.notion.com/p/3adb6410e50281618bc7f02bda0e3670)
5. [Ω-015 — Complete the shared Resource runtime contracts](https://app.notion.com/p/3adb6410e50281f79473ede39876f743)
6. [Ω-016 — Publish Document revisions to the Text lattice automatically](https://app.notion.com/p/3adb6410e50281208968d066f28cab27)
7. [Ω-017 — Close the Document Project vertical slice](https://app.notion.com/p/3adb6410e50281999781e35c8dfacd05)
8. [Ω-018 — Serve Project Overview projections and bounded commands](https://app.notion.com/p/3adb6410e50281c0a262e8580e8f03f2)
9. [Ω-019 — Complete the Project Agent and Task/Run runtime](https://app.notion.com/p/3adb6410e5028183ba41d764039f7930)
### Wave 2 — Implement every resource capability
1. [Ω-020 — Freeze the cross-resource Template parameter and materialization contract](https://app.notion.com/p/3acb6410e502812eb0f3f4aca7e329be)
2. [Ω-021 — Implement the Spreadsheet aggregate, operations, and persistence](https://app.notion.com/p/3acb6410e5028101ad28de36426d1403)
3. [Ω-022 — Complete Spreadsheet computation, overlays, templates, and API integration](https://app.notion.com/p/3acb6410e50281edb7f7d5bd3c7d90a8)
4. [Ω-023 — Implement the Slides aggregate, operations, and persistence](https://app.notion.com/p/3acb6410e50281909acdce415f06e0db)
5. [Ω-024 — Complete Slides content, templates, rendering, and API integration](https://app.notion.com/p/3acb6410e5028144837de6ca4b89ccbe)
6. [Ω-025 — Migrate Chat to a revisioned turn-tree aggregate](https://app.notion.com/p/3acb6410e502819daf6ac7c1a67c5165)
7. [Ω-026 — Complete Chat execution, context, personas, streaming, and API integration](https://app.notion.com/p/3acb6410e5028166993cc73270ff625e)
8. [Ω-027 — Extend Workspace history coordination to every resource](https://app.notion.com/p/3acb6410e50281e5a7b8f2ff2506c397)
### Wave 3 — Complete ingestion, retrieval, and connectors
1. [Ω-028 — Introduce the typed multi-lattice ingestion router](https://app.notion.com/p/3adb6410e5028137863ff4a2d59c1885)
2. [Ω-029 — Implement structured-data descriptors for CSV and XLSX](https://app.notion.com/p/3adb6410e50281cc8a40c4fc26f361d9)
3. [Ω-030 — Implement image descriptors and OCR-derived text](https://app.notion.com/p/3adb6410e50281e78526ddb3cda469e4)
4. [Ω-031 — Expose cross-lattice retrieval and Agent tools](https://app.notion.com/p/3adb6410e5028192a491c1bb4a8d9097)
5. [Ω-032 — Complete connector/source lifecycle and upload-vs-connection semantics](https://app.notion.com/p/3adb6410e50281f3aa7ec34cfa2bc5a7)
6. [Ω-033 — Implement Google Drive and Microsoft connector adapters](https://app.notion.com/p/3adb6410e502816cb7bbf4e1e525db68)
### Wave 4 — Complete customer interchange
1. [Ω-034 — Build the sandboxed conversion-worker foundation](https://app.notion.com/p/3acb6410e50281ef9dffdd761e59cb5c)
2. [Ω-035 — Implement Document DOCX import/export and PDF export](https://app.notion.com/p/3acb6410e5028191b118e2013904db29)
3. [Ω-036 — Implement Spreadsheet XLSX import/export and PDF export](https://app.notion.com/p/3acb6410e50281778861da73b4250b99)
4. [Ω-037 — Implement Slides PPTX import/export and PDF export](https://app.notion.com/p/3acb6410e502819cbe8ce2eab833514c)
### Wave 5 — Minimum stable user/control plane
1. [Ω-038 — Build the user-owned library, grant, and lineage kernel](https://app.notion.com/p/3acb6410e5028112b3d7e37e3daa31d0)
2. [Ω-039 — Migrate Personality, Context, and Template libraries](https://app.notion.com/p/3acb6410e50281c2bd7aea5f19585153)
3. [Ω-040 — Establish identity, Organization, Project ownership, and grants](https://app.notion.com/p/3acb6410e50281cab417e06f369b242a)
4. [Ω-041 — Implement user/project settings, administration, entitlements, and audit](https://app.notion.com/p/3acb6410e502810d884cd50770f5352d)
### Wave 6 — Production and release proof
1. [Ω-042 — Add production storage, object data, migrations, backup, and restore](https://app.notion.com/p/3acb6410e50281feba8ff4999d9d0505)
2. [Ω-043 — Package and operate the production single-node deployment](https://app.notion.com/p/3acb6410e50281b39bedccc751b658e8)
3. [Ω-044 — Certify the backend with security, recovery, and canonical demonstrations](https://app.notion.com/p/3acb6410e50281f5827efb0236dc64a5)
