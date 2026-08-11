# Stage 05A — Selected provider connector adapters

## Outcome and decision gate

Implement production-shaped external-data intake for the provider or providers
explicitly selected in [Q006](../questions/README.md#q006--external-connector-priority).
This stage begins only after that selection is recorded with the first user
workflow, item kinds and minimum scopes. It realizes the provider-neutral
connection/subscription contracts from Stage 05 without coupling login identity
to connector consent.

## Non-goals

- selecting a provider merely because an SDK exists
- treating Google/Microsoft sign-in tokens as Drive, Outlook, OneDrive or
  SharePoint credentials
- provider-shaped fields in File, Source, Knowledge or Resource models
- webhook delivery as canonical truth or Product authority
- silent import of every item visible to an external account
- Office-to-Resource conversion; connector intake creates immutable Files

## Target tree and files

```text
internal/
  control/connectors/                   consent, connection and credential refs
  capabilities/connectors/              pure Project subscription/mapping/sync model
  cell/handlers/connectors/             Project subscriptions and sync commands
    repository.go
    mysql/
  integrations/connectors/
    <selected-provider>/                concrete OAuth/API client and mapper
  cell/handlers/files/                  verified external-item-to-File intake
  platform/secrets/                     credential resolution/rotation mechanism
  wiring/{testing,development,production}/connectors.go
migrations/control/*_connectors.sql     connections, consent and generations
migrations/project/*_connectors.sql     subscriptions, items and continuation
configs/connectors/*.schema.json        admitted authorities/scopes/item policy
test/{integration,security,recovery}/connectors/
```

Provider SDKs and OAuth clients live only in the concrete integration package.
The pure Connectors capability owns Project subscription, item-mapping,
continuation and sync transition rules; the handler owns orchestration,
persistence and the consumer port implemented by the integration client.
Capability values and persisted Product values never import or serialize an
SDK/client type.

## Public contracts and schemas

The Control domain owns the safe `ConnectorProvider` catalog and
`ConnectorConnection`: admitted adapter/authority/tenant/item/scope contract,
consent revision, exact granted scopes, credential `SecretRef`, expiry,
revocation and policy generation. The Project Database owns
`ConnectorSubscription`, `ExternalItem`, `ConnectorContinuation` and the exact
resulting `FileID`/`FileVersionID`. Continuations are provider-local opaque
state, not a product-wide ordering token.

Versioned operations are:

| Operation | Domain | Contract |
| --- | --- | --- |
| `connectors.consent.begin.v1` | Control command | Creates bounded state/PKCE transaction for a selected provider and exact requested scopes |
| `connectors.consent.complete.v1` | Control command | Verifies callback once and stores only a managed credential reference plus consent metadata |
| `connectors.providers.list.v1` | Control query | Lists safe admitted provider/adapter/item/scope contracts |
| `connectors.connections.get.v1` | Control query | Returns safe provider, tenant, scopes, expiry and status without credentials |
| `connectors.connections.list.v1` | Control query | Lists safe bounded connections for the current administrative subject |
| `connectors.connections.revoke.v1` | Control command | Advances generation, revokes credential use and audits the effect |
| `connectors.connections.delete.v1` | Control command | Retention-tombstones an already-revoked connection and destroys any remaining managed credential reference |
| `connectors.subscriptions.create.v1` | Project command | Binds one admitted connection/root/query and target intake policy |
| `connectors.subscriptions.update.v1` | Project command | Changes root/query, mapping or intake policy under expected revision |
| `connectors.subscriptions.pause.v1` | Project command | Pauses an expected active generation and fences new sync/page work |
| `connectors.subscriptions.resume.v1` | Project command | Resumes an expected paused generation after current connection/scope/policy checks |
| `connectors.subscriptions.delete.v1` | Project command | Retention-tombstones an expected subscription without silently deleting imported Files |
| `connectors.subscriptions.get.v1` | Project query | Returns one safe authorized subscription/status projection |
| `connectors.subscriptions.list.v1` | Project query | Lists safe authorized subscriptions by provider/state under explicit bounds |
| `connectors.sync.start.v1` | Project durable command | Enqueues incremental or full reconciliation for one subscription generation |
| `connectors.sync.status.get.v1` | Project query | Returns bounded progress, item summaries and safe failures |
| `connectors.items.resolve.v1` | Project command | Retries, quarantines or ignores one item under explicit policy |

Provider wire values are mapped into a normalized `ProviderItemPage` containing
stable item/parent IDs, version/etag/digest, safe metadata, deletion marker,
content descriptor and next continuation. Unknown versions or item kinds fail
closed or remain explicitly unsupported.

Provider catalog/connection and subscription state enums are the closed sets
in the capability contract. Pause, resume, revoke and delete advance expected
generations so a stale callback, page or worker cannot commit.

## Construction and request flow

1. Control checks Organization/User policy, provider admission and exact scopes,
   then begins separate data consent with state, nonce and PKCE as applicable.
2. Callback verification consumes the connector-consent transaction once and stores tokens
   only through the credential vault; Control persists the `SecretRef` and
   consent generation atomically with required Control Audit.
3. A bound Project Cell creates a subscription after current Control authority
   proves that connection and scopes admit this Project action. If periodic
   execution is requested, Control creates a finite
   `StandingWorkDelegation{PendingProjectReceipt}` and only the exact Project
   subscription/receipt acknowledgement activates it.
4. A manual `connectors.sync.start.v1` preselects stable `SyncRunID`,
   `WorkAuthorityID` and `JobID`, creates one exact
   `DurableWorkAuthority{PendingProjectReceipt}` under the current session, then
   commits the SyncRun/Job/non-authoritative receipt, idempotency, Project Audit,
   declared fact and closed `durable_job@1` record under a fresh
   session-sourced permit. Trusted acknowledgement of that exact receipt alone
   activates it. A periodic trigger instead consumes one active standing-work
   delegation allowance and creates the same per-run pending WorkAuthority plus
   a separately typed `ReceiptBootstrapCredential` restricted to creating the
   one exact absent SyncRun/Job/receipt transaction. It is not an ordinary
   permit and cannot update an existing run.
5. A fenced Project job resolves the credential briefly, fetches one bounded
   page under deadline/rate limits, normalizes items and discards raw transport.
6. Each accepted item enters the Stage 05 scan/integrity pipeline and settles
   as an immutable FileVersion with external-item lineage in one Project
   transaction under a fresh exact work-sourced permit; unsafe items remain
   quarantined.
7. The continuation advances only with the corresponding item results. Full
   reconciliation periodically repairs missed notifications, expired cursors
   and provider-side moves/deletes according to declared policy.

Webhooks verify provider signatures and enqueue only a subscription hint. They
never carry a Taurus principal, select a Project Database or authorize a fetch;
without an active exact standing-work delegation and subscription receipt, no
WorkAuthority or provider use is admitted.

## Authority, transactions, failure, and recovery

Control consent and Project intake are intentionally separate transactions.
Before every provider page and Project commit, the worker reconstructs the
exact active per-run WorkAuthority/Job receipt and checks current connection,
subscription, standing-delegation and placement generations; each Project
effect consumes a fresh work-sourced permit. Pause/delete, connection revoke,
User-wide revoke or generation change denies new provider use and fences older
permits before reporting effective. Already committed FileVersions remain
subject to Product retention and access policy.

Neither a pending WorkAuthority, a Project receipt nor a webhook/timer hint can
issue an ordinary effect permit. A missing Project receipt leaves a harmless
expiring/revoked Control orphan. Lost acknowledgement is recovered only by
exact trusted receipt verification and never by minting a replacement run.
Current-family sign-out preserves an explicitly admitted sync or standing-work
delegation; sign out everywhere, User disable/removal, grant/policy/entitlement
loss, subscription pause/delete, connection generation change, cancellation,
expiry or explicit revoke denies new permits and fences affected work.

The separately typed `durable_job@1` finalizer may only terminalize the exact
pre-admitted Job bookkeeping after authority loss; success requires prebound
proof that an ordinary permitted effect already settled. It cannot change
SyncRun/subscription/continuation/item state, call the provider, publish a
FileVersion/Source, enqueue another sync or widen scope/budget. Capability state
must commit under a fresh permit before revocation or remain nonterminal.

Exact item version plus subscription generation forms the idempotency identity.
Crash before a Project commit replays the page; crash after commit returns the
same FileVersion mapping. Rate limit, credential expiry, consent-required,
provider outage, invalid continuation, item deletion and content quarantine are
distinct stable states. Bounded retry honors provider guidance; invalid consent
or policy waits for explicit reconnect instead of looping. Full reconciliation
is the recovery authority when incremental state is lost.

## Production and test composition

Production registers only providers named in configuration whose exact
authority, scopes, credential vault, callback, rate policy and adapter version
are present. Missing or synthetic dependencies keep that provider unavailable
without disabling local upload. Testing uses a protocol-faithful fake provider
with signed callbacks, pagination, replay, rate limit, deletion and cursor-loss
fixtures. Live promotion additionally requires a real least-scope consent and
revoke/reconnect/outage run against each enabled provider.

## Proof matrix

- state/nonce/PKCE, redirect/authority/tenant and callback one-time use;
- credential tokens absent from databases, jobs, logs, errors and Audit;
- minimal-scope refusal, scope reduction, expiry, rotation and revocation;
- pagination, incremental change, webhook duplication/loss and full rescan;
- provider catalog filtering, connection get/list/revoke/delete and
  subscription get/list/pause/resume/delete state/generation races;
- manual WorkAuthority pending/commit/ack/lost-ack/orphan/revoke and periodic
  standing-work activation/trigger replay/run exhaustion/expiry, including
  pause/connection-generation/User-wide revocation during page fetch/commit;
- `ReceiptBootstrapCredential` type/target confinement and proof that neither
  it, pending WorkAuthority nor Project receipt can authorize ordinary effects;
- current-family sign-out survival and exact `durable_job@1` confinement after
  broader revocation, including no connector capability-state change;
- item move/rename/delete, version replay and continuation invalidation;
- provider ID/path/metadata/content hostile bounds and SSRF protections;
- quarantine/scan/FileVersion lineage and exact Source acquisition;
- crash/retry/lease-loss at every page/object/Project-commit boundary;
- two Users/Projects/connections cannot cross roots, tokens or File mappings;
- live provider rate/outage/reconnect plus operator Project-database
  backup/restore of subscription state; and
- headless consent fixture → subscription → sync → immutable File → Source.

## Completion evidence and remaining boundary

One provider is complete only when its selected item workflow passes the
deterministic, live-provider, failure, recovery and least-scope evidence above.
Other Q006 candidates remain unavailable. Translation may later convert an
intake File through Stage 11; connector success never implies format fidelity.

## Consequential decisions and source grounding

- **Q006 gates concrete code.** Direction: retain a generic Stage 05 contract,
  then build only selected workflow adapters. Alternative: speculative adapters
  for every provider. Revisit when a provider workflow is prioritized.
- **Control owns consent; Project owns intake.** Direction: two explicit
  generation-fenced transactions. Alternative: copy credentials into each
  Project Database, rejected because it expands secret and revocation scope.
- **Files are the intake boundary.** Direction: every external byte becomes a
  scanned immutable FileVersion before Knowledge or Translation. Alternative:
  let providers populate family tables directly, rejected for authority and
  fidelity reasons.

Grounding: [Files, Sources and connectors](../capabilities/files-sources-connectors.md),
[Stage 05](05-files-sources-connectors.md),
[Control/Project boundary](../architecture/control-and-project-boundary.md), and
[import/export flow](../flows/import-export.md).
