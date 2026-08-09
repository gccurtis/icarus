# 07 · Slides

*Verified against source at commit ef6d462, 2026-08-09.*

Slides is a presentation-deck capability: a Deck holds a canvas, a theme, a style registry, a set
of Masters, a set of Layouts and an ordered set of Slides, and every Slide composes three planes
(Master → Layout → Slide) by live reference rather than by copying. It is being rebuilt in phases
after the earlier singular `slide/` capability was deleted on **2026-08-02** (commit `91165f9`,
timestamped `2026-08-02T00:04:42-05:00` — the archived docs say 2026-08-01, four minutes early).
At HEAD the rebuild has landed Phase 1 (domain) and Phase 2 (store port and SQLite persistence).

**Read this first: Slides cannot be reached.** There is no `application/`, no `index.ts`, no
`#slides` alias, no `1-init/create/slides.ts`, no `4-job-wiring/slides/` group, no endpoint, no
job intent, and `startBackend.ts` contains no occurrence of the string "slide". `data/slides.db`
is never created because nothing constructs `SQLiteSlidesStore`. It is nevertheless **15 files /
6,765 lines**, it is inside the `tsc` project (`apps/backend/tsconfig.json` `include` is
`["src/**/*.ts"]`) so it is typechecked on every build, and it is covered by **87 passing tests** —
the second-most-tested area in the repository, behind Templates' 114 and ahead of Document's 76.
Its only consumers anywhere in the repository are those two test files, which import it by relative
path (`../../src/3-capabilities/slides/…`) because there is no alias to import it by.

Slides is also the only module under `0-platform/` or `3-capabilities/` with **no `docs/`
package**: 19 modules have one, 20 exist. This page is the only description of it.

The superseded page is
[phase-1/claude-notes/07-capability-inventory.md](../../phase-1/claude-notes/07-capability-inventory.md)
(§ "slide"), which describes the *deleted singular* tree and says the capability is gone. Its
history is accurate; it predates the plural rebuild entirely and does not mention it.

---

## 0 · Scope: this page describes `main` at `ef6d462`, and nothing else

Phases 3, 4 and 5 of the rebuild exist, and **they are not part of the subject of this page.**
Verified with `git merge-base --is-ancestor <commit> HEAD`, which returns non-zero for every one
of them:

| Commit | Subject | On HEAD? | Where it lives |
| --- | --- | --- | --- |
| `acfdd81` | `feat(slides): Phase 3 — wire layer` | **no** | `slides-phase2`, `structured-analytic-phase1`, `worktree-phase-c-context-and-gc`, `origin/main` |
| `3279cf5` | `feat(slides): Phase 4 — service, composition, and a working slice` | **no** | same |
| `c5fa6d7` | `feat(slides): Phase 5 — prompt text sources` | **no** | `slides-phase2`, `origin/main` |
| `4a76c78` | `refactor(slides): adopt the platform detail label for content logging` | **no** | `slides-phase2`, `structured-analytic-phase1`, `worktree-phase-c-context-and-gc`, `origin/main` |
| `7a50e68` | `feat(slides): log authored content under a reserved 'content' key` | **no** | `backup-slides-work` |
| `29d588b`, `4755bcb`, `9805882`, `75250aa` | later Slides refactors | **no** | `slides-phase2`, `structured-analytic-phase1`, `origin/main` |

Two consequences a reader must not trip over:

1. **The local checkout is behind its own remote.** `git rev-list --count main..origin/main` is
   **16**; `origin/main..main` is **0**. `origin/main`'s Slides tree contains
   `application/slidesService.ts`, `application/createService.ts`, `index.ts`, `domain/outline.ts`,
   `ports/activityPublisher.ts`, `ports/derivedOutputs.ts`, and a four-file `wire/` package — none
   of which exists at `ef6d462`. A `git pull` changes everything on this page below §1.
2. **`.claude/worktrees/phase-c-context-and-gc/` is an untracked worktree** in the tree containing
   `slides-application.test.ts` and `slides-wire.test.ts`. **Neither file exists on `main`.** Do
   not read them as coverage of this code.

Everything below is measured on the working tree at `ef6d462`.

---

## 1 · At a glance

| Property | Value |
| --- | --- |
| Shape | **Layered, incomplete** — `domain/` (11 files), `persistence/` (3), `ports/` (1). No `application/`, no `wire/`, no `projections/`, no `index.ts` |
| Endpoints | **0.** Not registered, not registrable — there is no wiring file and no factory |
| DB file | *(would be `data/slides.db`)* — **never created**; no `.db` literal for Slides exists anywhere in `src/` |
| Tables | **13** declared (12 in one `db.exec`, plus the shared `_history`), all under the prefix `slides_<sha256(projectId)[0:16]>`. Zero created at runtime |
| Revision model | Periodic `Base` snapshot + append-only `ChangeSet` chain with exact inverses. SQL enforces `CHECK (seq = revision)` and `CHECK (revision = prior_revision + 1)`. Permanent identity ledger with tombstones |
| Test files | `slides-domain.test.ts` (**61 tests**, 1,774 lines), `slides-persistence.test.ts` (**26 tests**, 806 lines) = **87 tests, 87 pass, 0 fail** |
| Source files / lines | **15 files / 6,765 lines** — no wiring file, no `1-init` factory |
| Module docs | **None.** Slides is the only module without a `docs/` package |
| Typechecked | **Yes** — inside `tsconfig.json`'s `include`; `tsc --noEmit` exits 0 |
| Status | **Built, typechecked, 87 passing tests, completely unreachable.** Nothing in `src/` outside `slides/` names it except one comment |

Per-file line counts (`wc -l`):

| File | Lines |
| --- | ---: |
| [`domain/reducer.ts`](../../../apps/backend/src/3-capabilities/slides/domain/reducer.ts) | 1,884 |
| [`persistence/sqliteSlidesStore.ts`](../../../apps/backend/src/3-capabilities/slides/persistence/sqliteSlidesStore.ts) | 1,503 |
| [`domain/model.ts`](../../../apps/backend/src/3-capabilities/slides/domain/model.ts) | 897 |
| [`domain/validation.ts`](../../../apps/backend/src/3-capabilities/slides/domain/validation.ts) | 590 |
| [`domain/elements.ts`](../../../apps/backend/src/3-capabilities/slides/domain/elements.ts) | 455 |
| [`persistence/sqliteSchema.ts`](../../../apps/backend/src/3-capabilities/slides/persistence/sqliteSchema.ts) | 310 |
| [`persistence/sqliteMappers.ts`](../../../apps/backend/src/3-capabilities/slides/persistence/sqliteMappers.ts) | 301 |
| [`domain/presentation.ts`](../../../apps/backend/src/3-capabilities/slides/domain/presentation.ts) | 248 |
| [`ports/slidesStore.ts`](../../../apps/backend/src/3-capabilities/slides/ports/slidesStore.ts) | 183 |
| [`domain/identities.ts`](../../../apps/backend/src/3-capabilities/slides/domain/identities.ts) | 157 |
| [`domain/errors.ts`](../../../apps/backend/src/3-capabilities/slides/domain/errors.ts) | 112 |
| [`domain/geometry.ts`](../../../apps/backend/src/3-capabilities/slides/domain/geometry.ts) | 56 |
| [`domain/canonical.ts`](../../../apps/backend/src/3-capabilities/slides/domain/canonical.ts) | 32 |
| [`domain/rebase.ts`](../../../apps/backend/src/3-capabilities/slides/domain/rebase.ts) | 23 |
| [`domain/inverses.ts`](../../../apps/backend/src/3-capabilities/slides/domain/inverses.ts) | 14 |

### 1.1 The exact absence list, each verified

| Absent | How it was checked | Result |
| --- | --- | --- |
| `slides/application/` | `ls src/3-capabilities/slides/` | exactly `domain persistence ports` |
| `slides/index.ts` | `find … -name index.ts` | no barrel exists |
| `slides/docs/` | `find src/3-capabilities/slides -name '*.md'` | zero files |
| `slides/wire/`, `slides/projections/` | `ls` | absent (the deleted singular `slide/` had both) |
| `#slides` subpath alias | `grep -n slides apps/backend/package.json` and `tsconfig.json` | no match in either |
| `1-init/create/slides.ts` | `ls src/1-init/create/` | 23 files; no `slides.ts`, no `slide.ts` |
| `4-job-wiring/slides/` | `ls src/4-job-wiring/` | 14 subdirectories + one root file; no `slides` |
| Any mention in `startBackend.ts` | `grep -in slide src/1-init/startBackend.ts` | no match |
| Any importer in `src/` | `grep -rn slides src --include=*.ts` outside `slides/` | **one hit**, a comment: `templates/ports/templatableResource.ts:32-33` names `slides::deck` / `slides::slide` as a hypothetical compound kind |
| `data/slides.db` | `grep -rn '\.db"' src` | 12 `.db` paths, none of them Slides' |

The consequence is exact: **no HTTP request, job, factory, or startup call reaches a single line of
Slides.** The 87 tests are the only execution path in the repository.

---

## 2 · Domain model

All types below are from
[`domain/model.ts`](../../../apps/backend/src/3-capabilities/slides/domain/model.ts) unless noted.
They are consumed by the reducer, the validator and the store; **nothing constructs them outside
tests.**

### 2.1 The aggregate

```ts
// model.ts:27-39
export interface DeckSnapshot {
  representationVersion: 1;
  revision: number;
  title: string;
  lifecycle: DeckLifecycle;
  canvas: SlideCanvas;
  theme: DeckTheme;
  styles: SlideStyleRegistry;
  masters: Record<string, Master>;
  layouts: Record<string, Layout>;
  slideOrder: string[];
  slides: Record<string, Slide>;
}
```

`DeckHead` (`model.ts:16-25`) is the row the store maintains: `id, title, lifecycle, revision,
baseSeq, semanticDigest, createdAt, updatedAt`.

| Type | Line | Members |
| --- | ---: | --- |
| `DeckLifecycle` | 13 | `active` \| `archived` \| `trashed` |
| `SlideOrigin` | 14 | `interactive` \| `agent` \| `automation` |
| `SlideCanvas` | 45 | `{ widthPt, heightPt }` — dimensions only |
| `SlideSystemStyleRole` | 93 | `normal` — the only value |
| `SlideElementKind` | 272 | `group` \| `text` \| `table` \| `chart` \| `image` \| `geometry` \| `line` — **seven** |
| `SlideTextSourceKind` | 225 | `rich` \| `prompt` |
| `ElementContainerKind` | 169 | `slide` \| `master` \| `layout` |
| `SlideAttemptState` | 674 | `requested` \| `computing` \| `proposed` \| `settled` \| `unchanged` \| `stale` \| `failed` |
| `SlideIdentityKind` | `identities.ts:5` | **15**: `style, token, master, layout, slot, slide, element, table, table-row, table-column, table-cell, table-merge, chart-label, rich-text-atom, rich-text-mark` |
| `SlideIdentityLedgerState` | `identities.ts:32` | `active` \| `tombstoned` |
| `SlideIdentityReactivation` | `identities.ts:42` | `forbid` \| `same-kind-compensation` |

`DeckSnapshot.revision` is declared and **never maintained**: `grep -n '\.revision' reducer.ts
validation.ts` in `domain/` returns nothing. Only `DeckHead.revision` is real, and only the store
writes it. See §9.

### 2.2 The three planes

The whole composition model is one comment,
[`presentation.ts:17-22`](../../../apps/backend/src/3-capabilities/slides/domain/presentation.ts):

> ```
> /**
>  * Three planes, fixed back to front: Master → Layout → Slide. Inheritance is
>  * live within one Deck revision — a Layout references a Master and a Slide
>  * references a Layout by ID, and no layer ever copies another, which is why
>  * editing a Master changes every Slide beneath it immediately.
>  */
> ```

| Plane | Type | Line | Holds |
| --- | --- | ---: | --- |
| Master | `Master` | 136 | `id, name, background, elements` — *"Painted behind every Slide whose Layout names this Master."* (`:140`) |
| Layout | `Layout` | 144 | `id, name, masterId, background?, elements, slots` — background *"Overrides the Master's when present."* (`:148`) |
| Slot | `LayoutSlot` | 155 | `id, name, frame, accepts[]` — *"Named placeholders a Slide fills. Placement metadata only — never painted."* (`:151`); *"Which element kinds may bind here. Empty means any framed kind."* (`:159`) |
| Slide | `Slide` | 173 | `id, layoutId, title?, background?, notes, elements`. `title` is *"Plain metadata, not Rich Content."* (`:176`); `notes` is *"Authored only. Notes are the author's own aside, never generated."* (`:180`) |

Resolution is data, not rendering. `resolvePlane(snapshot, slideId)` returns
`{slide, layout, master}` or `undefined` if any link is missing; `resolveBackground` is *"Slide
override, else Layout override, else the Master's"* (`presentation.ts:42`), with a
`{kind:"inherit"}` value falling through. `resolveSlidePlan` composes the back-to-front
`SlidePresentationPlan` carrying `entries` (Master, then Layout, then Slide elements, each in paint
order), `unfilledSlotIds`, and `danglingSlotIds`.

### 2.3 Theme, and why token resolution cannot cycle

`DeckDesignToken` is a three-arm discriminated union (`model.ts:62-65`):

| Arm | Fields |
| --- | --- |
| `color` | `{ id, kind: "color", name, value: SlideColor }` (`SlideColor` is a CSS-style string) |
| `font` | `{ id, kind: "font", name, family: string }` |
| `length` | `{ id, kind: "length", name, valuePt: number }` |

`ThemeValue<T>` is `{kind:"literal"; value:T} | {kind:"token"; tokenId:string}` — `model.ts:69-72`:

> ```
> /**
>  * Either a literal or a live reference to a token of the matching kind. Tokens
>  * never alias other tokens, so resolution cannot cycle.
>  */
> ```

`DeckThemePalette` has exactly four slots (`background, surface, text, accent`);
`DeckThemeTypography` has three (`headingFontFamily, bodyFontFamily, baseFontSizePt`).
A kind mismatch resolves to `undefined` rather than coercing (`presentation.ts:208-212`).

### 2.4 Elements: one base, seven kinds, and two hard invariants

`SlideElementBase` (`model.ts:201-211`) carries `id`, `parentGroupId?`, `zIndex`, `placement`,
`rotationDegrees?`, `locked`, `hidden`, `styleId?`. Two field comments define the two hardest
invariants in the capability, both verbatim:

- `model.ts:204` — `/** Sole sibling-order authority: unique and contiguous 0..n-1, back to front. */`
- `model.ts:229` — `/** Membership is carried by each member's 'parentGroupId'; no child array. */`

The union (`model.ts:263-270`) has exactly seven arms:

| Kind | Interface | Payload field |
| --- | --- | --- |
| `group` | `GroupElement` | `name?` only — **no child list** |
| `text` | `TextElement` | `body: SlideTextSource` |
| `table` | `TableElement` | `table: SlideTable` |
| `chart` | `ChartElement` | `chart: SlideChartData` — `{source: "literal", specification, labels[], alt}`; the `source` field's comment is *"Literal series only; formula-backed series are deferred."* (`model.ts:320`) |
| `image` | `ImageElement` | `image: SlideImageData` — `{source: MediaSnapshotRef, alt, decorative, crop?, fit}` |
| `geometry` | `GeometryElement` | `geometry: SlideGeometry` — seven shapes (`rectangle`, `rounded-rectangle`, `ellipse`, `triangle`, `diamond`, `arrow`, `chevron`) plus a `BoxAppearance` |
| `line` | `LineElement` | `line: SlideLine` — `{start, end, widthPt, style, color, startCap, endCap}`; `start`/`end` are *"Relative to the element frame, so a Line moves with its frame."* (`model.ts:354`) |

`ElementPlacement` is `{kind:"free"; frame} | {kind:"slot"; slotId}` — `model.ts:192-196`:

> ```
> /**
>  * A slot-bound element has exactly one frame authority — the slot's — so it
>  * follows slot edits live. Moving it detaches it to a free frame at the slot's
>  * then-current position.
>  */
> ```

### 2.5 Text is a source, not an element kind

This is the design decision that most separates Slides from Document, and `model.ts:213-220`
states it directly:

> ```
> /**
>  * Text is a source, not an element kind. A Slide element is a positioned box,
>  * and its frame, order, rotation, lock, style, group membership and slot
>  * binding are all indifferent to whether its text was authored or generated.
>  *
>  * A `prompt` source holds only a reference: generated text never enters the
>  * snapshot, and `deck.load` resolves it on read the way `document.load` does.
>  */
> ```

```ts
type SlideTextSource =
  | { kind: "rich"; content: RichContent }
  | { kind: "prompt"; output: DerivedOutputRef };
```

### 2.6 Addressing: two overlapping target unions

| Union | Line | Arms |
| --- | ---: | --- |
| `RichContentTarget` | 375 | `element-body`, `table-cell`, `chart-label`, `slide-notes` |
| `PromptSite` | 401 | `element-body`, `table-cell` **only** |
| `PromptCreateTarget` | 416 | `new-text-element` (container + placement + optional style/parent), `existing` (a `PromptSite`) |

`model.ts:391-400` explains the narrowing:

> ```
> /**
>  * Every surface that may hold a `prompt` source: a Text element's body and a
>  * table cell, in any of the three planes. A generated element on a Master or
>  * Layout is a live prompt like any other — the backdrop is as much authored
>  * content as a Slide is.
>  *
>  * Narrower than `RichContentTarget` in two places. Chart labels are too small
>  * to be worth generating, and Slide notes are the author's own aside rather
>  * than something to hand to a model.
>  */
> ```

`PromptCreateTarget`'s comment (`model.ts:412-415`) fixes the identifier rule: *"Where generated
text will land. A caller names placement, never an identifier: the service allocates the element ID
at freeze and returns it."*

### 2.7 Tables are dense

`SlideTable` is `{ id, columns[], rows[], cells[], merges[] }`. A `SlideTableCell` carries
`{id, rowId, columnId, body: SlideTextSource, verticalAlign, styleId?}` — so **a table cell holds a
text source, and therefore may hold a prompt**, which is why `PromptSite` has a `table-cell` arm.
Validation requires `cells.length === rows.length * columns.length` — `validation.ts:278`:
`// A table is dense: every coordinate is materialised, unlike Spreadsheet.`

### 2.8 History and attempt types

| Type | Line | Purpose |
| --- | ---: | --- |
| `DeckBase` | 589 | `{representationVersion:1, deckId, baseSeq, snapshot, semanticDigest, createdAt}` |
| `DeckChangeSet` | 598 | `id, deckId, clientRequestId, requestDigest, authoredRevision, priorRevision, revision, seq, origin, operations[], inverseOperations[], touchedIds[], compensation?, semanticDigest, createdAt` |
| `DeckCommittedTransaction` | 619 | The Activity outbox row. Carries `sourceChangeSetId` *"deliberately independent of the historical ChangeSet foreign key: compaction must not make an outbox row incomplete before Activity has consumed it"* (`:629-633`) |
| `DeckSubmissionReceipt` | 648 | `(deckId, requestId)`-keyed replay record |
| `DeckCreateReceipt` | 664 | `requestId`-keyed replay record for `deck.create` (see §6.3) |
| `PromptCreationAttempt` | 696 | `target`, `site`, `definition{prompt, contextEntries, stabilisationText}`, `candidateOutputId?`, `candidateHeadRevision?` |
| `PromptRefreshAttempt` | 714 | `site`, `outputId`, `frozenAppliedRevision`, `candidateHeadRevision?` |
| `FormulaEvaluationAttempt` | 722 | `target: RichContentTarget`, `atomId`, `originChangeSetId?`, `frozenExpression`, `frozenExpressionDigest`, `resolverSnapshotDigest?`, `candidateOperations?` |
| `SlideStageReceipt` | 738 | `(attemptId, stage)` with `stage: "compute" \| "settle"`, `idempotencyKey`, `state: running \| completed \| failed` |
| `PromptOutputOwnership` | 750 | `outputId, deckId, site, creationAttemptId?, state: pending\|attached\|detached, attachedRevision?, detachedRevision?` |

`SlideLimits` (`model.ts:881-892`) has ten fields: `maxSlidesPerDeck`, `maxElementsPerContainer`,
`maxMastersPerDeck`, `maxLayoutsPerDeck`, `maxSlotsPerLayout`, `maxStylesPerDeck`,
`maxTokensPerTheme`, `maxGroupDepth`, `maxTableRows`, `maxTableColumns`. Every one is enforced by
`validateSnapshot` (§7.4). **Nothing in `src/` ever constructs a `SlideLimits` value** — the tests
supply it, and there is no `slides` section in `etc/configuration.yaml` or in `DEFAULT_CONFIG`.

---

## 3 · Operations — the 54-arm `SlideOperation` union

`SlideOperation` (`model.ts:428-583`) has **54 arms, 54 distinct type literals, no duplicates**
(counted by extracting every `type: "…"` in that range). Every one is implemented by `applyOne` in
the reducer and every one has an exact inverse.

| Group | Count | Operations |
| --- | ---: | --- |
| Deck | 2 | `deck.rename`, `deck.set-lifecycle` |
| Canvas | 1 | `canvas.set` |
| Theme | 3 | `theme.rename`, `theme.set-palette`, `theme.set-typography` |
| Token | 3 | `token.create`, `token.update`, `token.delete` (requires `replacementTokenId`) |
| Style | 4 | `style.create`, `style.update`, `style.delete` (requires `replacementStyleId`), `style.set-default` |
| Master | 4 | `master.insert`, `master.rename`, `master.set-background`, `master.delete` (requires `replacementMasterId`) |
| Layout | 5 | `layout.insert`, `layout.rename`, `layout.set-master`, `layout.set-background`, `layout.delete` (requires `replacementLayoutId`) |
| Slot | 3 | `slot.insert`, `slot.update`, `slot.delete` |
| Slide | 6 | `slide.insert`, `slide.move`, `slide.delete`, `slide.set-layout`, `slide.set-title`, `slide.set-background` |
| Element | 10 | `element.insert`, `element.replace`, `element.reorder`, `element.delete`, `element.set-placement`, `element.set-style`, `element.set-rotation`, `element.set-flags`, `element.group`, `element.ungroup` |
| Content | 3 | `text-source.set`, `rich-text.apply`, `prompt.apply-derived-output` |
| Table | 8 | `table.insert-row`, `table.move-row`, `table.delete-row`, `table.insert-column`, `table.move-column`, `table.delete-column`, `table.merge`, `table.unmerge` |
| Image | 2 | `image.set-source`, `image.set-accessibility` |

2 + 1 + 3 + 3 + 4 + 4 + 5 + 3 + 6 + 10 + 3 + 8 + 2 = **54**.

### 3.1 The reducer

[`domain/reducer.ts`](../../../apps/backend/src/3-capabilities/slides/domain/reducer.ts) exports
exactly four symbols: `resolveSlideStyle` (`:132`), `computeTouchedIds` (`:1833`),
`applyOperations` (`:1841`), `applyWithoutValidation` (`:1876`).

```ts
// reducer.ts:50
export interface SlideApplyResult {
  snapshot: DeckSnapshot;
  forward: SlideOperation[];
  inverse: SlideOperation[];
  touchedIds: string[];
  formulaChanges: FormulaAtomChange[];
}
```

`applyOperations(source, operations, richText, limits)` clones the source, applies each operation,
**prepends** each operation's inverse so the inverse list undoes in reverse order (`:1852`), then
runs `validateSnapshot` and throws `SlideValidationError(diagnostics)` if `!ok` (`:1854-1855`).
Finally it diffs the formula-atom map before and after and reports every atom that is new or whose
expression changed (`:1857-1865`). `touchedIds` is computed against the **source** snapshot
(`:1871`).

`applyWithoutValidation` (`:1876`) is the same loop with no validation and no inverse. **It is dead
at main** — the identifier appears nowhere else in `src/` or `test/`. (Document has its own
separate copy, which *is* used, at `document/domain/reducer.ts:1426`.)

### 3.2 Inverses and rebase

[`inverses.ts`](../../../apps/backend/src/3-capabilities/slides/domain/inverses.ts) is 14 lines and
exists only to stop callers hand-rolling inverses:

> ```ts
> /**
>  * Compute exact inverse operations through the same reducer used by admission.
>  * Kept as a separate domain entry point so callers never synthesize inverses.
>  */
> export const invertOperations = (before, operations, richText, limits) =>
>   applyOperations(before, operations, richText, limits).inverse;
> ```

(The signature is elided above; the real one is fully typed at `inverses.ts:9-14`.)

[`rebase.ts`](../../../apps/backend/src/3-capabilities/slides/domain/rebase.ts) is 23 lines and
purely functional — it never touches a snapshot. `canRebase(touchedIds, intervening)` intersects
the incoming touched-ID set with every intervening ChangeSet's `touchedIds` and returns
`{allowed: conflicts.size === 0, conflictingIds: sorted}`.

### 3.3 Touched IDs are the rebase currency

`operationIds` (`reducer.ts:1653-1820`) decides what any two concurrent edits are allowed to do.
The non-obvious choices:

| Rule | Where | Why |
| --- | --- | --- |
| `CONTAINER_ORDER_SENTINEL = "$slides:slide-order"` added by `slide.insert`/`move`/`delete` | `:1641` | Any two order-changing ChangeSets conflict |
| `style.set-default` uses `` `$slides:default-style:${elementKind}` `` | `:1681` | Per-kind default is its own conflict domain |
| `element.insert` adds **every sibling** in the target set | `:1726` | `// Insertion renumbers its sibling set, so the whole set is touched.` |
| `element.reorder` / `element.delete` add the whole subtree **and** the sibling set | `:1653-1820` | Both renumber and both move descendants |
| `rich-text.apply` adds the element (or `` `slide-notes:${slideId}` ``) **plus every atom ID** currently in the target | `:1653-1820` | Read through `readRichContentSafely` (`:1822`), which swallows errors and returns `undefined` |
| Prompt writes add both `promptSiteKey(site)` and `site.elementId` | `:1772-1778` | The site and the element are separately contended |

---

## 4 · Commands, queries and job intents — **declared, not implemented**

Everything in this section is a **type declaration only**. Nothing in `src/` constructs,
dispatches, decodes, or handles a `SlideCommand`, `SlideQuery`, or `SlideInternalJobIntent`. They
are the contract the missing application layer would satisfy. They are listed here because they are
the most precise available statement of what Slides is *for* — not because any of it runs.

### 4.1 `SlideCommand` — 9 arms (`model.ts:771`)

| Command | Payload |
| --- | --- |
| `deck.create` | `title`, `canvas?` |
| `deck.submit` | `deckId`, `expectedRevision`, `operations[]` |
| `deck.compensate` | `deckId`, `targetChangeSetId`, `intent: "undo" \| "redo"`, `expectedRevision` |
| `deck.delete` | `deckId`, `expectedRevision` |
| `deck.purge` | `deckId` |
| `prompt.create.request` | `deckId`, `expectedRevision`, `target: PromptCreateTarget`, `prompt`, `contextEntries[]`, `stabilisationText` |
| `prompt.update-definition` | `deckId`, `site`, `expectedDefinitionRevision`, `prompt`, `contextEntries[]`, `stabilisationText` |
| `prompt.refresh.request` | `deckId`, `site`, `expectedRevision` |
| `formula.evaluate.request` | `deckId`, `target: RichContentTarget`, `formulaAtomId` |

Two comments fix the identity rules. `model.ts:773-776`:

> ```
> /**
>  * The Deck ID and its first Slide are allocated by the service. A caller
>  * has no basis on which to name a resource that does not exist yet.
>  */
> ```

and `model.ts:795` — `/** Logical deletion; retained history remains revision-loadable. */`.

### 4.2 `SlideCommandResult` — 8 arms (`model.ts:832`)

`deck.created` (→ `DeckHead`) · `deck.changed` (→ `DeckChangeSet`) · `deck.deleted`
(`{deckId, revision}`) · `deck.purged` · `prompt.create-requested` (`{attemptId, site}`) ·
`prompt.definition-updated` (→ `DerivedOutput`) · `prompt.refresh-requested` (`{attemptId}`) ·
`formula.evaluate-requested` (`{attemptId}`).

There are 9 commands and 8 results because `deck.submit` and `deck.compensate` both answer
`deck.changed`.

### 4.3 `SlideQuery` / `SlideQueryResult` — 4 arms each (`model.ts:847`, `:853`)

| Query | Arguments | Result |
| --- | --- | --- |
| `deck.list` | `cursor?`, `lifecycle?` | `deck.listed` — `{items: DeckHead[], nextCursor?}` |
| `deck.load` | `deckId`, `revision?` | `deck.loaded` — `{head, snapshot, promptRevisions: DerivedOutputRevision[]}` |
| `deck.history` | `deckId`, `cursor?`, `limit` | `deck.history` — `{items: DeckChangeSet[], nextCursor?}` |
| `deck.attempt` | `deckId`, `attemptId` | `deck.attempt` — `{attempt: SlideAttempt}` |

### 4.4 `SlideInternalJobIntent` — 7 arms (`model.ts:864`)

Each carries `idempotencyKey: string`. Six are compute/settle pairs:

`slides.compact` · `slides.prompt.create.compute` / `.settle` ·
`slides.prompt.refresh.compute` / `.settle` · `slides.formula.evaluate.compute` / `.settle`.

For comparison, the seven internal job intents that **do** exist and **do** run all belong to
Document — see [document.md](document.md) and
[05-async-attempt-pipeline.md](../05-async-attempt-pipeline.md).

---

## 5 · Endpoints

**None.** Slides registers zero of the backend's 89 endpoints.

| Method | Path | Queue | Response mode | What it does |
| --- | --- | --- | --- | --- |
| — | — | — | — | *No endpoint exists. There is no `4-job-wiring/slides/` directory, no `registerSlideEndpoints` function, and no `registry.register` call site anywhere that names Slides.* |

The full 89-endpoint inventory is in [README.md](README.md) §1; Slides contributes 0 to it. There
is likewise **no internal job intent registered** — `registerDocumentInternalJobs` is the only
call to an `InternalJobsRegistrar` in the tree
([02-request-and-job-runtime.md](../02-request-and-job-runtime.md)).

---

## 6 · Persistence

Three files, 2,114 lines, none of them ever executed outside
`slides-persistence.test.ts`. The store's constructor is
`(projectId: string, dbPath: string, logger: Logger)` — **there is no default path constant and no
factory function**, because nothing constructs it.

### 6.1 The 13 tables

`createSlideTableNames(projectId)` (`sqliteSchema.ts:24`) builds the root
`` slides_${sha256(projectId).hex.slice(0,16)} `` and appends these suffixes. Twelve tables are
created in one `db.exec`; the thirteenth comes from the shared
`initializeResourceHistorySchema` (`sqliteSchema.ts:309`).

| Key | Physical suffix | Purpose | Key columns |
| --- | --- | --- | --- |
| `resources` | `_resources` | The stable root; survives logical deletion | `id` PK, `created_at` |
| `decks` | `_decks` | Current head | `id` PK → `resources(id)` CASCADE; `revision`, `base_seq`, `semantic_digest`, `lifecycle` |
| `history` | `_history` | Shared revision history, `resource_kind = 'deck'` | see [04-state-and-persistence.md](../04-state-and-persistence.md) |
| `receipts` | `_command_receipts` | Per-Deck idempotency replay | `(deck_id, request_id)` PK, `request_digest`, `result_json BLOB` |
| `createReceipts` | `_create_receipts` | Replay for `deck.create` | `request_id` PK, `deck_id` CASCADE |
| `identityLedger` | `_identity_ledger` | Permanent identity non-reuse | `(deck_id, identity_id)` PK, `identity_kind`, `state`, `first_revision`, `last_transition_revision`, `tombstoned_revision` |
| `bases` | `_bases` | Periodic snapshots | `(deck_id, base_seq)` PK, `snapshot_json BLOB`, `semantic_digest` |
| `changeSets` | `_change_sets` | The append-only chain | `id` PK; `deck_id`, `prior_revision`, `revision`, `seq`, `operations_json`, `inverse_operations_json`, `touched_ids_json` |
| `transactionOutbox` | `_transaction_outbox` | Activity outbox | `source_transaction_id` PK, `published_at` NULL while pending |
| `retainedOutputs` | `_retained_outputs` | Prompt outputs owned by a deleted Deck | `(deck_id, output_id)` PK → `resources(id)` |
| `attempts` | `_attempts` | Three attempt kinds | `id` PK, `deck_id`, `kind`, `site_key`, `frozen_json`, `candidate_json`, `state` |
| `promptOutputs` | `_prompt_outputs` | One Derived Output per live prompt site | `output_id` PK, `(deck_id, site_key)` UNIQUE, `state` |
| `stageReceipts` | `_stage_receipts` | Per-attempt stage claims | `(attempt_id, stage)` PK, `idempotency_key` UNIQUE |

**Pragmas: all four** (`sqliteSchema.ts:47-50`) — `journal_mode = WAL`, `foreign_keys = ON`,
`busy_timeout = 5000`, `synchronous = NORMAL`. Slides is one of only seven stores that set all
four; `foreign_keys = ON` earns its place, because this schema declares **15** `FOREIGN KEY`
clauses. Investigation, by contrast, declares none and sets three pragmas. The full pragma census
is in [04-state-and-persistence.md](../04-state-and-persistence.md).

**The `db.exec` is not wrapped in a transaction** (contrast Investigation, whose four-table
initialisation is). With `IF NOT EXISTS` on every statement this is a latent rather than an active
problem, but it is a difference worth knowing.

**Twelve indexes** are created in the same `exec`, plus `_history`'s own `_recorded` index:
`_decks_lifecycle_updated`, `_identity_ledger_state`, `_bases_lookup`, `_change_sets_recent`,
`_change_sets_compensation_target` (partial), `_transaction_outbox_unpublished` (partial),
`_transaction_outbox_source_request`, `_attempts_state`, `_attempts_site`,
`_attempts_prompt_create_site` (**UNIQUE, partial: `WHERE kind = 'prompt-create'`**),
`_prompt_outputs_detached` (partial), `_stage_receipts_state`.

### 6.2 The revision model, spelled out

A Deck's state at revision *N* is `Base(baseSeq ≤ N)` plus every ChangeSet in `(baseSeq, N]`. The
arithmetic is enforced by SQL, not by the (absent) service:

| Constraint | Table | Effect |
| --- | --- | --- |
| `CHECK (seq = revision)` | `_change_sets` | Sequence number and revision are **the same number**. There is no separate ordering key |
| `CHECK (revision = prior_revision + 1)` | `_change_sets` | Every ChangeSet advances by exactly one. Gaps are impossible |
| `UNIQUE (deck_id, seq)`, `UNIQUE (deck_id, revision)` | `_change_sets` | Two writers cannot claim one revision |
| `CHECK (base_seq <= revision)` | `_decks` | A Base can never be ahead of the head |
| `CHECK (revision >= 1)`, `CHECK (base_seq >= 1)` | `_decks` | Creation writes revision 1 and Base 1 |
| `CHECK ((state='active' AND tombstoned_revision IS NULL) OR (state='tombstoned' AND tombstoned_revision IS NOT NULL))` | `_identity_ledger` | The tombstone column and the state cannot disagree |
| `UNIQUE (deck_id, site_key)` + `CHECK (state != 'attached' OR attached_revision IS NOT NULL)` | `_prompt_outputs` | One output per live site, and an attached row must say when |
| `UNIQUE (deck_id, kind, client_request_id)` | `_attempts` | Per-kind request replay |

`commitCreation` asserts `head.revision === 1 && base.baseSeq === 1` and that every part names the
same Deck (`assertSameDeck`, `sqliteSlidesStore.ts:118`), then writes resources row → head →
identities → base → receipt → create receipt → outbox **in one transaction**
(`sqliteSlidesStore.ts:440-450`).

`commitMutation` validates `priorRevision === expectedRevision`,
`changeSet.revision === expectedRevision + 1`, and `head.revision === changeSet.revision`
*before touching the database*, and refuses a `same-kind-compensation` reactivation that arrives
without a compensation ChangeSet. Inside the transaction it snapshots the previous head into
`_history`, issues a conditional `UPDATE … WHERE id = ? AND revision = ?`, and **returns `false`**
when zero rows change — the port says why (`ports/slidesStore.ts:101-105`):

> ```
> /**
>  * Returns false when the compare-and-set on `expectedRevision` loses, which
>  * is an ordinary concurrent-writer outcome rather than an error. Every other
>  * failure throws.
>  */
> ```

`deleteDeck` writes a `snapshot` history record at `head.revision` and a `deleted` record at
`head.revision + 1`, copies owned prompt-output IDs into `_retained_outputs`, stages the deletion
transaction at the terminal revision, then `DELETE`s the deck row — cascading receipts, attempts
and prompt outputs away while `_resources`, `_history`, `_bases`, `_change_sets` and
`_identity_ledger` survive. It returns the terminal revision, or `null` when the Deck is absent.
`purgeDeck` purges history and then deletes the `_resources` row.

`pruneHistory(deckId, retainedBaseCount, retainedChangeSetCount, retainedTerminalAttemptCount)`
keeps `max(1, retainedBaseCount)` bases, `max(0, retainedChangeSetCount)` ChangeSets, and
`max(0, retainedTerminalAttemptCount)` attempts in
`TERMINAL_ATTEMPT_STATES = ["settled","unchanged","stale","failed"]` (`sqliteSlidesStore.ts:129`).
**No retention port is bound for Slides** — `startBackend.ts:123-147` binds 11 ports and Slides is
not among them, so nothing calls this.

### 6.3 The two-receipt rule

`deck.create` is the one command with no resource id at retry time, so it needs a second receipt
table. The port says it (`ports/slidesStore.ts:26-31`):

> ```
> /**
>  * Written in the same transaction as the receipt above. The two are not
>  * redundant: this one makes the create replayable by request id, while the
>  * deck-keyed receipt keeps the request-id reuse guard working for later
>  * commands on the same Deck.
>  */
> ```

and the schema repeats the consequence (`sqliteSchema.ts:88-92`):

> ```
> -- Replay record for deck.create. Keyed by request id alone, because the Deck
> -- id does not exist until the service allocates one and a retry has nothing
> -- else to look up with. It carries deck_id purely so it can CASCADE: once
> -- the Deck is gone the record is meaningless, and replaying it would hand
> -- the caller a head for a Deck that no longer exists.
> ```

### 6.4 The store port

[`ports/slidesStore.ts`](../../../apps/backend/src/3-capabilities/slides/ports/slidesStore.ts)
declares **exactly 40 methods** in six sections:

| Section | Count | Methods |
| --- | ---: | --- |
| Reads | 11 | `listHeads`, `getHead`, `getHistoricalHead`, `hasResource`, `getBaseAtOrBefore`, `getChangeSets`, `listChangeSets`, `getChangeSet`, `getSubmission`, `getCreateSubmission`, `getIdentity` |
| Writes | 7 | `recordSubmission`, `commitCreation`, `commitMutation`, `appendBaseIfHead`, `pruneHistory`, `deleteDeck`, `purgeDeck` |
| Attempts | 8 | `getAttempt`, `getAttemptById`, `getAttemptByRequest`, `getPromptCreationAttemptBySite`, `listRecoverableAttempts`, `createAttempt`, `createAttemptWithSubmission`, `updateAttempt` |
| Stages | 4 | `claimStage`, `completeStage`, `failStage`, `recoverInterruptedStages` |
| Prompt-output ownership | 6 | `getPromptOutputOwnership`, `getPromptOutputOwnershipBySite`, `registerPendingPromptOutput`, `updatePromptOutputOwnership`, `listDetachedPromptOutputs`, `listPromptOutputsForDeck` |
| Activity outbox | 4 | `getCommittedTransaction`, `getCommittedTransactionByRequest`, `listUnpublishedTransactions`, `markTransactionPublished` |

Every one returns a `Promise`, and the port explains why (`:62-68`):

> ```
> /**
>  * Every method is `Promise`-returning even though better-sqlite3 is synchronous.
>  * That is deliberate and matches Document: the port is what the service depends
>  * on, so it must not encode the fact that today's implementation happens to be
>  * an embedded synchronous database. A future store that is not — a networked
>  * one, or one behind a worker — drops in without touching a caller.
>  */
> ```

### 6.5 Behavioural specifics of the implementation

- `claimStage` returns `"completed"` / `"running"` / `"claimed"`; `recoverInterruptedStages` flips
  every `running` stage to `failed` with diagnostic
  `{code:"interrupted", message:"The stage was running when the process stopped"}`.
- `applyIdentityTransitions` tombstones removals (throwing when the ledger row is missing or is not
  an active identity of the same kind) and, for additions, either inserts, reactivates (**only**
  under `same-kind-compensation`, and only for a tombstoned identity of the same kind), or throws
  `SlideIdentityReuseError` after a `warn` log.
- Cursors are base64url JSON — `{kind:"deck-head", updatedAt, id}` or `{kind:"deck-change", seq}` —
  validated field by field; anything else throws `InvalidDeckCursorError`. `DEFAULT_PAGE_SIZE = 50`,
  `MAX_PAGE_SIZE = 200` (`sqliteSlidesStore.ts:59-60`).
- `sqliteMappers.ts` encodes every JSON column through `canonicalize` (sorted keys, `undefined`
  dropped) and returns a `Buffer`, so **stored JSON is canonical bytes** and digests are stable
  across writes. `decodeJson` accepts `string` or `Uint8Array` and otherwise throws
  `"Invalid JSON value read from the Slides store"`.

---

## 7 · Invariants, and where they are enforced

### 7.1 Group membership is acyclic — enforced as *reachability*

This is the most deliberate piece of the Slides domain, and it exists in four cooperating parts.
The argument is in `reducer.ts:276-286`, verbatim:

> ```
> /**
>  * Reject an element record that is not a well-formed forest.
>  *
>  * Acyclic group membership is not something the reducer may leave to
>  * end-of-batch validation: a cycle makes every downward walk non-terminating,
>  * so it has to be unreachable rather than merely rejected. Element-level
>  * operations carry their own targeted guards; this covers the operations that
>  * accept a whole element record from the caller — `slide.insert`,
>  * `master.insert` and `layout.insert` — where there is nothing to guard
>  * incrementally.
>  */
> ```

**(a) The formulation.** `unreachableElementIds` (`elements.ts:164`) walks *down* from
`parentGroupId === undefined`, collects everything reachable, and returns the sorted complement.
`elements.ts:158-163`:

> ```
> /**
>  * Elements not reachable from the container root by following `parentGroupId`.
>  * A parent cycle is exactly a set of elements that is unreachable, so this is
>  * the acyclicity check — and unlike walking ancestors from each element, it
>  * cannot be defeated by the cycle it is looking for.
>  */
> ```

**(b) The whole-record guard.** `assertElementForest(elements, where)` (`reducer.ts:287-316`)
throws `SlideOperationError` on three conditions: a record key that differs from the element's own
`id`; a `parentGroupId` that is missing or names a non-`group`; and a non-empty
`unreachableElementIds`, with the message
`` `${where} contains a group cycle: ${unreachable.join(", ")}` ``. It runs at `master.insert`
(`:422`), `layout.insert` (`:448`) and `slide.insert` (`:514`).

**(c) The incremental guards**, for operations that do not accept a whole record:

| Operation | Guard | Line |
| --- | --- | ---: |
| `element.insert` | a named `parentGroupId` must exist and be a `group` | `reducer.ts:565-570` |
| `element.reorder` | the same, **plus** `if (isWithinGroup(elements, parentGroupId, operation.elementId)) throw new SlideOperationError("An element cannot be moved beneath itself")` | `:598-606` |
| `element.replace` | cannot turn a Group into another kind; `zIndex` and `parentGroupId` are copied from the existing element and never taken from the replacement | `:581-589` |
| `element.group` | all members must share one parent | `:662-670` |
| `element.ungroup` | moves members only **upward**, so it cannot create a cycle | `:700-712` |

`element.group`'s comment (`reducer.ts:662-664`) is the proof obligation:

> ```
> // Sharing one parent is what makes grouping incapable of producing a
> // cycle: a member that already contained another member would sit at a
> // different depth, so it cannot pass this check.
> ```

**(d) The defensive walk.** `descendantsOf` (`elements.ts:140`) carries a `seen` set even though
validation forbids cycles — `elements.ts:130-138`:

> ```
> /**
>  * Every transitive member of a Group: a parent before its own children, and
>  * siblings in ascending `zIndex`. The reducer's delete-inverse restores in
>  * exactly this order, so each member's parent exists before it is written.
>  *
>  * The `seen` guard is not decoration. Validation rejects a parent cycle, but
>  * this runs on snapshots that arrive from storage as well as from the reducer,
>  * and an unguarded walk over a cycle overflows the stack rather than failing a
>  * check.
>  */
> ```

Nine of the 61 domain tests target exactly this, including
*"a cycle is refused at the operation, not merely at end-of-batch validation"*
(`slides-domain.test.ts:589`) and *"no legal operation sequence leaves an unreachable element"*
(`:613`).

### 7.2 `zIndex` is the sole sibling-order authority

`elements.ts:108-112`:

> ```
> /**
>  * `zIndex` is the sole sibling-order authority. Within one container, the
>  * elements sharing a `parentGroupId` (or sharing its absence) form a sibling
>  * set whose `zIndex` values are exactly 0..n-1, back to front.
>  */
> ```

The mutators are in-place, and the block comment at `elements.ts:230-234` names the precedent:

> ```
> // These mutate the element record in place, exactly as Document's reducer
> // splices its row and block arrays in place. Every one of them preserves the
> // contiguous-0..n-1 invariant on the sibling sets it touches.
> ```

Mutators: `compactSiblings`, `openSiblingSlot`, `closeSiblingGap`, `insertIntoSiblings`,
`detachFromSiblings`. Readers: `siblingsOf`, `rootElements`, `childrenOf`, `descendantsOf`,
`ancestorsOf`, `groupDepth`, `isWithinGroup`, `paintOrder`. Enforcement at validation time is
`validation.ts:388-402`, under the comment
`// zIndex is the sole sibling-order authority: unique and contiguous per parent.`

`paintOrder` (`elements.ts:216`) is *"Back-to-front paint order: each sibling set in `zIndex` order,
with a Group's members emitted immediately after the Group itself."*

### 7.3 Structural guard rails in the reducer

A Deck can never be emptied of the things everything else references. Each is a thrown
`SlideOperationError`:

| Rule | Helper | Line |
| --- | --- | ---: |
| A Deck must retain at least one Style | `fallbackStyleId` | `reducer.ts:1557-1560` |
| A Deck must retain at least one Master | `anyOtherMasterId` | `:1574-1578` |
| A Deck must retain at least one Layout | `anyOtherLayoutId` | `:1580-1584` |
| A token may only be replaced by one of the same kind | `firstTokenOfKind` (`:1563`) and the forward check at `:378-383` (`SlideTokenReferenceError`) | |
| Nothing may replace itself | styles `:407`, masters `:434`, layouts `:467` | |
| `style.update` cannot change identity | `:397-399` | |
| Only a Slide element may bind a slot | `element.set-placement` → `SlidePlacementError` | `:619-621` |

### 7.4 What `validateSnapshot` checks

`validateSnapshot(snapshot, richText, limits)` returns `{ok, diagnostics: string[]}` and
**accumulates every diagnostic** rather than failing on the first. `applyOperations` turns a
non-`ok` result into one `SlideValidationError(diagnostics)`.

| # | Check | Line |
| ---: | --- | ---: |
| 1 | `representationVersion !== 1` → `"unsupported representation version"` | `:438` |
| 2 | Non-blank Deck title; positive canvas dimensions | `:441-444` |
| 3 | Theme: non-blank name; each token keyed by its own ID, named, kind-appropriate; every palette entry resolves to a `color` token; typography resolves to `font`/`length` | `validateTheme`, `:70-112` |
| 4 | Styles: unique non-empty IDs, non-blank names, **exactly one** `systemRole === "normal"`, `basedOnStyleId` exists and does not cycle, and **all seven element kinds have a registered, existing default style** | `validateStyles`, `:153-206` |
| 5 | ≥ 1 Master; each keyed correctly, named, background resolvable | `:449-458` |
| 6 | ≥ 1 Layout; `masterId` exists; slots keyed correctly, named, valid frames, only known `accepts` kinds | `:460-486` |
| 7 | ≥ 1 Slide; `slideOrder` free of duplicates and dangling IDs; every Slide in the order; `layoutId` exists; notes are valid Rich Content | `:488-514` |
| 8 | Per container: element keyed by its own ID; `styleId` exists; finite rotation; `free` placement has a valid frame; **a `slot` placement outside a Slide is a diagnostic**; `parentGroupId` exists and is a `group`; kind-specific checks; **no empty Group**; acyclicity; contiguous `zIndex` | `:308-427` |
| 9 | Every one of the ten `SlideLimits` fields | `:525-562` |
| 10 | One distinct Derived Output per live prompt source, and no output bound at two sites | `:564-587` |

Two comments in this file are worth keeping. `validation.ts:170-172` on the single protected style
role:

> ```
> // `normal` is the only protected role: Document additionally protects its six
> // heading roles because outline level derives from them, and Slides has no
> // outline to derive.
> ```

and `validation.ts:418-419` on dangling slot bindings:

> ```
> // A dangling slot binding is legal and reported by a projection, but a
> // binding to a slot that exists must respect what that slot accepts.
> ```

Table validation (`validateTable`, `:230`) additionally enforces unique row/column/cell/merge IDs,
≥ 1 row and ≥ 1 column, cells referencing live rows and columns, no two cells at one coordinate,
density, merges referencing existing cells, a merge never covering its own root, and no cell
covered by two merges.

### 7.5 Identity non-reuse

`collectSlideIdentities(snapshot)` walks every governed ID and returns them sorted by `(id, kind)`;
`computeSlideIdentityTransitions(before, after)` returns `{added, removed}` keyed on
`` `${id}\u0000${kind}` ``. `identities.ts:53-60`:

> ```
> /**
>  * Collect every identity governed by the retained-history non-reuse rule.
>  * References to external resources — Derived Output IDs and media file IDs —
>  * are deliberately excluded, because Slides does not own their lifecycle.
>  *
>  * A `prompt` text source contributes no Rich Text identities: it holds a
>  * reference, and the generated text never enters the snapshot.
>  */
> ```

and `identities.ts:92` — `/** A 'prompt' source holds a reference, so it contributes no identities. */`.

The SQL side keeps itself honest: the `identity_kind` `CHECK` lists all 15 values, with the comment
(`sqliteSchema.ts:102-104`) *"Permanent identity non-reuse across retained history. The kind list is
the SlideIdentityKind union; a mismatch between the two is caught by a test rather than left to
drift."* — and that test exists, `slides-persistence.test.ts:255`,
*"the identity-kind CHECK constraint matches the SlideIdentityKind union"*.

### 7.6 Canonical bytes

`canonical.ts` (32 lines) sorts object keys and **drops `undefined` values**, then hashes the UTF-8
JSON with SHA-256. `digestSnapshot` is the Deck's semantic digest; `digestFormulaExpression` is a
plain SHA-256 of the expression string. Because the mappers encode through the same function,
snapshot bytes on disk are canonical and a round trip through storage cannot change a digest —
which is precisely what `orderTableCells` (§8) exists to preserve.

---

## 8 · Design decisions worth preserving

Slides carries the densest concentration of decision-explaining comments in the backend. Beyond
those already quoted, these are the ones that answer "why is it done this way".

### 8.1 Exact inverses, and the six places where "exact" is hard

| Comment | Where |
| --- | --- |
| *"Position is structural and is never carried by a replacement: it stays exactly where it was, so replace is purely a content edit."* | `reducer.ts:584-585` |
| *"Ungrouping returns the members to the parent as a contiguous run, which is not where they were if non-members were interleaved. The explicit reorders restore each member's original index; applying them in ascending index order reconstructs the original arrangement exactly."* | `reducer.ts:1307-1310` |
| *"Style order is part of canonical state, so restoring a deleted Style has to put it back where it was rather than appending it."* | `reducer.ts:1544-1547` |
| *"Style and token deletion rewrite every reference to them. Restoring the deleted thing does not restore those references, so the inverse carries the reference edits back explicitly."* | `reducer.ts:1586-1590` |
| *"Restore an element exactly where it was, including its parent and z-index. Groups restore their whole subtree, deepest last, so every member's parent exists before the member is written."* | `reducer.ts:968-971` |
| `// Members land where the Group was, in their relative order.` | `reducer.ts:706` |

### 8.2 Why a dense table is ordered row-major after every structural edit

`reducer.ts:867-873` — the clearest statement anywhere in the repo of "derived, not authored":

> ```
> /**
>  * A table is dense, so the cell array carries no information the row and column
>  * orders do not already hold. Ordering it row-major after every structural edit
>  * makes the array derived rather than authored — without this, restoring a
>  * deleted column appends its cells and the round trip changes canonical bytes
>  * while the table is logically unchanged.
>  */
> ```

### 8.3 Why deleting a slot does not cascade

`reducer.ts:497-499`:

> ```
> // Elements bound to the slot are left bound. The binding becomes dangling
> // and a projection reports it; making deletion cascade into Slides would
> // turn a Layout edit into an unbounded Slide rewrite.
> ```

`presentation.ts` states the reporting side of the same rule three times:

- `:87-91` (`unfilledSlots`) — *"An unfilled slot is a completeness **hint** — a half-finished Slide
  is legal — so this is a projection input, never a validation diagnostic."*
- `:105-109` (`resolveElementFrame`) — *"A binding whose slot has been deleted resolves to
  `undefined` rather than to a stale frame."*
- `:66-70` (`slotBindings`) — *"At most one element per Slide may bind a given slot, so this is a
  function rather than a multimap; a second binding is a validation error, not something resolved
  here."*

### 8.4 Geometry is deliberately permissive

`geometry.ts:3-7`:

> ```
> /**
>  * Slide geometry is in points and is deliberately *not* integral: half-point
>  * positions are ordinary in authored decks, so the only requirements are
>  * finiteness and positive extent.
>  */
> ```

`geometry.ts:23-27`:

> ```
> /**
>  * Frames may extend past the canvas — bleed and deliberate overflow are normal
>  * authoring, and clipping is a rendering decision. This predicate exists for
>  * projections that want to report it, never for validation.
>  */
> ```

and `geometry.ts:43` — `/** Rotation is stored as authored; only finiteness is required. */`.

### 8.5 The prompt-site key is a string because the uniqueness rule is SQL

`sqliteMappers.ts:142-150`:

> ```
> /**
>  * The stored address of a prompt site.
>  *
>  * Document keys ownership on a bare block id. A Slides site is a container plus
>  * an element (plus a cell), so it needs a composite key — and it must be a
>  * *string*, because the uniqueness constraint that enforces one output per live
>  * site is a SQL UNIQUE. The container is part of the key, not decoration: two
>  * planes may hold elements with the same ID.
>  */
> ```

The schema says the same from the other side (`sqliteSchema.ts:278-279`): *"One dedicated Derived
Output per live prompt site, in SQL rather than in the service, so a concurrent settle cannot
double-bind a site."* — and `:227-229`: *"A prompt site is a container plus an element, so the
address is wider than Document's single block id. It is stored decomposed rather than as opaque
JSON so the uniqueness constraint below can be expressed in SQL."*

### 8.6 The only store in the backend that logs

`sqliteSlidesStore.ts:170-198` is the longest design argument in the capability, quoted in full:

> ```
> /**
>  * **This store logs, and no other store in this backend does.**
>  *
>  * Every existing persistence layer is silent — logging lives in the application
>  * layer. That is a reasonable default, because a service knows *why* it is
>  * writing and a store only knows *what* it wrote. It was changed here on
>  * purpose: a correct-looking result reached by wrong reasoning is the failure
>  * this capability is most exposed to, and several facts are visible only from
>  * inside the transaction — which compare-and-set lost, which identity was
>  * refused, which statement tripped a constraint.
>  *
>  * The cost is controlled by level. Statement-level detail is `debug`, so it is
>  * off in production and complete in development. `info` is reserved for durable
>  * commits, `warn` for outcomes a caller is expected to handle, and `error` for
>  * state that should be impossible.
>  *
>  * **Authored content is logged, under a reserved `content` key.** Everything
>  * outside `content` is *shape* — identifiers, counts, revisions, digests, kinds.
>  * Everything inside it is what a person wrote: titles, operations carrying Rich
>  * Content, prompt text.
>  *
>  * The split is the point. A logger that wants shape only drops `data.content`
>  * and needs to know nothing else about any capability, so the eventual
>  * configuration flag is one line in the sink rather than an audit of every call
>  * site. Nothing outside `content` may carry authored text, or that guarantee
>  * silently stops holding.
>  *
>  * Today everything is logged. See {@link CONTENT_KEY}.
>  */
> ```

Four supporting comments in the same file:

- `:211` — `// The prefix, not the project ID: the prefix is already a one-way hash.`
- `:556-558` — *"Losing the compare-and-set is an ordinary concurrent-writer outcome, so it is a
  caller's problem to report, not a fault. It is logged because 'why did my write vanish' is
  otherwise invisible from outside."*
- `:593-594` — *"The operations are the whole point of the line: they are what changed, and they
  carry the authored text that changed."*
- `:727-728` — *"Retained prompt outputs move to the stable root before the operational rows cascade
  away, so a reclaimer can still find what this Deck owned."*

**That argument has since been overtaken.** See §9.1.

### 8.7 An explicitly admitted unwired seam

`ports/slidesStore.ts:165-169` — a port method that documents its own uselessness rather than
pretending otherwise:

> ```
> /**
>  * Outputs that were owned and are no longer attached. Nothing consumes this
>  * yet — deletion detaches rather than destroys, because compensation can
>  * restore the source — but a reclaimer needs the list to exist.
>  */
> ```

---

## 9 · Known gaps and defects

### 9.0 The capability is unreachable

Restated because it governs everything else: Slides has no application layer, no composition, no
wiring, no alias and no endpoint. Its 6,765 lines are compiled on every build and exercised by 87
tests, and no request, job or startup path touches any of it. It is the largest single block of
dormant code in the backend — **6,765 of `3-capabilities`' 32,246 lines, 21%**. Recorded in
[11-known-issues.md](../11-known-issues.md).

### 9.1 `CONTENT_KEY` was superseded by a platform mechanism in this very commit

`sqliteSlidesStore.ts:131-144` declares:

> ```
> /**
>  * The reserved log-payload key under which authored content is carried.
>  *
>  * A log payload is `{ ...shape, content?: { ...authored } }`. Shape is safe to
>  * emit anywhere: IDs, counts, revisions, digests, kinds, states. Content is
>  * whatever a person typed.
>  *
>  * This exists so the split is enforced in one place rather than remembered at
>  * every call site, and so a future `logContent: false` sink can strip
>  * `data[CONTENT_KEY]` without knowing anything about Slides. It belongs in
>  * `0-platform/observability` once that flag lands; it is here for now because
>  * Slides is the only capability observing the convention.
>  */
> export const CONTENT_KEY = "content";
> ```

**The flag landed in `ef6d462` itself** — `LogDetail`, `LogOptions`, the third `options?` parameter
on all four `Logger` methods, and the `logging.detail` config field
([`0-platform/observability/logger.ts:22-27, 44-48`](../../../apps/backend/src/0-platform/observability/logger.ts)).
Slides was not migrated: `grep -n detail sqliteSlidesStore.ts` finds the word only inside prose.
The store passes no `options`, and `FileLogger` never inspects `data`.

Concrete consequence: with `logging.detail: "shape"`, Document and Templates correctly drop their
nine content-labelled records, while **every** Slides store record — including the ones whose
`content` key carries Deck titles, whole operation arrays with Rich Content, and prompt text — is
written in full, because it is `shape` by default. Nothing leaks today only because Slides is
unreachable; the convention is broken regardless. Two Slides tests that pin the split
(`slides-persistence.test.ts:712`, `:739`) would still pass in shape mode, because they inspect the
payload shape rather than the sink. See
[06-platform-services.md](../06-platform-services.md) and [11-known-issues.md](../11-known-issues.md).

(The off-main commit `4a76c78`, *"refactor(slides): adopt the platform detail label for content
logging"*, fixes this. It is not an ancestor of HEAD — §0.)

### 9.2 Seven of fourteen error classes are thrown by nothing

`errors.ts` exports exactly 14 classes (`grep -c '^export class'` → 14). Counting `new X(` across
the whole capability:

| Error | Throw sites | Status |
| --- | ---: | --- |
| `SlideOperationError` | 73 | live |
| `SlidePlacementError` | 10 | live |
| `SlideStyleReferenceError` | 4 | live |
| `SlideTokenReferenceError` | 4 | live |
| `InvalidDeckCursorError` | 4 | live (store) |
| `SlideIdentityReuseError` | 2 | live (store) |
| `SlideValidationError` | 1 | live (reducer) |
| `DeckNotFoundError` | **0** | declared for the absent service |
| `SlideAttemptNotFoundError` | **0** | declared for the absent service |
| `RevisionConflictError` | **0** | declared for the absent service |
| `IdempotencyMismatchError` | **0** | declared for the absent service |
| `CompensationConflictError` | **0** | declared for the absent service |
| `HistoryPrunedError` | **0** | declared for the absent service |
| `SlideStaleAttemptError` | **0** | declared for the absent service |

Seven thrown, seven not. There is also no HTTP status mapping for any of them, because there is no
wiring file — so the shared retention-error contract every other capability honours
([04-state-and-persistence.md](../04-state-and-persistence.md)) has no Slides implementation.

### 9.3 Dead exports inside Slides

Each verified by grepping `src/` and `test/` for the identifier:

| Symbol | File:line | Status |
| --- | --- | --- |
| `detachedFrameFor` | `presentation.ts:125` | **Imported by `reducer.ts:41` and never used in that file** — the identifier appears exactly once in `reducer.ts`, as the import. `noUnusedLocals` is not set, so `tsc` does not flag it. This reads as an incomplete edit, not a plan |
| `applyWithoutValidation` | `reducer.ts:1876` | Exported; no other reference in `src/` or `test/` |
| `siteAsRichContentTarget` | `elements.ts:391` | An identity function, `(site) => site`; no reference anywhere |
| `framesIntersect`, `isFrameWithinCanvas`, `translateFrame` | `geometry.ts:37, 28, 47` | Exported; no reference anywhere |
| `locateElement`, `forEachElement`, `compactSiblings`, `groupDepth` | `elements.ts:82, 95, 237, 198` | Exported; no reference anywhere. Note the group-depth limit is enforced with `ancestorsOf(...).length` (`validation.ts:529`), not with `groupDepth` |
| `containerRootElements` | `presentation.ts:242` | Exported; no reference anywhere |
| `canRebase`, `invertOperations` | `rebase.ts:8`, `inverses.ts:9` | Reached only from `slides-domain.test.ts`. Document keeps its own separate copies |
| `DeckSnapshot.revision` | `model.ts:29` | Declared; **no reducer operation writes it and no validation reads it**. Only `DeckHead.revision` is maintained, and only by the store |
| `listDetachedPromptOutputs` | `ports/slidesStore.ts:170` | The port comment itself says *"Nothing consumes this yet"* |
| `SlideCommand`, `SlideCommandResult`, `SlideQuery`, `SlideQueryResult`, `SlideInternalJobIntent`, `SlideCommandRequest`, `SlideQueryRequest`, `SlideOptions` | `model.ts` | Contract types for the absent application layer (§4) |

The consolidated dead-surface list for the whole backend is in
[11-known-issues.md](../11-known-issues.md).

### 9.4 `promptSiteKey` is implemented twice, with nothing enforcing agreement

| Implementation | File:line | Consumer |
| --- | --- | --- |
| Domain | `domain/elements.ts:450` | `reducer.ts:1775`, for touched IDs |
| Persistence | `persistence/sqliteMappers.ts:151` | `attemptToStorageParts`, for `site_key` |

They produce identical strings today (`element-body:<plane>:<id>:<el>` and
`table-cell:<plane>:<id>:<el>:<cell>`), by two independent code paths — the domain version builds
the container prefix from `` `${site.container.kind}:${containerId(site.container)}` ``, the
persistence version from a hand-written three-way conditional. There is **no shared source and no
test asserting they agree**. If they diverge, a touched-ID conflict check and a SQL uniqueness
constraint stop referring to the same thing, which is exactly the class of bug the
`0-utils/persistence/likePattern.ts` header was written to warn about.

### 9.5 `SlideLimits` has no configuration source

Ten limits are enforced by `validateSnapshot`, and **nothing in `src/` constructs a `SlideLimits`
value**. There is no `slides` section in `etc/configuration.yaml`, no `slides` field on
`BackendConfig`, and no entry in `DEFAULT_CONFIG`. The tests supply their own. Whoever writes the
application layer has to add the config surface as well — see
[09-configuration.md](../09-configuration.md) for the shape every other capability uses.

### 9.6 No retention port, no shutdown path

`pruneHistory` and `purgeDeck` exist on the store and satisfy the shape of the shared
`ResourceRetentionPort`, but `startBackend.ts:123-147` binds **11** ports and Slides is not one of
them, so a Slides database — if one existed — would accumulate history forever. `close()` exists on
`SQLiteSlidesStore` (`:217`) and, like the other five stores that expose it, is called from nothing
outside tests.

### 9.7 The schema `exec` is not transactional

`initializeSlidesSchema` runs its twelve `CREATE TABLE` / twelve `CREATE INDEX` statements in a
single un-wrapped `db.exec`, then calls `initializeResourceHistorySchema`. Investigation wraps the
equivalent work in a transaction. Every statement uses `IF NOT EXISTS`, so a partial failure leaves
a partially-created schema that a later run completes rather than a corrupt one — but the asymmetry
between two capabilities written days apart is real.

### 9.8 Coverage: what the 87 tests do and do not reach

`slides-domain.test.ts` (61 tests, 1,774 lines) covers, in file order: blank-Deck validation and
each structural requirement; **nine group-cycle tests**; prompt sources in all three planes and
one-output-per-site; slot acceptance; table density and merges; exact-inverse round trips for every
operation family; batch inversion in reverse order; `invertOperations` agreeing with the reducer;
a batch that ends invalid being refused whole; touched-ID coverage; the same element ID in two
planes being two distinct prompt sites; rebase gating; identity collection and transitions;
three-plane resolution and background precedence; slot-bound frames following slot edits; theme and
style resolution; digest stability across key order; container isolation; and operations against
missing containers.

`slides-persistence.test.ts` (26 tests, 806 lines) covers the four pragmas and the hashed prefix;
the identity-kind `CHECK` matching the union; atomic creation; the CAS and its refusal; history,
ChangeSet, receipt and outbox writes together; revision-arithmetic refusals before any write;
cross-Deck part rejection; tombstoning and same-kind reactivation; `appendBaseIfHead`; pruning
windows; cursor round trips and junk rejection; attempt round trips and the one-prompt-create-per-
site database rule; stage claiming and interrupted-stage recovery; prompt-output ownership
transitions and the two-outputs-one-site refusal; outbox publication; and **four logging tests**
(`:712`, `:739`, `:770`, `:781`).

What no test reaches, because the code does not exist: command decoding, query handling, the
attempt state machine end to end, job dispatch, HTTP status mapping, Activity publication, Derived
Output integration, Formula settlement, and composition. Both test files import by relative path;
neither exercises a composed capability, because there is nothing to compose.

---

## See also

- [README.md](README.md) — the capability inventory, where Slides is the one row with 0 endpoints
- [document.md](document.md) — the capability Slides is modelled on: same Base + ChangeSet history,
  same identity ledger, same attempt/stage pipeline, and fully wired
- [investigation.md](investigation.md) — the opposite persistence answer (whole canonical records
  with a monotonic revision) in a capability written at the same time
- [../02-request-and-job-runtime.md](../02-request-and-job-runtime.md) — the registry and scheduler
  Slides would have to register into
- [../04-state-and-persistence.md](../04-state-and-persistence.md) — the shared history table, the
  pragma census, and the retention sweep Slides is absent from
- [../06-platform-services.md](../06-platform-services.md) — the Rich Text engine the reducer and
  validator call, and the observability detail label Slides does not use
- [../08-conventions.md](../08-conventions.md) — the module-`docs/` rule Slides is the only
  exception to
- [../11-known-issues.md](../11-known-issues.md) — the consolidated defect and dead-surface list
- [../12-build-order.md](../12-build-order.md) — where finishing Slides sits relative to everything
  else
