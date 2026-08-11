# Capability and product-domain contracts

## Purpose

This directory is the implementation authority for Taurus Omega's Product
capabilities and closely related authoritative domains. It translates the
original Taurus product and construction specifications into the accepted
Omega Host/Cell/capability architecture. It is a greenfield product contract,
not a Nova migration plan.

The pages describe the complete intended product surface and divide it into
versioned operations that can be built and proved incrementally. A feature in a
table is a supported target, not a claim that code or production evidence
already exists. The implementation status of any feature belongs in the
construction plan and test evidence, not in a weakened domain contract.

## Contract map

| Contract | Responsibility |
| --- | --- |
| [Control and administration](control-and-administration.md) | Identity, enterprise federation, authenticators/recovery, sessions, exactly-one Organization assignment, Projects, pins/share links/direct User grants, entitlements/billing, trusted placement, one-use permits, Agent sponsorship authority, and Control Audit |
| [Project Audit administration](project-audit.md) | Exact-Project required-Audit search, governed export, one-use delivery, typed reader isolation, and retention truthfulness |
| [Workspace](workspace.md) | One User's durable view of one Project: permanent destinations, Resource tabs, active durable destination, panel preferences and private Resource/Data favorites |
| [Documents](documents.md) | Structured rich authoring, semantic ChangeSets, prompt/Formula content, exact extraction and print/render projections |
| [Workbooks](workbooks.md) | Worksheets, typed sparse grid, names/tables/charts, Formula/prompt bindings and analytical projections |
| [Decks](decks.md) | Slides, themes/layouts, presentation elements, bindings, notes and deterministic scene projection |
| [Boards](boards.md) | Whiteboard/dashboard canvas, element/connector graph, views, bindings and deterministic spatial scene |
| [Chats](chats.md) | Durable threaded/branched conversation, grounded replies, SavedOutput revisions/history, governed delete/redact, contribution status and promoted-output links |
| [Files, Sources and connectors](files-sources-connectors.md) | Immutable File versions and safe intake; boundary to Knowledge Sources and governed external connectors |
| [Formula and Data](formula-and-data.md) | Pure typed expression language, governed Data Objects, Data Catalog projections and bounded analytic compute |
| [Knowledge](knowledge.md) | Exact source versions, deterministic windows/lattice generations, grounded retrieval, lineage and staleness |
| [Resolution](resolution.md) | Persistent resolvables, plans, sealed evidence, contradictions, typed results, refresh and family settlement proposals |
| [Intelligence](intelligence.md) | Provider-neutral semantic casts, model/embedding routing, budgets, receipts, continuations and sanitized failures |
| [Quarterback and Agents](agents.md) | Ask/Action/Plan semantics, Agents, immutable Instructions, Personas, declared triggers/Routines, Tasks, immutable plans, tool catalog, attempts, checkpoints, verification and review |
| [Activity, Working Context and Memory](activity-context-memory.md) | Semantic Activity, current objectives, work episodes, governed evidence-linked Memory and recommendations |
| [Collaboration, change control, notifications and Search](collaboration-and-search.md) | Owner-routed history/diff/undo, Proposals/ChangeGroups/review, comments, private Notes, references, authorized search, presence, notifications and committed-change hints |
| [Translation and Templates](translation-and-templates.md) | Family-owned templates plus safe native/Office import, export, fidelity and Project archive workflows |

Control is an authoritative application domain rather than an optional
capability library. The remaining pages preserve the same explicit model,
operation, error, security and proof discipline while respecting their more
specific ownership boundaries.

## Resource family map

| Family | Canonical aggregate | Primary concurrency contract | Deterministic headless form |
| --- | --- | --- | --- |
| [Documents](documents.md) | Document base, ordered Document ChangeSets, head and verified checkpoints | Semantic ChangeSet reconciliation and append at canonical head | Canonical JSON, display text and Markdown; print model for PDF/DOCX adapters |
| [Workbooks](workbooks.md) | Workbook containing ordered Worksheets, stable axes, cells, names, tables and charts | Conditional revisions at workbook, worksheet-structure and addressed-object grains | Canonical JSON, typed range/table JSON and CSV |
| [Decks](decks.md) | Deck containing ordered Slides, themes/layouts, elements and notes | Deck-order, slide and element revisions with atomic multi-element commands | Canonical JSON, semantic outline and deterministic scene projection |
| [Boards](boards.md) | Board canvas, modes, elements, connectors, bindings and views | Board-structure and element revisions with atomic graph/geometry commands | Canonical JSON and deterministic SVG scene projection |
| [Chats](chats.md) | Conversation, branches and immutable message revisions | Ordered immutable append plus conditional message/settings transitions | Canonical JSON and Markdown transcript |
| [Files](files-sources-connectors.md) | File metadata and immutable content versions | Immutable version insert plus conditional current-version/lifecycle revision | Metadata JSON, verified download and safe extracted projection |

Sources and connectors are described beside Files because they form the intake
boundary, but they are not alternate File representations. Sources identify an
authorized, exact Resource version for Knowledge. Connectors govern external
account consent and incremental intake. Knowledge owns ingestion and retrieval;
Files owns bytes and versions; a connector owns its provider mapping and sync
state.

## Rules shared by every Resource family

### Ownership and representation

- Each family owns its own serializable model, invariants, operations, render
  or extraction semantics, and concurrency contract. There is no generic
  Resource payload, generic Resource repository or universal event history.
- A canonical aggregate includes stable family identity, name, lifecycle,
  representation version, provenance and family content. Search, Activity,
  workspace tabs and realtime messages hold bounded references or projections,
  never a second authoritative copy.
- Tagged unions are closed and versioned. Unknown kinds, operation versions,
  persisted representation versions or required fields fail closed. A decoder
  never silently drops an unknown value.
- Persisted values contain no `context.Context`, interfaces, clients,
  callbacks, channels, locks, loggers, SQL records, transport DTOs, provider
  objects or credentials.
- Documents, Workbooks, Decks and Boards may own a family-specific Template
  definition/version plus Template metadata. Instantiation validates and
  creates that family's ordinary model. Files has no Template; Chat
  starter/settings presets are plain creation inputs, not Templates. There is
  no universal Template-content capability.

### Operation contract

Public Product operations use stable names such as `documents.get.v1` and
`workbooks.set_cells.v1`. An operation descriptor fixes its action,
input/output type, request class, bounds, idempotency mode, transaction
behavior, job eligibility and nested-call policy. Unknown versions fail before
handler execution.

Every editable Resource family owns an explicit same-Project duplicate
operation. It freezes an authorized exact source version, creates a new family
identity and independent canonical aggregate with bounded provenance, and
commits through that family's ordinary create transaction. It never aliases
mutable state, copies grants/Audit/comments/private workspace state, or accepts
a destination Project/database from request data. Cross-Project or whole-
Project copying instead uses the governed export/import workflow with separate
authority in each Project.

The capability library receives plain trusted domain values. The surrounding
handler performs the environmental envelope:

```text
current exact session/work/Task authority + immutable Cell scope
  -> load one consistent canonical view from the bound Project Database
  -> validate expected versions and operation bounds
  -> call one deterministic capability operation
  -> obtain a fresh exact one-use Project-effect permit
  -> atomically consume permit, persist family state, idempotency and Audit
     plus a bounded SemanticFact for a declared user-visible effect
  -> enqueue any required durable follow-up in the same transaction
  -> return the committed canonical version and bounded projection
```

Queries perform the same current-authority, Cell-scope and bound-store checks,
but do not obtain or consume a mutation permit.

### Commands, queries and jobs

- An operation descriptor has exactly one request class and transaction
  behavior. Neither changes with input size, estimated cost, load, caller or
  runtime profile.
- A bounded Query is read-only. It cannot create a Job, work receipt,
  artifact, idempotency record, `SemanticFact` or other durable state. When a
  valid request exceeds the declared interactive bound, it fails before work
  with a stable family `*_async_required` `precondition_failed` code naming the
  exact durable request operation; that rejection has no side effect.
- A durable request is a separate idempotent Command. It freezes the exact
  authorized inputs and versions and atomically commits the request, Job,
  applicable receipt, idempotency result and Audit envelope. A separate Query
  observes status and the family-owned typed result metadata.
- Ask receives only the bounded Query registry. It cannot invoke a durable
  request Command or turn a Query into a Job implicitly.
- Commands state the exact expected canonical version or finer-grained
  precondition required by the family's concurrency contract. No family uses a
  blind JSON patch as its public mutation language.
- Commands that can be retried require idempotency. Exact replay returns the
  recorded committed result; reuse with a different canonical input digest is
  a conflict.
- Interactive handlers remain bounded. Import, export, OCR, model inference,
  large render, extraction and connector sync use their explicitly named
  durable request Commands when they cannot fit the declared interactive
  budget; a Query never upgrades itself to durable work.
- A job records a bounded input reference and exact source version. Any later
  canonical effect requires either an exact active Control
  `DurableWorkAuthority` plus matching Project Job receipt, or an exact active
  Task sponsorship plus matching Project Task receipt. It then consumes a fresh
  permit immediately before commit. A lease or serialized job is never
  authority. Stale work never overwrites a newer authored or last-good value.
- Work admission may precommit an exact `FinalizationRecord`. Its separately
  typed finalizer may only settle/cancel/fail that same admitted record after
  authority loss; it cannot invoke a provider/tool, mutate Resource output,
  enqueue new effect work, or resurrect authority.

### Cross-capability contracts

The consuming family defines a narrow interface in its own vocabulary. A
handler adapter outside both capabilities satisfies it through bounded nested
dispatch. Sibling implementation imports, service locators, internal HTTP/gRPC
and a universal event runtime are forbidden.

| Consumer need | Contract shape | Typical provider, hidden behind handler adapter |
| --- | --- | --- |
| Prompt-backed content | Resolve or refresh an exact prompt binding and return normalized content, evidence and artifact version | Resolution, Knowledge and Intelligence |
| Formula-backed content | Evaluate a typed expression against explicit names/references and return typed value, dependencies and errors | Formula |
| File/asset content | Read a verified exact object version or safe rendition by opaque reference | Files and object-store adapter |
| Knowledge contribution | Produce a bounded, deterministic, exact-version extraction | Knowledge source acquisition calls the family query |
| Comments and presence | Validate and rebase a family-native anchor; return a bounded target projection | Collaboration |
| Import/export | Translate a declared source/target format without changing family semantics | Translation plus a format adapter |
| Agent action | Execute the same versioned command or create a reviewable proposal under delegated authority | Agents through ordinary dispatch |

Nested work inherits the immutable `(UserID, ProjectID)` Cell key, actor and
delegation chain, action, deadline/cancellation, remaining work/cost/depth
budget, idempotency lineage and trace correlation. It cannot widen scope or
authority.

### Security and failure

- Every read and write is Project-scoped and checks current durable authority.
  Every ordinary protected Project effect obtains a fresh one-use permit from
  exactly one trusted `SessionAuthority`, `DurableWorkAuthority`, or
  `TaskSponsorshipAuthority` immediately before commit. Control mutations use
  their own single-Control-UoW authority check and do not recursively issue a
Project permit. Once revocation reports effective, no previously issued
permit can commit.

- Request input cannot choose a database, credential, placement generation,
  Project identity fence, User identity, canonical author or Audit actor.
- Unauthorized existence is hidden as `not_found` where disclosure would be
  sensitive. Provider, SQL and integrity causes are redacted at the Product
  boundary.
- Required Audit is atomic with every protected effect. A declared user-visible
  effect also atomically writes its bounded projection `SemanticFact`.
  Activity, search, logging, telemetry and realtime cannot substitute for
  canonical state or Audit.
- Caches and notifications are optional hints. Every protocol must remain
  correct with caches disabled and notifications lost, delayed, duplicated or
  reordered.
- Stable kernel categories are refined by bounded family error codes. Pages
  list the family codes they introduce.

## Proof ladder

Every family must pass all applicable levels before a production claim:

1. **Pure contract:** table, property, fuzz and golden tests exercise the
   capability with plain values and deterministic fakes; no Host or database.
2. **Handler contract:** operation registration, authority, idempotency,
   permit timing, Audit, bounds and error mapping are proved.
3. **Live Project persistence:** real database transactions prove concurrent
   multi-Cell behavior, crash boundaries, corrupt-state refusal, retry and
   recovery for that family's protocol.
4. **Provider and job evidence:** real object/provider adapters prove timeouts,
   cancellation, leases, stale output, credential redaction and replay.
5. **Headless acceptance:** `taurus-lab` can create, mutate, inspect and render
   the complete canonical Resource through the same Product operations.
6. **Client convergence:** browser projections converge from canonical
   responses/reads across reload, multiple tabs, conflicts and missed hints.
7. **Operational evidence:** backup/restore, performance, accessibility where
   applicable, retention, export, security and rollback/fail-closed evidence
   match the production risk.

## Source grounding

These contracts apply the current [Omega capability model](../architecture/capability-model.md),
[request flow](../architecture/request-dispatch.md), [persistence rules](../architecture/persistence-and-concurrency.md),
[Control boundary](../architecture/control-and-project-boundary.md),
[experience map](../product/experience-map.md) and accepted
[decisions](../decisions/README.md).

Product intent comes from the original [Taurus Product Vision](https://app.notion.com/p/377b6410e50280c69389e5763939cbf0),
[Taurus project](https://app.notion.com/p/38bb6410e5028184ad23f350113cd3cc),
and [construction catalog](https://app.notion.com/p/377b6410e50280228b00c11b957c5d43).
The original Document construction is verified source evidence; the other five
families are vision-defined and therefore receive explicit Omega contracts
here. Nova source and tests are implementation evidence only: they may prove a
behavior worth retaining, but cannot override these contracts or introduce a
compatibility requirement.
