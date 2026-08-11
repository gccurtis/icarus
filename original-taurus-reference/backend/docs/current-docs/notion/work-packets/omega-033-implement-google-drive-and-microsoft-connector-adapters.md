---
title: "Work Packet — Ω-033 — Implement Google Drive and Microsoft connector adapters"
notion_page_id: "3adb6410e502816cb7bbf4e1e525db68"
notion_url: "https://app.notion.com/3adb6410e502816cb7bbf4e1e525db68"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 00:09:07Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-033 — Implement Google Drive and Microsoft connector adapters

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="☁️" color="blue_bg">
	**Frozen-baseline provider requirement.** Google/Microsoft adapters implement context-aware paged changes and version-bound point opens. Native cloud documents use provider revision/modified tokens; ordinary files use immutable version/ETag or verified content hash. Same-size/no-hash changes must be detected by opening and hashing. Adapters report claimed and actual bytes, reject version/hash drift with typed errors, and never expose credentials or provider URLs to Project/model inputs.
</callout>
**Type:** Supporting  
**Wave:** 3 — Complete ingestion, retrieval, and connectors  
**Gate:** Project Backend Complete  
**Depends on:** Ω-007, Ω-014, Ω-028–Ω-032  
**Unblocks:** cloud-source backend completion and Ω-044 certification
## Outcome
Omega ships two production-grade read-only Connector Provider adapters:
- Google Drive, including Shared Drives and Google-native document exports;
- Microsoft Graph for OneDrive for Business and SharePoint document libraries.
Both use OAuth with least privilege, opaque credential references, stable
provider item/version IDs, paginated full discovery, incremental change cursors,
streamed content reads, rate-limit handling, revocation/reauthorization, and the
Ω-032 lifecycle. The Project backend depends on a `CredentialBroker` port rather
than owning user/organization identity or token storage.
## Current evidence
Only `local-folder` is accepted as a Connector subkind. The provider factory can
talk to a prototype HTTP watcher, but no cloud OAuth/account, API client, change
cursor, shared-drive/site selection, export policy, token refresh, webhook, or
provider contract suite exists.
## Before and after
```plain text
core/integration/connector/google_drive/
  provider.go oauth.go changes.go export.go errors.go
core/integration/connector/microsoft_graph/
  provider.go oauth.go delta.go content.go errors.go
core/application/connectoraccounts/
  service.go handlers.go
core/wiring/cloud_connectors.go
```
Use direct REST clients plus `golang.org/x/oauth2` (BSD-3-Clause) unless a
provider SDK has a clear, measured benefit. Any SDK must be FOSS, pinned, and
license/SBOM reviewed. No commercial conversion or connector library.
## Scope
- OAuth authorization/callback/revocation and CredentialBroker integration.
- Google Drive file/shared-drive selection, changes cursor, exports/downloads.
- Microsoft tenant/site/drive selection, Graph delta, downloads.
- Stable metadata normalization to Ω-032 Provider Item contracts.
- Streaming, pagination, retries, throttle budgets, status and metrics.
- Typed unsupported/export/extractor outcomes.
## Non-goals
- No Dropbox, Box, email, calendar, write-back, bidirectional sync, or arbitrary
	cloud URL.
- No audio/video and no legacy XLS.
- No organization-admin UI; Ω-040–Ω-041 own final principal/grant/admin surfaces.
- No webhook requirement for V1; bounded polling/delta is sufficient.
## Governing invariants
1. Project Connector rows contain only opaque credential and binding references.
2. OAuth state is single-use, session-bound, expiry-bound, PKCE-protected, and
	redirect-allowlisted.
3. Requested scopes are the least capable read scopes for the selected source.
4. Access/refresh tokens never enter logs, responses, jobs, Connector JSON, or
	lattice metadata.
5. Provider item ID and immutable version/ETag/cTag are canonical; names/paths
	are labels.
6. Delta/change cursors advance only after all page items publish or receive
	explicit durable skip outcomes.
7. Expired/invalid cursors trigger a visible bounded full reconciliation.
8. Token refresh is serialized per credential and safe across worker retries.
9. Rate limits honor provider guidance and remain within Ω-032 retry/cost
	budgets.
10. Provider-native exports are deterministic by recorded export policy and
	retain original provider provenance.
## Google Drive adapter
Use:
- `files.list` for bounded initial inventory;
- `changes.getStartPageToken` and `changes.list` for incremental reconciliation;
- `supportsAllDrives`, `includeItemsFromAllDrives`, `driveId`, and corpora rules
	for Shared Drives;
- `files.get?alt=media` for stored files;
- `files.export` for Google-native formats.
V1 export policy for ingestion:
<table header-row="true">
<tr>
<td>Google native type</td>
<td>Ingestion representation</td>
</tr>
<tr>
<td>Docs</td>
<td>`text/plain` for Text projection; retain provider/source provenance</td>
</tr>
<tr>
<td>Sheets</td>
<td>XLSX routed to Structured Data</td>
</tr>
<tr>
<td>Slides</td>
<td>`text/plain` for Text projection; deck import remains Ω-037</td>
</tr>
</table>
Non-native CSV/XLSX/text/Markdown/images stream unchanged. Unsupported types
produce item diagnostics; they do not vanish.
Minimum OAuth scope should prefer `drive.readonly` constrained by explicit user
selection where product semantics permit. Record exactly why any broader scope
is required.
## Microsoft Graph adapter
Use:
- `/me/drive/root/delta` or selected `/drives/{drive-id}/root/delta`;
- SharePoint `/sites/{site-id}/drives/{drive-id}/root/delta`;
- `/drives/{drive-id}/items/{item-id}/content` for authenticated streamed reads;
- stable `id`, `eTag`/`cTag`, parent reference, deleted facet, and package/file
	facets.
Prefer authenticated Graph `/content` over blindly following
`@microsoft.graph.downloadUrl`. If the short-lived URL is used for performance,
it passes an adapter-owned CDN-origin/IP allowlist and redirect/body policy and
never receives an Authorization header.
Request delegated `Files.Read` for selected personal/work drive sources.
`Files.Read.All` or `Sites.Read.All` requires an explicit tenant/admin policy and
must not be the default.
DOCX/PPTX items may be discovered and downloaded before Ω-035/Ω-037, but
ingestion returns a typed `projector_unavailable` rather than flattening binary
bytes. Final Ω-044 certification reruns the provider matrix after those
extractors land. XLSX routes through Ω-029.
## Credential boundary
```go
type CredentialBroker interface {
    BeginAuthorization(ctx context.Context, req AuthorizationRequest) (AuthorizationURL, error)
    CompleteAuthorization(ctx context.Context, callback AuthorizationCallback) (CredentialRef, error)
    Lease(ctx context.Context, ref CredentialRef, scopes []string) (CredentialLease, error)
    Revoke(ctx context.Context, ref CredentialRef) error
}
```
The Project layer consumes this port. A development broker may persist only
encrypted local test credentials. Production token encryption/secret-provider
implementation is a hard dependency of Ω-042; live cloud production remains
disabled until that broker passes conformance.
## Routes
User-gated account setup:
```javascript
POST /connector-accounts/google/authorize
GET  /connector-accounts/google/callback
POST /connector-accounts/microsoft/authorize
GET  /connector-accounts/microsoft/callback
GET  /connector-accounts
DELETE /connector-accounts/:accountID
```
Project Connector creation uses only returned `credentialRef` and an adapter-
validated source selector/binding reference.
## Ordered implementation tasks
1. Freeze Provider conformance, normalized item/change/error/export schemas, and
	credential boundary.
2. License-review/pin `golang.org/x/oauth2`; build reusable OAuth state/PKCE
	flow and fake broker.
3. Implement Google REST client, drive picker metadata, pagination, full scan,
	changes cursor, downloads/exports, and fixtures.
4. Implement Microsoft Graph client, tenant/site/drive selectors, pagination,
	delta, content reads, and fixtures.
5. Add typed rate-limit/auth/cursor-reset/unsupported/export diagnostics and
	bounded retry.
6. Register adapters through Ω-032 binding registry and route all items through
	Ω-028.
7. Add account routes, redaction, token-refresh serialization, revocation, and
	audit.
8. Add provider contract, adversarial HTTP, recovery, scale, optional live
	smoke, and backend E2E suites.
9. Publish scope/export/retention/admin setup docs and FOSS license record.
## Security, concurrency, jobs, and observability
- OAuth callback validates exact state, issuer/provider, PKCE verifier, session,
	redirect, and expiry.
- Connector selector IDs are validated against the credential's accessible
	drives/sites; caller cannot provide a download URL.
- Provider clients use fixed API origins, safe redirect policies, response/body
	limits, and certificate verification.
- Refresh uses a per-credential lease/singleflight; sync uses per-Connector
	lease. Jobs never serialize tokens.
- Audit account link/unlink, scope set, source selection, reauthorization, and
	sync actor without secret/body content.
- Emit API calls, pages/items/bytes, cursor age/reset, exports, throttles and
	honored delay, refreshes, auth failures, latency, and ingestion receipts/cost.
## Verification
- Provider conformance using `httptest` fixtures; no cloud account required in
	normal CI.
- OAuth CSRF/state replay, wrong session/provider, redirect injection, scope
	escalation, token/log leak, revoked/expired refresh token.
- Pagination and delta/change cursor crash/retry with no missed or duplicate
	item versions.
- Rename/move/delete/shared-drive/SharePoint cases.
- 429/Retry-After, 5xx, timeout, short read, oversized response, malicious
	download redirect.
- Large-drive bounded-memory/load test.
- Optional live smoke in a disposable test tenant/drive with no production data.
- Backend E2E for each provider: authorize, select, initial sync, edit/move/
	delete, incremental sync, revoke, reauthorize, disconnect.
## Migration and rollback
Adapters are additive subkinds registered only when credential/binding
configuration is valid. Existing local connectors do not change. Rolling back
unregisters new creation/sync while retaining Connector/item/cursor rows and
revoking test credentials if requested. Never downgrade token encryption or
reintroduce raw endpoint configuration.
## Completion evidence
- Google and Microsoft provider conformance/security/recovery matrices pass.
- OAuth scope/export policy and tenant/admin requirements are published.
- Backend-only E2E and optional live-smoke receipts are attached.
- Token/log secret scan is clean.
- `golang.org/x/oauth2` and any other dependency have approved FOSS license,
	pinned version, SBOM, and vulnerability review.
## Sources
- Ω-032 Connector/source lifecycle contract
- Taurus Yesod Work Streams — connectors
- [Google Drive export MIME types](https://developers.google.com/workspace/drive/api/guides/ref-export-formats)
- [Google Drive ](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/list)[`changes.list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/list)[ v3](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/list)
- [Microsoft Graph DriveItem delta](https://learn.microsoft.com/en-us/graph/api/driveitem-delta?view=graph-rest-1.0)
- [Microsoft Graph DriveItem content download](https://learn.microsoft.com/en-us/graph/api/driveitem-get-content?view=graph-rest-1.0)
- [Microsoft Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference)
- [`golang.org/x/oauth2`](https://pkg.go.dev/golang.org/x/oauth2)[ package and BSD-3-Clause license](https://pkg.go.dev/golang.org/x/oauth2)
- `core/capability/connector`
- `core/wiring/connector_lattice.go`

