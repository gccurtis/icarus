# Stage 05 — Files, Sources, upload, and connector boundary

## Outcome

Build secure immutable File resources, resumable single upload, durable
multi-file/folder UploadBatch intake, malware/type/integrity validation,
previews/extraction, exact-version Source registration, original download, and
provider-neutral connector contracts. This gives Knowledge grounded inputs
without conflating Files, Sources, Translation-owned native targets, standing
Resolution targets, import, or external connectors.

## Non-goals

- Office-to-Resource translation
- Google Drive/OneDrive/SharePoint/Outlook data connectors in the initial slice
- treating a mutable URL/provider object as canonical evidence
- exposing unscanned content or parser output as trusted
- storing large bytes in Project relational tables

## Target tree and files

```text
internal/
  capabilities/resources/files/   File/version transitions and projections
  capabilities/knowledge/         Source identity/acquisition contract only
  cell/handlers/files/             upload/batch, object, scan and extraction envelope
  cell/handlers/knowledge/         exact Source registration/acquisition handler
  platform/objectstore/            opaque bounded storage mechanism
  cell/handlers/{files,knowledge}/mysql/
  wiring/{testing,development,production}/files.go
migrations/project/*_{files,sources}.sql
api/openapi/product-v1.yaml
test/{integration,security,recovery,golden}/files/{upload,batches}/
```

Scanner, parser, OCR and media implementations are handler adapters. Concrete
external-account adapters are not created here; they have the separate
[Stage 05A](05a-provider-connectors.md) authority.

## Canonical models

### File

File identity/metadata, ordered immutable FileVersions, object reference,
digest, size, declared/detected media type, uploader/attribution, scan state,
preview/extraction versions, lifecycle, retention, and safe display metadata.
Original bytes are immutable; derived artifacts never replace them.

UploadBatch is the durable multi-file/folder intake aggregate. It owns a
Project-bound manifest, safe logical-root label, declared totals, revision,
aggregate progress/outcome and cancellation state. Stable UploadBatchItems own
normalized display-only relative paths, independent UploadIntents/generations,
server-observed progress, exact terminal outcome and resulting File/FileVersion.
One failed/rejected/cancelled item never rolls back ready siblings.

Batch states are `accepting`, `processing`, `succeeded`, `partial`, `failed`,
or `cancelled`. Item states are `registered`, `transferring`, `staged`,
`verifying`, `quarantined`, `scanning`, `ready`, `duplicate`, `rejected`,
`failed`, or `cancelled`; failure carries an explicit retryable bit and safe
category. Relative folder paths are UTF-8/Unicode NFC-normalized `/`-separated
display metadata. Absolute/drive/UNC/URI/tilde prefixes, backslashes, empty/
`.`/`..` segments, controls/bidi overrides, depth/length violations and
NFC-equal collisions within the Batch fail closed. A path never selects an object key,
filesystem path, Project scope or access decision.

### Source

An authorized Project-scoped reference to an exact version of a File or another
Resource, including source kind, target reference, version/digest, acquisition
status, content representation references, lineage, visibility, and removal or
staleness state. It does not own Resource content.

### Connector boundary (implemented in Stage 05A)

Control owns the provider-neutral connection/consent identity, exact granted
scope, credential `SecretRef`, policy generation, status, and revocation.
Project-side Connectors owns subscription, external-item mapping, continuation,
sync policy, and status. Login identity tokens are never connector credentials,
and provider clients live only in `internal/integrations/connectors/`.

Stage 05 establishes the Files intake and Knowledge Source seams that a future
connector must call. It does not create connector tables, operations, packages,
or a fake working provider. Stage 05A introduces the two connector domains only
after Q006 names a real workflow.

## Versioned contracts and schemas

The canonical Product operation names, kinds and behavior are the tables in
[Files, Sources and connector intake](../capabilities/files-sources-connectors.md#commands-and-queries);
this stage registers the File and Source operations from those tables and no
aliases. Stage 05A registers Connector operations. Persisted Stage 05 schemas
cover `File`, immutable `FileVersion`, `UploadIntent`, `UploadBatch`,
`UploadBatchItem`, aggregate counters/outcomes, `ContentDisposition`,
`Rendition`, `Extraction`, Knowledge-owned `Source`/`SourceAcquisition`, and
idempotent workflow generations. Object refs are opaque values; paths, URLs,
clients, tokens and parser objects are forbidden persisted authority fields.

Handler ports are `ObjectStore`, `ContentScanner`, `ContentExtractor` and safe
delivery adapters. Each request/result fixes input version, tool/policy version,
digest, bounds and cancellation behavior. Unknown media, extraction, schema or
operation versions fail closed rather than degrading to generic bytes-as-text.

## Operations

- initiate upload under size/type/quota policy;
- duplicate one authorized exact ready FileVersion into a new independent
  same-Project File identity, reusing only immutable verified object content
  when policy admits it;
- stream parts and complete idempotently against expected digest/size;
- create a durable declared UploadBatch, register bounded item pages, complete
  items independently, cancel/fence uncommitted items, retry one exact failed
  logical ItemID, and get/list aggregate or cursor-bounded item state;
- scan/detect/inventory in a durable sandboxed job;
- create immutable preview, OCR/text/media description, and extraction result;
- publish a verified generated/import/export artifact as an immutable first
  FileVersion under a preselected FileID and stable publisher idempotency key,
  without accepting a caller-controlled object reference;
- get metadata/status/preview/original under current authority;
- create a Source from an exact FileVersion/ResourceVersion;
- re-extract/re-register a new version without rewriting older evidence;
- archive/delete subject to references, retention, and legal hold;
- accept connector-origin lineage through the same verified FileVersion intake
  contract when a later Stage 05A adapter is enabled.

The exact Batch Product operations are
`files.upload_batches.create.v1`, `files.upload_batches.items.add.v1`,
`files.upload_batches.items.complete.v1`,
`files.upload_batches.cancel.v1`,
`files.upload_batches.items.retry.v1`,
`files.upload_batches.get.v1`, `files.upload_batches.list.v1`, and
`files.upload_batches.items.list.v1`. Their authoritative behavior is defined
once in the capability operation table; this stage creates no upload aliases.
The final registered item seals an exact declared manifest. Exact replay
returns prior state, changed manifest/path/digest/size conflicts, and Host
restart reconstructs progress from durable Item/Job state rather than client
percentages.

Static native targets are created only by
`translation.execute_import.v1` plus the destination family's canonical
command. A File-owned read model may expose exact lineage/status but cannot
mutate the destination. A standing target is owned by its exact Resolution
host; connector sync may create newer FileVersions but cannot rebind or refresh
that target. Stage 05 therefore stores no generic native-target body,
instruction, Output history or ambient connector automation.

## Processing pipeline

```text
UploadBatch accepting -> item manifests sealed -> processing
  -> independent UploadIntent/staged object parts per item
  -> digest/size completion
  -> quarantine FileVersion
  -> malware/content/type checks
  -> bounded sandbox parser/OCR/preview jobs
  -> immutable derived artifacts
  -> Source representation proposal
  -> atomic item/File metadata activation + aggregate progress + required Audit
  -> succeeded | partial | failed | cancelled
```

Failures preserve the original quarantined record and safe diagnostic status;
they do not expose unsafe previews or partial source truth.
One item failure never blocks or rolls back ready siblings. Cancellation fences
uncommitted item generations, preserves ready FileVersions, and settles the
Batch `partial` when it contains both committed and failed/cancelled outcomes.

## Provider ports

- immutable object store;
- malware/content scanner;
- media/type detector;
- sandboxed parser/OCR/preview converter;
- `MediaDescriber` through Intelligence for explicitly inference-marked
  descriptions;
- Knowledge contribution/acquisition contract outside Files.

## Security and failure

- archive traversal, decompression bombs, parser exploits, polyglots, malicious
  filenames, active content, oversized metadata, and content-type confusion are
  bounded before trusted use;
- presigned/object URLs are short-lived delivery mechanics, not authority;
- filenames/object keys/logs are sanitized and do not disclose secrets or
  cross-Project structure;
- folder paths are normalized relative display metadata only; hostile prefixes,
  traversal, controls, ambiguity/collisions and depth/length overflow fail
  closed, and no accepted path is interpolated into an object/filesystem key;
- future connector credentials remain Control-owned write-only SecretRefs and
  cannot enter this Stage 05 File/Source graph;
- repeated completion/extraction is idempotent; digest mismatch is integrity
  failure, not retry success; and
- cleanup/reconciliation handles orphan staged/final objects without deleting a
  referenced version.

## Authority, transactions, and recovery

Reads reauthorize the exact File/Source/version. Upload intent creation and
metadata transitions consume fresh permits and atomically persist Project
state, idempotency and required Project Audit. Object storage is outside that
transaction: a pre-commit object is collectible, while a post-commit missing
derivative remains a retryable explicit state. Activation of a FileVersion and
Source acquisition never claims partial parser output.

Batch create/add/cancel/retry and item completion each check current durable
session authority and consume a fresh exact session-sourced permit for their
Project mutation. Transfer itself uses only the independently constrained,
short-lived Item capability. Registering a Batch is not ambient permission for
background work. Completion may explicitly admit a scan/extract/publish Job
for that one Item only through pending WorkAuthority -> exact Project Job/
receipt -> trusted acknowledgement. Every item has its own WorkAuthorityID,
JobID, ItemID/generation, bounds, operation/target ceiling and expiry, so one
item can retry/cancel/fail without sharing authority with a sibling.

The Item canonical transition and Batch aggregate counters/state commit in the
same Project transaction. Closing a tab or current-family sign-out preserves
only work already admitted as independent; staged-but-uncompleted items expire.
Batch cancellation advances Batch/Item generations and fences older permits,
requests cancellation of exact admitted work, and preserves ready siblings.
User-wide/grant/policy/entitlement/explicit cancellation denies new permits and
fences issued ones before effective revocation.

No new Batch finalizer exists. Each Item's durable job may precommit only the
existing closed `durable_job@1` record, which can terminalize exact Job
bookkeeping after revocation but cannot verify bytes, mutate Batch/Item/File
state, recalculate progress, run a scanner/parser or publish a FileVersion.
Canonical terminal outcome and aggregate convergence always require the
ordinary permitted item transition; retry/recovery repeats that transition
idempotently.

Every effectful durable scan, rendition or extraction has stable
`FileDerivationWorkID`, `WorkAuthorityID` and `JobID` values. When
`files.complete_upload.v1`, `files.request_scan.v1`,
`files.request_rendition.v1`, or `files.request_extraction.v1` admits such work,
Control first creates an exact bounded
`DurableWorkAuthority{PendingProjectReceipt}` under the current session. One
session-permitted Project transaction then stores the exact derivation intent,
Job, non-authoritative receipt, idempotency result, required Project Audit,
declared fact and closed `durable_job@1` finalization record. Trusted
acknowledgement of that exact receipt alone activates the authority.

The pending authority and Project receipt cannot issue an ordinary permit. A
missing Project receipt leaves a harmless expiring/revoked Control orphan; a
lost acknowledgement is reconciled only by exact receipt verification through
the trusted placement. A worker reconstructs the active WorkAuthority and
matching Job/receipt/generation. It obtains a fresh work-sourced permit for
each later canonical scan-state, rendition/extraction metadata or verified
FileVersion effect, but holds no permit while reading bytes or running a
scanner/parser/OCR/media adapter.

Current-family sign-out preserves an explicitly admitted derivation. Sign out
everywhere, User disable/removal, Project-grant/policy/entitlement loss,
File/work cancellation, expiry or explicit revocation denies new permits and
fences issued ones. The typed `durable_job@1` finalizer may only terminalize
that exact pre-admitted Job bookkeeping; success requires prebound proof that
the ordinary canonical effect already settled. It cannot change File,
rendition, extraction or scan state, run a scanner/parser, attach an object,
publish a FileVersion, enqueue work or widen authority. Capability state must
commit under a fresh permit before revocation or remain nonterminal.

Lease/generation checks fence scan, extraction, rendition and cleanup workers.
A stale worker may retain an orphan for later reaping but cannot advance
canonical state. Recovery reconstructs jobs from Project state, verifies every
object digest before reuse and rebuilds derived projections without rewriting
the immutable original. Revocation stops new reads/acquisition/commits; retained
sealed Evidence follows its separate retention authority.

## Production and test composition

Production requires a durable Project repository, object store, scanner and
every parser/rendition adapter advertised as supported. Missing scanners,
synthetic repositories or unsupported formats keep upload content quarantined
or the feature unavailable. Testing may use deterministic byte stores and
normalized scanner/parser fakes for state-machine cases, but live promotion
requires real object, scanner, sandbox, crash and recovery evidence. No
connector is part of this Stage 05 graph.

## Proof matrix

- multipart resume/replay/concurrent completion and crash boundaries;
- UploadBatch create/add/seal/complete/cancel/retry/get/list/items, including
  aggregate monotonicity, partial success, ready-sibling preservation, exact
  replay versus mismatched input, per-item generations and Host restart;
- hostile relative-folder paths: absolute/drive/UNC/URI/tilde, slash/backslash,
  `.`/`..`, empty segments, Unicode canonical collision, controls/bidi,
  depth/length, and proof that no path derives an object/filesystem key;
- per-item WorkAuthority/Job isolation, no Batch ambient authority, current-
  family sign-out behavior, cancellation fencing, and `durable_job@1` inability
  to mutate Batch/Item/File or aggregate state;
- stable derivation Work/Job IDs; pending→receipt→ack activation; lost-ack and
  missing-receipt orphan recovery; and denial of pending/bare-receipt permits;
- current-family sign-out survival and User-wide/grant/policy/entitlement/
  cancel/expiry revocation fencing at every derivation effect;
- `durable_job@1` confinement after revocation, including no capability-state
  change, scanner/parser execution or File/derived-output publication;
- generated-output publication rejects caller/provider object refs and returns
  one preselected File/FileVersion under retry, including crash between object
  staging and Project publication;
- digest/size/type mismatch, unsafe scan, archive/path/bomb fixtures;
- parser time/memory/output/network sandbox limits;
- Project/User authorization on every metadata/preview/original operation;
- Project A object references unusable in Project B;
- original/derived/source lineage survives backup/restore;
- extraction clearly distinguishes verbatim, parser-derived, OCR, and inferred
  text;
- deleted/revoked Sources cannot be retrieved by Knowledge while historical
  sealed Evidence remains policy-governed;
- headless upload → scan → extract → Source → authorized original download;
- headless 3-item folder Batch → two ready/one failed → Host restart → exact
  failed-item retry → aggregate success, plus cancellation after one ready item
  yielding preserved File and explicit partial outcome.

## Completion boundary

Single and durable Batch/folder upload, immutable Files, Sources, previews/
extraction, originals, safe relative-path handling, and explicit Translation/
standing-target boundaries are production-shaped. Concrete cloud/mail/calendar connectors follow
[Stage 05A](05a-provider-connectors.md) only after Q006 selects a workflow;
Office Resource translation remains separately consented and staged.

## Consequential decisions and source grounding

- **Files own bytes and immutable versions; Knowledge owns Sources.** A Source
  registration references an exact owner extraction rather than copying
  canonical File state. Revisit only if a new family defines a stronger exact
  contribution contract.
- **Object/database consistency is an explicit workflow.** Orphan collection
  and replay replace a fictitious distributed transaction. Revisit if the
  storage technology supplies an equivalent proven atomic mechanism.
- **Concrete connectors are separately gated.** Stage 05 remains complete for
  local upload without guessing Q006 or broadening login consent.

Grounding: [capability contract](../capabilities/files-sources-connectors.md),
[import/export flow](../flows/import-export.md),
[persistence and concurrency](../architecture/persistence-and-concurrency.md),
and [Stage 05A](05a-provider-connectors.md).

Exact Taurus construction grounding:

- [SOL X 31 — Files, Sources, Corpora, Connectors & Upload Batches](https://app.notion.com/p/39ab6410e5028184ae70fe7b0083355a)
  owns the durable Batch/item, partial outcome, path, Translation split and
  derived-target requirements adapted here.
- [SOL X 41 — File Upload, Folder Intake, Preview & Import Screen](https://app.notion.com/p/39ab6410e5028132b831fd0378161f8b)
  grounds user-visible per-item progress/cancel/retry/open, folder intake and
  honest preview/import handoff.
- Pinned Nova `3df790b2` object-store/resource primitives linked from the
  [capability evidence](../capabilities/files-sources-connectors.md#nova-evidence-pinned)
  ground integrity and fail-closed composition only. Nova has no durable
  UploadBatch/folder journey or governed native/standing target proof.
