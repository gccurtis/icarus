---
title: "Work Packet — Ω-032 — Complete connector/source lifecycle and upload-vs-connection semantics"
notion_page_id: "3adb6410e50281f3aa7ec34cfa2bc5a7"
notion_url: "https://app.notion.com/3adb6410e50281f3aa7ec34cfa2bc5a7"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 00:09:07Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-032 — Complete connector/source lifecycle and upload-vs-connection semantics

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

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

