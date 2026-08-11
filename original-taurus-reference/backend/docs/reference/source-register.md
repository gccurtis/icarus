# Source register

## Purpose

This register identifies the authorities used to specify Taurus Omega and the
rules for resolving disagreement between them. It is a construction reference,
not a migration plan. Omega is a greenfield rebuild; Taurus and Taurus Nova are
evidence repositories, not codebases to preserve.

## Authority order

The binding order is:

1. Explicit decisions in [`docs/decisions/README.md`](decisions/README.md).
2. Current Omega architecture and capability contracts in this repository.
3. Original Taurus construction specifications for intended product behavior.
4. Taurus Nova source and tests for observed implementation behavior.
5. Older Taurus and Nova architecture for historical context only.

The more authoritative source narrows or replaces the less authoritative one.
Silence in a higher source does not make an older runtime mechanism binding.
Every consequential ambiguity must be recorded in the decision or question
register before implementation.

## Evidence labels

Use one of these labels when describing inherited behavior:

| Label | Meaning |
| --- | --- |
| **Omega authority** | Accepted product or architecture behavior in this repository. |
| **Taurus target** | Intended feature behavior in the construction corpus; it still requires an Omega capability contract. |
| **Nova working legacy** | Executable behavior in Nova's file-backed `/dev` proof or browser application. |
| **Nova working durable** | A durable domain path is composed and live-tested, even if production activation remains fail-closed. |
| **Nova primitive** | Useful code and deterministic tests exist without a complete promoted product journey. |
| **Presentation-only** | A visible surface exists without canonical backend behavior. |
| **Target-only** | A behavior is described but has no inspected working implementation. |

Do not use “implemented” without one of these qualifiers. Source quality alone
does not establish production evidence.

## Omega controlling sources

| Source | Responsibility |
| --- | --- |
| [`AGENTS.md`](../../AGENTS.md) | Binding working agreement, greenfield rule, dependency rules, and capability-document completion standard. |
| [`docs/decisions/README.md`](decisions/README.md) | Accepted product, tenancy, runtime, persistence, concurrency, authority, and sign-out decisions. |
| [`docs/product/vision.md`](product/vision.md) | Product promise, people model, product surfaces, and backend-truth principles. |
| [`docs/product/experience-map.md`](product/experience-map.md) | Visible features mapped to canonical owners and the completion standard. |
| [`docs/architecture/system-map.md`](architecture/system-map.md) | Host, Control, bound Cells, Project Databases, and truth boundaries. |
| [`docs/architecture/control-and-project-boundary.md`](architecture/control-and-project-boundary.md) | Identity, sessions, grants, placement, strong permits, Audit, and provisioning. |
| [`docs/architecture/request-dispatch.md`](architecture/request-dispatch.md) | Versioned operations, environmental envelope, nested dispatch, and mutation sequence. |
| [`docs/architecture/capability-model.md`](architecture/capability-model.md) | Capability ownership, ports, package independence, and completion contract. |
| [`docs/architecture/persistence-and-concurrency.md`](architecture/persistence-and-concurrency.md) | Per-capability persistence/concurrency policy and Document ChangeSet authority. |
| [`docs/architecture/jobs-audit-observability.md`](architecture/jobs-audit-observability.md) | Durable work, required Audit, Activity, telemetry, and realtime projections. |
| [`docs/architecture/repository-map.md`](architecture/repository-map.md) | Intended package ownership and dependency direction. |
| [`docs/capabilities/project-audit.md`](capabilities/project-audit.md) | Exact-Project required-Audit search/export/delivery and typed-reader isolation. |
| [`docs/questions/README.md`](questions/README.md) | Open decisions with current fail-closed defaults and implementation deadlines. |

## Original Taurus product and construction sources

The following pages are product-behavior evidence. Their former Rust service,
event-runtime, construction-factory, or deployment mechanisms are not Omega
requirements.

| Source | Use in Omega |
| --- | --- |
| [Taurus project](https://app.notion.com/p/38bb6410e5028184ad23f350113cd3cc) | Top-level product context and index into the original resource corpus. |
| [Original Taurus Product Vision](https://app.notion.com/p/377b6410e50280c69389e5763939cbf0) | Product promise, resource families, workspace, collaboration, intelligence, knowledge, formulas, memory, agents, import/export, and user journeys. |
| [Taurus Construction database](https://app.notion.com/p/377b6410e50280228b00c11b957c5d43) | Detailed domain behavior, types, operations, providers, errors, and proof ideas. Interpret “service” as a product boundary, not a required process. |
| [Back-End Construction specs](https://app.notion.com/p/38bb6410e502816cbe98e415f3f52aa2) | Index and status for original construction records. |
| [Taurus Back-End Architecture Overview](https://app.notion.com/p/37fb6410e502817c99c3dbfff9b93f42) | Historical topology and product vocabulary only; the event runtime is superseded by Omega D002, D003, and D009. |
| [SOL X 00 — Master Blueprint](https://app.notion.com/p/39ab6410e5028158b555c9a34752e292) | Cross-domain target behavior and responsibility map. |
| [SOL Y 00 — Master Implementation Corpus](https://app.notion.com/p/39ab6410e502813c8a9fd566d355fe63) | Detailed implementation-oriented target material, subject to Omega architecture. |
| [SOL Y 89 — Manifest](https://app.notion.com/p/39ab6410e50281c28039d16eea62b63e) | Corpus navigation and coverage reference. |
| [SOL Y 98 — Developer Guide](https://app.notion.com/p/39ab6410e50281928025cdf64f09426d) | Historical construction guidance; dependency/runtime instructions do not override Omega. |
| [SOL Y 99 — Glossary](https://app.notion.com/p/39ab6410e5028120b143d2b7964136ae) | Terminology evidence reconciled into [`glossary.md`](glossary.md). |
| [SOL X 14 — Project Selection](https://app.notion.com/p/39ab6410e5028114883af87b51fccc3b) | Project search, grouping, sorting, pins and entry actions. |
| [SOL X 16 — Project Overview and Catalog](https://app.notion.com/p/39ab6410e5028101ab70d2f429b67174) | Project profile, creation entry points, unified catalog, favorites, members and overview composition. |
| [SOL X 20 — Organizations, Identity & Sessions](https://app.notion.com/p/39ab6410e50281b0b809d2cce095584d) | Organization/User administration, identity, sessions and security surfaces; cardinality is replaced by Omega D004. |
| [SOL X 21 — Access, Projects & Sharing](https://app.notion.com/p/39ab6410e502814babc4e727a3437c9b) | Project lifecycle, direct sharing, link behavior and access administration; authority semantics are replaced by Omega D004/D007. |
| [SOL X 22 — Entitlements, Billing & Admin](https://app.notion.com/p/39ab6410e50281feae0ad70b715220a7) | Entitlements, subscription/usage administration and provider reconciliation target behavior. |
| [SOL X 25 — Workspace Persistence](https://app.notion.com/p/39ab6410e502815181b3d2823db55262) | Permanent destinations, tabs, panel preferences and restoration behavior. |
| [SOL X 26 — Documents](https://app.notion.com/p/39ab6410e5028138a2edf7db1214ad1e) | Complete Document family surface, blocks, styles, generated content, history and rendering. |
| [SOL X 27 — Workbooks](https://app.notion.com/p/39ab6410e502819a9db4da4a76cd1adb) | Workbook/Worksheet, grid, table, formula, binding, chart and render behavior. |
| [SOL X 28 — Decks](https://app.notion.com/p/39ab6410e50281a79849c7e55ef42af9) | Deck/Slide, layout, theme, element, note, binding and presentation behavior. |
| [SOL X 29 — Boards](https://app.notion.com/p/39ab6410e50281e894d5ebec8cd991c8) | Whiteboard/dashboard modes, spatial objects, connectors, bindings and views. |
| [SOL X 30 — Chats](https://app.notion.com/p/39ab6410e50281b4971bfb5c1b5a38f1) | Conversation branches, grounded replies, SavedOutputs, histories and promotion. |
| [SOL X 31 — Files and Upload Batches](https://app.notion.com/p/39ab6410e5028184ae70fe7b0083355a) | Immutable File versions, multi-file/folder batch intake, progress, failures and retries. |
| [SOL X 33 — Resolution Outputs](https://app.notion.com/p/39ab6410e50281f09729f532db04791c) | Persistent normalized outputs, exact mounts, revision history and settlement. |
| [SOL X 41 — File Upload Surface](https://app.notion.com/p/39ab6410e5028132b831fd0378161f8b) | Drag/drop, folder intake, batch progress, collision policy and error recovery experience. |
| [SOL X 44 — Intelligence Budgets](https://app.notion.com/p/39ab6410e5028127b45ee0f51977d1ee) | Model admission, token/cost ceilings, continuations, receipts and provider governance. |
| [SOL X 45 — Quarterback, Agents, Personas & Task Execution](https://app.notion.com/p/39ab6410e50281b0bb98d7a1d726080f) | Ask/Action/Plan, Agent, Persona, Task, Plan, tool, approval, verification, and Memory target semantics. |
| [SOL X 46 — Templates](https://app.notion.com/p/39ab6410e502817b9773de5f8db9f66e) | Family-owned Document/Workbook/Deck/Board template definitions, publishing and instantiation. |
| [SOL X 47 — Change Sets, Proposals, Review & Undo](https://app.notion.com/p/39ab6410e5028135a246d3d806110f9f) | Attributable change metadata, Proposal/ChangeGroup review, history/diff, and owner-specific inverse/compensation behavior; D006 replaces its universal ChangeSet persistence with family-owned history. |
| [SOL X 65 — Settings and Sharing Surfaces](https://app.notion.com/p/39ab6410e5028132925cd75b41046788) | Account, Project and Organization settings scope, consequences and sharing controls. |
| [SOL X 67 — Notifications, Activity & Recommendation Delivery](https://app.notion.com/p/39ab6410e50281b98095c2f7e99f4466) | Attention hierarchy, notification/subscription/preference/delivery model, dedupe, quiet hours, privacy, and separation from Activity/Audit/authority. |
| [Taurus Design System Index](https://app.notion.com/p/392b6410e50281f1a374fa89a941626a) | Visual doctrine, shell geometry, interaction/disclosure, Quarterback presentation, motion, component and accessibility contracts. |

### Product-operation supplements

These later pages are compact feature summaries and useful acceptance
orientation. They are provisional where they say so.

| Source | Product behavior grounded |
| --- | --- |
| [Operation Vellum](https://app.notion.com/p/394b6410e502819c9cf1e59c10fba631) | Document surface, blocks, marks, selection, prompt-block editing, and inspector behavior. |
| [Operation Manuscript](https://app.notion.com/p/395b6410e5028176a30de7f8d7fc25b8) | Complete Document family: richer blocks, outline, Formula consumer, prompt output, and translation hooks. |
| [Operation Lattice](https://app.notion.com/p/394b6410e50281c88ab9e42ba2d140ce) | Knowledge retrieval, sufficiency, artifact lifecycle, provider evolution, and grounding evidence. |
| [Operation Calculus](https://app.notion.com/p/394b6410e50281259c75dfbe9121c002) | Formula language, evaluator, named formulas/tables, and cross-Resource consumers. |
| [Operation Keystone](https://app.notion.com/p/394b6410e5028183af47f2bd097fadb4) | Sign-in, sessions, access, Projects, and startup experience; relationship rules are replaced by Omega D004. |
| [Operation Codex](https://app.notion.com/p/394b6410e50281b3bb8bc8dd2d22ae5e) | Files, upload, extraction, translation, import, export, and provenance. |
| [Operation Legion](https://app.notion.com/p/394b6410e502814994ceece646403c79) | Agents, personas, tasks, tools, Memory, automation, and supervised Resource changes. |

## Taurus Nova evidence snapshot

Nova evidence is pinned to repository
[`gccurtis/merkabah`](https://github.com/gccurtis/merkabah) at commit
[`3df790b2ac736f644e577ae4e6f4e899e6e85b6d`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d).
Moving-branch observations are not evidence until recorded against a commit.

Primary guides:

- [Nova Project Index](https://app.notion.com/p/393b6410e5028128a368ccbfb24d9c07)
- [Nova Architecture Guided Tour](https://app.notion.com/p/39fb6410e502817f896dd43328752846)
- [Nova Production-Grade Architecture Blueprint](https://app.notion.com/p/396b6410e502817babadc0e26dda7f06)
- [Nova Design Decision Ledger](https://app.notion.com/p/393b6410e50281838782f3005870b02e)
- [Nova Build Command Center](https://app.notion.com/p/39eb6410e50281ff84fec039b88087a2)
- [TN-I02 Identity and Project Workspace](https://app.notion.com/p/39eb6410e50281948921cbdb5de707c7)
- [`nova-evidence.md`](nova-evidence.md), the inspected code-and-test map for Omega authors

Repository citations must name the path and important symbol, for example:

> Nova working legacy: [`internal/document/service.go` `Service.UpdateBlockData`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/document/service.go)

## Known source conflicts and resolutions

| Conflict | Omega resolution |
| --- | --- |
| Original Taurus coordinates work through a universal event runtime. | D009: explicit calls, bounded nested dispatch, and explicit durable jobs; no global event runtime. |
| Original sources often call domains independently running services. | D003: capabilities are independently testable Go libraries. Host, Control, handlers, and job runners own runtime concerns. |
| Nova permits multi-Organization Users and multiple Project owners. | D004: one Organization per User; one home Organization and exactly one User owner per Project; sharing uses direct User grants. |
| Nova uses shared Control/Cell database topology and file-backed product content. | D005/D008: separate Control truth and one logical Project Database per Project; canonical Resource content is backend-owned. |
| Nova's browser editor writes through a `/dev` compatibility edge. | No compatibility edge is brought forward. Product handlers and versioned operations are the only Omega content path. |
| Nova calls Formula, Knowledge, and Intelligence “services.” | In Omega they are capability libraries. A handler adapter supplies consumer-owned ports and may use bounded nested dispatch. |
| Historical sources model all changes as events. | D006: each canonical owner defines its own concurrency model; Documents alone use the accepted base + ordered ChangeSets + head design. |
| Historical authorization tolerates a permit validity window. | D007: every protected request checks current durable authority; mutations consume a fresh one-use permit, and effective revocation fences all older permits. |

## Citation and implementation rules

1. A capability page must cite its controlling Omega documents, relevant
   Taurus construction pages, and exact Nova code/tests used as evidence.
2. Copy product behavior, invariants, and failure lessons—not old runtime
   topology, package names, or wire formats.
3. A test in Nova proves only the behavior it executes. A schema proves only
   representation intent unless a composed live test uses it.
4. A UI placeholder is not a backend capability. A domain primitive is not a
   production path. A source-only gate is not live production evidence.
5. When current code contradicts a Notion snapshot, cite both and prefer the
   inspected commit for “what works”; preserve Notion for target intent.
6. Do not create migration, compatibility, source-map, or rollback-to-Nova
   documents. Any future import of real deployed data requires a new explicit
   decision.
