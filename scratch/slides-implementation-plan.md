# Slides Implementation Plan

## Goal

Build Slides from [`slides-design.md`](slides-design.md) as a regular
project-scoped capability owning versioned Deck editing.

Slide was deleted on 2026-08-01 (general-updates item 1) as an incomplete shell
blocking the build. This is a fresh implementation. `git show 91165f9` has the
old tree, but the model differs enough that it is not a useful starting point.

## What changed from the previous design

The old `slides-design/` (5 files, ~3,400 lines) is replaced by one document.
Stale conventions were fixed: caller-supplied create IDs, the old `origin`
vocabulary, and no delete command.

**Masters, Layouts, and slots are retained.** An intermediate revision cut them;
that was wrong on both halves of the test — the product is meaningfully
different without Layouts, and retrofitting them means a representation bump
plus a migration that has to invent Layout assignments for existing Slides. The
full inventory with add-back costs is in
[`slides-design.md`](slides-design.md#inventory-what-the-old-design-had-and-what-happened-to-it).

Tables, charts, and images are **ordinary element kinds**, exactly as
`TableBlock`/`ChartBlock`/`ImageBlock` are ordinary Document blocks. Nothing
about them is deferred.

One real substitution: the old design had a single protected `Normal` text style
and no style selection on elements. This uses a `SlideStyleRegistry` with named
styles and per-element-kind defaults, mirroring `DocumentStyleRegistry` — more
styling capability, and a model authors already know from Document.

## Settled architecture

- Layered shape; **Document as it exists now is the reference**, not its design
  doc. Read `3-capabilities/document/` before starting.
- One public import `#slides`; `POST /slides/command` (serial), `POST
  /slides/query` (concurrent).
- Strict `wire/` decoders with `exactKeys`.
- `./data/slides.db`, project-hashed prefix, Base + append-only ChangeSets.
- Freeze → compute → settle for prompt text sources and formula atoms.
- Activity via local transactional outbox carrying the command `origin`.

## Files

```text
apps/backend/src/3-capabilities/slides/
  index.ts
  domain/    model.ts canonical.ts errors.ts elements.ts geometry.ts
             identities.ts inverses.ts presentation.ts rebase.ts reducer.ts
             validation.ts
  application/  createService.ts slidesService.ts
  ports/     slidesStore.ts derivedOutputs.ts formulaResolver.ts activityPublisher.ts
  persistence/  sqliteSchema.ts sqliteSlidesStore.ts sqliteMappers.ts
  projections/  dependencies.ts outline.ts plainText.ts presentation.ts styling.ts
  wire/      commandSchemas.ts operationSchemas.ts querySchemas.ts valueSchemas.ts
  docs/      (six standard files)

apps/backend/src/4-job-wiring/slides/
  registerSlidesEndpoints.ts createSlidesJobs.ts
  registerSlidesInternalJobs.ts slidesJobPayloads.ts

apps/backend/src/1-init/create/slides.ts
apps/backend/test/capabilities/slides-{domain,wire,persistence,application}.test.ts
```

Directory is `slides` (plural); the old singular one is deleted. Composition
seams: `package.json` + `tsconfig.json` (`#slides`), `startBackend.ts`,
`runtime-wiring.test.ts`, `http-smoke.mjs`.

`domain/presentation.ts` resolves Master → Layout → Slide and slot binding;
`projections/presentation.ts` reports the resolved plan plus slot completeness.
No `formulaDependencies.ts` — formula atoms live in Rich Content and the ordinary
`dependencies.ts` projection already walks it.

## Phase 1 — Pure domain

`domain/model.ts`: `DeckHead`, `DeckSnapshot` (canvas, theme, styles, masters,
layouts, slideOrder, slides), `Master`, `Layout`, `LayoutSlot`, `Slide`, the
closed seven-member `SlideElement` union, `SlideTextSource`, `PromptSite`,
`ElementPlacement`, operations, history, attempts, intents.

`SlideTextSource` is `rich | prompt`, and the two surfaces that hold one are
`TextElement.body` and `TableCell.body`, in any of the three planes — a Master
or Layout element may hold a prompt like any other. `Slide.notes` is plain
`RichContent`: notes are the author's own aside, never generated.

Prompt is a property of content, not an element kind — see
[the rationale](slides-design.md#text-is-a-source-not-an-element-kind). Get the
`rich → prompt` conversion's exact inverse right here, in the reducer, where it
is pure: the inverse carries the displaced Rich Content verbatim.

Then `canonical.ts` (canonical bytes + semantic digest), `elements.ts` (flat
lookup, parent traversal, `zIndex` ordering), `geometry.ts` (frame validation),
`presentation.ts` (plane resolution and slot binding), `validation.ts`,
`reducer.ts` (forward ops + exact inverses + touched IDs), `inverses.ts`,
`rebase.ts`, `identities.ts`.

The three planes are the subtle part and belong here, where they are pure and
cheap to test: a Layout references a Master and a Slide references a Layout by
ID with no copying, a slot-bound element has exactly one frame authority, moving
one detaches it to a free frame at the slot's then-current position, and at most
one element per Slide binds a given slot. An unfilled slot is a projection hint,
never a validation error.

Gate: `slides-domain.test.ts`. This is the bulk of the work and should be
complete before any persistence exists.

## Phase 2 — Persistence

`ports/slidesStore.ts` (async, like Document), then `persistence/`. Four
standard pragmas; CHECK constraints carry the revision invariants.

Thirteen tables, not the ten first listed here: Document's `resources` root and
its shared `history` table were missing from that list and are not optional.
The root is what survives logical deletion so retained history and the identity
ledger have something to hang from, and adding either later is a migration.

`create_receipts` keyed on `request_id` with `deck_id` for cascade only — the
correction in general-updates item 2.

**Two divergences from Document, both deliberate.**

*The prompt-output address.* Document keys ownership on a bare `block_id`. A
Slides site is a container plus an element plus an optional cell, so the table
stores a composite `site_key` string alongside the structured `site_json`. It
has to be a string because the rule it enforces — one dedicated output per live
site — is a SQL `UNIQUE`, and the container has to be in it because two planes
may hold elements with the same ID.

*The store logs.* No other store in this backend does; logging is
application-layer everywhere else. Changed here on purpose: several facts are
visible only from inside the transaction — which compare-and-set lost, which
identity was refused — and those are exactly the "right answer, wrong process"
cases. Cost is controlled by level: statement detail is `debug`, `info` is
durable commits, `warn` is a caller's problem, `error` is impossible state.

**Authored content is logged, under a reserved `content` key.** A payload is
`{ ...shape, content?: { ...authored } }`. Outside it: identifiers, counts,
revisions, digests, kinds. Inside it: the Deck title, the operations and their
inverses, the snapshot at creation, the prompt text on an attempt. Splitting on
one reserved key is what makes the planned shape-only logger flag a single line
in the sink rather than an audit of every call site — so the rule that keeps it
true is that **nothing outside `content` may carry authored text**. A test
plants a marker in every authored field and asserts it appears nowhere else.

Gate: `slides-persistence.test.ts` — 26 tests.

## Phase 3 — Wire

`valueSchemas.ts` with `exactKeys` and a wire budget; `operationSchemas.ts` with
an `OPERATION_KEYS` table typed `Record<SlideOperation["type"], …>` so decoder
and union cannot drift; `commandSchemas.ts` decoding
`{ requestId, origin, command }`; `querySchemas.ts`.

The Rich Text decoders are hand-written here rather than shared with Document.
That is the convention rather than an oversight: `exactKeys` is defined four
times across four capabilities, each throwing its own error class, because a
capability owns its wire layer. Worth extracting to `0-platform` one day, not
worth touching shared files for while several agents are in the tree.

Two divergences from Document. Lengths are finite positives rather than
integers, because slide geometry is in points and half-point positions are
ordinary where Document's twips are integral. And the history page bound is a
named constant, where Document inlines `1..1000`.

**A decoded operation is a validated clone of the input, not a reconstruction.**
The value decoders build clean objects, but `decodeSlideOperation` returns
`structuredClone(operation)` and discards them, exactly as Document does — so
for operations the decoders are validation side-effects only. Their constructed
output matters for commands, which do return it. Do not write a test that thinks
otherwise; one here did, and passed for the wrong reason.

Gate: `slides-wire.test.ts` — 25 tests.

## Phase 4 — Service and composition: first working slice

`createService.ts` — blank Deck with canvas, theme, style registry, one Master,
one Layout, and one Slide bound to that Layout. Allocates every identity.

`slidesService.ts` — `deck.create`, `deck.submit`, `deck.compensate`,
`deck.delete`, four queries. Serial admission, revision CAS, rebase admission,
compaction dispatch, Activity outbox in the mutation transaction.

Then job wiring, `1-init/create/slides.ts`, `startBackend`.

**End-to-end slice**: create a Deck, edit its Master and Layouts, add slides
against a Layout, fill slots, add free text/table/chart/image elements, group,
reorder, undo, load, list, delete. No prompt content, no formula settlement yet.
Gate: `slides-application.test.ts` + smoke.

## Phase 5 — Prompt text sources

`prompt.create.request` (serial freeze + durable attempt) → `.compute`
(concurrent declare + first refresh via Derived Outputs) → `.settle` (serial
revalidate + write). Plus `prompt.refresh.*` and `prompt.update-definition`.
Needs `ports/derivedOutputs.ts` and `recoverPendingAttempts()` from startup.

A prompt source holds only a `DerivedOutputRef`; generated text never enters the
snapshot, and `deck.load` resolves each one on read, as `document.load` does.

**The Slides-specific part is the address.** Document keys ownership on a
`blockId`; Slides keys on a `PromptSite`, because a prompt can sit in a table
cell. Store the site on `prompt_outputs` and resolve it at settle.

Creation has two shapes, and only one of them is Document's:

- `existing` — the surface is already there; settlement replaces its body.
- `new-text-element` — the service allocates the element ID at freeze, freezes
  the placement, and dry-runs it before spending an LLM call, the way Document
  proves a block placement with a throwaway divider. Settlement revalidates,
  because a bound Layout slot can be deleted while the model is running.

Settlement is stale, not failed, when the site no longer resolves, no longer
holds a `prompt` source, holds a different `outputId`, or has moved off the
`appliedRevision` the attempt froze. **Write these four as tests before the
happy path** — the last one is the one that is easy to miss, and it is what
catches a concurrent refresh or an undo landing mid-flight.

Deleting a source **detaches** the ownership row and leaves the Derived Output
alone; the diff of prompt references before/after each mutation drives the
transitions, and re-attaches on undo. Follow
`documentService.promptOwnershipTransitions` literally.

## Phase 6 — Formula atoms

Follows Document exactly: the reducer reports changed atoms, the service creates
one evaluation attempt per atom inside the mutation transaction, computes
against a frozen resolver snapshot, and settles conditionally on digest equality
plus a touched-ID scan. Needs `ports/formulaResolver.ts`.

Because every authored text surface is `RichContent`, this lights up formulas in
text elements, table cells, chart labels, and slide notes at once. A `prompt`
source carries no atoms, so the walk simply skips it.

## Phase 7 — Projections, docs, hardening

Five projections — including `presentation.ts`, which reports the resolved
Master/Layout/Slide plan and which slots are unfilled — plus the six-file
`docs/` package with an honest status section and the `#slides` alias assertion.

## Verification

```bash
pnpm --filter @icarus/backend typecheck
pnpm --filter @icarus/backend test
```

**Keep the tree green before starting each phase.** The signal that matters here
is *any error is this work*, and it only works from a clean baseline. The
Templates rework runs concurrently in the same tree, so check before you start
rather than assuming: `A2` was mid-rename when Phase 1 began and landed during
it, and a transient error in `formula/wire.ts` appeared and cleared the same way.

## Status

**Phases 1, 2 and 3 are complete** (2026-08-02): eleven `domain/` files, four
`ports/` + `persistence/` files and four `wire/` files — 61 domain, 26
persistence and 25 wire tests.

Work happens in a worktree at `/home/jakul/cyberia/icarus-slides` to keep other
agents' uncommitted files out of the way; every commit still lands on `main`.

Two defects were found by the tests and fixed in the same commit — restoring a
deleted table column appended its cells and changed canonical bytes, and the
group-cycle check was dead code that let a cycle through validation and into a
stack overflow. Both are worth knowing about before Phase 2, because the first
means **cell array order is derived, not authored**, and the second means
**acyclicity is reachability from the container root**, never an ancestor walk.

Phases 2–7 are unstarted.

Extend `http-smoke.mjs` from phase 4 onward. The composition-root import test in
`runtime-wiring.test.ts` catches an unresolvable barrel immediately.

## Deferred

Rendering, thumbnails, exports, pixel geometry, animation, transitions —
**outside the backend boundary**, not deferred work.

Inside it: Deck/Slide duplication, external theme sharing, token aliases, stored
Group rotation and scale, custom paths, gradients, curved lines, formula-backed
chart series, embeds, video, audio, and Templates integration.
