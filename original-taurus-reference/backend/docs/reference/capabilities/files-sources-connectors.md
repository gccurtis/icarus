# Files, Sources, and connector intake

## Purpose and boundary

This page defines the external-content intake chain without collapsing three
different authorities:

1. **Files** is a Resource-family capability. It owns File metadata, immutable
   content versions, safe lifecycle, exact-version preview/extraction records
   and File-specific operations.
2. **Sources** is Knowledge-owned identity and acquisition state for an exact
   version of any Resource family. Files exposes an exact-version extraction;
   it does not own the Knowledge source ledger or index.
3. **Connectors** cross two explicit domains. The Control connector domain owns
   data consent, connection identity, credential references, and revocation.
   The Project connector capability owns subscription, mapping, continuation,
   and intake state that maps exact external items to Project File versions.
   Provider clients remain outside capability packages.

This separation lets local upload ship before any provider connector and keeps
Google/Microsoft sign-in distinct from Drive, OneDrive/SharePoint or Outlook
Mail/Calendar data consent.

### Files owns

- File identity, name, lifecycle, representation version, media classification
  and ordered immutable content versions.
- Exact object reference/integrity metadata, uploader/import provenance,
  quarantine/scan state and safe-serving eligibility.
- Versioned preview, rendition, extraction and description records whose input
  is one exact File version.
- Upload/version state transitions, File-specific metadata,
  download/preview/extraction projections and stable errors. Files has no
  Template model or Template operations.

### Files does not own

- Object bytes in a database, provider credentials, presigned URLs as authority,
  scanner/parser/OCR clients, Knowledge indexes, source staleness, connector
  consent, SQL, jobs, sessions, authority, required Audit or browser upload
  buffers.
- Editable semantics for Documents, Workbooks, Decks or Boards. Import may
  create those Resources through Translation and their own commands; the
  original File remains an independently versioned source.
- Generic arbitrary-file execution. Unknown types can be stored safely without
  becoming previewable, extractable or trusted.

## Supported feature contract

| Area | Feature | Required behavior and owner |
| --- | --- | --- |
| Files | Local/direct upload | Bounded resumable/staged upload, server-declared digest/size/media policy, idempotent completion and no trust from filename alone |
| Files | Multi-file and folder intake | A durable UploadBatch owns independently retryable items, aggregate progress and partial success; normalized relative paths are organization hints only and never storage paths |
| Files | Immutable versions | Every accepted byte change creates a FileVersion; original bytes never mutate in place |
| Files | Metadata/lifecycle | Rename, description/tags, current-version pointer, archive/restore/tombstone and retention state use explicit revisions |
| Files | Integrity and scanning | Digest/size verification, media sniffing and malware/content policy gate before trusted download/preview/ingestion |
| Files | Preview/renditions | Safe exact-version image/PDF/text/media thumbnails or normalized renditions; derived output never replaces original |
| Files | Extraction/OCR | Exact-version parser/OCR/table/image-description output with method/version/provenance/confidence and bounded content |
| Files | Download | Reauthorize exact File/version on every request, then stream or issue a narrow short-lived delivery capability |
| Files | Import | Explicit Translation can create a target family Resource and retain source File/version/loss/provenance link |
| Files | Export | Other families create immutable export File versions with exact source versions and loss report |
| Files | Native and standing derivation | Static native targets are governed Translation outputs; standing targets are Resolution hosts over exact FileVersion addresses, while Files exposes only typed lineage/status projections and never owns target content or refresh authority |
| Sources | Stable source identity | Knowledge records SourceID, family, ResourceID, exact version/digest, dirty/watermark/removal and acquisition status |
| Sources | Authorized acquisition | Knowledge calls the owning family's extraction query for the exact authorized version; no direct table access |
| Sources | Provenance/staleness | Derived artifacts retain source/version/anchor; newer source version marks old projections stale without rewriting history |
| Connectors | Separate consent | External-data OAuth scopes/tokens are independent of identity login, minimal, revocable, audited and stored only through secret references |
| Connectors | Provider catalog | Explicit provider/kind/version, admitted tenant/authority and supported item types; unknown provider/config fails closed |
| Connectors | Incremental intake | Provider item IDs/version/etag/digest and provider continuation state map idempotently to exact File versions |
| Connectors | Full reconciliation | Bounded rescan repairs missed/expired incremental state and handles changes/deletions according to explicit policy |
| Connectors | Webhook/polling | Notifications are verified hints that enqueue authorized reconciliation; they do not carry Product authority or canonical content |
| Connectors | Outlook/Google data | Outlook Mail/Calendar, OneDrive/SharePoint and Drive are separately scoped connector adapters; sign-in scopes never imply data access |

## Files canonical domain model

| Type | Required content and invariant |
| --- | --- |
| `File` | `FileID`, name, description/tags, lifecycle, representation version, current FileVersionID, metadata revision and trusted attribution |
| `FileVersion` | Immutable VersionID/ordinal, opaque ObjectRef, byte size, cryptographic digest/algorithm, declared and detected media type, creation/import provenance and eligibility state |
| `UploadIntent` | Stable intent/idempotency identity, expected bounds/type/digest when known, staging reference, state/generation, expiry and intended File/new-version target; no secret URL |
| `UploadBatch` | Durable BatchID, Project-bound actor attribution, safe logical root label, declared item/byte totals, accepted totals, aggregate state/progress, cancellation state, expected revision, idempotency identity, creation/expiry and bounded terminal counts; it contains no bytes, object keys or signed URLs |
| `UploadBatchItem` | Stable ItemID and client item identity within one Batch, normalized relative folder path, display filename, declared size/type/digest, UploadIntent/generation, resulting exact File/FileVersion when committed, phase/progress, retry generation, safe failure and terminal outcome |
| `UploadBatchProgress` | Monotonic server-observed transferred/verified byte and item counts by phase plus terminal counts (`ready`, `duplicate`, `rejected`, `failed`, `cancelled`); aggregate display never estimates canonical completion from client-only progress |
| `ContentDisposition` | `pending`, `scanning`, `ready`, `quarantined`, `rejected` plus versioned safe reason category/policy version; only `ready` is trusted-serving eligible |
| `Rendition` | Exact input FileVersion, kind/format, opaque object ref, digest/size/dimensions, generator/policy version, state/generation and warnings |
| `Extraction` | Exact input FileVersion, extraction kind/schema, normalized bounded content object/ref, method/version, provenance/confidence, state/generation and warnings |
| `ImportLink` | Exact source FileVersion, target family/Resource/version, translator/version and accepted loss report |
| `ExportLink` | Exact source Resource/version set, output FileVersion, translator/version and loss report |
| `FileProjection` | Exact metadata revision and requested version/rendition/extraction fields; omission is explicit |

Opaque object references identify durable data but never establish permission.
File names are display metadata; path separators/control characters are
normalized or rejected and never select server filesystem paths. Digests use
an approved explicit algorithm and cover the exact stored bytes.

An UploadBatch starts `accepting`, becomes `processing` when its declared item
manifest is complete, and settles as `succeeded`, `partial`, `failed`, or
`cancelled`. Items move through `registered -> transferring -> staged ->
verifying -> quarantined -> scanning -> ready`, with explicit terminal
`duplicate`, `rejected`, `failed`, or `cancelled` outcomes. A retryable failure
also records a bounded safe reason and `retryable=true`; callers never infer
retryability from an error string. `partial` means at least one item produced a
ready or explicit duplicate outcome and at least one item failed, was rejected,
or was cancelled. Batch cancellation with already committed siblings therefore
settles `partial`; it never rolls those Files back.

`RelativeFolderPath` is UTF-8, Unicode NFC-normalized, slash-separated and relative
to the Batch's display-only logical root. The server rejects empty segments,
`.`/`..`, leading or trailing separators, drive/UNC/URI/tilde prefixes,
backslashes, control or bidi-override characters, overlong/deep paths, and
NFC-equal path collisions within the Batch. It never strips a dangerous prefix into a
different accepted path, never chooses a server path/object key, and never
confers hierarchy or access. The File catalog may preserve it as safe
organization metadata.

## Source and connector records

These records are not persisted in the Files model, but their boundary is
fixed here so implementations do not smuggle them into File metadata.

| Authority | Record | Required content |
| --- | --- | --- |
| Knowledge / Project DB | `Source` | SourceID, family, exact Project Resource/File ID and version, canonical digest, dirty/watermark/removal state and acquisition generation |
| Knowledge / Project DB | `SourceAcquisition` | Exact source/version, extractor contract/version, normalized artifact refs/anchors, outcome and lineage |
| Connector domain / Control transaction domain | `ConnectorProvider` | Admitted provider/kind and adapter-contract version, exact authorities/tenant modes, supported item kinds/scopes/callback modes, policy state and safe display metadata; no SDK/client value |
| Connector domain / Control transaction domain | `ConnectorConnection` | Administrative subject/scope, provider/kind, admitted tenant/authority, granted scopes, credential SecretRef/key version, consent/expiry/revocation state and policy generation |
| Project DB | `ConnectorSubscription` | Project-bound stable ID, Control connection ref, provider root/query, intake policy, target mapping, state/generation and last successful reconciliation |
| Project DB | `ExternalItem` | Provider item identity, parent/location metadata, provider version/etag/digest, observed/deleted state and exact resulting FileID/FileVersionID |
| Project DB | `ConnectorContinuation` | Opaque encrypted/provider continuation reference or bounded token, adapter contract version, generation and expiry; it is not a cross-product ordering mechanism |
| Project read model | `FileDerivedTargetProjection` | Exact source FileVersion/addresses, static-or-standing mode, owning Translation run/plan digest, destination family/Resource/version, optional exact ResolutionHostRef, fidelity and safe status; it is rebuilt from owner facts and grants no mutation or refresh authority |

Provider catalog entries are immutable by adapter-contract version and have an
explicit admitted/disabled policy state. Connection states are `active`,
`reconnect_required`, `revoked`, or retention-governed `tombstoned`.
Subscription states are `active`, `paused`, or retention-governed
`tombstoned`; every state change advances the expected generation. Unknown
states or adapter versions fail closed.

Raw refresh/access tokens live only behind a managed credential/secret vault and
never in the Project Database, capability state, jobs, logs or provider errors.
A connector subscription can use a connection only when current Control
authority and consent policy admit that exact Project action.

## Commands and queries

### Files Product operations

| Product operation | Kind | Capability behavior |
| --- | --- | --- |
| `files.create_upload.v1` | Idempotent command | Validate policy/metadata and create bounded expiring UploadIntent |
| `files.duplicate.v1` | Idempotent command | Create an independent same-Project File identity/current version from one authorized exact ready source version, reusing only immutable verified object content under policy and recording bounded provenance; grants, connector state and private state are not copied |
| `files.upload_batches.create.v1` | Idempotent command | Create one Project-bound accepting UploadBatch with exact declared item/byte bounds and safe logical-root metadata |
| `files.upload_batches.items.add.v1` | Idempotent command | Register a bounded page of stable items, reject path/client-ID collisions, and issue independently constrained UploadIntents without exceeding declared totals |
| `files.upload_batches.items.complete.v1` | Idempotent command | Verify one exact item generation's staged bytes, record the observed outcome, and explicitly admit its independent scan/extract/publication work when required |
| `files.upload_batches.cancel.v1` | Command | Advance the expected Batch revision, cancel/fence uncommitted item generations and their work, and preserve every already committed FileVersion |
| `files.upload_batches.items.retry.v1` | Idempotent command | Reuse one exact failed logical ItemID, advance its retry generation and resume or issue a new bounded UploadIntent; never create an anonymous duplicate item |
| `files.upload_batches.get.v1` | Query | Return one authorized Batch summary, aggregate state, exact terminal counts and bounded safe status |
| `files.upload_batches.list.v1` | Query | Return an authorized cursor-bounded Project list filtered by safe state/time fields |
| `files.upload_batches.items.list.v1` | Query | Return cursor-bounded per-item phase/progress/outcome and resulting File/FileVersion references without transfer credentials |
| `files.complete_upload.v1` | Idempotent command | Verify staged size/digest/type and conditionally advance to scan/finalization workflow |
| `files.add_version.v1` | Idempotent command | Attach a verified ready immutable version and conditionally advance current pointer; with an exact preselected absent FileID and declared create-on-first-version intent, atomically creates that File and first version for a generated/imported/export output |
| `files.rename.v1` | Command | Rename/update safe metadata under expected metadata revision |
| `files.set_lifecycle.v1` | Command | Archive/restore/tombstone under retention/legal-hold policy |
| `files.request_scan.v1` | Idempotent durable command | Freeze and scan one exact staged/versioned object under declared scanner/policy version |
| `files.request_rendition.v1` | Idempotent durable command | Freeze exact version/render policy and produce one safe rendition |
| `files.request_extraction.v1` | Idempotent durable command | Freeze exact version/extractor policy and produce normalized extraction/OCR/description |
| `files.get.v1` | Query | Return metadata and bounded exact-version status/projection, including authorized typed import/derived-target lineage when explicitly requested |
| `files.list_versions.v1` | Query | Return bounded immutable version metadata under current authority |
| `files.download.v1` | Query | Reauthorize exact ready version and return/stream a bounded delivery response |
| `files.preview.v1` | Query | Return an exact ready rendition or explicit pending/unsupported state |
| `files.extract.v1` | Query | Return safe exact-version normalized contribution for Knowledge |

The create-on-first-version arm of `files.add_version.v1` accepts only a typed
handler-authenticated generated-artifact claim with a stable publisher
idempotency key, verified staging digest/size/media type, exact lineage, and
declared safe filename. A browser request, capability payload, or provider
response cannot supply an object reference or claim that an object is verified.
This is the Files-owned publication seam used by Translation and policy-shaped
Memory exports; Files still performs the canonical integrity/lifecycle checks.

The UploadBatch operations are the canonical multi-file/folder surface.
`files.create_upload.v1` and `files.complete_upload.v1` remain the exact
single-item surface and handler primitive; a Batch item stores that same
bounded UploadIntent semantics and does not invent a weaker transfer contract.
Replaying a Batch or Item idempotency key with changed manifest, path, digest,
size, target or policy returns conflict. After restart, get/list reconstruct
progress from durable Item and Job state; client progress is only an advisory
overlay.

### Source acquisition contract

Knowledge owns operations such as `knowledge.sources.register.v1`,
`knowledge.sources.acquire.v1`, `knowledge.sources.mark_changed.v1` and
`knowledge.sources.remove.v1`. Registration names an exact family Resource and
version. Acquisition invokes that family's canonical namespaced extraction
query; Files supplies `files.extract.v1`. A source update never mutates an old
artifact into a new version.

### Connector application operations

Connector connection operations are Host-routed connector-domain operations
in the Control transaction domain; Project subscription/sync operations are
Project-scoped handlers. This does not make connector tokens part of Taurus
identity/session state. The canonical target operations are:

| Product operation | Kind | Capability behavior |
| --- | --- | --- |
| `connectors.consent.begin.v1` | Control command | Create a bounded state/PKCE transaction for one admitted provider and exact requested scopes |
| `connectors.consent.complete.v1` | Control command | Verify and consume the callback once, then store only a managed credential reference and consent metadata |
| `connectors.providers.list.v1` | Control query | Lists admitted provider/adapter versions, item kinds, tenant modes and consent scopes without exposing credentials or disabled private configuration |
| `connectors.connections.get.v1` | Control query | Return safe provider, tenant, scope, expiry and status metadata without credentials |
| `connectors.connections.list.v1` | Control query | Lists the current administrative subject's safe connection projections under explicit bounds |
| `connectors.connections.revoke.v1` | Control command | Advance the connection generation, revoke credential use and audit the effect |
| `connectors.connections.delete.v1` | Control command | Retention-tombstones already-revoked connection metadata and destroys any remaining managed credential reference under policy |
| `connectors.subscriptions.create.v1` | Project command | Bind one admitted connection/root/query to an exact Project intake policy |
| `connectors.subscriptions.update.v1` | Project command | Change root/query, mapping or intake policy under expected revision without silently changing run state |
| `connectors.subscriptions.pause.v1` | Project command | Pause an expected active subscription generation and fence new sync/page work |
| `connectors.subscriptions.resume.v1` | Project command | Resume an expected paused subscription only after current connection/scope/policy checks pass |
| `connectors.subscriptions.delete.v1` | Project command | Retention-tombstones an expected subscription and advances its generation; imported Files follow their declared retention policy |
| `connectors.subscriptions.get.v1` | Project query | Returns one authorized safe subscription projection, connection status and last reconciliation |
| `connectors.subscriptions.list.v1` | Project query | Lists authorized subscriptions by provider/state under explicit bounds |
| `connectors.sync.start.v1` | Project durable command | Enqueue incremental or full reconciliation for one subscription generation |
| `connectors.sync.status.get.v1` | Project query | Return bounded progress, item summaries and safe failures |
| `connectors.items.resolve.v1` | Project command | Retry, quarantine or ignore one external item under explicit policy and Audit |

Provider-root discovery and reconnect behavior may be added only when their
public contracts are named and versioned here; prose must not invent aliases.

Provider priority is intentionally open in Q006. Local upload and the
provider-neutral contract do not wait for that choice.

## Capability API and ports

The Files pure library validates metadata/state transitions and accepts
normalized results from environmental work:

- `PlanUpload`, `VerifyUploadedMetadata`, `AcceptScanResult`,
  `AcceptRendition`, `AcceptExtraction`, `AttachVersion`, `SetLifecycle`,
  `Project`, `RenderMetadata` and `ExtractContribution`;
- `CreateUploadBatch`, `AddUploadBatchItems`, `CompleteUploadBatchItem`,
  `CancelUploadBatch`, `RetryUploadBatchItem`, `FoldUploadBatchProgress`, and
  `ValidateRelativeFolderPath` are deterministic Batch transitions;
- every accept operation validates exact input version, state generation,
  tool/policy version, integrity metadata and result bounds; and
- no scanner, parser, object-store or connector client enters Files.

Handler-owned contracts include:

```go
type Digest struct { Algorithm, Hex string }
type ByteRange struct { Offset, Length int64 }

type StageObjectRequest struct {
    IntentID, MediaType string
    MaximumBytes int64
    ExpectedDigest *Digest
    ExpiresAt time.Time
}
type StagedObject struct { StagingRef string; ExpiresAt time.Time }
type ObjectMetadata struct { ObjectRef string; Size int64; Digest Digest; MediaType string }
type FinalizeObjectRequest struct { StagingRef string; ExpectedSize int64; ExpectedDigest Digest }
type OpenObjectRequest struct { ObjectRef string; Range *ByteRange; MaximumBytes int64 }
type DeleteObjectRequest struct { ObjectRef, ExpectedDigest string }

type ObjectStore interface {
    Stage(ctx context.Context, req StageObjectRequest) (StagedObject, error)
    Head(ctx context.Context, objectRef string) (ObjectMetadata, error)
    Finalize(ctx context.Context, req FinalizeObjectRequest) (ObjectMetadata, error)
    Open(ctx context.Context, req OpenObjectRequest) (io.ReadCloser, ObjectMetadata, error)
    Delete(ctx context.Context, req DeleteObjectRequest) error
}

type ScanRequest struct {
    FileID, FileVersionID, ObjectRef string
    Digest Digest
    ScannerContractVersion, PolicyVersion string
    MaximumBytes int64
}
type ScanResult struct {
    Disposition, SafeReasonCode, DetectedMediaType string
    ScannerVersion string
    FindingsDigest Digest
}
type ContentScanner interface {
    Scan(ctx context.Context, req ScanRequest) (ScanResult, error)
}

type ExtractRequest struct {
    FileID, FileVersionID, ObjectRef string
    Digest Digest
    Kind, OutputSchema, ExtractorContractVersion, PolicyVersion string
    MaximumInputBytes, MaximumOutputBytes int64
}
type ExtractResult struct {
    Kind, OutputSchema, MethodVersion string
    ContentRef string
    ContentDigest Digest
    Confidence *float64
    Warnings []string
}
type ContentExtractor interface {
    Extract(ctx context.Context, req ExtractRequest) (ExtractResult, error)
}

type CredentialRequest struct {
    SecretRef, ExpectedKeyVersion, Provider, Tenant, Purpose string
}
type CredentialApplier interface {
    Apply(req *http.Request) error
}
type CredentialVault interface {
    WithCredential(
        ctx context.Context,
        req CredentialRequest,
        use func(context.Context, CredentialApplier) error,
    ) error
}

type ConnectorListRequest struct {
    Provider, ConnectionID, Root, Query, Continuation string
    SubscriptionGeneration int64
    MaximumItems, MaximumResponseBytes int
}
type ConnectorItem struct {
    ExternalID, ParentID, Name, Kind, Version, ETag, Digest, MediaType string
    Size int64
    Deleted bool
}
type ConnectorPage struct { Items []ConnectorItem; Continuation string; Complete bool }
type ConnectorFetchRequest struct {
    Provider, ConnectionID, ExternalID, ExpectedVersion string
    MaximumBytes int64
}
type ConnectorAdapter interface {
    List(ctx context.Context, auth CredentialApplier, req ConnectorListRequest) (ConnectorPage, error)
    Fetch(ctx context.Context, auth CredentialApplier, req ConnectorFetchRequest) (io.ReadCloser, ConnectorItem, error)
}
```

Every string above is a validated opaque/domain value, not a filesystem path,
URL or arbitrary provider parameter. Bounds must be positive and capped by
policy before an adapter runs. `ContentRef` is an opaque immutable object
reference, never inline unbounded extracted text. `CredentialApplier` is valid
only inside `WithCredential`; it is nonserializable, redacts on every formatting
path, cannot reveal raw credential bytes, and is invalid after the callback.
Unknown provider item kinds, versions, continuations or response shapes fail
closed rather than being dropped.

The first three contracts live with File handlers. Connector contracts live
with connector handlers and concrete provider implementations live under
`internal/integrations/connectors/`; none is a persisted capability value.
They receive bounded requests under deadline/cancellation and return normalized
results with no raw transport object. Knowledge defines its own
`SourceContentProvider` in Knowledge vocabulary; a handler adapter calls
`files.extract.v1`.

## Persistence and workflows

### Upload and File-version state

Object storage and the Project Database cannot share a transaction, so upload
is an explicit idempotent state machine:

```text
initiated -> staged -> verifying -> scanning -> ready
                                \-> quarantined / rejected / failed
```

1. A Project transaction creates an expiring intent with policy bounds.
2. Bytes reach a generated opaque staging location; it grants no Product
   authority and is never logged.
3. Completion reads trusted object metadata, computes/verifies digest and size,
   sniffs media type and conditionally advances the intent generation.
4. A durable scan job claims the exact immutable staged object under lease and
   records normalized result. Unsafe/unknown policy stays non-ready.
5. Finalization creates or verifies an immutable content-addressed/object
   version. In one Project transaction the handler consumes a fresh permit,
   records FileVersion/current pointer, intent settlement, idempotency, Audit
   and extraction/rendition jobs.
6. A reconciler deletes expired staging and unattached finalized objects after
   a safe retention window. Object deletion failure never fabricates a missing
   canonical FileVersion.

Exact replay at every transition returns its existing state/result. Same intent
or job identity with different digest/input conflicts. A crash before database
commit leaves a collectible object; a crash after commit leaves a canonical
retryable job. `ready` is never inferred merely from object existence.

Batch and Item rows live in the Project Database and use conditional Batch/
Item revisions. Adding the final declared manifest item seals registration;
the sum of stable Item IDs and declared sizes must exactly match the Batch
manifest. Every item owns an independent staging object, upload generation,
idempotency identity and terminal outcome. One item's metadata transition and
the resulting aggregate counters/state commit in the same Project transaction,
so restart cannot show a terminal item omitted from aggregate progress. A
consistent integrity read verifies counters against locked Item terminal totals;
a mismatch is an integrity failure, not a guessed progress repair.

Each Batch create/add/cancel/retry effect checks current durable session
authority and consumes a fresh session-sourced permit in its Project
transaction. Transfer uses only the item's short-lived constrained delivery
capability and creates no canonical effect. Item completion again requires a
current session, verifies trusted object metadata, and—only when the User has
explicitly accepted background continuation—admits that item's scan,
extraction or Source-publication work through the standard pending
WorkAuthority -> exact Project Job/receipt -> trusted acknowledgement
protocol. There is no Batch-wide ambient worker authority: each admitted item
has an exact `WorkAuthorityID`, `JobID`, ItemID, generation, operation/target
ceiling, byte/tool budget and expiry.

Closing a tab or current-family sign-out preserves only item work already
admitted as independent durable work. It cannot complete a merely staged item.
Batch cancellation advances the Batch and affected Item generations, which
fences older permits in the Project transaction, requests cancellation of the
exact item authorities/jobs, and leaves ready siblings untouched. User-wide,
grant/policy/entitlement, explicit work or Batch cancellation denies new
permits and fences issued ones before cancellation is effective.

Batch aggregation introduces no finalizer kind. Every item Job may use only
the existing closed `durable_job@1` finalization record to terminalize its exact
Job bookkeeping after revocation. That finalizer cannot verify bytes, change a
Batch/Item/File/FileVersion, recompute aggregate progress, scan/extract, or
publish an output. The ordinary permitted item transition commits its
canonical outcome and aggregate state; recovery retries or repairs that normal
transition under current authority.

Every scan/rendition/extraction that can publish canonical metadata has stable
derivation-work, `WorkAuthorityID` and `JobID` values. Under the current
session, Control creates exact `DurableWorkAuthority{PendingProjectReceipt}`;
a session-sourced permit commits the intent, Job, non-authoritative receipt,
idempotency, required Audit/fact and `durable_job@1`. Exact
trusted receipt acknowledgement alone activates the work. Pending authority or
a receipt cannot issue an ordinary permit; missing Project state expires as an
orphan, and lost acknowledgement reconciles only from the exact trusted
receipt. Every later canonical result/metadata/FileVersion effect takes a
fresh work-sourced permit. No permit is held while reading bytes or invoking a
scanner/parser/OCR/media adapter.

Current-family sign-out preserves accepted derivation work. User-wide,
grant/policy/entitlement, cancel/expiry or explicit revocation denies/fences
later effects. `durable_job@1` may only terminalize exact Job bookkeeping;
success requires prebound proof that the ordinary File effect already settled.
It cannot change File/derivation state, run an adapter, attach an object,
publish a FileVersion/rendition/extraction, enqueue work or widen authority.
Capability state must commit under a fresh permit before revocation or remain
nonterminal.

### Concurrency

- File metadata/lifecycle/current-version use conditional revisions.
- FileVersion inserts are immutable and unique by stable version identity plus
  idempotency/digest constraints. Concurrent uploads may both create versions;
  advancing current requires the caller's expected pointer or explicit policy.
- Upload, scan, rendition and extraction transitions require expected state and
  generation. Lease loss prevents stale job completion.
- A preview/extraction result is keyed to exact FileVersion, tool contract and
  policy version. New File versions do not rewrite old derived records.
- Connector sync is a durable leased state machine per subscription/generation.
  A manual `connectors.sync.start.v1` admits one exact Control
  `DurableWorkAuthority` and Project SyncRun/Job receipt through the common
  pending→commit→ack protocol. Each later page/item effect consumes a fresh
  work-sourced permit; the lease and subscription row are not authority.
  An external item version maps idempotently to at most one resulting File
  version for that mapping policy. Provider continuation advances only in the
  same Project transaction that records all accepted item outcomes in its
  bounded batch.
- Expired/invalid continuation triggers a bounded full reconciliation. Provider
  deletion follows subscription policy (`retain_and_mark_removed`, `archive`,
  or governed deletion); it never silently destroys a Project File.
- Pause, resume and delete advance expected subscription state/generation so a
  page admitted under an older state cannot commit. Deleting a subscription
  never implies deleting previously imported FileVersions.

Connector webhooks and realtime status are hints. Correctness comes from
provider reconciliation, exact external item versions and Project state.

Periodic sync is disabled until the User explicitly accepts a finite Control
`StandingWorkDelegation` for one exact Project subscription. The Project stores
only its non-authoritative receipt; acknowledgement activates the delegation.
Each timer/webhook trigger consumes one bounded allowance and creates a fresh
pending Work/Job authority plus separately typed
`ReceiptBootstrapCredential`, restricted to creating the one exact absent
SyncRun/Job/receipt and never usable as an ordinary permit; the Project commit
and trusted acknowledgement then activate it. A missing receipt leaves an
unusable orphan. Pause/delete, connection generation change, sign-out
everywhere or User disable deny/fence the delegation and affected derived work.

Each SyncRun precommits `durable_job@1`. Its finalizer may only terminalize
exact Job bookkeeping; it cannot change SyncRun/continuation state, fetch a
provider page, publish a FileVersion/Source, enqueue sync or widen authority.

## Security, privacy and failure

- Current Project authority is checked before initiating, completing,
  downloading, previewing, extracting, subscribing or manually admitting sync.
  Periodic effects require the exact active standing-work delegation,
  subscription receipt and per-run WorkAuthority. Every Project effect uses a
  fresh exact one-use permit and required Audit.
- Download URLs, if used, are short-lived, exact-object, audience-bound where
  supported and issued only after authorization. They are delivery
  capabilities, never reusable Product credentials.
- Media type is detected from content; extension and provider declarations are
  untrusted hints. Archives enforce compressed/uncompressed size, nesting,
  entry-count, path and format bounds. Parsers/converters run with resource and
  network restrictions appropriate to their risk.
- HTML/SVG/office macros, scripts, active content, external links, embedded
  executables and formula injection are sanitized, quarantined or rejected by
  explicit policy—not executed during preview/extraction.
- Provider callbacks/webhooks verify issuer, tenant, audience, signature,
  timestamp/replay and exact connection. Connector adapters enforce egress
  allowlists and resist SSRF/redirect-to-private-network behavior.
- OAuth scopes are least privilege and purpose-specific. Outlook Mail/Calendar
  or Drive/OneDrive access requires explicit connector consent; login identity
  scopes cannot be reused.
- Raw bytes, extracted sensitive content, tokens, presigned URLs and provider
  errors are absent from required Audit/logs by default. Normalized safe IDs,
  classifications, sizes, digests/policy versions and outcomes suffice.

| Family/integration error | Kernel category | Meaning/retry |
| --- | --- | --- |
| `file_invalid_metadata` | `invalid_argument` | Invalid name/type/size/digest/state or bounds |
| `file_unknown_kind` | `unsupported_version` | Unsupported representation/media/extraction/rendition kind |
| `file_conflict` | `conflict` | Expected metadata/current-version/state generation changed |
| `file_integrity_mismatch` | `integrity_failure` | Stored size/digest/object metadata differs; quarantine and investigate |
| `file_not_ready` | `precondition_failed` | Version is pending/quarantined/rejected and cannot serve/ingest |
| `file_scan_rejected` | `precondition_failed` | Content/policy forbids trusted use; safe bounded reason only |
| `file_extraction_unsupported` | `unsupported_version` | No admitted safe extractor for exact media/contract |
| `file_too_large` | `invalid_argument` | Upload/archive/rendition/extraction budget exceeded |
| `upload_batch_conflict` | `conflict` | Batch revision, manifest, declared totals or idempotent replay input differs |
| `upload_batch_not_accepting` | `precondition_failed` | Item registration is sealed, cancelled or terminal |
| `upload_item_not_retryable` | `precondition_failed` | Item is active, ready, duplicate, policy-rejected or otherwise not eligible for retry |
| `upload_relative_path_invalid` | `invalid_argument` | Relative path violates normalization, segment, depth, length or prefix policy |
| `upload_relative_path_collision` | `conflict` | Two items map to the same policy-canonical relative path/client identity |
| `file_object_unavailable` | `temporarily_unavailable` | Canonical object cannot currently be read; never return partial/corrupt bytes |
| `connector_consent_required` | `precondition_failed` | Connection scopes/tenant/credential need explicit reconnect |
| `connector_stale_generation` | `conflict` | Subscription/connection/lease generation advanced; stale worker stops |
| `connector_item_quarantined` | `precondition_failed` | External item failed content/policy validation |
| `connector_provider_unavailable` | `temporarily_unavailable` | Bounded retry under provider policy; prior canonical Files remain available |

## Cross-capability relationships

- Every Resource family can reference exact File versions for assets and can
  create export Files. No sibling reads the object store directly.
- Translation parses an exact ready FileVersion into a validated target-family
  command or renders an exact Resource version into a new FileVersion with a
  loss report.
- A static File-derived native target is owned by the exact
  `translation.execute_import.v1` run and destination-family commit. Files may
  expose a read-only `FileDerivedTargetProjection` containing the exact source
  FileVersion/addresses, Translation run/plan digest, target family/Resource/
  version and fidelity outcome; it cannot edit or rerun the target.
- A standing target is owned by its destination Resolution host. Its projection
  additionally names the exact `ResolutionHostRef` and current safe status.
  Connector synchronization may publish a newer immutable FileVersion, but it
  never retargets or mutates the native destination directly; a separately
  authorized Resolution/Translation run selects exact new evidence. Files
  owns neither standing instructions, Output history nor refresh authority.
- Knowledge owns Sources and calls exact family extraction. Files returns only
  safe exact-version normalized extraction; Knowledge owns artifacts, lineage,
  staleness, embeddings and retrieval.
- Intelligence may describe an image or normalize content through an
  extraction job. The result is provenance-marked inference, never a claim
  about original bytes.
- Search/Activity/workspace store bounded File/source/connector projections;
  the connector domain owns connection consent/credential references while
  Control supplies current identity, administrative scope and authority.

## Headless proofs and examples

```text
create upload for report.pdf expected sha256 D
stage bytes -> verify D -> scan clean -> File F version V1 ready
extract V1 -> normalized pages/text/tables at extractor contract E3
register Knowledge source F@V1 -> acquire exact extraction E3
upload changed bytes -> V2; V1/source artifacts remain immutable and V1 becomes stale
download V1 -> current authority checked, exact digest D returned
```

Connector example:

```text
consent OneDrive read scope -> Control connection C generation 1
subscribe Project P folder R -> subscription S generation 1
sync item I etag 7 -> File F/V1; batch and continuation commit together
duplicate sync I etag 7 -> exact replay, no new File version
revoke C -> no new permits/sync; stale worker cannot commit after effective
```

Folder batch example:

```text
create Batch B for root "FY2026" with 3 items / 18 MiB
add a/report.pdf, a/data.csv, notes.txt -> three exact UploadIntents
complete report and notes; data digest fails -> ready, ready, failed_retryable
restart Host -> B reconstructs partial progress from durable rows/jobs
retry data with same ItemID and digest -> generation 2, no anonymous duplicate
scan succeeds -> B succeeded; relative paths remain display metadata only
```

Required proofs include:

- pure File state-machine/model/integrity/property/fuzz tests;
- UploadBatch/item state-machine, aggregate-counter and property/fuzz tests,
  including partial success, cancel with ready siblings, exact replay,
  mismatched replay, restart, manifest sealing and retry generations;
- relative-folder hostile fixtures cover absolute/drive/UNC/URI prefixes,
  slash/backslash ambiguity, `.`/`..`, Unicode canonical collisions, controls,
  bidi overrides, depth/length and object-key non-derivation;
- staged/final object crash boundaries, orphan cleanup and digest mismatch;
- malicious media/archive/SVG/office/parser fixtures and resource bounds;
- concurrent upload/version/current-pointer/lifecycle transitions with exact
  idempotency against live Project storage;
- generated-output create-on-first publication accepts only a verified typed
  handler claim, rejects caller/provider object references, and converges to
  one File/FileVersion across staging/publication/response crashes;
- scan/extraction/render job retry, lease loss, cancellation and stale result;
- download authorization/revocation and no presigned-URL authority confusion;
- connector consent/revocation, token redaction, tenant/scope enforcement,
  webhook replay/signature and SSRF negative tests;
- manual-sync WorkAuthority pending/ack/orphan/revoke and periodic standing-
  work activation/trigger/dedup/exhaustion/expiry, with pause, connection-
  generation and User-wide revocation fencing every derived page commit;
- provider catalog filtering, connection get/list/revoke/delete, and
  subscription get/list/pause/resume/delete with stale-worker fencing and
  imported-File retention;
- incremental duplicate/out-of-order item changes, expired continuation, full
  reconciliation and provider deletion policy;
- exact Source acquisition/staleness/removal with no cross-Project reads;
- backup/restore preserves metadata-to-object integrity and Project isolation;
  and
- browser-free upload, inspect, preview, extract, source-register, import,
  export and connector-sync journeys through normal operations; and
- browser-free folder Batch registration, bounded parallel upload, per-item
  completion, partial outcome, Host restart, exact retry, cancellation and
  final aggregate convergence with only `durable_job@1` Job finalization.

## Source grounding

- The original [Taurus Product Vision](https://app.notion.com/p/377b6410e50280c69389e5763939cbf0)
  defines General Files, upload, metadata, previews, extraction, Knowledge
  source registration, connectors and import/export. It is vision evidence;
  no verified General Files construction existed.
- [SOL X 31 — Files, Sources, Corpora, Connectors & Upload Batches](https://app.notion.com/p/39ab6410e5028184ae70fe7b0083355a)
  grounds UploadBatch/item durability, aggregate and partial outcomes,
  normalized display-only relative paths, independently constrained transfers,
  retry/cancel behavior, Files/Translation ownership and File-derived target
  distinctions. Omega replaces its former runtime/event assumptions with the
  accepted Host/Cell, permit and durable-Job contracts.
- [SOL X 41 — File Upload, Folder Intake, Preview & Import Screen](https://app.notion.com/p/39ab6410e5028132b831fd0378161f8b)
  grounds per-item progress, Cancel/Retry/Open behavior, safe preview states,
  immutable version visibility, import handoff and keyboard-accessible folder
  intake. It is UX evidence rather than canonical persistence authority.
- The original [Knowledge construction](https://app.notion.com/p/393b6410e50281a584e7cebba0281402)
  grounds the source ledger, exact source version/hash, dirty/watermark/removal,
  acquisition and lineage behaviors. Omega replaces event acquisition with
  authorized exact-version queries and durable jobs.
- Omega's [Control boundary](../architecture/control-and-project-boundary.md)
  separates Google/Microsoft identity from connector data consent and supplies
  the authority context under which the connector domain acts. [Q006](../questions/README.md)
  deliberately leaves provider priority open while this provider-neutral
  contract and local upload proceed.
- The current [persistence](../architecture/persistence-and-concurrency.md) and
  [jobs/Audit](../architecture/jobs-audit-observability.md) contracts ground
  staged object writes, immutable versions, leases, fencing and atomic intent.

### Nova evidence (pinned)

- Nova's
  [`platform/objectstore`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/platform/objectstore),
  [`resource`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/resource),
  Knowledge and identity/provider boundaries are useful primitive/security
  evidence, especially integrity checks, fail-closed composition and credential
  redaction. The audited Nova tree at
  [`3df790b2`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova)
  has no complete File Resource, durable UploadBatch/folder intake, governed
  File-derived target, import/export or connector journey. Those are new Omega
  contracts, not Nova compatibility requirements or production proof.
