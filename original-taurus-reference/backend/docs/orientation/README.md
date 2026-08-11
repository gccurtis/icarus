# Orientation — start here

**You are a coding agent about to work in the Taurus Omega repository.** Read this
document fully before touching anything. It tells you what the repo is, how it is
organized, the vocabulary, the rules you must follow, and what to read next. When
you finish it you should be able to find your way to any part of the system and make
a change that fits the way this codebase is built.

Read this, understand it, follow it — then go do the specific task you were given.

> **Working on the Taurus Alpha ↔ Omega integration?** After this document, read
> [`alpha-omega-integration.md`](alpha-omega-integration.md) — it orients you to
> that mission: bringing in Alpha's backend requests and closing the gap so Alpha
> can be fully implemented against Omega.
>
> **Executing the Omega completion program?** Open
> [`docs/current-docs/work-packets/README.md`](../current-docs/work-packets/README.md),
> then give the coding agent one packet file. Each packet contains its full source
> specification, hard dependency gate, required reading, validation, record, and
> pull-request contract.
>
> **Touching `core/capability/knowledge/`, connector sync, or ingest?** The lattice
> is the load-bearing system here and its failures are silent rather than loud: the
> characteristic bug retrieves nothing, or retrieves the *wrong span*, while every
> test passes and every response is a 200.
>
> The resilient-ingest programme that hardened it is complete (records 0152–0160),
> so its orientation document is archived at
> [`archive/orientation/resilient-ingest.md`](../../archive/orientation/resilient-ingest.md).
> Read it for the invariants that fail silently when broken and the mistakes already
> made there — those outlive the work. Treat its "what remains" as history.
>
> What is still open is tracked in
> [`docs/architecture/issues-and-gaps.md`](../architecture/issues-and-gaps.md).

---

## 1. What this is (60-second mental model)

Taurus Omega is a **Go backend** — one process, an HTTPS JSON API — for a
knowledge-aware workspace (documents, projects, retrieval, agent-assisted work). It
is a **greenfield build, done incrementally and by hand**: code is added only when it
is actually built and exercised, in small working steps. There is no scaffolding
ahead of need.

Key shape:

- **One process, one store.** `main` is a thin shell over
  [`core/wiring`](../../core/wiring/); storage is embedded **pure-Go SQLite** (one
  file, no external DB, no cgo). The server always serves **HTTPS** (self-signed cert
  in dev).
- **Ports and adapters.** Capability packages never import concrete adapters.
  Leaf capabilities stay independent; the explicitly inventoried exceptions are
  `agent` (the composition tier), `knowledge → intelligence` (port/value types),
  and `formula/names → formula` (a state layer over a pure library). Cross-
  capability behavior still goes through narrow ports, normally satisfied in
  `wiring`.
- **Code changes are documented by numbered records.** The old sibling `.go.md`
  companion convention is retired and archived. Every material increment still
  requires the numbered record described in §4.

Authoritative deep-dives (read after this): the
[architecture overview](../architecture/runtime-model.md) and the
[backend guide](../backend-guide.md).

---

## 2. Repository map

```
core/                  the backend (all the Go)
  main.go              thin entrypoint → wiring.Run
  wiring/              composition root: reads config, builds everything, owns lifecycle
  transport/          HTTP edge — Echo router, access gates, sync/async dispatch
  endpoint/           transport-agnostic Request/Response contract (handlers never import Echo)
  handlers/           one thin package per capability: HTTP adapter → domain call → response
  capability/         THE DOMAIN — 21 Go packages across 20 top-level capabilities:
                      access · activity · agent · chat · comment · connector · contexts ·
                      document · file · formula · intelligence · knowledge · notification ·
                      organization · persona · presence · reference · resource · session · workspace
  platform/           technical mechanisms, no product policy: config · devcert · dispatch · job · storage/sqlite · telemetry
  integration/        concrete adapters to external systems: intelligence/openrouter · context/web
docs/
  orientation/        you are here
  current-docs/       active Yesod mirror + the 44 agent-facing Omega execution packets
  architecture/       how the code works NOW, grounded in the code (conceptual layer)
  records/            numbered change log — what changed and WHY, over time
  support/            working assessments and roadmaps (e.g. the document backend)
  superpowers/        earlier pre-build design docs (specs/) and implementation plans (plans/)
  reference/          older, ASPIRATIONAL design material — NOT what exists; code wins
  backend-guide.md    practical "run it and call every endpoint" guide for a harness/front-end
dev-test/             end-to-end suites that drive a real running server; each has a manual.md
etc/                  config templates (config.yaml committed; config.local.yaml gitignored, holds secrets)
scripts/              dev-setup.sh (register a dev account)
experimental/         a separate module — spikes; not part of the core build
var/                  runtime artifacts (db, dev cert) — gitignored
AGENTS.md             the working agreement. Authoritative. Read it.
```

The frontend that consumes this backend is a **separate repo** (`taurus-alpha`, a
SvelteKit cockpit). It files "backend requests" against Omega; when you see a feature
framed as "the cockpit needs X," that is its origin.

---

## 3. The layers and the one rule

Dependencies form a stack; an outer layer may depend on the layer beneath,
**never the reverse**. Leaf capabilities remain independent; the sanctioned
composition/type/library edges are frozen in the
[completion architecture inventory](../completion/architecture-startup-inventory.md).

```
transport → handlers → capability → (ports) → platform / integration
wiring assembles all of them
```

- **transport / endpoint** — routing, the access gates, and the map deciding whether
  an operation runs synchronously or is deferred to a background job. See
  [transport](../architecture/transport.md).
- **handlers** — thin HTTP adapters. Read the request, call the domain, shape the
  response. **No business logic.**
- **capability** — the domain. Each capability declares interfaces for what it needs
  (a `Store`, an `Embedder`) and generally ships an in-memory implementation
  (`memory.go`) for its unit tests. It never names a concrete DB or provider.
  Infrastructure-neutral platform mechanisms such as durable jobs, limits, and
  logging may be imported without importing an owning adapter.
- **platform / integration** — the concrete mechanisms and external adapters `wiring`
  plugs into those ports. One `sqlite.Store` implements *every* capability's
  persistence port.

**Access tiers** (enforced in transport): **public** (no session — health, register,
login), **gated** (any signed-in user), **project-scoped** (a project must be
*selected* into the session first). Auth is an opaque `to_session` **cookie**.

**The `/dev` convention:** endpoints under a `/dev` path prefix are maintenance and
tooling not part of the eventual production client surface (e.g. lattice indexing,
document rebase). They are exposed so a harness can drive and observe them.

---

## 4. The rules you MUST follow (from [`AGENTS.md`](../../AGENTS.md))

These are non-negotiable and reviewers will check them.

1. **Small, working steps.** Build the smallest useful piece, get it working, then
   move on. Don't scaffold structure ahead of need. When in doubt, ask before adding
   scope.

2. **Companion docs are retired.** Do not create or update sibling `.go.md`
   files. Historical companions are archived under `archive/companions/` and are
   reference only. The current source and tests are authoritative.

3. **Change records.** Each increment gets one numbered
   [`docs/records/NNNN-<slug>.md`](../records/) capturing *what changed and why* — the
   reasoning behind the diff. One `##` section per file changed, `###` per change, each
   noting **what it does / the goal / why**. Small follow-ups append to the most recent
   relevant record rather than getting a new number. **Numbers are sequential and
   unique** — when merging a branch, renumber any colliding records to the next free
   number.

4. **Test against real providers, and surface the cost.** Deterministic plumbing is
   proved by **unit tests** (with in-memory fakes). Whether a model-backed feature
   *works well* (retrieval quality, synthesis) is proved only in a **live `dev-test/`
   suite** that makes real provider calls. Live suites read the OpenRouter key from the
   gitignored `etc/config.local.yaml` and **skip (exit 0) when no key is present**, so
   CI stays green without secrets. Keep live inputs tiny. Every model response carries a
   `usage` block; a live suite **sums tokens and prints the total + estimated dollar
   cost** at the end (`track_usage`/`usage_summary` in
   [`dev-test/lib.sh`](../../dev-test/lib.sh)). The price of testing is never hidden.

5. **Reference is not authority.** [`docs/reference/`](../reference/README.md) is prior
   design material that may read as more settled than reality. Where it conflicts with a
   deliberate decision or with built code, **the code and current decision win.** Do not
   treat its implementation plan as a required sequence.

---

## 5. The capabilities (the domain)

Read the linked doc before working in one.

| Capability | What it is | State | Read |
|---|---|---|---|
| **access** | Identity, sessions (cookie), users, projects, membership, roles, purpose, visibility, role-carrying share links | wired | [access.md](../architecture/capabilities/access.md) |
| **activity** | Immutable Project feed of confirmed Resource effects with actor/target snapshots and cursor paging | wired | [activity/](../architecture/capabilities/activity/README.md) |
| **document** | The editable content model: page layout + rows → blocks → atoms, fine-grained text/move operations, row/block styles, marks, derived pagination, revision History, undo/redo, Resource metadata, Activity facts, rebase, prompt blocks | wired | [documents/](../architecture/capabilities/documents/README.md) |
| **intelligence** | The single model-provider boundary, driven by semantic **casts**; also a bounded tool-use loop | wired (one-shot reason/infer/embed; the **tool-use loop is now wired** via agent Plan/Action tasks) | [intelligence.md](../architecture/capabilities/intelligence.md), [tool-use](../architecture/capabilities/intelligence/tool-use.md) |
| **knowledge** | The retrieval **lattice**: window → embed → cluster → retrieve grounded, cited regions | wired (under `/dev`) | [knowledge/](../architecture/capabilities/knowledge/README.md) |
| **formula** | Pure deterministic `formula/v1` evaluator plus the `names` state layer of stored scalars, tables, and functions | evaluator is wired through the HTTP/SQLite-backed name manager; no Formula atoms or spreadsheet runtime | [formula/](../architecture/capabilities/formula/README.md), [name manager](../architecture/capabilities/formula/name-manager.md) |
| **resource** | Unified Project catalog/lifecycle router over family-owned identity and metadata | wired; `document` and `connector` are the available families | [resources/](../architecture/capabilities/resources/README.md) |
| **agent** | Quarterback work: durable Plan/Action **tasks** over the Intelligence tool-use loop, composing knowledge, persona, and document tools; plus the read-only **Ask** answer path | Plan/Action **wired** (`/agent/*`, async jobs); Ask is wired through ask-mode Chat turns | [agents/](../architecture/capabilities/agents/README.md) |
| **persona** | Project-local, **versioned** behavior profiles that shape agent work; a managed **General** default per user | wired | [persona](../architecture/capabilities/persona.md) |
| **session** | Ephemeral per-user, per-project **presence** — document focus and caret/selection (not the auth cookie) | wired; **stateful** | [session](../architecture/capabilities/session.md) |
| **chat** | Durable Project-scoped AI conversations: container + ordered turns + attachments, run through an injected engine port | wired | [chat](../architecture/capabilities/chat.md) |
| **comment** | Anchored document discussion: a comment pinned to a document anchor with an ordered reply thread | wired | [comment](../architecture/capabilities/comment.md) |
| **connector** | External-source connectors naming where outside content lives, and the sync that pulls it into the lattice | wired; `local-folder` served over HTTP by `cmd/connector-watcher` | [connector](../architecture/capabilities/connector.md) |
| **contexts** | Named, nestable sets of resource refs (`{includes, excludes}`) resolved live to concrete leaf resources | wired | [contexts](../architecture/capabilities/contexts.md) |
| **file** | Project-scoped binary file store: metadata + opaque bytes behind a Store port | wired (`List` is service-only, unrouted) | [file](../architecture/capabilities/file.md) |
| **notification** | Ephemeral per-user toast queues | wired; **stateful** — the service is its own store | [notification](../architecture/capabilities/notification.md) |
| **organization** | Organizations spanning projects + memberships; only ever *narrows* resource visibility | wired | [organization](../architecture/capabilities/organization.md) |
| **presence** | In-memory TTL-pruned collaborator presence on a document | wired via `handlers/collaboration`; **stateful** | [presence](../architecture/capabilities/presence.md) |
| **reference** | Directed reference graph between resources (links + backlinks), names resolved at read time | wired | [reference](../architecture/capabilities/reference.md) |
| **workspace** | Opaque per-user × per-project cockpit blob (tab/panel geometry), validated only as bounded JSON | wired | [workspace](../architecture/capabilities/workspace.md) |

"Unwired" means the code exists and is tested but nothing calls it over HTTP yet —
by design, in this incremental build. The Intelligence tool-use loop is driven by
Agent Plan/Action tasks, and Quarterback Ask is driven by ask-mode Chat turns. Do
not assume other library code is reachable from an endpoint merely because it
exists.

---

## 6. Vocabulary

- **Cast** — a semantic request for a model, `{purpose, strength, speed, cost}`. Callers
  never name a model; config maps a cast to a concrete provider/model per kind
  (reasoning / inference / embedding).
- **Lattice** — the knowledge retrieval structure. A source is flattened to text,
  **windowed**, each window **embedded**, windows **clustered** into a per-source forest
  joined by a cross-source corpus tier. Retrieval returns **grounded regions**: verbatim,
  cited spans of source text with provenance.
- **Prompt block** — a document block whose text is *generated* from the project's own
  knowledge: resolving it plans queries, retrieves grounded evidence, synthesizes, and
  writes editable atoms with evidence + status. Generated content is `inferred` and never
  fed back into the lattice.
- **Atoms & marks** — the text model inside a block: text is a sequence of atoms; marks
  are ranges carrying formatting/semantics. Ordinary typing can use
  digest-guarded UTF-8 splices; Rows, Blocks, and Atoms have stable-ID move
  operations; Mark replacement is guarded by the prior Mark digest.
- **Document layout** — page geometry and captured row metrics live in the
  revisioned Base; row style adds bounded height, block style owns alignment,
  and pages are derived deterministically rather than persisted.
- **Change submission / revision** — a client edit carries a stable
  `submissionId`, the exact `expectedRevision` it observed, and typed
  operations. An identical retry returns the original ChangeSet. A stale
  distinct submission is admitted only when retained operation footprints
  prove it disjoint from all intervening work; otherwise it gets a bounded
  resync conflict. Disjoint same-Atom splices have coordinates transformed,
  while overlap and missing proof fail closed. The accepted ChangeSet records
  its durable ID, trusted author, client-observed `authoredRevision`, actual
  admission `priorRevision`, and server-assigned `seq`; the document's public
  `revision` is the latest accepted sequence.
  **History** exposes newest-first bounded summaries and retained public
  ChangeSet detail without private inverse recipes.
  **Undo** appends the current author's stored inverse only when an eligible
  revision is still the head; **redo** explicitly compensates a current authored
  undo. Their revisions point back with `undoOf` or `redoOf`. This protects
  later collaborators' edits and lets any new head invalidate stale redo.
  **Rebase** folds pending changes into a new base without changing the logical
  revision (async job).
- **Project scoping** — most real work happens inside a *selected* project; the session
  carries the selection, resolved into an `access.Context` with the user's role.
- **Resource** — a unified `(kind, family-owned ID)` catalog entry. Resource does
  not duplicate content or metadata; it routes lifecycle work to a canonical
  owner (currently Documents and Connectors).
- **Activity** — immutable semantic snapshots of confirmed Resource effects
  (`created`, `edited`, `renamed`, `deleted`), committed in the canonical owner's
  transaction rather than accepted from clients.
- **Cursor** — an opaque keyset-pagination bookmark returned as `nextCursor`;
  send it back unchanged with the next request. It carries ordering state, never
  authorization.
- **Share link** — an unguessable read/edit join token controlled by Project
  visibility. Joining upgrades membership but never demotes it.
- **Tool use (intelligence)** — a bounded reasoning→tool→reasoning loop over an
  **immutable `ToolSet`** of fixed application bindings with non-escalatable limits; plus
  a structured-output variant. Project-scoped tools (e.g. knowledge search) capture the
  project id in a closure so a model can't select another scope.
- **Persona** — a Project-local, **versioned** behavior profile that shapes how agent work
  is done. Editing appends an immutable version; a managed **General** persona is the
  per-user default. It is not an authority, a model config, or task history.
- **Agent task** — a durable, Project-local unit of Quarterback work in **Plan** mode (a
  reviewable plan draft) or **Action** mode (tool-driven execution). It runs asynchronously
  on the job pool; **accepting a plan is explicitly not an execution trigger**.
- **Presence (session)** — ephemeral per-user, per-project activity: current document focus
  and caret/selection, self-expiring after a stale timeout. Distinct from the auth session
  cookie.
- **Formula terms** — *binding* (a variable supplied to the formula), *field* (a table
  column, per-row); inside a query `.{...}` an identifier is resolved **field-first**
  (column if present, else binding). Values are exact (`big.Rat`); everything is bounded
  by explicit limits.

---

## 7. Documentation layers — which to use when

- **`docs/current-docs/`** — the active Taurus Yesod planning corpus and the
  executable Ω-001–Ω-044 handoffs. When assigned a completion packet, start with
  its file under `work-packets/`; the exact Notion evidence is mirrored under
  `notion/`.
- **`docs/architecture/`** — the conceptual layer: how the code works *now*, grounded in
  it, linking to source. Start at the
  [runtime model](../architecture/runtime-model.md) — the canonical as-built
  description (config → composition → control gate → dispatch → capabilities →
  persistence), with one document per capability beside it. **This is your map for
  understanding existing code.** Its companion,
  [issues & gaps](../architecture/issues-and-gaps.md), is the live register of
  where the running system falls short of that model — check it before assuming a
  rough edge is unknown.
- **`docs/records/`** — the *why over time*. To understand how something got the way it
  is (e.g. the knowledge lattice was built then corrected over records 0008–0010), read
  the records. **Add one for your change.**
- **`docs/superpowers/`** — pre-build thinking: `specs/` (design) and `plans/`
  (step-by-step implementation). This is where a non-trivial change is designed before
  code. For a small change you may not need one; for a multi-increment feature you do.
- **`docs/archive/`** — superseded planning artifacts: the former `plans/` and
  `checklists/` (agent-capability and frontend integrations, backend-outstanding, etc.),
  retained for history. Current planning lives under `docs/superpowers/`.
  **`docs/support/`** holds working assessments and roadmaps. None of these supersede the
  code; the architecture set and the source do.
- **`docs/reference/`** — aspirational, older. Consult for product intent; never treat as
  the current contract.
- **`docs/backend-guide.md`** and **`dev-test/*/manual.md`** — the practical "how to run
  and call it" layer; the manuals are the authoritative per-feature request/response
  walkthroughs.

Historical companion `*.go.md` files are archived reference only. Do not recreate
or update them; use current source, tests, architecture docs, and numbered records.

---

## 8. Running and testing

```bash
go run ./core            # serves https://127.0.0.1:8443 (self-signed cert in dev)
./scripts/dev-setup.sh   # register dev@taurus.local / devpassword against the running server
./dev-test/run.sh        # exercise the whole platform end-to-end (each suite starts its own instance)
go test ./...            # the unit suite — must be green after every change
go vet ./...             # must be clean
```

Config resolves as: built-in defaults → [`etc/config.yaml`](../../etc/config.yaml)
(committed template) → `etc/config.local.yaml` (gitignored overlay — **secrets, e.g. the
OpenRouter key, live here only**). Point elsewhere with `TAURUS_OMEGA_CONFIG`. Without a
model key the server still runs; model-backed endpoints return `503` and live suites skip.

`curl` needs `-k` (self-signed cert) and a shared cookie jar (`-c/-b cookies.txt`) to
carry the session.

---

## 9. The workflow for making a change

1. **Understand first.** Read the relevant architecture doc and the current source. Check `docs/records/` for the history if the area is subtle.
2. **Design if non-trivial.** For a feature or anything with real choices, write the
   design as a `docs/superpowers/specs/` doc and (for multi-step work) a
   `docs/superpowers/plans/` plan before coding. For a genuinely small change, implement
   directly.
3. **Implement in small increments, test-first where practical.** Add code that can be
   exercised. Keep capabilities free of concrete infrastructure and preserve the
   inventoried leaf/composition boundaries.
4. **Add/append a `docs/records/NNNN-*.md`** explaining what changed and why.
5. **Prove it.** Unit tests for plumbing; a live `dev-test/` assertion (with cost
   surfaced) for provider-backed quality. Run `go test ./...` and `go vet ./...` green.
6. **Update the practical docs** (`backend-guide.md`, the relevant `dev-test/*/manual.md`)
   if you changed the HTTP surface.

---

## 10. Quick "don't get surprised" list

- **Do not create or update `.go.md` companions.** That convention is retired;
  current source, tests, architecture docs, and numbered change records carry the
  implementation truth.
- **`docs/reference/` is aspirational.** Don't implement it wholesale or assume it
  describes reality.
- The **Intelligence tool-use loop** has production callers: the **agent**
  capability's Plan/Action tasks and ask-mode Chat turns. Formula's pure evaluator has no standalone stateless route,
  but it **is** exercised through `names`, the per-project HTTP/SQLite state layer (see
  [name manager](../architecture/capabilities/formula/name-manager.md)).
- The server is **always HTTPS**, even in dev; storage is **one SQLite file**; auth is a
  **cookie**, not a bearer token.
- **Leaf capabilities do not acquire new cross-capability behavior directly.**
  Start with a port that `wiring` satisfies; changes to the small sanctioned
  import graph must update and pass the completion architecture inventory.
- Change-record numbers are **sequential and unique** — mind collisions when merging.

Now go read the [architecture overview](../architecture/runtime-model.md) and
[`AGENTS.md`](../../AGENTS.md), then do your task.
