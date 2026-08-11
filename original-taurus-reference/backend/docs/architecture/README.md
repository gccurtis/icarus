# Architecture

How the Taurus Omega backend **core** is built, grounded in the code as it exists
today. Read this set to understand the whole codebase — each document pairs the
concept (what a piece does and why) with the implementation (how the code does
it), and links straight to the source.

Start with the **[runtime model](runtime-model.md)** for the whole picture, then
follow the threads that interest you.

## The set

| Document | What it covers |
|---|---|
| **[Runtime model](runtime-model.md)** | **Canonical, as-built.** The six-phase spine (config → composition → control gate → dispatch → capabilities → persistence), the capability meta-model, file organization, and an end-to-end request walk. Start here. |
| **[Ports & adapters](ports-and-adapters.md)** | The executable import policy, reviewed exception budget, fail-fast startup closure, logical User Cell/Project Subcell port contract, unit-of-work/outbox boundary, and modular deployment decision. |
| **[Issues & gaps](issues-and-gaps.md)** | The living register of where the running system falls short of the runtime model — bugs, privacy, defence-in-depth, efficiency, the job system, God files, and doc drift — severity-rated with fixes. |
| **[Where we stand](where-we-stand.md)** | The model boundary in one read: what the live suites prove on the shipped config, every bug found with its fix, each model/embedding/limit decision with the evidence behind it, and what is still open. |
| **[Intelligence: next steps](intelligence-next-steps.md)** | The working plan for the model boundary — splitting casts by the work being done, reasoning effort, testing *upward* through stronger models with priced options, tool-limit sizing, and the precision probe the current suites cannot provide. |
| **[Configuration](configuration.md)** | How the manifest is resolved (defaults → template → local secrets overlay) and every setting that shapes the server. *(Inventory drifting — see `DOC-1`.)* |
| **[Transport](transport.md)** | The HTTP edge: routing, the public/gated/project-scoped access gates, and dispatch. *(Inventory drifting — see `DOC-1`.)* |
| **[Persistence & jobs](persistence.md)** | The single SQLite store (schema, WAL, transactions) and the durable background-jobs system. *(Inventory drifting — see `DOC-1`.)* |

### Capabilities (the domain)

One document per package in [`core/capability/`](../../core/capability/) — a 1:1
mirror. The shape they all share (value types, a `Scope`, ports, a stateless
service built by `New(...)`) is described in
[runtime-model §6](runtime-model.md#6-phase-4--the-capability-meta-model).

| Capability | What it covers |
|---|---|
| **[Access](capabilities/access.md)** | Identity, the login session and cookie, projects, membership, roles, purpose, visibility, and role-carrying share links. |
| **[Activity](capabilities/activity/README.md)** | Immutable, Project-scoped semantic events emitted atomically by canonical Resource mutations. |
| **[Agents](capabilities/agents/README.md)** | Quarterback work — durable Plan/Action tasks driving the Intelligence tool-use loop (wired at `/agent/*`), plus the read-only [Ask](capabilities/agents/ask.md) answer path (library-only). The one sanctioned composition-tier capability. |
| **[Chat](capabilities/chat.md)** | Durable Project-scoped AI conversations: a container plus ordered turns and attachments, executed through an injected engine port. |
| **[Comment](capabilities/comment.md)** | Anchored document discussion — a comment pinned to a document anchor with an ordered reply thread. |
| **[Connector](capabilities/connector.md)** | External-source connectors that name where outside content lives, and the sync that pulls it into the knowledge lattice. |
| **[Contexts](capabilities/contexts.md)** | Named, nestable sets of resource references (`{includes, excludes}`) resolved live to concrete leaf resources. |
| **[Documents](capabilities/documents/README.md)** | The editable content model, change sets, re-base, Resource projection, Activity facts, and prompt blocks — with a type-by-type [data model](capabilities/documents/data-model.md), [block types](capabilities/documents/block-types.md), [atoms & marks](capabilities/documents/atoms-and-marks.md), and [prompt blocks](capabilities/documents/prompt-blocks.md). |
| **[File](capabilities/file.md)** | The Project-scoped binary file store: metadata plus opaque bytes behind a Store port. The clean template of the capability shape. |
| **[Formula](capabilities/formula/README.md)** | The deterministic `formula/v1` parser/evaluator plus the wired, SQLite-backed per-project [name manager](capabilities/formula/name-manager.md), with an exact [data model](capabilities/formula/data-model.md), [query semantics](capabilities/formula/querying.md), and complete [formula catalog](capabilities/formula/supported-formulas.md). |
| **[Intelligence](capabilities/intelligence.md)** | The single model-provider boundary, driven by semantic **casts** and their config mapping. |
| **[Knowledge](capabilities/knowledge/README.md)** | The retrieval **lattice** — its own subdirectory: [lattice](capabilities/knowledge/lattice.md) (build), [retrieval](capabilities/knowledge/retrieval.md) (query), and [lifecycle](capabilities/knowledge/lifecycle.md) (add/update/remove). |
| **[Notification](capabilities/notification.md)** | Ephemeral per-user toast queues. **Stateful** — the service is its own in-memory store, by design. |
| **[Organization](capabilities/organization.md)** | Organizations spanning projects and their memberships. Only ever *narrows* resource visibility; never grants project access. |
| **[Personas](capabilities/persona.md)** | Project-local, versioned behavior profiles that shape agent work, with a managed **General** default per user. |
| **[Presence](capabilities/presence.md)** | In-memory, TTL-pruned collaborator presence on a document. **Stateful**; distinct from both the auth cookie and the Sessions capability. |
| **[Reference](capabilities/reference.md)** | The directed reference graph between resources — links and backlinks — with display names resolved at read time. |
| **[Resources](capabilities/resources/README.md)** | The unified Project catalog and lifecycle router over canonical family owners; Documents are the first registered family. |
| **[Sessions](capabilities/session.md)** | Ephemeral per-user, per-project **presence** — document focus and caret/selection — distinct from the auth cookie. **Stateful.** |
| **[Workspace](capabilities/workspace.md)** | The opaque per-user × per-project cockpit blob (tab and panel geometry); validated only as bounded JSON. |

The Intelligence [tool-use loop](capabilities/intelligence/tool-use.md) now has a
production caller: the [agent](capabilities/agents/README.md) capability drives it
for durable Plan and Action tasks. The read-only
[Quarterback Ask](capabilities/agents/ask.md) path is built as tested library code
but is not yet routed over HTTP.

### Workflows (cross-capability flows)

| Workflow | What it covers |
|---|---|
| **[Prompt resolution](workflows/prompt-resolution.md)** | Resolving a prompt block end to end — plan → retrieve → synthesize → incorporate — with the **full, configurable prompts** the model is given. |

## How to read the codebase alongside these docs

- These documents are the **conceptual layer**. Every non-test `*.go` file under
  [`core/`](../../core/) once had a sibling `FILE.go.md` describing it in prose,
  kept fresh with the code. That practice is retired and those 191 documents are
  archived under [`archive/companions/`](../../archive/companions/README.md),
  mirroring their original paths — history now, not current reference.
- [`docs/records/`](../records/) is the **change log**: numbered records of what
  changed and why (the knowledge lattice's design and correction are recorded in
  0008–0010).
- [`docs/backend-guide.md`](../backend-guide.md) is the **practical** companion —
  how to run the server and call every endpoint, for a front-end or harness.
- [`dev-test/`](../../dev-test/README.md) exercises the running platform
  end-to-end; each suite's `manual.md` is a by-hand walkthrough of a feature.

## Relationship to `docs/reference/`

[`docs/reference/`](../reference/README.md) is older, **aspirational** design
material — the product being worked toward, not a description of what exists. This
`docs/architecture/` set describes the code that is actually here. Where the two
disagree, the code and this set win.
