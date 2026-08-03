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

`SlideTextSource` is `rich | prompt`, and the three surfaces that hold one are
`TextElement.body`, `TableCell.body`, and `Slide.notes`. Prompt is a property of
content, not an element kind — see
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

`ports/slidesStore.ts` (async, like Document), then `persistence/`. Tables:
`decks`, `bases`, `change_sets`, `command_receipts`, `create_receipts`,
`identity_ledger`, `attempts`, `stage_receipts`, `prompt_outputs`,
`activity_outbox`. Four standard pragmas; CHECK constraints carry the
revision invariants.

`create_receipts` keyed on `request_id` with `deck_id` for cascade only — the
correction in general-updates item 2.

Gate: `slides-persistence.test.ts`.

## Phase 3 — Wire

`valueSchemas.ts` with `exactKeys` and a wire budget; `operationSchemas.ts` with
an `OPERATION_KEYS` table so decoder and union cannot drift; `commandSchemas.ts`
decoding `{ requestId, origin, command }`; `querySchemas.ts`.

Gate: `slides-wire.test.ts`.

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

**Precondition: get the tree green first.** The baseline is *not* clean as of
2026-08-02 — the Templates rework is mid-`A2`, with `ports/resourceAdapter.ts`
deleted, `ports/templatableResource.ts` added, and `templateService.ts`,
`index.ts`, and `1-init/create/templates.ts` still on the old names (four
errors). That is in-flight work tracked in
[`0-templates-checklist.md`](0-templates-checklist.md), not a Slides concern —
but starting Slides against a red tree destroys the only signal that matters
here, which is *any error is this work*. Finish A2, confirm green, then begin.

Extend `http-smoke.mjs` from phase 4 onward. The composition-root import test in
`runtime-wiring.test.ts` catches an unresolvable barrel immediately.

## Deferred

Rendering, thumbnails, exports, pixel geometry, animation, transitions —
**outside the backend boundary**, not deferred work.

Inside it: Deck/Slide duplication, external theme sharing, token aliases, stored
Group rotation and scale, custom paths, gradients, curved lines, formula-backed
chart series, embeds, video, audio, and Templates integration.
