# Taurus Omega glossary

This glossary defines canonical Omega language. Product and capability pages
should link here rather than inventing near-synonyms. Original Taurus and Nova
terms are retained only when their meaning is compatible with Omega.

## A

**Action** — A Quarterback mode that requests one bounded mutation under the
same authority, permit, version, Audit, and review rules as a direct User
command. High-risk actions still require pre-approval.

**Activity** — A user-facing projection of meaningful Project actions and task
progress, rebuildable within the retained Semantic Fact horizon. Activity is
not required Audit and is not canonical Resource state.

**Agent** — A non-human secondary actor whose authority principal, status,
grants, and generations are Control-owned while display/persona/tool
configuration and work state are Project-local. Agent work is sponsored by a
User through approved operations; Agent is never a Cell-key substitute or
privileged mutation path.

**Artifact** — A durable derived value with exact input/evidence versions,
policy, derivation identity, status, and provenance. A Knowledge artifact is
not the same as a file object or an export artifact.

**Ask** — A Quarterback mode that is read-only against user-visible Product
content and workflow state. It may retrieve, calculate, and infer but cannot
create Resource, Task, Activity, Memory, Semantic Fact, durable job,
ChangeGroup, or tool effects. Provider-backed Ask may admit only one bounded
Intelligence reservation, call record, optional continuation envelope, and
exact `FinalizationRecord` under an exact permit and atomic Audit. The separately
typed finalizer may later record the provider receipt and terminalize that exact
reservation and call generation, but cannot call the provider again. Saving the
answer is a separate command.

**Attempt** — One execution try within a Task step, provider call, tool call,
login transaction, or other retryable boundary. Attempts have their own
identity and outcome; a Task remains the stable user-visible intent.

**Audit** — Canonical security attribution that commits atomically with its
protected effect in the same Control or Project transaction. Audit is distinct
from logs, telemetry, Activity, and change history.

## B

**Base** — For a Document, the compact canonical content snapshot beneath an
ordered stack of Document ChangeSets. A base has an immutable identity/version;
compaction creates a new base without erasing required history.

**Board** — A Resource family for freeform whiteboards and dashboard canvases,
including shapes, connectors, embeds, frames, views, and Board-specific
concurrency.

**Bound Cell** — A disposable in-process runtime object immutably scoped to one
`(UserID, ProjectID)`. It owns interactive admission, scheduling, dispatch,
handlers, and instance-local caches—not canonical truth.

## C

**Capability** — An independently testable Go library that owns serializable
domain types, invariants, commands, queries, pure transformations, stable
errors, and narrow consumer-owned ports. It is not an autonomous process,
mailbox, queue, database, or transport.

**Canonical state** — The authoritative durable representation from which
projections can be rebuilt. Control state lives in the Control Database;
Project Resource state lives in that Project's Project Database.

**Cell instance** — One allocation of a Bound Cell, identified by a disposable
`CellInstanceID`. Multiple independent instances may have the same Cell key.

**Cell key** — The immutable authority scope `(UserID, ProjectID)` injected by
trusted Host placement. Request payloads cannot choose or replace either part.

**ChangeGroup** — A user-reviewable grouping of one or more already-authorized
Resource changes produced by an Action, Plan, or Agent task. It does not create
cross-capability atomicity.

**Chat** — A Project Resource family for threaded conversation, attachments,
grounded responses, and promotion of selected outputs into other Resources.

**Command** — A versioned operation that may change canonical state. A command
is authorized, idempotent where retried, validated against the owning
capability's concurrency model, and audited where required.

**Control** — The authoritative product domain for identity, sessions, Users,
Organizations, Project ownership/grants/lifecycle, entitlements, placement,
one-use permits, revocation, and Control-local Audit.

**Control Database** — Durable central truth for Control. It never stores
canonical Project Resource content.

**Control worker** — A separately wired runtime for Control-owned jobs and
authority-fence fanout. It has no Product listener, Cells, DDL authority, or
general Project Resource-content access.

**Corpus** — An authorized, Project-scoped collection of exact-version Sources
eligible for Knowledge retrieval under explicit policy.

## D

**Data Object** — A governed canonical Project data asset with stable schema,
data, field, provenance, review, and lineage versions. It is initially outside
the six common Resource families and is projected by the Data Catalog.

**Data catalog** — A Project capability that catalogs structured data objects,
named tables, schemas, ownership, and lineage while leaving underlying family
content with its canonical owner.

**Deck** — A Resource family containing Slides, layouts, elements, speaker
notes, themes, and Deck-specific presentation/export behavior.

**Decision** — A durable, inspectable conclusion made during Resolution or
agent work, with alternatives, evidence, rationale, confidence, and effect on
the result. Do not use this word for an undocumented implementation choice.

**Document** — A structured Resource family containing ordered blocks, inline
or display content, marks, provenance, collaboration-anchor semantics, prompt
blocks, Formula consumers, outline/sections, and Document-specific concurrency/
rendering. Collaboration owns comment and private-Note records.

**Durable sponsorship** — A Control-owned bounded, expiring authority record
for exactly one Action/Plan Task and sponsoring User in one Project. It binds
Task ID, User, Project, Agent/tool/policy generations, allowed operations,
targets/scope, budget ceiling, expiry, and revocation generation and never
creates an Agent-only Cell. It begins pending until the exact Project Task/
receipt commit is acknowledged. Project-owned Task generation remains in the
Project Database. The Project receipt grants no authority by itself.

**Document ChangeSet** — An immutable, ordered set of Document operations based
on a known head/base. It has stable identity, actor, provenance, preconditions,
and conflict/reconciliation semantics owned only by Documents.

**Durable job** — Restartable asynchronous work represented in durable state.
Its record is created atomically with the effect that requires it, and workers
use leases, fencing, idempotency, cancellation, and bounded retry.

**Durable work authority** — A bounded Control record for one accepted non-
Agent Work/Job identity, sponsor, Project, operations/targets, budgets,
generations and expiry. It is unusable while pending Project receipt; once the
exact Job/receipt is acknowledged, each later canonical effect still requires
a fresh work-sourced permit. A lease or job payload is not authority.

## E–H

**Entitlement** — A Control-owned product capability or quota grant evaluated
separately from authorization. Unknown, expired, or unavailable entitlement
state fails closed.

**Execution** — Runtime context for one admitted operation or Task run,
including injected Cell scope, actor/delegation, deadline, budget, trace,
idempotency, and nested-dispatch depth. It is not persisted inside capability
state.

**File** — A Resource family for uploaded or connector-received binary/text
objects, immutable/versioned object references, metadata, integrity, previews,
extraction status, and source registration. “File” is not a generic wrapper for
Documents, Workbooks, or Decks.

**Finalization record** — An exact Project-owned precommit binding one already-
admitted target to one kind and transition in the closed versioned
`FinalizationTargetKind` registry. V1 contains only durable Job, Task,
Intelligence reservation/call generation, Agent disable, Routine lifecycle,
and Project Audit export lifecycle. Each kind has a non-interchangeable
credential and exact transition set. Unknown kinds fail closed. A finalizer
cannot obtain a permit, invoke providers/tools, create or change Resource
output, enqueue work, widen scope/budget, or revive authority.

**Formula** — A pure capability for typed expressions, environments, named
formulas/tables, dependency evaluation, errors, and explainability. Resource
families own their Formula slots and presentation.

**Handler** — The environmental adapter for a versioned operation. It checks
authority, loads repositories, calls capability code, obtains a fresh mutation
permit, opens/commits transactions, handles idempotency/jobs/Audit, maps
providers, and constructs transport-neutral responses.

**Head** — The canonical current Document history position identifying the
base and ordered ChangeSets materialized by a read. Clients mutate against a
known head, not an implicit last-seen in-memory copy.

**Host** — The Product-serving Omega application role. It owns bootstrap,
Control access, trusted Project placement, Cell lifecycle, outer capacity,
Project Product-job supervision, technical facilities, and shutdown/readiness.
It has no operator authority.

## I–L

**Idempotency key** — A caller-provided or internally stable identity used to
return the exact prior outcome of a retried command and reject conflicting
reuse. It is scoped to the operation and authority domain.

**Intelligence** — Provider-neutral Embedding, Inference, and Reasoning
capabilities plus routing policy, serviceability, receipts, usage, budgets, and
sanitized failures. Provider clients are handler adapters, not domain state.

**Knowledge** — The inference-free Project capability that ingests eligible
exact-version Sources, builds retrieval structures, returns grounded evidence,
tracks artifacts/dependencies/staleness, and can report insufficiency. Knowledge
does not invent conclusions.

**Knowledge lattice** — One replaceable retrieval/index structure over
Knowledge windows. It is an implementation of retrieval, not the canonical
Source corpus or an independent product authority.

**Lease** — A bounded worker claim on a durable job. Lease expiry/reassignment
must not allow a stale worker to commit an effect.

## M–P

**Memory** — Evidence-linked, scoped behavioral learning used to shape future
Agent context. Memory is not Knowledge, canonical fact, or permission.

**Organization** — The single administrative and identity home of a User. A
Project has one home Organization, but Project access is evaluated through
explicit User grants.

**Owner** — The exactly one User with final Project ownership authority.
Delegated roles cannot silently replace, demote, or multiply the owner; only
the owner may finally delete the Project.

**Operator runner** — A separately wired, non-Product runtime for bounded
provisioning, migration, relocation, backup, and restore steps under privileged
credentials. It exposes no Product listener or Cells.

**Permit** — A short-lived signed one-use Control authorization for an exact
User, Project, action, Resource/operation, authority generations, and expiry.
Its trusted authority source is exactly one current session family, one exact
durable-work authority/Job, or one exact Task sponsorship/Task. The Project
transaction validates and consumes it against mutable local fencing immediately
before committing an ordinary protected effect; a Job, Task, lease or receipt
cannot mint one.

**Permit consumption proof** — An immutable Project row written atomically with
permit consumption and the protected effect. It binds the exact permit digest,
Project and placement generation, effect/idempotency commit identity, and commit
time. Trusted Control settlement re-reads this row through the exact read-only
settlement target. It is evidence of an already committed effect, not authority.

**Persona** — A versioned Agent behavior overlay: focus, standing
instructions, output preferences, and verification defaults. A Task snapshots
the Persona version it uses.

**Plan** — A Quarterback mode that creates an inspectable versioned execution
plan for approval, then runs the approved revision as bounded steps.

**Projection** — A rebuildable or replaceable view of canonical state, such as
browser state, Workspace summaries, search, Activity, or realtime hints. A
projection cannot authorize or replace its source.

**Project** — The primary collaboration and content boundary. It has one home
Organization, one User owner, explicit User grants, one logical Project
Database, trusted placement, lifecycle, and Project-local authority fence.

**Project Database** — The logical database containing exactly one Project's
canonical Resources, Project idempotency, required Audit, consumed permits,
immutable permit-consumption/authority-receipt proofs, authority fence, and
Project-owned durable jobs.

**Project placement** — Trusted Control metadata that maps an active Project
to its engine, cluster/database/credential references, schema version, fence,
region/tier, and placement generation. Requests cannot supply placement.

**Prompt block** — A Document-owned block whose source prompt, visible output,
generated result, evidence, decisions, status, history, provenance, and
staleness are distinct. It consumes Resolution through a Document-owned port.

**Provider receipt** — A minimized, provider-neutral record of a provider call:
route/model identity, normalized timing/usage, policy, status, and safe error
attribution. It excludes secrets and raw transport objects.

## Q–S

**Query** — A versioned read operation that passes current authority and bound
scope but does not consume a mutation permit or commit an effect.

**Quarterback** — The product interaction surface for Ask, Action, and Plan. It
orchestrates explicit operations but is neither a privileged authority path nor
the owner of Resource truth.

**Reconciliation** — Capability-owned logic that compares a proposed change to
the latest canonical version and either applies, transforms, or rejects it
with an explicit conflict. There is no universal reconciliation algorithm.

**Receipt bootstrap credential** — A separately typed signed one-use security
transition issued only when an active standing-work or Routine delegation
admits a trigger without a session. It can create only the preselected exact
absent Job or Task plus its matching non-authoritative receipt and prescribed
admission bookkeeping. It is not an ordinary effect permit, cannot authorize a
later effect, and does not add a fourth permit source.

**Receipt proof** — A bounded Project row proving that one exact Work, Task,
Routine, standing-work, or Agent-principal receipt committed at the expected
placement generation and digest. Activation and lost-ack reconciliation re-read
it through a dedicated least-privilege credential; caller assertions and other
runtime credentials are not proof.

**Resolution** — A governed capability that turns intent plus exact Knowledge
evidence into a plan, reasoning steps, decisions, and a sealed result. It may
use Intelligence but keeps provider details outside the domain; the consuming
Resource family owns editable and last-good output.

**Resolution output** — User-editable material accepted into a Resource. It is
separate from the sealed Resolution result so edits do not rewrite evidence.

**Resolution plan** — The versioned proposed sequence, evidence needs, policy,
and approval points for a Resolution run.

**Resolution result** — The sealed provider-neutral conclusion and generated
material with exact evidence, decisions, receipts, and provenance.

**Resource** — A Project-owned product object with common identity/lifecycle
metadata and a family-specific canonical model. “Resource” is taxonomy and
metadata, not a generic payload or implementation package.

**Session family** — The lineage of an opaque browser session across rotation.
Predecessor replay revokes the family. Current-family sign-out ends that
family's interactive authority but preserves separately issued explicit durable
sponsorships/work authorities and finite delegations; User-wide sign-out also
revokes and fences every active User-sponsored authority before reporting
effective.

**Standing delegation** — A finite Control-owned Routine authority ceiling
binding sponsor, Project, Routine version, Agent/tool generations, admitted
trigger, allowed operations/targets/scope, per-run and cumulative budgets,
maximum runs, validity window, and revocation generation. Each admitted run
requires a fresh exact Task sponsorship; the Project receipt is not authority.

**Standing work delegation** — A finite Control-owned non-Agent periodic-work
ceiling for one exact Project subscription, trigger class, operations/targets,
budgets, run count, generations and expiry. It activates only after the matching
Project receipt is acknowledged; every trigger consumes allowance and creates a
fresh exact Work/Job authority. A timer or webhook grants nothing.

**Semantic Fact** — A bounded safe record written by the owning mutation
transaction so authorized Activity/search projections can be rebuilt within a
declared retention horizon. It is not a command bus, Audit, or canonical domain
reconstruction stream.

**Slide** — An ordered presentation unit inside a Deck; not a top-level backend
family.

**Source** — An authorized, exact-version input eligible for Knowledge or
provenance: a Resource version, File version, connector capture, or derived
artifact. A mutable URL alone is not a Source version.

## T–Z

**Task** — The stable, durable record of an explicit Action/Plan goal, sponsor,
scope, policy, state, plan revision, approvals, attempts, verification, and
resulting ChangeGroup. One Task may have many executions or attempts; ordinary
Ask creates no Task.

**Task sponsorship receipt** — A Project-local reference and digest proving
which Control durable sponsorship was paired with an exact Task. It is required
alongside current Control authority for sponsored effects but grants no
authority by itself.

**Template** — A family-owned versioned starting configuration for creating a
Resource. There is no generic Template capability; Documents, Workbooks,
Decks, and Boards define their own Template semantics. Chat starters are
settings presets, and Files has no Template.

**Translation** — The capability boundary for validated conversion between
external formats and family-owned canonical import/export contracts. It does
not own the resulting Resource.

**Unit of Work (UoW)** — One atomic transaction in a single authority domain.
For Project mutations it includes permit consumption, state, idempotency,
required Audit, and any required durable job record.

**User** — A Taurus human principal linked to external identities and belonging
to exactly one Organization. Project access is evaluated for the User, not
inferred from a browser, email address, or active Organization selector.

**User Workspace** — The per-User/per-Project view model containing permanent
destinations, open Resource tabs, active durable view, and panel preferences.
Hover, selection, launcher progress, requests, and clients are transient.

**Workbook** — A Resource family containing Worksheets, cells, ranges, tables,
Formula bindings, formats, analysis, and Workbook-specific concurrency.

**Working context** — A bounded, inspectable assembly of selected Resources,
Sources, prior results, Memory, and policy used for one interaction or Task.
It is not a hidden global conversation state.

**Worksheet** — A grid-bearing unit within a Workbook; not a top-level backend
family.

## Discouraged or historical terms

- **Service**: use only for an externally deployed role or a type literally
  named `Service` in cited evidence. Omega product domains are capabilities.
- **Edge**: say transport, Host bootstrap, or Product handler; “edge” does not
  identify ownership.
- **Use case layer**: say handler or explicit flow. Cross-capability behavior is
  implemented through consumer-owned ports and bounded nested dispatch.
- **Shared Cell**: invalid. A Cell is always bound to one User and one Project.
- **Generic Resource content/template**: invalid. Families own content and
  templates.
- **Event** as universal truth: invalid. Use the owning capability's ChangeSet,
  state transition, immutable record, or optional notification as appropriate.
