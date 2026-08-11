# Mission — bringing Taurus Alpha and Taurus Omega to parity

**Read [`README.md`](README.md) in this folder first** — it orients you to *this
repository* (layers, conventions, capabilities, vocabulary). This document is the
second half: it orients you to *the mission* you are here to advance — closing the
gap between **Taurus Alpha** and **Taurus Omega** and setting up an ongoing
co-working loop between them.

If you only take one thing from this page: **the target is already written down.**
`docs/reference/` is the product Taurus Alpha is meant to be. Your job is to make
Omega provide the backend that lets Alpha actually be that product — one small,
proven increment at a time — driven by concrete requests coming from the Alpha
side.

## The two Tauruses

- **Taurus Alpha** — the product experience (the client / front end and the
  product design). What Alpha *wants to do* end to end is captured, in detail, in
  this repo's [`docs/reference/`](../reference/README.md): the
  [product intent](../reference/product/README.md), the per-capability behavior
  contracts ([`reference/capabilities/`](../reference/capabilities/README.md) —
  chats, decks, workbooks, boards, files, agents, collaboration, …), and the
  cross-layer [flows](../reference/flows/README.md).
- **Taurus Omega** — *this* repository: the backend that Alpha runs against. It is
  built **incrementally and by hand**, one working piece at a time, toward that
  reference. It is not a re-implementation of a legacy system; it is a clean build
  with uneven progress through stage `07`: early host/control foundations are
  built, the stage-03 Resource surface is Document-backed but intentionally
  incomplete, and later capability families remain ahead.

**Reference is the target, not the authority.** Where a reference document
conflicts with the code we've actually built or a decision we've made, the code
and the decision win (see [`AGENTS.md`](../../AGENTS.md) and orientation §4). Treat
`docs/reference/` as a detailed map of where we're going, not a spec to transcribe.

## The mission

1. **Keep Alpha requests reconciled with executable Omega state.** The initial
   backend-request branch has been audited and its deterministic
   Resource/purpose/Activity slice implemented. New requests still need the same
   implemented-vs-open analysis before work begins.
2. **Reach parity.** Implement enough of Omega that every feature Alpha needs has a
   real, tested backend behind it — so Alpha can be *fully* implemented, not
   stubbed. This is stage-by-stage work against the reference roadmap.
3. **Co-work.** Establish a steady loop: Alpha requests → Omega implements and
   exposes over HTTP → Alpha integrates → repeat. The two repos advance together.

## Where Omega stands today (your baseline)

Built and wired (reachable over HTTP, persisted in SQLite, exercised by
`dev-test/`). See orientation §5 and [`docs/architecture/`](../architecture/README.md)
for depth:

| Area | Reference stage | State |
|---|---|---|
| Host / cell, always-HTTPS, one process | `00` | built |
| Persistence, auth (cookie sessions), background jobs | `01` | built |
| Control / identity / **projects** (create, purpose, members, roles, visibility, role-carrying share links) | `02` | built |
| **Workspace Resources + Activity** (unified catalog/lifecycle, semantic feed, safe User/Resource reference reads) | `03` | built for the canonical Document and Connector families; other recognized kinds remain unavailable |
| **Documents** (change sets, prompt blocks, rebase/resolve) | `04` | built |
| **Knowledge** (per-project retrieval lattice: window → embed → cluster → retrieve) | `06` | built |
| **Intelligence** (model boundary via casts: reason / infer / embed) | `06` | one-shot wired; **tool-use loop is library-only** |
| **Formula + data** (deterministic `formula/v1`: evaluator, user functions, per-project **name manager** over SQLite) | `07` | built and wired through the name-manager HTTP surface |

The most recent accepted backend-request slice is the Document-backed
[Resource catalog](../architecture/capabilities/resources/README.md), immutable
[Activity feed](../architecture/capabilities/activity/README.md), Project
purpose/aggregate timestamps, secure share links, and safe current-state
reference resolution. Prompt-block resolve is also now a production route rather
than `/dev`. Formula names remain the persisted calculation foundation beneath
future analytic surfaces.

## The parity gap (roughly, what's *not* built yet)

These reference stages/capabilities are still ahead — this is the raw material for
the requests you'll be working. Consult the matching
[`reference/implementation/`](../reference/implementation/README.md) stage and
[`reference/capabilities/`](../reference/capabilities/README.md) contract for each:

- **Files, sources, connectors** (`05`) — uploads, external sources, connectors.
- **Analytic compute / workbooks** (`07a`, `08`) — spreadsheet-shaped surfaces on
  top of formula + the name manager (a natural next consumer of what was just
  built).
- **Decks** (`09`), **Boards & chats** (`10`).
- **Translation, import/export, templates** (`11`).
- **Agents, context, collaboration** (`12`) — the intelligence **tool-use loop** is
  now wired: the [agent](../architecture/capabilities/agents/README.md) capability's
  Plan/Action tasks drive it (Ask is reached through ask-mode Chat turns), and collaboration presence
  has a first cut in the [session](../architecture/capabilities/session.md)
  capability.
- **Web client integration** (`13`), **administration / production** (`14`).

Don't take this list as a work order — it's a map. The Alpha requests decide the
*order* and the *exact shape*; the reference decides the *target behavior*.

## Handling incoming Alpha backend requests

The initial request inventory and accepted Resource/purpose/Activity design are
already recorded in
[`alpha-backend-request-inventory.md`](../superpowers/specs/2026-07-21-alpha-backend-request-inventory.md)
and records 0027–0034. For any later incoming branch, treat it the way we treated
`feature/intelligence-tool-use`: **analyze before you merge.**

1. `git fetch` and read the branch: what does it actually change, is it
   well-built, does it match a reference contract, does it merge cleanly?
2. Discuss anything surprising before merging — don't merge on faith.
3. On merge, **renumber any colliding sequential files** — `docs/records/NNNN-*`,
   plan/spec files — to the next free number, and fix their in-file titles. (This
   is a standing convention; sequential record numbers must stay unique.)
4. Then convert the requests into Omega increments through the normal workflow
   below.

## The co-working loop (how to actually move)

Each request becomes a small, proven slice of backend:

1. **Brainstorm → design.** Turn the request into a design grounded in the current
   code and the reference contract. Decide the capability boundary: leaf
   behavior crosses through a port that `wiring` satisfies, and any sanctioned
   composition/type import must stay in the executable architecture inventory.
2. **Plan → execute in tiny steps.** Each step gets tests and a numbered change
   record. Do not create `.go.md` companions; that convention is retired. Wire
   the increment (transport route + `wiring` construction) so Alpha can actually
   call it.
3. **Prove it against reality.** Unit tests for plumbing; a `dev-test/` HTTP suite
   for anything Alpha will hit; live provider suites (surfacing token/$ cost) for
   anything model-backed. "It compiles" is not "it works."
4. **Hand back a real endpoint.** Parity means Alpha integrates against a running,
   tested route — not a stub. Then take the next request.

The non-negotiables for *how* you work here (small increments, no new companion
docs, numbered records, real-provider testing, reference-is-not-authority) are in
orientation §4 — they apply to every step above.

## Your next moves

1. Read orientation [`README.md`](README.md) end to end, then
   [`reference/product/vision.md`](../reference/product/vision.md) and
   [`reference/product/README.md`](../reference/product/README.md) for what Alpha
   is *for*.
2. Read the current Alpha request or branch and reconcile it with the existing
   inventory before assuming its status label is current.
3. Inventory the specific gap: which reference capability, which endpoints Omega
   is missing, and what already exists to build on (Resources/Activity,
   Formula names, and the Intelligence tool-use library are the relevant recent
   seams).
4. Pick the smallest first slice, brainstorm a design, and get it approved before
   building.

Then go — one working, tested, wired increment at a time, until Alpha has the
backend it needs.
