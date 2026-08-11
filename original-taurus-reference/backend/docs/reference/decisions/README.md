# Decision register

This register records choices that materially constrain product behavior,
security, data, public contracts, or construction. Implementation may make
reversible local choices, but it must add consequential choices here rather
than burying them in code.

## D001 — Greenfield rebuild

- **Decision:** Build Omega in its own repository; do not migrate Nova.
- **Grounding:** Nothing is in production, and preserving transitional
  structure would constrain the architecture without protecting live users.
- **Direction:** Taurus specifications and Nova behavior are evidence only.
  No migration packets, compatibility adapters, source maps, Nova acceptance
  gates, or rollback-to-Nova path. Ordinary forward database schema evolution
  inside Omega remains a production requirement and is not a Nova migration.
- **Alternatives:** Incrementally refactor Nova; copy Nova into an archive
  directory inside Omega.
- **Revisit:** Only if a real deployed Nova estate must later be imported.

## D002 — Host-supervised, scope-bound Cells

- **Decision:** A Host may supervise many Cells; every Cell instance is
  immutably bound to exactly one `(UserID, ProjectID)`.
- **Grounding:** The product needs hard Project isolation and parallel work
  without pretending every domain library is a service.
- **Direction:** Multiple disposable same-scope Cell instances are valid.
  Correctness never depends on reuse or affinity.
- **Alternatives:** One shared multi-Project Cell; one process per Cell; exactly
  one Cell globally per scope.
- **Revisit:** A future Gateway may add compatible warm-Cell placement without
  weakening the bound key.

## D003 — Capabilities are libraries

- **Decision:** Product capabilities are independently testable Go libraries,
  not autonomous services.
- **Grounding:** Domain independence comes from contracts and dependency
  direction, not mandatory network or mailbox boundaries.
- **Direction:** Handlers provide the environmental envelope; cross-capability
  work uses narrow consumer-owned ports and bounded nested dispatch.
- **Alternatives:** Internal microservices over HTTP/gRPC; one hidden mailbox
  goroutine per capability; direct sibling imports.
- **Revisit:** Extract a capability only after measured scaling, isolation, or
  ownership needs justify a separate deployment.

## D004 — Tenancy and Project grants

- **Decision:** A User belongs to exactly one Organization. A Project has one
  home Organization and exactly one User owner; Project access is granted to
  Users and may cross Organizations.
- **Grounding:** The Organization is an administrative home, while actual
  collaboration is person-specific and should be explicit.
- **Direction:** “Share with Organization” creates an auditable snapshot of
  User grants. Groups and dynamic Organization grants are deferred.
- **Alternatives:** Multi-Organization Users; Organization-only Project ACLs;
  groups in the initial model.
- **Revisit:** Enterprise directory synchronization or group-scale policy.

## D005 — Control plus one Project Database per Project

- **Decision:** Central Control state is separate from one logical Project
  Database per Project.
- **Grounding:** Project content should be difficult to expose across Projects,
  and database credentials should embody the narrowest practical scope.
- **Direction:** Initial Bridge placement may host multiple separately named
  Project Databases on one managed cluster. Silo placement gives a Project a
  dedicated instance/cluster when stronger isolation is required.
- **Alternatives:** Shared tables with `project_id`; one database with schemas;
  dedicated physical cluster for every Project from day one.
- **Revisit:** Measured fleet cost, database limits, regional placement, and
  enterprise isolation tiers.

## D006 — Capability-specific concurrency

- **Decision:** Every canonical owner defines its own persistence and
  concurrency contract.
- **Grounding:** A Document history, session family, file version, task state
  machine, and formula name registry do not have the same conflict semantics.
- **Direction:** Documents use base + ordered Document ChangeSets + head.
  Other capabilities may use conditional aggregate revisions, immutable
  inserts, row constraints/locks, state transitions, leases, or their own log.
- **Alternatives:** Universal event sourcing; universal last-write-wins;
  universal application locks.
- **Revisit:** Never globally; only within the owning capability contract.

## D007 — Strong per-request authority and revocation

- **Decision:** Every protected request checks current durable authority. Every
  protected Project Product-effect mutation gets a fresh one-use permit
  immediately before effect; the Project transaction validates and consumes it
  against mutable Project-local authority fencing. Control mutations instead
  lock and re-evaluate authority in their own Control transaction. Once
  revocation is effective, no older effect permit can commit.
- **Grounding:** “Revoked” must have one simple security meaning, not a bounded
  window in which previously issued effects may still appear.
- **Direction:** Permit issuance stops at revocation. Revocation returns
  effective only after prior permits have settled or been fenced. Issuance and
  revocation serialize on the same Control authority row, and every
  nonterminal permit target is fenced even after permit expiry. Replays,
  expiry, wrong scope/action/resource/generation, and stale fence all fail.
  Permit issuance locks every revocable dependency in a deterministic order
  and indexes the permit by each dependency so any dependency revoker sees it.
  Permit expiry is capped by every source/approval/delegation deadline. Every
  consuming Project transaction also writes an exact `PermitConsumptionProof`.
  After commit, `control.mutation_permits.settle.v1` re-reads that row through
  the exact typed settlement target and idempotently marks the Control permit
  committed. A lost acknowledgement is reconciled by the same re-read; an
  absent or conflicting proof never settles the permit. The settlement
  credential is read-only and cannot substitute for the separate fence
  credential.
- **Alternatives:** Allow permits issued before revocation to finish; reserve
  strong fencing for destructive operations only.
- **Revisit:** Only with an explicit product/security decision and evidence
  that a weaker guarantee is necessary.

## D008 — Backend-owned canonical Resources

- **Decision:** The complete Resource exists in backend state; clients receive
  and mutate bounded projections.
- **Grounding:** Multiple tabs, Cells, users, agents, retries, and recovery need
  one canonical authority independent of a browser lifecycle.
- **Direction:** All important operations and rendering are testable headlessly.
- **Alternatives:** Client-owned document state with periodic snapshots;
  session-affine in-memory truth.
- **Revisit:** Not expected.

## D009 — No universal event runtime or internal RPC

- **Decision:** Initial in-process coordination is explicit calls and bounded
  jobs. Notifications are optional hints, never canonical ordering.
- **Grounding:** Previous event-runtime coordination added intermediate forms
  and failure modes without a product requirement for independent services.
- **Direction:** No internal gRPC, service discovery, global bus, or ordered
  cross-capability cursor. Durable asynchronous effects use explicit job
  records owned by the effect's transaction domain.
- **Alternatives:** Event-sourced runtime; service mesh; per-capability queues.
- **Revisit:** A proven external integration or extracted deployment may add a
  transport adapter around existing contracts.

## D010 — Nix is local developer tooling

- **Decision:** Nix may pin the developer workstation toolchain and has no
  architectural or runtime role.
- **Grounding:** Local workstation reproducibility is useful, but repository
  automation from Merkabah must not leak into the greenfield product design.
- **Direction:** Record and lock selected tool versions when code begins. Keep
  repository automation outside this corpus until it receives its own explicit
  task and evidence boundary.
- **Alternatives:** No local pinning; copy inherited repository automation.
- **Revisit:** A separately authorized repository-automation task.

## D011 — Sign-out semantics

- **Decision:** Support sign out of the current session family and sign out
  everywhere for all of a User's session families.
- **Grounding:** Users need both ordinary device-scoped control and an account-
  wide security action.
- **Direction:** Current-family sign-out revokes that family and waits for D007
  to fence only permits sourced by it; independently admitted durable-work
  authorities, standing-work delegations, Task sponsorships, and standing
  Routine delegations continue. Sign-out everywhere revokes every session family,
  durable-work authority, standing-work delegation, Task sponsorship, and
  standing Routine delegation sponsored by the User and
  reports security completion only after their older permits cannot commit.
  User disable/removal follows the everywhere rule. A User-root generation
  serializes User-wide revocation against new session/sponsorship/delegation/
  permit issuance; current-family sign-out similarly serializes against new
  sponsorship creation from that family.
- **Alternatives:** Current token only; best-effort Cell cancellation as the
  authority mechanism.
- **Revisit:** Device/session management UX.

## D012 — Resource-family vocabulary

- **Decision:** Backend families are Documents, Workbooks, Decks, Boards, Chats,
  and Files. A Workbook contains Worksheets; a Deck contains Slides.
- **Grounding:** The top-level durable object needs one stable name distinct
  from its repeated inner units, while visible product labels can remain
  familiar.
- **Direction:** Directory/package names use `documents`, `workbooks`, `decks`,
  `boards`, `chats`, and `files`. `resources/` is taxonomy only.
- **Alternatives:** Top-level `sheets`/`slides`; generic `resource` payload.
- **Revisit:** Before public API v1 freezes, if product terminology research
  selects a different visible label.

## D013 — Templates stay with Resource families

- **Decision:** A template is a mode/definition owned by its Resource family,
  not a generic Template service or canonical payload.
- **Grounding:** Document, Workbook, Deck, and Board structures and safe
  instantiation rules differ materially.
- **Direction:** Each applicable family owns template model, validation,
  parameterization, instantiate/preview, and template import/export behavior.
  Workspace/Data may project a cross-family template catalog.
- **Alternatives:** Generic serialized template blobs; independent Template
  capability that imports every family.
- **Revisit:** A proven shared trait may be extracted as a pure contract only
  after at least two complete family implementations.

## D014 — Files, Sources, connectors, and translation are distinct

- **Decision:** File bytes/versioning, exact-version Sources, external connector
  consent/acquisition, and format translation are separate owned behaviors.
- **Grounding:** They have different authority, persistence, security, failure,
  consent, and lifecycle semantics.
- **Direction:** They collaborate through explicit identifiers and ports. Upload
  does not imply import, Source registration, connector sync, or Resource
  creation.
- **Alternatives:** One generic intake service or Files capability owning every
  import/provider workflow.
- **Revisit:** Only for shared pure utilities, not canonical ownership.

## D015 — Structured Data Objects are Project data assets

- **Decision:** A governed Structured Data Object is canonical Project data but
  is not initially a seventh member of the common Resource catalog/family
  identity.
- **Grounding:** Data Objects have typed schema/data versions, field provenance,
  review, and analytic semantics that differ from editor/file Resource
  lifecycle and presentation contracts.
- **Direction:** `dataobjects` owns its identity and persistence; Data Catalog
  projects it. Other capabilities reference it through exact Project-scoped
  IDs and versions.
- **Alternatives:** Promote it to a seventh Resource family; encode it as a
  Workbook/File; treat it as an ephemeral inference result.
- **Revisit:** Before public API v1 if one shared Resource lifecycle demonstrably
  improves UX without importing editor semantics into data assets.

## D016 — Connector authority is split by transaction owner

- **Decision:** Control owns external connection/consent identity and token
  `SecretRef`s; the Project domain owns subscriptions, mappings, cursors, and
  intake/sync state; concrete provider adapters live outside capability code.
- **Grounding:** Provider consent is account/security authority, while selected
  data and synchronization effects belong to a Project transaction.
- **Direction:** Use `control/connectors`, `capabilities/connectors`,
  `cell/handlers/connectors`, and `integrations/connectors` as distinct
  boundaries. No provider token enters a capability value or Project database.
- **Alternatives:** Let Files own all connectors; place tokens in Project
  records; make each provider a service.
- **Revisit:** Enterprise-managed tenant consent may add a Control policy layer
  without collapsing the boundary.

## D017 — Every Agent execution has a sponsoring User

- **Decision:** Agent work always executes under Cell key
  `(SponsorUserID, ProjectID)`; Agent is a secondary actor/delegate and never an
  Agent-only Cell authority.
- **Grounding:** Every protected effect needs a current accountable human and
  the same Project-isolation contract as interactive work.
- **Direction:** Interactive Agent work is session-bound. Control owns Agent
  authority identity, tool-grant generations, exact Task sponsorships, and
  standing Routine delegations; Agents owns Project-local configuration,
  Persona/tool declarations, Task state, and a non-authoritative sponsorship
  receipt. Every ordinary Project-effect permit names exactly one live session,
  durable-work authority, or exact Task sponsorship source; Task effects use
  the sponsorship arm. A session-started Task creation uses an ordinary
  session-sourced effect permit. A Routine trigger instead receives a
  separately typed one-use `ReceiptBootstrapCredential`, usable only to create
  the exact absent Task and matching receipt preselected by that trigger; it is
  not an effect permit or a fourth authority source. Activation and lost-
  acknowledgement recovery re-read the exact receipt using a dedicated
  least-privilege proof credential. A pending orphan is harmless and a receipt
  alone grants nothing. A current-family sign-out may
  leave sponsorship active, but sign-out everywhere, User disable/removal,
  Project/Agent/tool revocation, Task cancel, sponsorship expiry/revocation, or
  stale generations deny new permits and fence old ones. A Routine standing
  delegation is bounded by trigger, scope, runs, budgets, generations, and
  expiry and mints a fresh sponsorship for each admitted Task.
- **Alternatives:** Ambient Project-wide Agents; service-account Cells; require
  a live browser session for every durable Task.
- **Revisit:** Non-human enterprise principals only through a new explicit
  authority model with equally strong attribution and revocation.

## D018 — Product, Control-worker, and operator roles are separate

- **Decision:** Product traffic, Control jobs, and privileged infrastructure
  steps use separately wired runtimes and credentials.
- **Grounding:** A Product process that can provision databases, apply DDL, or
  restore backups defeats the intended database-per-Project isolation.
- **Direction:** Product Host serves bootstrap/Product traffic and Project jobs
  using typed `ProductCredentialRef` placement views. Control worker owns
  Control jobs, exact permit-settlement/receipt-proof reconciliation and
  authority-fence fanout using mutually distinct typed
  `PermitSettlementCredentialRef`, `ReceiptProofCredentialRef`, and
  `FenceCredentialRef` targets. The first two can read only one exact proof;
  the fence target permits only the fence mutation plus its same-transaction
  bounded Project Audit. Operator runner owns provisioning,
  migrations, relocation, database/object backup and restore and exposes no
  Product listener or Cells. No generic placement credential crosses graphs.
- **Alternatives:** One all-powerful binary graph; manually operated shell
  scripts; separate network microservice per domain.
- **Revisit:** Deployment packaging may colocate processes in development but
  may not merge production credentials or authority.

## D019 — Activity is projected from retained semantic facts

- **Decision:** The owning mutation transaction writes a bounded safe
  `SemanticFact`; an idempotent projector builds Activity within an explicit
  retained-fact horizon.
- **Grounding:** Activity should be rebuildable without turning logs, Audit, or
  a universal event stream into canonical product coordination.
- **Direction:** Facts contain registered kind, actor/delegation and target
  references, before/after version/state, safe summary, time, and projection
  identity—never Resource bodies, prompts, provider payloads, or secrets.
- **Alternatives:** Write Activity synchronously as canonical state; infer it
  from logs; introduce a universal domain-event runtime.
- **Revisit:** Retention/legal-hold policy must define the advertised rebuild
  horizon before production.

## D020 — Required Audit follows the owning transaction

- **Decision:** Control mutations append Control Audit in the Control UoW;
  Project mutations append Project Audit in the Project UoW.
- **Grounding:** No appender can atomically join two independent databases, and
  Audit is required to commit with the protected effect.
- **Direction:** The domains may share bounded record vocabulary and validators,
  but have separate transaction-bound appenders that never open a second
  transaction. A Control worker's Project fence advance is a Project mutation,
  so the fence-only principal appends its bounded Project Audit record in that
  same Project transaction before acknowledging Control. Central search is a
  projection only.
- **Alternatives:** One Control Audit appender for every mutation; asynchronous
  Audit; logs as Audit.
- **Revisit:** Not expected without a different distributed transaction model.

## D021 — Collaboration owns comments and private Notes

- **Decision:** Collaboration owns comment/private-Note records, operations,
  visibility, and persistence; each Resource family owns only its anchor
  vocabulary, validation, rebase/orphan behavior, and render/export treatment.
- **Grounding:** The collaboration lifecycle is shared product behavior, while
  the meaning of an anchor is family-specific.
- **Direction:** Early Resource stages prove anchor semantics with test doubles;
  the Collaboration stage introduces canonical records and handlers.
- **Alternatives:** Duplicate comment/Note aggregates in every family; a generic
  anchor implementation that understands every Resource payload.
- **Revisit:** Shared pure anchor traits may be extracted only after multiple
  family implementations prove the same mechanics.

## D022 — Ask is transient and Product-read-only

- **Decision:** `quarterback.ask.v1` is read-only against user-visible canonical
  Product content and workflow state; it is not a durable Agent Task.
- **Grounding:** A User asking a question should not silently create or change
  a Resource, Task, Activity, Memory, SemanticFact, job, or tool effect, while a
  real provider call still needs crash-safe spend accounting.
- **Direction:** Ask may query, calculate, retrieve, and infer through a
  registry that excludes Product mutation tools and return cited receipts.
  Provider-backed Ask admission may write only one bounded Intelligence
  reservation, call record, optional continuation envelope, and exact
  `FinalizationRecord` under one exact session-sourced effect permit. Its
  separately typed metering finalizer may later record the receipt and
  terminalize that exact reservation and call generation with required atomic
  Audit—even after session revocation—but cannot call the provider again or
  touch Product state. A
  deterministic/local Ask can
  be literally zero-write. Saving an answer is a separate authorized Chat/
  Resource command. Only explicit Action and Plan intent creates a durable
  sponsored Task.
- **Alternatives:** Persist every Ask as a Task; persist a Chat automatically;
  allow Ask to propose hidden writes.
- **Revisit:** An explicit “retain this research” UX may create a separate
  durable research Task, but cannot change the default Ask contract silently.

## D023 — Explicit durable-work authority and terminal finalization

- **Decision:** Accepted long-running Product work receives an exact bounded
  Control `DurableWorkAuthority`; Project state stores only its receipt. A
  separate exact precommitted finalization contract may close already-admitted
  records after authority loss but can never create a new Product effect.
- **Grounding:** Imports, Resolution, renders, indexing and provider accounting
  must survive process/session loss, while sign-out/revocation must still mean
  no new effects or permits. Requiring a live browser session for recovery
  either loses accepted work or makes settlement impossible.
- **Direction:** Admission preselects Work/Job IDs, scope, operations/targets,
  budgets, generations and expiry. Control creates `PendingProjectReceipt`;
  the initiating Project transaction consumes a session effect permit and
  stores the job/receipt; an idempotent acknowledgement re-reads its exact
  receipt through a least-privilege proof target before activating authority.
  Later canonical effects require fresh work-sourced permits. Current-family
  sign-out preserves accepted work; User-wide/grant/policy revocation fences
  it. Trigger-started standing work uses a separately typed one-use
  `ReceiptBootstrapCredential` only for its exact absent Job and receipt; normal
  session-started admission uses the ordinary session permit. Finalization uses
  a closed versioned target-kind registry—not a generic extension point. V1
  admits only durable Job, Task, Intelligence reservation plus call generation,
  Agent disable, Routine activation/disable, and Project Audit export lifecycle
  transitions. Each kind has its own typed credential and exact transition set;
  unknown kinds and credential substitution fail closed. No finalizer may call
  providers/tools, create or change Resource output, enqueue work, or widen or
  resurrect authority.
  Periodic work additionally requires a finite standing-work delegation with
  exact Project receipt and trusted proof re-read; each trigger consumes bounded allowance
  and creates a fresh pending Work/Job authority. Timers and webhooks grant no
  authority by themselves.
- **Alternatives:** Tie every job to a live session; give workers ambient
  Project authority; allow revoked work to remain forever nonterminal.
- **Revisit:** Extraction into separate workers may change transport, never the
  bounded authority and finalization semantics.

## D024 — Request class is fixed per operation version

- **Decision:** Every versioned operation is permanently a Query or a Command
  with fixed transaction behavior; runtime size, cost, load, caller, or profile
  never changes that class.
- **Grounding:** A Query that silently creates a Job, receipt, artifact, Audit,
  or idempotency state breaks API reasoning, Ask safety, authorization review,
  retry behavior, and testability.
- **Direction:** Queries are bounded and zero-write. If valid work exceeds the
  interactive contract, the Query returns a stable family
  `*_async_required` precondition naming an explicit idempotent durable request
  Command and creates nothing. That Command freezes exact inputs and admits the
  Job/work/Audit/idempotency envelope; a separate Query reports status and typed
  result metadata. Ask sees only the Query registry and cannot auto-upgrade.
- **Alternatives:** One operation chooses synchronous versus asynchronous at
  runtime; queries enqueue hidden work; every potentially large read is always
  a Job.
- **Revisit:** A new operation version may choose a different fixed class only
  with explicit compatibility, authority, and client-behavior review.
