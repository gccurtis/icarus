# Target repository map

Directories are created when a construction stage introduces real code. The
tree below is a dependency and ownership map, not a request for empty packages.

```text
taurus-omega/
├── README.md
├── AGENTS.md
├── go.mod
├── go.sum
├── flake.nix
├── flake.lock
├── Makefile
├── cmd/
│   ├── taurus-omega/              Product Host entrypoint
│   ├── taurus-control-worker/     Control jobs and authority-fence fanout
│   ├── taurus-operator/           privileged infrastructure state-machine steps
│   ├── taurus-migrate/            operator-only one-shot schema plan/verify/apply
│   └── taurus-lab/                headless operations and golden journeys
├── internal/
│   ├── host/
│   │   ├── bootstrap/             identity/session/project entry
│   │   ├── routing/               pre-Cell and bound-Cell routing
│   │   ├── cells/                 factory, registry, placement, supervision
│   │   ├── projectstores/         sealed typed Product/settlement/proof/fence handles
│   │   ├── jobs/                  Project Product-job supervision/reconstruction
│   │   │   ├── activity/          bounded local/Control fact projection and rebuild
│   │   │   └── projectaudit/      exact Project-Audit export build/reaping
│   │   ├── finalizers/            closed-kind exact terminal/restrictive graph
│   │   │   ├── durablejob/
│   │   │   ├── task/
│   │   │   ├── intelligence/
│   │   │   ├── agentdisable/
│   │   │   ├── routine/
│   │   │   └── projectauditexport/
│   │   └── runtime/               lifecycle, limits, readiness
│   ├── control/
│   │   ├── identity/
│   │   │   └── enterprise/        versioned OIDC/SAML trust policy
│   │   ├── security/              authenticators, step-up, recovery
│   │   ├── sessions/
│   │   ├── users/
│   │   ├── organizations/
│   │   ├── projects/
│   │   │   ├── pins/              private pre-Cell Project pin sets
│   │   │   ├── sharelinks/        signed-in bounded invitation authority
│   │   │   └── copy/              isolated durable Project duplication
│   │   ├── access/
│   │   ├── admin/                 exact Control-owned admin composition; no generic settings map
│   │   ├── entitlements/
│   │   ├── billing/               subscription, usage ledger, provider ports
│   │   ├── placement/
│   │   ├── provisioning/          state/lifecycle; no DDL implementation
│   │   ├── connectors/            consent, connection identity, token SecretRefs
│   │   ├── intelligence/          Cast/route/provider policy and limits
│   │   ├── agents/                principal/grants, sponsorships, delegations
│   │   ├── workauthority/         exact non-Agent Work/Job authority sagas
│   │   ├── workdelegations/       finite periodic Product-work ceilings
│   │   ├── exports/               governed account/Audit artifacts and delivery
│   │   ├── jobs/                  Control-owned jobs
│   │   │   ├── authority/         revocation/fence fanout and reconciliation
│   │   │   └── exports/           build, expire, and reap Control exports
│   │   ├── authority/             one-use permits, settlement proofs, revocation
│   │   │   ├── permitsettlement/  exact post-commit Project proof reconciliation
│   │   │   ├── receiptproof/      exact pending-authority activation proofs
│   │   │   └── receiptbootstrap/  no-session standing-trigger security transition
│   │   ├── audit/
│   │   └── semanticfacts/         retained Control projection inputs
│   │       └── projectreader/     exact-Project paged safe-fact contract
│   ├── cell/
│   │   ├── key.go
│   │   ├── kernel/                request/response/execution/errors/budgets
│   │   ├── access/                bound-scope gate and authority ports
│   │   ├── dispatch/              operation registry and nested invocation
│   │   ├── scheduler/             bounded interactive work
│   │   ├── handlers/
│   │   │   ├── catalog/            rebuildable owner summaries; owner-routed writes
│   │   │   ├── overview/           bounded composition; no canonical aggregate
│   │   │   ├── documents/
│   │   │   ├── workbooks/
│   │   │   ├── decks/
│   │   │   ├── boards/
│   │   │   ├── chats/
│   │   │   ├── files/
│   │   │   ├── connectors/
│   │   │   ├── knowledge/
│   │   │   ├── resolution/
│   │   │   ├── intelligence/
│   │   │   ├── formula/
│   │   │   ├── dataobjects/
│   │   │   ├── datacatalog/
│   │   │   ├── analytics/
│   │   │   ├── translation/
│   │   │   ├── workspace/
│   │   │   ├── favorites/         private Resource/Data refs and decoration
│   │   │   ├── agents/
│   │   │   ├── activity/
│   │   │   │   └── projector/     scoped fact readers, checkpoints, generation rebuild
│   │   │   ├── context/
│   │   │   ├── episodes/
│   │   │   ├── memory/
│   │   │   ├── recommendations/
│   │   │   ├── collaboration/
│   │   │   │   ├── changecontrol/ owner-routed history/review/undo envelope
│   │   │   │   ├── comments/
│   │   │   │   ├── notifications/ recipient attention and delivery envelope
│   │   │   │   └── references/
│   │   │   ├── search/
│   │   │   ├── projectaudit/
│   │   │   │   ├── appender/      Project-UoW writer; never Control transaction
│   │   │   │   └── admin/         typed exact-Project query/export envelope
│   │   │   └── finalization/      schema-owned exact terminal transitions
│   │   └── runtime/
│   ├── capabilities/
│   │   ├── resources/             taxonomy only; no generic Go package
│   │   │   ├── documents/
│   │   │   ├── workbooks/
│   │   │   ├── decks/
│   │   │   ├── boards/
│   │   │   ├── chats/
│   │   │   └── files/
│   │   ├── knowledge/
│   │   ├── resolution/
│   │   ├── intelligence/
│   │   ├── formula/
│   │   ├── dataobjects/           Project data assets; not Resource family identity
│   │   ├── datacatalog/
│   │   ├── analytics/             bounded runs and typed result artifacts
│   │   ├── connectors/            Project subscription, mapping, and sync state
│   │   ├── workspace/
│   │   ├── agents/
│   │   ├── activity/
│   │   ├── context/               bounded Working Context
│   │   ├── episodes/              selective Work Episodes and review
│   │   ├── memory/
│   │   ├── recommendations/       expiring read-only suggestions/drafts
│   │   ├── collaboration/
│   │   │   ├── changecontrol/
│   │   │   ├── comments/
│   │   │   ├── notifications/
│   │   │   └── references/
│   │   ├── search/
│   │   ├── projectaudit/          safe query/export models and validation
│   │   └── translation/
│   ├── integrations/
│   │   ├── billing/               concrete commercial-provider adapters
│   │   ├── connectors/            concrete external-data provider adapters
│   │   └── intelligence/
│   │       ├── openrouter/         provider-neutral inference/embedding adapter
│   │       ├── openai/             provider-neutral inference/embedding adapter
│   │       └── anthropic/          provider-neutral inference adapter
│   ├── operator/
│   │   ├── provisioning/          allocate databases/accounts/credentials
│   │   ├── migrations/
│   │   ├── relocation/
│   │   └── backuprestore/
│   ├── transport/
│   │   ├── http/
│   │   │   ├── server/
│   │   │   ├── middleware/
│   │   │   ├── bootstrap/
│   │   │   └── product/
│   │   ├── cli/
│   │   └── realtime/
│   ├── wiring/
│   │   ├── testing/
│   │   ├── lab/
│   │   ├── development/
│   │   └── production/            separate Product/Control/operator graphs
│   ├── platform/
│   │   ├── config/
│   │   ├── secrets/
│   │   ├── mysql/
│   │   ├── objectstore/
│   │   ├── crypto/
│   │   ├── logging/
│   │   ├── telemetry/
│   │   ├── clock/
│   │   ├── jobs/
│   │   ├── idempotency/
│   │   ├── migrations/
│   │   ├── uow/
│   │   └── health/
│   └── architecturetest/          dependency and persisted-field laws
├── api/openapi/                   public versioned HTTP contracts
├── migrations/
│   ├── control/
│   └── project/                   applied to every Project Database
├── configs/                       schemas/examples/policy; never secrets
├── deploy/local/                  local external dependencies only
├── scripts/
│   ├── dev/
│   ├── architecture/
│   └── supply-chain/
├── web/                           client projection; no canonical Resource
├── test/
│   ├── integration/
│   ├── acceptance/
│   ├── security/
│   ├── recovery/
│   ├── performance/
│   └── golden/
└── docs/
```

## Dependency direction

```text
cmd -> wiring -> one explicit Product, Control-worker, operator, or lab graph

transport -> host public bootstrap/bound-request APIs
host -> control public APIs + cell/runtime + Project jobs/handles
cell/runtime -> access + dispatch + scheduler + handlers
handlers -> their capability API + handler-owned repository/port contracts
handler adapters -> neutral platform clients
capabilities -> standard library + explicitly approved pure libraries
control repositories -> neutral platform clients
Control worker -> Control jobs/authority + distinct trusted settlement,
                  receipt-proof, and fence-only Project handles
operator -> Control provisioning contract + privileged platform adapters
integrations -> handler-owned provider ports + external clients; never canonical state
platform -> no product domain
```

Concrete Intelligence integrations implement the narrow handler-owned
inference/embedding ports. Provider SDK/request/response types, route names,
credentials, retries, and transport errors stop at the adapter; capability
packages and canonical Resource state see only provider-neutral Cast inputs and
normalized receipts. An adapter directory is created only when that provider is
actually admitted and tested.

`cmd/taurus-migrate` is part of the operator graph. It has no Product listener,
Cell, or ordinary Resource credential and can run only with short-lived
schema-management authority. Product archive/package import is a Product
workflow; database backup/restore is separately credentialed operator work.

Required Audit follows the transaction owner. Control handlers use a Control-
UoW appender implemented by `control/audit`; bound-Cell handlers use a Project-
UoW appender under `cell/handlers/projectaudit/appender`. The separate
`projectaudit/admin` handler exposes only the typed exact-Project safe query/
export contract. These packages may share bounded
record vocabulary and safe-field validators, but neither appender can join the
other database's transaction, open a second transaction, or expose product
payloads through the Audit contract.

## Naming

- Use `workbooks`, not `sheets`, for the backend Resource family; a Workbook
  contains Worksheets.
- Use `decks`, not `slides`, for the backend Resource family; a Deck contains
  Slides.
- `workspace` means the per-User/per-Project product view model, not identity.
- `control` means authoritative identity/access/project administration.
- `platform` means technical mechanisms without product policy.
- `wiring` means concrete object graph construction, not business use cases.
