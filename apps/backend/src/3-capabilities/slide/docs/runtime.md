# Slide runtime and function map

## Missing application runtime

There is no [`application/slideService.ts`](../application) in the current
tree. Consequently these exports referenced by [`index.ts`](../index.ts) do not
exist:

- `createSlideCapability`;
- `SlideCapability`;
- `SlideDependencies`.

The endpoint/internal-job files expect a `SlideCapability` with methods
`command`, `query`, `computePromptCreation`, `settlePromptCreation`,
`computePromptRefresh`, `settlePromptRefresh`, `recoverPendingAttempts`, and
`compact`. Those names can be inferred from direct calls in wiring, but there
is no implementation to document and no current runtime behavior to guarantee.

## Present but blocked construction/wiring

[`createSlideInstance`](../../../1-init/create/slide.ts) opens
`SQLiteSlideStore(config.projectId, "./data/slides.db")` and attempts to call
the missing factory with Rich Text, Derived Outputs, internal jobs, Logger,
trusted user attribution, and `DEFAULT_SLIDE_OPTIONS`.

[`startBackend.ts`](../../../1-init/startBackend.ts) attempts to construct the
Slide instance, register internal jobs/endpoints, and recover attempts. These
calls do not make Slide runnable because module resolution fails first.

## Implemented creation functions

[`application/createService.ts`](../application/createService.ts) exports:

- `DEFAULT_SLIDE_CANVAS`: 960 × 540 points;
- `DEFAULT_SLIDE_OPTIONS`: history/content limits listed in [Types](types.md);
- `createDefaultSlideStyles()`: defaults for all seven Shape kinds with text,
  geometry, line, image, table, and chart Styles;
- `createBlankDeckSnapshot(input)`: validates a safe initial Slide ID, returns
  active revision 0 with cloned/default canvas/styles and one empty Slide whose
  notes contain one empty text atom.

## Implemented reducer family

[`domain/reducer.ts`](../domain/reducer.ts) exports:

- `resolveSlideStyle`: acyclic inheritance overlay;
- `resolveShapeStyle`: kind default, selected Style, presentation overlay;
- `applyOperations`: clone, sequentially apply every operation, construct exact
  reverse-ordered inverses, reject within-batch identity delete/readd or kind
  change, validate final snapshot, and return sorted touched IDs;
- `applyWithoutValidation`: replay trusted operations against a clone;
- `computeTouchedIds`: operation-specific semantic conflict footprint including
  synthetic ordering/container sentinels;
- `snapshotsEqual`: canonical digest equality.

Major private helper families require Slides/elements/Shapes/Styles, resolve
target containers and anchors, insert/remove subtrees, prune empty ancestor
Groups, preserve exact inverse placement, protect Rich Text identity, apply
each discriminated operation, and derive touched identities.

## Implemented geometry and tree functions

[`geometry.ts`](../domain/geometry.ts):

- `unionBounds`, `computeShapeBounds`, `computeElementBounds`, and
  `computeGroupBounds` calculate axis-aligned bounds, including rotation and
  hidden descendants;
- `expandGroupTransform` validates a finite/non-zero group gesture and emits
  canonical frame + normalized transform operations for descendant Shapes.

[`tree.ts`](../domain/tree.ts) exports Deck/Slide/Group sentinel-ID helpers,
Slide/container/element/Shape/Prompt lookup, recursive walk/subtree collection,
descendant checks, inverse placement reconstruction, Prompt Shape collection,
and public/internal Prompt operation classifiers.

## Implemented canonical, identity, validation, inverse, and rebase functions

- Canonical functions recursively sort record keys, encode UTF-8, and SHA-256
  digest values/snapshots.
- Identity functions collect Styles, Slides, Groups, Shapes, and Rich Text IDs
  and deterministic additions/removals.
- `validateSnapshot` checks representation, canvas, Style graph, safe/global
  identity, Slide order/record parity, notes/text, membership/reachability/
  cycles/depth, all Shape payloads, accepted values, and limits.
- `isSafeSlideIdentity` rejects empty/prototype/inherited record keys.
- `invertOperations` delegates to the validating reducer's exact inverse.
- `canRebase` allows only disjoint touched IDs across intervening ChangeSets.

## Implemented projections

- `projectSlidePlainText`: Slide title/notes, authored text, accessible image alt,
  and chart title in canonical order; excludes Prompt content text.
- `projectSlideOutline`: ordered Slide IDs and optional titles.
- `projectSlideDependencies`: exact Prompt output and image snapshot refs.
- `projectSlideShapeStyle` / `projectSlideTextStyling`: resolved visual/text
  layers and Rich Text ranges.

## Implemented wire functions

Command/query/operation/value decoders enforce the complete wire contracts and
budgets. Exported primitive/value decoders cover JSON bounds, safe identifiers,
finite numbers, enums, context, canvas/colors/styles, Rich Text/Formula values,
frames/transforms/presentation, every Shape payload, Groups, placement,
background, and full Slides.

## `SQLiteSlideStore` methods

[`ports/slideStore.ts`](../ports/slideStore.ts) and
[`sqliteSlideStore.ts`](../persistence/sqliteSlideStore.ts) implement:

- heads/history: list/get head, get Base/tail, list/get ChangeSet;
- replay/identity: get/record submission, get identity, delegated claim
  get/claim/complete;
- atomic creation and revision-CAS mutation commits;
- head-fenced Base append and retained-history pruning;
- attempt lookup/list/create/update;
- stage claim/complete/fail, atomic Prompt creation failure, interrupted-stage
  recovery;
- Prompt ownership lookup/register/transition/detached listing;
- outbox get/list unpublished/mark published;
- adapter-only `close()`.

The adapter enables WAL, foreign keys, 5-second busy timeout, and NORMAL
synchronous mode. It is operational in direct persistence tests, but no current
application runtime invokes its complete workflow.

## Declared job/endpoint functions

`registerSlideEndpoints` registers two request factories and typed error
mapping. `createSlideInternalJob` maps five typed intents to expected runtime
methods; `registerSlideInternalJobs` registers all five. These functions are
present, but require the missing `SlideCapability` implementation.
