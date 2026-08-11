---
title: "Execute Ω-032 — Complete connector/source lifecycle and upload-vs-connection semantics"
packet_id: "Ω-032"
status: "ready-for-execution"
wave: "Wave 3 — Complete ingestion, retrieval, and connectors"
depends_on: "Ω-007, Ω-009, Ω-014, Ω-015, Ω-028, Ω-029, Ω-030, Ω-031"
source_mirror: "docs/current-docs/notion/work-packets/omega-032-complete-connector-source-lifecycle-and-upload-vs-connection-semantics.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-032 — Complete connector/source lifecycle and upload-vs-connection semantics

## Mission

Omega has a production-grade source lifecycle with an explicit choice between: - **Upload/copy:** Taurus owns an immutable File snapshot; no ongoing external authority or synchronization exists. - **Connection:** Taurus holds an authorized provider binding, tracks stable external item/version IDs, and reconciles new versions into the typed ingestion router. Connector configuration contains opaque administrator-/broker-authorized binding and credential references—not arbitrary server paths or caller-chosen HTTP endpoints. Sync is a durable, Project-safe, retry-bounded job. Delete, disconnect, source deletion, access revocation, and provider revocation retract or retain projections according to one explicit policy.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-007, Ω-009, Ω-014, Ω-015, Ω-028, Ω-029, Ω-030, Ω-031**.

Source dependency statement: Ω-007, Ω-009, Ω-014–Ω-015, Ω-028–Ω-031.

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
- `docs/current-docs/notion/work-packets/omega-032-complete-connector-source-lifecycle-and-upload-vs-connection-semantics.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `core/capability/connector/httpprovider.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/connector/localfolder.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/handlers/connector/connector.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/wiring/connector_lattice.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

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

Source mirror: `docs/current-docs/notion/work-packets/omega-032-complete-connector-source-lifecycle-and-upload-vs-connection-semantics.md`

<callout icon="🔗" color="orange_bg">
	**Frozen-baseline addendum.** Preserve reconciliation semantics even when scheduling it as a durable/coalesced job. Connector owns the durable provider-item catalog: provider item ID, path/name, version/ETag, content hash when available, current immutable FileVersion, tombstone, and projection refs. Knowledge is never the only ID↔path registry. A provider must supply a reliable version/change token or content hash; if neither exists, Omega opens and hashes the item and never declares “unchanged” from path+size. Add context-aware, version-bound point `Open` for ingestion and `resource.read`.
</callout>
**Type:** Supporting  
**Wave:** 3 — Complete ingestion, retrieval, and connectors  
**Gate:** Project Backend Complete  
**Depends on:** Ω-007, Ω-009, Ω-014–Ω-015, Ω-028–Ω-031  
**Unblocks:** Ω-033 and production connector use
## Outcome
Omega has a production-grade source lifecycle with an explicit choice between:
- **Upload/copy:** Taurus owns an immutable File snapshot; no ongoing external
	authority or synchronization exists.
- **Connection:** Taurus holds an authorized provider binding, tracks stable
	external item/version IDs, and reconciles new versions into the typed
	ingestion router.
Connector configuration contains opaque administrator-/broker-authorized
binding and credential references—not arbitrary server paths or caller-chosen
HTTP endpoints. Sync is a durable, Project-safe, retry-bounded job. Delete,
disconnect, source deletion, access revocation, and provider revocation retract
or retain projections according to one explicit policy.
## Current evidence
- `connectorProviderFactory` treats any non-HTTP configured string as a local
	server filesystem root and any `http(s)` string as a watcher endpoint.
- `localfolder.Snapshot` recursively `WalkDir`/`os.ReadFile`s the chosen path.
- `httpProvider` performs unrestricted HTTP GET with redirects and no host/IP
	admission or decoded-body cap.
- `Configure` accepts any non-empty string; connector handlers do not enforce
	`Role.CanWrite`, and `dispatchScoped` classifies execution but does not
	authorize it.
- Therefore the reviewed baseline allows a selected-Project member to attempt
	arbitrary host filesystem reads or SSRF and ingest results.
- Ω-007 is the immediate exploit-closure packet. Ω-032 must preserve those
	controls while replacing the prototype configuration/lifecycle permanently.
- Current detection is an in-process periodic loop; sync state tracks retry
	failure/needs-attention but jobs are not the durable lifecycle authority.
## Before and after
```plain text
Before
Connector{SubKind, Path, Fingerprint, retry state}
  → path scheme dispatch
  → in-process detector and sync

After
Connector
  ├── SourceBindingRef (opaque, allowlisted)
  ├── CredentialRef (opaque broker handle)
  ├── sync policy/cursor/state
  └── stable ConnectorItems

Source acquisition
  ├── UploadedSnapshot → File source, immutable
  └── ConnectedSource  → provider manifest/version readers
```
## Scope
- Acquisition-mode contract and UI-facing explanations.
- Connector/binding/item/sync state models.
- CredentialBroker/SourceBindingRegistry ports.
- Durable reconciliation/sync jobs and stable item identity.
- Per-format routing through Ω-028.
- Disconnect/delete/tombstone/revoke/retry/reauthorize lifecycle.
- Upload import/copy routes and lineage.
- Permanent filesystem/SSRF/authorization/secret controls.
## Non-goals
- Provider-specific Google/Microsoft behavior is Ω-033.
- No arbitrary “custom URL” connector.
- No direct external-source write-back in V1.
- No Dropbox in this packet set.
- No audio/video or unsupported-format coercion.
## Governing invariants
1. Project data never grants authority to a host path, URL, or credential.
2. Only the SourceBindingRegistry can turn an opaque binding ID into an endpoint
	or local watcher channel.
3. Readers cannot create/configure/sync/disconnect; explicit
	`connector.manage` authorization is required.
4. Credentials are opaque references resolved by infrastructure and never
	returned/logged/stored in connector JSON.
5. Provider item ID + version, not path/name, is canonical external identity.
6. Rename/move retains identity; delete creates a tombstone and retracts current
	projections atomically/eventually with visible status.
7. A sync publishes only complete source-version projections and advances its
	cursor only after all accepted items commit.
8. Retried syncs are idempotent and never repeat completed projection spend.
9. Upload/copy never silently becomes a live connection; connection never
	silently copies ownership semantics.
10. Revocation stops future reads immediately and surfaces stale/current status.
## Core model
```go
type AcquisitionMode string
const (
    AcquisitionUpload     AcquisitionMode = "upload"
    AcquisitionConnection AcquisitionMode = "connection"
)

type Connector struct {
    ID, ProjectID, Name string
    ProviderKind        string
    BindingRef          string
    CredentialRef       string
    State               string // draft | validating | ready | syncing |
                               // degraded | needs_attention | revoked | disconnected
    Cursor               string
    SyncPolicy           SyncPolicy
    LastReceiptID        string
    CreatedBy            string
    CreatedAt, UpdatedAt time.Time
}

type ConnectorItem struct {
    ID, ProjectID, ConnectorID string
    ProviderItemID, VersionID   string
    ParentProviderID, Path, Name string
    MIMEType, Extension          string
    SizeBytes                    int64
    ContentHash                  string
    State                        string // current | deleted | unsupported | failed
    ProjectionRefs               []ProjectionRef
}
```
Ports:
```go
type SourceBindingRegistry interface {
    Resolve(ctx context.Context, actor Actor, bindingRef string) (AuthorizedBinding, error)
}

type CredentialBroker interface {
    Resolve(ctx context.Context, actor Actor, credentialRef string) (CredentialLease, error)
}

type ConnectorProvider interface {
    Changes(ctx context.Context, cursor string, page Page) (ChangePage, error)
    Open(ctx context.Context, itemID, versionID string) (io.ReadCloser, ItemMeta, error)
}
```
## Persistence and routes
Add `connector_items`, `connector_sync_runs`, and encrypted/opaque configuration
metadata; evolve `connectors.path` to `binding_ref`, `credential_ref`,
`provider_kind`, `state`, `cursor`, and policy. Never place access tokens in
these tables.
```javascript
POST /source-imports                    # upload/copy
POST /connectors
GET  /connectors
GET  /connectors/:connectorID
PUT  /connectors/:connectorID/binding
POST /connectors/:connectorID/validate
POST /connectors/:connectorID/sync
POST /connectors/:connectorID/reauthorize
POST /connectors/:connectorID/disconnect
DELETE /connectors/:connectorID
GET  /connectors/:connectorID/items
GET  /connectors/:connectorID/sync-runs/:runID
```
## Ordered implementation tasks
1. Confirm Ω-007 exploit closure and turn its negative tests into permanent
	connector conformance tests.
2. Freeze acquisition, binding, credential, item, sync, retention, and error
	contracts.
3. Add SourceBindingRegistry/CredentialBroker ports and remove path-scheme
	dispatch from Project data.
4. Add ConnectorItem/sync-run persistence and migrate retry/health fields.
5. Move detection to a scheduler that enqueues coalesced durable Project-scoped
	sync jobs; implement cursor and lease recovery.
6. Reconcile manifests by stable provider ID/version; route each accepted item
	through Ω-028 and aggregate receipts/skips/cost.
7. Implement upload/copy lineage and connection lifecycle/retraction policies.
8. Add management authorization, undisclosing reads, secret redaction, SSRF and
	watcher mutual-auth controls.
9. Add routes, status/live events, observability, recovery/load/security E2E,
	and companions.
## Security, concurrency, jobs, and observability
- Local folders are served only through an administrator-installed watcher with
	an allowlisted root and authenticated channel; production Omega never walks a
	caller-selected server path.
- Network bindings enforce allowed HTTPS origin, DNS/IP policy, redirect policy,
	re-resolution checks, timeouts, manifest/body/item limits, and mutual
	authentication/signature where applicable.
- Secret values are redacted at serialization and logging boundaries.
- One sync lease per Connector; cursor/checkpoint publication is transactional
	with run outcome. Provider rate limits honor `Retry-After`.
- Emit connection health, cursor age, items discovered/changed/deleted/skipped,
	projection receipts by class, bytes, tokens/cost, retry/needs-attention,
	revocation, and safe errors.
## Verification
- Permanent negative tests for read-only mutation, arbitrary path, traversal,
	symlink escape, loopback/private/link-local/metadata-service URL, DNS
	rebinding, redirects, oversized manifest/body, token leakage.
- Stable item identity across rename/move and cursor reset/full reconcile.
- Crash before/after item publish and cursor advance; no missed/double sources.
- Upload versus connection retention/revocation matrix.
- Delete/disconnect/provider delete retracts every relevant lattice projection.
- Load/rate-limit/backoff and multi-Project isolation.
- Backend E2E: upload copy; connect watcher binding; initial/incremental sync;
	move/delete item; revoke/recover; inspect receipts.
## Migration and rollback
Raw `path` records are never automatically trusted. Mark them
`needs_reconfigure`; an administrator may map a known watcher endpoint to an
approved binding. Ω-007 keeps unsafe resolution disabled during migration.
Legacy indexed content remains labeled stale until revalidated or removed.
Rollback must not re-enable raw path/URL behavior.
## Completion evidence
- No production code selects a provider from a caller-controlled path scheme.
- Connector management authorization and SSRF/filesystem security suites pass.
- Durable sync recovery and lifecycle/retraction E2E pass.
- Secret scan/log inspection shows no credential disclosure.
- Upload/connection semantics are published for Alpha.
## Sources
- [Current connector factory](https://github.com/gccurtis/taurus-omega/blob/b8ba4aa05974ff21746f14b71acaf09117d38dcf/core/wiring/connector_lattice.go)
- [Current local-folder provider](https://github.com/gccurtis/taurus-omega/blob/b8ba4aa05974ff21746f14b71acaf09117d38dcf/core/capability/connector/localfolder.go)
- [Current HTTP provider](https://github.com/gccurtis/taurus-omega/blob/b8ba4aa05974ff21746f14b71acaf09117d38dcf/core/capability/connector/httpprovider.go)
- [Current connector handler](https://github.com/gccurtis/taurus-omega/blob/b8ba4aa05974ff21746f14b71acaf09117d38dcf/core/handlers/connector/connector.go)
- Ω-007 and Ω-028–Ω-031
---

