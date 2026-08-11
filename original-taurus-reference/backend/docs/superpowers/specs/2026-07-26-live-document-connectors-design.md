# Live-document connectors and refresh graph design

**Status:** design settled; ready for an implementation plan. The previously
parked question — what a prompt block's *context scoping* means — is resolved
below (see [Context model](#context-model)). The full set of changes is
enumerated in [Changes required](#changes-required) so no piece is lost between
design and plan.

## The demo we are building toward

A single end-to-end scenario, runnable in the terminal, that proves a document
can be a **live view over changing upstream data**:

1. A document whose body is **mostly prompt blocks** (headers/scaffolding are
   hard-coded text; the substantive content is generated).
2. Those prompt blocks are fed by **context variables** — selectable resources,
   not free text — acting as swappable inputs ("context stores").
3. **Swap a context variable** to point at different context → the document's
   generated content **refreshes** to reflect it.
4. A new **connector** resource binds to an external, live data source (a
   `local-folder` subkind for the proto; Google Drive in a later iteration). When
   the underlying data changes, the connector notices (via its companion watcher
   program), re-syncs into the knowledge lattice, and
   **the document refreshes on its own** — proving the change propagated from
   outside the system all the way to the rendered content.
5. The **AI quarterback** makes a structural edit ("split this section in two")
   that itself **creates new prompt blocks, sets their instructions, and
   resolves them** — so an agent edit still yields a live document.
6. A user may hand-edit a prompt-derived block; a substantial divergence from the
   prompt is **surfaced to the user** (frontend concern for now).

## Where we stand today (gap analysis)

Traced against the running backend. What exists, what is a clean extension, and
what is genuinely missing:

| Demo beat | State | Reason |
|---|---|---|
| Mostly-prompt-block document + hard-coded headers | **Exists** | `BlockKindPrompt` + `PromptData` (`document/model.go`). |
| Context variable = *selectable resource* | **Gap** | Context variables bind to **free text** today (`document/template.go`), not to a resource reference. |
| Swap variable → auto-refresh | **Gap** | `set_context_variable` moves no timestamp and clears no `ResolvedAt`, so a `refresh` resolve skips. |
| Connector to external live data | **Gap** | No external-source capability; only manual upload + Markdown import. |
| External change → lattice → downstream refresh | **Gap** | Refresh is pull-based; a lattice update bumps `synced_at` but nothing drives dependent blocks to re-resolve. |
| Quarterback splits a section into new prompt blocks | **Gap (agent surface only)** | The changeset API has every primitive (`insert_block(kind:"prompt")`, `set_prompt`, async `/resolve`); the agent's `document.edit` tool cannot reach them. |
| User edit diverges from prompt → notify | **Frontend** | Users already edit prompt atoms as text; divergence detection is UI. |

The architecture cooperates: resource **kinds** are a closed vocabulary plus a
registered `Family` owner (add a const + implement six methods + register); the
knowledge lattice's **`SourceType` is a free string** (only `document` is wired);
the **job pool** can host sync and refresh work; and **refresh is already a
logged changeset operation** with **system-actor attribution** available. So the
demo is buildable now as a proto — the only thing out of reach is real OAuth,
which the demo does not need.

## Decisions

### Connector is one resource kind with subkinds; "sync" is an operation on it

We add a single `connector` resource **kind** (via the existing kind/`Family`
registry), not two kinds. A connector carries a **subkind** naming its provider —
the first subkind is **`local-folder`**; real providers (`google-drive`, …) are
later subkinds behind the same provider contract. "Sync" is an operation/job on a
connector — pulling the current external content and feeding it into the lattice —
not a separate resource type. (Revisitable if a connector and a sync record turn
out to want independent lifecycles.)

The connector resource is **fully buildable now**; only real-provider subkinds
are deferred. The `local-folder` subkind is a complete, honest implementation,
not a mock.

### The `local-folder` subkind binds a folder, behind a swap-clean provider contract

The first subkind binds a connector to a **local folder** (a mutable stand-in for
SharePoint/OneDrive/Drive). The value of the proto is the *mechanism*, not the
provider. The connector is built against a **provider contract** whose shape does
not assume "local folder," so a real Google Drive subkind — the likely
next-iteration real connector — drops in behind the same interface without
touching anything downstream (lattice feed, reference graph, refresh).

The provider contract must express, at minimum: *read current content* and
*learn that content changed* (below). Everything above the contract (lattice
feed, dependency graph, refresh) is provider-agnostic.

### Change detection is a first-class part of the connector, not an afterthought

Knowing *when* the source changed is the hard part, not reading it. The Omega
server does **not** watch the filesystem itself. Instead the `local-folder`
subkind detects change by **accessing a running companion program** — a local
watcher/agent that observes the folder and reports what has and hasn't changed;
the backend queries it (or receives its signal) to learn a folder needs
re-syncing. This keeps filesystem-watching out of the server, and it generalizes:

- **`local-folder` subkind:** the companion watcher program is the change source.
- **Real providers:** their own change signals (Drive change feed / webhooks)
  satisfy the same contract point later.

The contract abstracts "how we learn it changed" so the companion watcher and a
real push feed are interchangeable. Continuous background syncing with no viewer
present is a valid future mode but not required for the proto.

### Connector content flows through the knowledge lattice

A sync writes the connector's current content into the lattice under a **new
`SourceType`** (e.g. `connector`), reusing `knowledge.Add`. The lattice stays the
single substrate for "what is the current upstream state," so change detection
and refresh both key off it. This keeps the demo's "everything is connected to
the lattice" property literally true.

### A reference graph drives refresh server-side; pull-based stays the truth

Refresh remains **pull-based underneath** — a block re-resolves only when its
inputs actually changed. What we add is a **reference-graph capability** that
records *who is connected to whom*: `resource → lattice source → dependent prompt
blocks`. When a source updates, the server pulls that map and **applies refresh to
every dependent block itself**, rather than waiting for a client to poll each one.

The server *driving* the pulls (instead of the frontend polling) is chosen
because **refresh is already a logged changeset operation** and the machinery to
apply and attribute changes already exists — we are composing existing features,
not inventing a push system. (Frontend polling of a per-document staleness signal
remains a valid fallback and is the natural bridge until this lands; a websocket
push replaces polling later without changing the resolve path.)

### System-attributed, activity-logged automatic refresh

Server-driven refreshes are authored by a **system tributary actor** with
authority to edit any document, and each is **recorded in Activity** like any
other change — so an automatic update is attributable ("system refreshed this
because its upstream source changed") and appears in the journal, not as an
opaque mutation. This reuses the existing `SystemActor` + Activity emission.

**UX caveat (parked, frontend):** a system-wide "everything just changed"
refresh can be jarring — the whole document can visibly re-write. The intended
frontend affordance is a "data changed — updating in progress" hold state so the
change feels deliberate. Backend applies the change; smoothing is frontend polish
and out of scope for the proto.

### Agent gains prompt-aware document tools

The quarterback's document tool surface is extended so an Action can **create a
`prompt` block, set its instruction, and trigger resolution** — mapping to the
`insert_block` / `set_prompt` / async `/resolve` primitives that already exist at
the changeset layer. `document.get` is extended so a prompt block is visible *as*
a prompt (today it reads as a paragraph). No new low-level document primitives are
required — only the agent-facing tools.

## Context model

A prompt block's context **defines the retrieval scope** — it is not supplemental
material layered on top of a project-wide search. Context *is* the world the
block sees.

### Scope is `includes − excludes`

The scope is built compositionally from two per-block selections over sources:

- **includes** — the sources the block draws from; multiple selections union.
- **excludes** — sources removed from that set.

The resolved scope is exactly `includes − excludes` (equivalently, the whole
lattice intersected with the includes, then minus the excludes — the
intersection with the includes is just the includes). **There is no "base" and no
"whole project" toggle.** If a block should see "everything," that is expressed by
including a context variable that *is* everything — not by a separate mode. This
keeps the mental model a literal pair of checkbox lists: pick what's in, pick
what's out.

The 2024/2025 case is expressed directly: include the sources you want and
exclude the 2024 source; or include an "everything" variable and exclude 2024.

Emphasis/boost ("make *sure* you use 2025") is **weighting within a scope**, a
different concern from membership, and is deferred. Membership first.

### Where context lives: document-declared, block-selected

- **Context variables are declared at the document/template level** — a shared
  palette, part of document style. This is the existing `ContextVariable` on
  `TemplateInfo`, upgraded so its binding is a **resource reference** instead of
  free text (`BoundContext string` → a `(kind, id)` source ref).
- **Each prompt block selects its own context** from that palette — its own
  `include` set and `exclude` set. Context is **per-block**, not a single
  document-wide scope every block inherits. A block says "use this variable."

So a block's resolved scope is the union of its included variables' sources minus
its excluded variables' sources.

### Retrieval is scoped to that set

Knowledge retrieval is extended to rank a query **only against windows whose
source is in the resolved scope**. Today retrieval ranks over every project
window; the change is a source allow-set applied before ranking (`Region`/windows
already carry `SourceID`). Scope resolution (`includes − excludes → source set`)
happens before retrieval, so retrieval receives a final allow-set.

### Scope is the dependency edge

The resolved scope doubles as the block's dependency set, so the reference graph
is **precise, not coarse**: "source X changed → which blocks refresh?" is exactly
"which blocks have X in their resolved scope?" This supersedes the currently-inert
per-source revision plumbing (`Region` drops `Revision`) — the graph keys off
scope instead, so that dead path stays retired rather than being revived.

### Changing context marks blocks stale

Editing a block's context selection (or rebinding a variable it uses) **clears
the affected blocks' `ResolvedAt`**, so a subsequent refresh does not skip. This
closes the current gap where `set_context_variable` moved nothing and a refresh
resolve short-circuited.

## Changes required

The complete inventory, grouped by area, so nothing is lost between design and
plan. Each item names the capability/handler it touches.

**A. Connector resource kind** (`core/capability/connector`, new)

- `KindConnector` added to the resource `Kind` vocabulary + `knownKinds`.
- A **subkind** on the connector naming its provider (first: `local-folder`).
- A `Family` owner (create / rename / delete / list / get) so `connector` joins
  `availableKinds` automatically.
- A **provider contract** (interface) abstracting an external source: *read
  current content* and *learn that content changed* — shaped so a real Google
  Drive subkind drops in behind it unchanged.
- A **`local-folder` provider** adapter for the proto.
- Wiring registration in `core/wiring`.

**B. Change detection + sync** (connector + `core/capability/knowledge`)

- A change detector for the `local-folder` subkind that **queries a running
  companion watcher program** (not server-side filesystem watching) to learn what
  changed.
- A **sync** operation: fetch current content → feed the lattice via
  `knowledge.Add` under a **new `SourceType` = `connector`** (new constant).
- Sync also runs on connector create and on manual trigger, not only on change.

**C. Source-scoped retrieval** (`core/capability/knowledge`)

- Retrieval accepts a resolved **source allow-set** and ranks a query only within
  it (filter on `Region.SourceID` before ranking).
- Scope resolution helper: `includes − excludes → source set`.

**D. Resource-backed context variables** (`core/capability/document`)

- `ContextVariable.BoundContext string` → a **resource reference** (`kind, id`).
- Extend the existing `set_context_variable` changeset op payload + validation.

**E. Per-block context selection** (`core/capability/document`)

- A prompt block gains an **`include` / `exclude`** selection over the document's
  context variables (per-block scope).
- A changeset op to set a block's context selection (new op or extension).
- Prompt resolution resolves the block's scope and passes the allow-set to
  scoped retrieval (C).
- Setting a block's selection, or rebinding a variable it uses, **clears the
  affected blocks' `ResolvedAt`** so refresh does not skip.

**F. Reference graph** (`core/capability/reference` or new capability)

- Records `source → dependent prompt blocks`, derived from each block's resolved
  scope (E). Queried on source update.

**G. System-driven refresh + attribution** (handler/wiring composition)

- On a source sync/update, resolve dependents from the graph (F) and apply
  refresh (`resolve_block`) to each, **authored by the system tributary actor**,
  **logged in Activity**. Ensure the system actor may edit any document.

**H. Agent prompt-aware document tools** (`core/capability/agent`)

- `document.get` reveals a prompt block *as* a prompt (instruction + context),
  not as a paragraph.
- New agent tools mapping to existing primitives: **create prompt block**, **set
  instruction** (`set_prompt`), **set context selection** (E), **resolve** (the
  async `/resolve` job).

**I. End-to-end terminal dev-test** — the six-beat scenario, token cost surfaced,
green against the usual unit / transport / race / vet / companion-drift checks.

### Build order

Independent and buildable first: **A, B, C, H**. Then **D, E** (the context data
model + scoped-retrieval wiring), then **F, G** (graph + system refresh, which
depend on E's scope), then **I** (the demo tying it together). Each is
independently testable and gets its own implementation plan.

## Non-goals (proto)

- Real OAuth / real Google Drive, OneDrive, or SharePoint adapters.
- Websocket / push delivery of updates (polling or server-driven refresh only).
- Continuous background polling of sources with no viewer present.
- Backend detection of "user edit diverged from the prompt" (frontend concern).
- The "updating in progress" hold-state UX (frontend polish).
- Scaling the lattice feed to very large external corpora.

## Acceptance criteria (proto demo)

1. A `connector` resource of subkind `local-folder` can be created, points at a
   local folder, and appears in `availableKinds`.
2. Changing the folder's contents — as reported by the companion watcher
   program — causes the connector to re-sync into the lattice without a manual
   API call.
3. A document of mostly prompt blocks, bound to that connector's context,
   refreshes its generated content after the file changes — with the refresh
   attributed to the system actor and visible in Activity.
4. Changing a prompt block's context selection (swapping which variable it
   includes) changes that block's generated content on the next resolve, because
   the change cleared its `ResolvedAt`.
5. Scoping is exact: a block that includes source A and excludes source B
   retrieves only from A — adding content to B does not change its output, and a
   block including an "everything" variable while excluding B never surfaces B's
   content.
6. A quarterback Action can split a section into two new prompt blocks, set their
   instructions and context, and resolve them, yielding a still-live document.
7. The whole scenario runs as a terminal dev-test that surfaces its token cost;
   Omega unit, transport, race, vet, and companion-drift checks stay green.
