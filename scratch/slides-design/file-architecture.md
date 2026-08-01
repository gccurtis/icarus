# Slide capability — file architecture

## Placement and removal boundary

Slide is a regular, project-scoped capability. Its implementation lives under
the singular directory `3-capabilities/slide/`; HTTP and internal-Job adapters
live under `4-job-wiring/slide/`. Initialization constructs one instance in
`1-init/create/slide.ts` and adds a small composition hunk to
`1-init/startBackend.ts`.

The store is bound to `config.projectId` during construction. Project and user
IDs never appear in the canonical Deck aggregate, public request DTOs,
ChangeSets, or internal Job intents. The configured user ID may be copied only
into the operational accepted-fact attribution record. Slide owns a separate
`./data/slides.db` file whose physical table names include a deterministic
project hash.

Apart from tests and these design documents, `startBackend.ts` is the only
existing file changed by the implementation. Slide defaults are exported by
the new capability and consumed by its new initialization factory, so Slide
does not add fields to backend configuration. Existing generic aliases are
used; no `package.json` or `tsconfig.json` alias is added.

```text
apps/backend/
  src/
    3-capabilities/
      slide/
        application/
          createService.ts          # blank Deck and local default options
          slideService.ts           # commands, queries, admission, stages, recovery
        domain/
          canonical.ts              # canonical JSON and semantic digests
          errors.ts                 # typed domain/application errors
          elements.ts               # scoped flat element lookup, parent traversal, and z-order
          geometry.ts               # pure canonical point geometry validation/derivation
          identities.ts             # identity collection and transition calculation
          inverses.ts               # exact inverse entry point
          model.ts                  # canonical state, operations, history, attempts, intents
          presentation.ts           # Design-system resolution and Layout-slot binding
          rebase.ts                 # conservative touched-ID rebase decision
          reducer.ts                # pure operation reduction and inverse generation
          validation.ts             # recursive invariants and configured limits
        persistence/
          sqliteMappers.ts          # deterministic JSON and row/domain mapping
          sqliteSchema.ts           # project-hashed table names and DDL
          sqliteSlideStore.ts       # transactions and SlideStore implementation
        ports/
          derivedOutputs.ts         # narrow Derived Outputs runtime interface
          formulaResolver.ts        # narrow Formula name-resolution snapshot interface
          slideStore.ts             # project-scoped persistence contract
        projections/
          dependencies.ts           # Prompt, immutable General Files, Formula, token, Layout, and Master refs
          formulaDependencies.ts    # Formula atom IDs, targets, and expression digests
          outline.ts                # Slides in canonical Deck order
          plainText.ts              # titles, authored text, notes, labels, and accessibility text
          presentation.ts           # resolved semantic Slide plan, never pixels
          styling.ts                # Theme tokens, embedded appearance, Normal text style, and marks
        wire/
          commandSchemas.ts         # exact command-envelope decoding
          operationSchemas.ts       # exact operation decoding
          querySchemas.ts           # exact query-envelope decoding
          valueSchemas.ts           # recursive DTO decoding and wire budgets
        index.ts                    # the capability's public barrel

    1-init/
      create/
        slide.ts                    # concrete project-scoped construction
      startBackend.ts               # the only existing runtime file changed

    4-job-wiring/
      slide/
        createSlideJobs.ts          # internal intent to fresh Job mapping
        registerSlideEndpoints.ts   # two public endpoint mappings
        registerSlideInternalJobs.ts
        slideJobPayloads.ts         # transport-neutral type re-exports

  test/capabilities/
    slide-application.test.ts
    slide-domain.test.ts
    slide-persistence.test.ts
    slide-wire.test.ts
```

This is intentionally the consolidated structure used by Document. Command
dispatch, query dispatch, CAS admission, compensation, prompt orchestration,
compaction, logging, and recovery remain cohesive in `slideService.ts` rather
than being split into thin application files that conceal one transaction or
workflow across many modules.

## Module responsibilities

| File | Responsibility |
|---|---|
| `application/createService.ts` | Exports `DEFAULT_SLIDE_OPTIONS`, the default canvas and `DeckDesignSystem` (Theme defaults/tokens, protected editable Normal text style, one Master, and one Layout), and `createBlankDeckSnapshot`. Creation starts at revision 0 with one blank Slide selecting the default Layout and no ChangeSet. |
| `application/slideService.ts` | Implements `SlideCapability`; dispatches commands and queries; reconstructs revisions; performs CAS admission, semantic rebase, compensation, compaction, Prompt Content and Formula stages, capacity redrive, and startup recovery. |
| `domain/model.ts` | Defines the Deck aggregate and `DeckSnapshot.design: DeckDesignSystem { theme, textStyles, masters, layouts }`; Theme defaults and typed tokens; exactly one protected editable Normal text style; Master and Layout registries; stable Layout-slot metadata; ordered Slides; Master/Layout/Slide element scopes; discriminated free-versus-slot placement; the direct `SlideElement` kinds (`group`, `text`, `prompt-content`, `geometry`, `straight-line`, `image`, `table`, and `chart`); Rich Content Formula attempts; operations; history; receipts; intents; limits; and options. |
| `domain/elements.ts` | Locates flat elements within their Master, Layout, or Slide owner scope, derives Group ancestry from `parentGroupId`, derives ordered siblings from canonical `zIndex`, and rejects cross-scope parents, missing parents, cycles, or ambiguous ordering. No root/child arrays duplicate those authorities. |
| `domain/geometry.ts` | Validates free-element frames/transforms and derives slot-bound frames from the selected Layout in canonical Slide point coordinates. It performs no I/O, font measurement, pixel conversion, or rendering. |
| `domain/presentation.ts` | Resolves the selected Layout to its Master, Theme defaults/tokens, the Normal text style, kind-specific embedded appearance, Master/Layout-scoped elements, and Slide-scoped elements/bindings to stable Layout slot IDs, then emits deterministic canonical presentation semantics in point coordinates. It does not shape fonts, calculate pixels, or paint. |
| `domain/reducer.ts` | Clones a snapshot, applies operations to flat elements and presentation resources, validates the result, and returns canonical forward operations, exact inverses, touched IDs, and the new snapshot. |
| `domain/inverses.ts` | Exposes inverse calculation through the same reducer used by admission; callers never synthesize compensation operations independently. |
| `domain/identities.ts` | Collects every Deck-owned stable identity, including Theme tokens, Masters, Layouts, Layout slots, Slides, elements, Rich Text atoms, and marks, and computes additions/removals for the permanent identity ledger. External output and General Files IDs are references and are excluded. |
| `domain/validation.ts` | Enforces identity uniqueness, valid owner scopes, flat membership and unique sibling `zIndex`, bounded acyclic Groups, valid Master/Layout/slot references, exactly one frame authority per placement, valid slot bindings, typed token/appearance/content limits, immutable General Files image refs, Rich Text validity, one protected Normal text style, and one dedicated Derived Output per live Slide-scoped `prompt-content` element. Tokens hold literal values and cannot alias in v1. |
| `domain/canonical.ts` | Produces deterministic bytes and SHA-256 digests for requests, snapshots, stages, and facts. |
| `domain/rebase.ts` | Allows stale submission only when its touched-ID footprint is disjoint from every continuous intervening ChangeSet. |
| `ports/derivedOutputs.ts` | Defines the keyed `declare`, `refresh`, and `updateDefinition` calls plus exact output/revision reads that Slide needs. It imports no Derived Outputs persistence and exposes no deletion authority. |
| `ports/formulaResolver.ts` | Defines only `buildSnapshot()`, returning the immutable `FormulaResolverSnapshot` needed to bind Formula names during a compute stage. It imports no resolver implementation or mutable source persistence. |
| `ports/slideStore.ts` | Defines atomic creation/mutation commits; Base and ChangeSet reads; receipts; identity ledger; Prompt and Formula attempts/stages; output ownership; delegated-command claims; compaction; and accepted-fact outbox access. |
| `persistence/sqliteSchema.ts` | Creates project-hashed Deck, Base, ChangeSet, receipt, identity-ledger, delegated-claim, attempt, stage, Prompt-output ownership, and activity-outbox tables. The generic attempt/stage tables distinguish Prompt and Formula attempt kinds. |
| `persistence/sqliteSlideStore.ts` | Opens `./data/slides.db`, applies DDL, performs compare-and-swap transactions, preserves exact receipts, and implements history pruning without breaking the retained replay tail. |
| `wire/*` | Rejects unknown fields, invalid discriminants, non-finite numbers, non-JSON/cyclic input, excessive depth/counts/bytes, malformed Rich Text, and structurally invalid element content before the capability is called. |
| `projections/*` | Builds deterministic, discardable outline, plain-text, dependency, Formula-dependency, resolved-style, and semantic-presentation reads from a loaded snapshot. Presentation projection resolves `DeckDesignSystem`—Theme, the Normal text style, Master/Layout scoped elements, slots, and Slide bindings/elements—in point coordinates; it never persists a render cache or resolves viewport/font/device pixels. |
| `index.ts` | Exports the public runtime, domain contracts/errors, pure helpers, store port/adapter, wire decoders, and projections. Internal persistence helpers remain private. |

## Dependency direction

```text
2-transport / 4-job-wiring / 1-init
                    |
                    v
          Slide application runtime
             |       |       |       |
             |       |       |       +--> injected Logger
             |       |       +----------> injected InternalJobsRuntime
             |       +------------------> narrow Derived Outputs port
             +--------------------------> injected Formula runtime
                    |
                    +-----------> narrow FormulaResolver port
                    +-----------> SlideStore port
                    |                  ^
                    v                  |
             pure Slide domain     SQLite adapter
                    |
                    +-----------> injected Rich Text interface
```

The laws are:

- Domain code is pure and deterministic. It never imports SQLite, the
  scheduler, transport, Derived Outputs implementation, Formula implementation,
  Formula resolver implementation, Structured Data, Intelligence, or a model
  provider.
- Application code sequences domain functions and injected ports. It owns
  retries and crash boundaries but does not select queues or parse HTTP input.
- Persistence implements only the capability-owned `SlideStore` contract.
- Job wiring chooses queues and HTTP status codes but performs no domain
  reduction or persistence.
- Initialization is the only place that constructs concrete dependencies and
  binds project scope and actor attribution.
- Slide imports Rich Text, Formula, and Derived Outputs only through their
  public contracts and sees name resolution only through its narrow
  `SlideFormulaResolver` port. No upstream capability imports Slide.
- Canonical element point geometry, Theme/token resolution, the protected
  Normal text style, kind-specific appearance, Master/Layout selection, stable slot bindings, and resolved semantic
  presentation values belong to Slide.
  Rasterization, font shaping, line breaking, viewport/device/DPI conversion,
  hit testing, selection geometry, and pixel bounds belong permanently to the
  frontend presentation engine.
- Slide does not own animation or transition definitions, timelines, playback,
  or execution. Adding those is a separate future capability decision, not a
  hidden responsibility of the semantic presentation projection.

Within `slide/`, relative imports make the directory self-contained. Outside
it, the new files use aliases that already exist:

```ts
import { createSlideInstance } from "#init/create/slide.js";
import { registerSlideEndpoints } from "#job-wiring/slide/registerSlideEndpoints.js";
import type { SlideInternalJobIntent } from "#capabilities/slide/index.js";
```

No `#slide` alias is introduced.

## Runtime contracts and construction

```ts
interface SlideDependencies {
  richText: RichText;
  formula: FormulaEngine;
  formulaResolver: SlideFormulaResolver;
  derivedOutputs: SlideDerivedOutputs;
  jobs: InternalJobsRuntime<SlideInternalJobIntent>;
  logger: Logger;
  attribution?: { actorId: string };
}

interface SlideCapability {
  command(request: SlideCommandRequest): Promise<SlideCommandResult>;
  query(request: SlideQueryRequest): Promise<SlideQueryResult>;

  computePromptCreation(attemptId: string): Promise<void>;
  settlePromptCreation(attemptId: string): Promise<void>;
  computePromptRefresh(attemptId: string): Promise<void>;
  settlePromptRefresh(attemptId: string): Promise<void>;
  computeFormulaEvaluation(attemptId: string): Promise<void>;
  settleFormulaEvaluation(attemptId: string): Promise<void>;

  recoverPendingAttempts(): Promise<number>;
  compact(deckId: string): Promise<boolean>;
}

interface SlideFormulaResolver {
  buildSnapshot(): Promise<FormulaResolverSnapshot>;
}

function createSlideCapability(
  store: SlideStore,
  dependencies: SlideDependencies,
  options: SlideOptions = DEFAULT_SLIDE_OPTIONS,
): SlideCapability;
```

The concrete factory is new code and owns the physical database choice:

```ts
// 1-init/create/slide.ts
const SLIDE_DB_PATH = "./data/slides.db";

function createSlideInstance(
  config: BackendConfig,
  richText: RichText,
  formula: FormulaEngine,
  formulaResolver: FormulaNameResolver,
  derivedOutputs: SlideDerivedOutputs,
  jobs: InternalJobsRuntime<SlideInternalJobIntent>,
  logger: Logger,
): SlideCapability {
  const store = new SQLiteSlideStore(config.projectId, SLIDE_DB_PATH);
  return createSlideCapability(store, {
    richText,
    formula,
    formulaResolver,
    derivedOutputs,
    jobs,
    logger,
    attribution: { actorId: config.userId },
  }, DEFAULT_SLIDE_OPTIONS);
}
```

`SlideOptions` contains history and terminal-attempt retention; maximum Slides,
Theme tokens, Masters, Layouts, slots, and elements; Group depth;
geometry and appearance bounds; and Rich Content limits. The implementation
exports an immutable local default value. These initial limits deliberately do
not become global backend configuration; making them configurable later is an
additive composition change.

Formula is a constructor dependency because Formula atoms are ordinary Rich
Content atoms across the closed authored-content targets: Slide notes,
owner-scoped text elements and table cells, and Chart titles/axis titles/
category labels/series names. Structured Data and Analysis are reached only through the Formula
resolver when a Formula needs them. General Files, rendering, export, and
Activity are not constructor dependencies in representation version 1; Image
elements retain immutable General Files references.

## Public endpoint wiring

`registerSlideEndpoints.ts` owns exactly two mappings:

| Method and path | Job name | Queue | Response mode |
|---|---|---|---|
| `POST /slides/command` | `slides.command.v1` | serial | inline |
| `POST /slides/query` | `slides.query.v1` | concurrent | inline |

The command Job calls `decodeSlideCommand` before `slide.command`. Deck creation
returns `201`; durable Prompt Content creation/refresh and Formula-evaluation
admission return `202`; other accepted commands return `200`. The query Job
calls `decodeSlideQuery` before `slide.query` and returns `200`.

Typed error mapping follows the Document boundary:

| Status | Error families |
|---|---|
| `400` | wire, validation, placement, Group cycle/depth, invalid token kind, invalid Normal style, invalid Master/Layout/slot binding, Formula source/binding, operation, identity-reuse, and stale-attempt errors |
| `404` | missing Deck, attempt, or Derived Output |
| `409` | Deck already exists, revision conflict, idempotency mismatch, definition-revision conflict, or compensation conflict |
| `410` | requested revision or retained target history has been pruned |
| `500` | unexpected failures; the response is generic and the shared Logger records only safe diagnostics |

Handlers do not leak SQLite errors, provider response bodies, prompts, or
generated content. They do not perform Prompt computation inside the endpoint
adapter.

## Embedded presentation model

Every Deck revision owns exactly one canonical design system:

```ts
interface DeckDesignSystem {
  theme: DeckTheme;
  textStyles: SlideTextStyleRegistry;
  masters: Record<MasterSlideId, MasterSlide>;
  layouts: Record<SlideLayoutId, SlideLayout>;
}

type ElementOwner =
  | { kind: "master"; masterSlideId: MasterSlideId }
  | { kind: "layout"; layoutId: SlideLayoutId }
  | { kind: "slide"; slideId: SlideId };

type DeckDesignToken =
  | ThemeColorToken
  | ThemeFontToken
  | ThemeLengthToken;
```

It is stored at `DeckSnapshot.design`, not in external resources or separately
versioned aggregates. `design.theme` owns editable Theme metadata, typed tokens,
and presentation defaults. `design.textStyles` contains exactly one protected
Normal style: its properties are editable, but it cannot be created, deleted,
renamed to another semantic role, inherited, or selected from a registry.
There is no generic element `styleId` or visual Style registry: every direct
element kind embeds its own bounded appearance fields, whose values may use
typed Theme-token references.
Master and Layout registries are sibling deck-owned resources, not children of
Theme. Ordinary operations provide Theme metadata/default updates, typed-token
CRUD, `text-style.update-normal`, Master CRUD, and Layout CRUD.
Whole-design-system replacement/import is only a possible future
administrative convenience composed from those ordinary operations; it is not
a privileged reducer path.

Color, font, and length properties use their corresponding discriminated
literal-or-token reference types. Tokens hold literal values and cannot alias
other tokens in representation v1, so resolution never cycles or guesses
across token kinds.

References are live within a Deck revision:

- a Slide selects a deck-owned `SlideLayout` by stable `SlideLayoutId`;
- a Layout selects a deck-owned `MasterSlide` by stable `MasterSlideId`;
- Masters and Layouts may own flat, scoped elements that participate in the
  semantic presentation plan without becoming Slide-owned state;
- a Layout defines stable `LayoutSlot` metadata—ID, name, canonical point frame,
  accepted element kinds, and required flag. A slot has no selectable text
  style, Rich Content, `zIndex`, paint content, or `ElementId` and is not a
  `SlideElement`; the protected Normal style is universal;
- slide-specific content and overrides remain slide-owned elements that may
  select `layout-slot` placement; Master/Layout elements and slots are never
  copied into a Slide;
- edits to a Master, Layout, Normal style, or token therefore inherit immediately to
  every selecting Slide in the new Deck revision, while an old revision still
  resolves through its old embedded design system.

Element placement has one, and only one, canonical frame authority:

```ts
type FramedElementPlacement =
  | { kind: "free"; frame: ElementFrame }
  | { kind: "layout-slot"; slotId: LayoutSlotId };
```

A free element owns its point frame. Only a framed Slide-root element may use
`layout-slot` placement. It stores no competing frame and inherits the selected
Layout's current slot frame during semantic projection; each slot has at most
one live Slide binding. Binding therefore remains live when a slot is edited.
A move or resize of a slot-bound element is an explicit detach: the normalized
operation changes placement to `free` and supplies the resulting point frame.
Binding/rebinding similarly removes any element-owned frame. No reducer or
projection guesses which geometry should win.

The presentation projection resolves that graph into a deterministic semantic
plan: canonical point-coordinate frames/transforms, back-to-front ordering,
resolved style values, placeholder/slot roles, and slide-owned content. This is
the backend's resolution boundary. It is intentionally not a display list with
pixel bounds. The frontend continues from the semantic plan and owns font
metrics, font fallback, shaping, line breaking, viewport scaling, device/DPI
conversion, rasterization, hit testing, selections, and all other pixel
geometry. Animation and transition data, timelines, playback, and execution
are also outside Slide rather than partially modeled by this projection.

Changing a Slide's Layout changes its live reference and must validate all
remaining slot bindings atomically. The reducer never silently creates,
deletes, or rewrites slide-owned elements merely to make a new Layout fit; a
caller supplies any required element/binding operations in the same command.
Deleting a referenced token, Master, Layout, or slot likewise requires
an explicit replacement/migration in the same ChangeSet. This preserves exact
inverses and prevents presentation resolution from depending on repair logic.

## Internal Jobs and durable Prompt/Formula workflows

`registerSlideInternalJobs.ts` registers the closed intent vocabulary with one
`SchedulerInternalJobsRuntime<SlideInternalJobIntent>`:

| Intent | Queue | Capability method |
|---|---|---|
| `slide.compact` | serial | `compact(deckId)` |
| `slide.prompt-content.create.compute` | concurrent | `computePromptCreation(attemptId)` |
| `slide.prompt-content.create.settle` | serial | `settlePromptCreation(attemptId)` |
| `slide.prompt-content.refresh.compute` | concurrent | `computePromptRefresh(attemptId)` |
| `slide.prompt-content.refresh.settle` | serial | `settlePromptRefresh(attemptId)` |
| `slide.formula.evaluate.compute` | concurrent | `computeFormulaEvaluation(attemptId)` |
| `slide.formula.evaluate.settle` | serial | `settleFormulaEvaluation(attemptId)` |

Each intent carries a caller-namespaced idempotency key. Dispatch returns after
admission. Capacity-only admission failures receive bounded in-process redrive;
durable attempt and stage records remain the authority across a restart.

A Slide-scoped `prompt-content` element is never introduced by a generic
`element.insert` or caller-supplied initial-Slide payload. Its creation command
durably freezes the Deck revision, Slide/element identities, owner scope,
`parentGroupId`, `zIndex`, the discriminated placement (free frame or Layout
slot), appearance, text layout, and prompt
definition. Concurrent compute declares and initially refreshes one dedicated
Derived Output. Serial settlement inserts the exact `DerivedOutputRef` through
the normal reducer and ChangeSet transaction.

Refresh likewise freezes the current output identity and applied revision,
computes through Derived Outputs, and conditionally adopts the exact candidate
revision in a serial ChangeSet. Definition and stabilization-text changes are
delegated directly to Derived Outputs, but Slide first persists a
delegated-command claim that freezes the output ID. Completing that command
stores its Slide receipt atomically with the local claim transition.

Deleting a `prompt-content` element transactionally changes its output
ownership to `detached`. Slide never deletes the output: Derived Outputs alone
owns retention, including for outputs referenced only by historical Deck
revisions. Creation failures and stale settlements also detach any candidate
output. No two live `prompt-content` elements may own the same output.

Formula evaluation applies to Formula atoms in the closed authored
`RichContentTarget` union: Slide notes; an `element-text` value in a Master,
Layout, or Slide owner scope; an owner-scoped table cell; an owner-scoped Chart
title, X/Y-axis title, category label, or series name. The public
`formula.evaluate.request` command identifies one of those exact owner targets
plus a `formulaAtomId`; it cannot target Prompt Content, generated output text,
a Deck/Slide metadata title, Image alt text, Layout-slot metadata, or Chart
numeric data. Serial admission freezes the Deck revision,
target owner/address, atom identity, source-expression digest, and a retryable
Formula attempt. Concurrent compute obtains one immutable resolver snapshot
from `SlideFormulaResolver`, then asks the injected `FormulaEngine` to parse,
bind, and evaluate the frozen expression and persists the candidate or typed
failure before dispatching settlement.

The target discriminants are exact and shared by command, operation, attempt,
store, and wire contracts:

```ts
type RichContentTarget =
  | { kind: "slide-notes"; slideId: SlideId }
  | { kind: "element-text"; owner: ElementOwner; elementId: SlideElementId }
  | { kind: "table-cell"; owner: ElementOwner; elementId: SlideElementId; cellId: TableCellId }
  | { kind: "chart-title"; owner: ElementOwner; elementId: SlideElementId }
  | { kind: "chart-axis-title"; owner: ElementOwner; elementId: SlideElementId; axis: "x" | "y" }
  | { kind: "chart-category-label"; owner: ElementOwner; elementId: SlideElementId; categoryId: ChartCategoryId }
  | { kind: "chart-series-name"; owner: ElementOwner; elementId: SlideElementId; seriesId: ChartSeriesId };
```

Serial settlement reloads the target through the current Deck head. It adopts
the candidate through Rich Text's Formula-settlement operation only when the
same target and atom still exist and the expression digest is unchanged. That
ordinary Rich Content operation is wrapped in a normal Slide ChangeSet, so its
inverse, touched identities, receipt, accepted fact, and revision behavior are
identical to authored-text editing. A stale result becomes a terminal stale
attempt and never overwrites later authoring. Neither Slide nor its wire layer
parses `{{ ... }}`: authoring uses Rich Text's deterministic
delimiter-to-Formula-atom operation/helper, exactly as Document does.

An accepted Rich Content mutation that introduces a Formula atom or changes
its expression creates the corresponding evaluation attempt atomically with
the Slide ChangeSet and dispatches compute after commit. The explicit
`formula.evaluate.request` command uses the same attempt path for retry/manual
evaluation; it is not a second evaluator.

## Startup and recovery

After Formula, its Structured Data inputs, the shared `FormulaNameResolver`,
Rich Text, Derived Outputs, scheduler, and registry construction,
`startBackend.ts` adds only the following composition steps:

```ts
const slideJobs =
  new SchedulerInternalJobsRuntime<SlideInternalJobIntent>(scheduler);
const slide = createSlideInstance(
  config,
  richText,
  formula,
  formulaResolver,
  derivedOutputs,
  slideJobs,
  logger,
);

registerSlideInternalJobs(slideJobs, slide);
registerSlideEndpoints(registry, slide, logger);

const recoveredSlideAttempts = await slide.recoverPendingAttempts();
logger.info("slide.attempts.recovered", { count: recoveredSlideAttempts });
```

The existing startup readiness log adds `slideReady`. Recovery runs after
internal intent factories and public mappings are registered and before the
HTTP listener binds. It marks interrupted running stages retryable, lists
non-terminal Prompt and Formula attempts, and redispatches compute or
settlement according to their durable state.

## Permanent capability boundary

Slide owns the canonical facts required to describe a presentation: point
canvas and element geometry, z-order, authored and generated content references,
the embedded `DeckDesignSystem`, Theme defaults and typed tokens, the protected
Normal text style, kind-specific appearance, Master/Layout selection, stable
slots, element-to-slot bindings, and deterministic semantic resolution.

The following are permanently outside the Slide backend capability and remain
frontend presentation-engine responsibilities:

- rasterization/painting and pixel output;
- thumbnails, render caches, render artifacts, and renderer persistence;
- font discovery/fallback, shaping, glyph metrics, line breaking, and text-fit
  pixel calculations;
- viewport/device/DPI scaling, pixel bounds, hit testing, selection handles,
  snapping guides, and other interaction geometry;
- animations and transitions, including their definitions, timelines,
  interpolation, playback state, and execution.

A thumbnail, export, or server-render integration may consume an
immutable semantic projection, but its renderer and artifacts belong to that
integration rather than to canonical Slide state or `slideService.ts`.

## Explicitly deferred integrations

The initial directory contains no placeholder service for functionality whose
authority or deterministic contract is not ready. The following remain
outside the implementation:

- presentation-mode UI and PDF/PPTX import/export;
- reusable external design-system libraries and whole-design-system
  import/export (`DeckSnapshot.design` and live Theme/token/Normal-style/
  Master/Layout resolution are in scope);
- Image acquisition and remote fetching; Image elements keep immutable General
  Files references and do not inject a file-storage runtime;
- Formula-backed Chart numeric series and linked external data/analysis sources
  as future representation extensions. Formula atoms in table cells and Chart
  labels are already in scope through Rich Content;
- Deck/Slide duplication when Prompt Content would require dedicated-output
  cloning;
- Activity publication, feed management, undo routing, Presence, Comments,
  and realtime collaboration.

Slide does write accepted mutation facts to its own transactional outbox so a
future Activity publisher can be added without changing admission semantics.
Renderers and external-value integrations can consume immutable Deck revisions
without becoming canonical Slide state.

## Removal instructions

The capability is deliberately easy to remove:

1. Delete `apps/backend/src/3-capabilities/slide/`.
2. Delete `apps/backend/src/4-job-wiring/slide/`.
3. Delete `apps/backend/src/1-init/create/slide.ts`.
4. Delete the four `slide-*.test.ts` files.
5. Revert only the Slide imports, construction, registrations, recovery call,
   and `slideReady` field in `apps/backend/src/1-init/startBackend.ts`.
6. Delete `./data/slides.db` only when its persisted Decks are intentionally
   being discarded; otherwise leave it as recoverable user data.

There are no Slide-specific edits to configuration loading, YAML, shared Job
runtime, Rich Text, Derived Outputs, Formula, Structured Data, package imports,
or TypeScript paths. Slide merely receives their existing public runtimes at
composition. Removing Slide therefore cannot change another capability's
behavior or schema.

## Key differences from Document

| Aspect | Document | Slide |
|---|---|---|
| Aggregate | ordered content flow | ordered Deck of fixed-canvas Slides |
| Layout primitive | Row tracks with relative widths | element frames in canonical point geometry |
| Ordering | Row and Block arrays | `slideOrder` plus flat per-element `parentGroupId` and `zIndex` |
| Optional structure | every Block belongs to a Row | an element may omit `parentGroupId` and sit at the Slide root |
| Nesting | content containers such as Callout/List/Table | structural Groups with bounded recursion |
| Authored text | Rich Content in text-bearing Blocks | Rich Content in authored `text` elements and Slide notes |
| Prompt content | `PromptBlock` | distinct `prompt-content` element kind |
| Async adoption | dedicated Derived Output per Prompt Block | dedicated Derived Output per `prompt-content` element |
| Formula atoms | Rich Content target inside text-bearing Blocks | closed `RichContentTarget` for Slide notes and owner-scoped text, table-cell, and Chart-label content |
| Reusable presentation | embedded document Styles | embedded `DeckDesignSystem` with Theme tokens/defaults, one protected Normal text style, and sibling Master/Layout registries |
| Rendering boundary | pagination is a future document layout concern | semantic point presentation is canonical; pixel rendering is permanently external |
