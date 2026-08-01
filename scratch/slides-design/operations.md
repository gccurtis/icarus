# Slide capability — operations, endpoints, and Jobs

## Boundary

The implementation lives under the singular code path `3-capabilities/slide/`.
The aggregate is a Deck, and the public resource routes remain plural:
`/slides/command` and `/slides/query`.

Public wire values are decoded into a closed operation vocabulary before the
Slide capability is called. Every accepted Deck mutation produces one
normalized forward batch and an exact inverse batch. Replay is pure: it calls
neither SQLite nor an external capability.

The runtime does inject Rich Text, Formula, a Formula name resolver, Derived
Outputs, internal Jobs, and logging. Those dependencies are used around the
serial Deck transaction:

- Rich Text normalizes and inverts edits to canonical `RichContent`;
- Formula evaluates `FormulaAtom`s after a mutation has durably frozen them;
- the Formula resolver supplies one immutable resolver snapshot per compute;
- Derived Outputs owns every Prompt Content definition and output revision;
- internal Jobs split durable freeze, concurrent compute, and serial settle.

Structured Data is available to Slide formulas through the Formula resolver.
Slide does not independently dereference mutable Structured Data while loading
or replaying a Deck.

## Canonical addressing

Theme, Master, Layout, Slide, and element operations all mutate the same Deck
revision. The Deck contains exactly one embedded Theme plus deck-owned Master
and Layout registries.

```ts
type ElementOwner =
  | { kind: "master"; masterSlideId: MasterSlideId }
  | { kind: "layout"; layoutId: SlideLayoutId }
  | { kind: "slide"; slideId: SlideId };

type RichContentTarget =
  | { kind: "slide-notes"; slideId: SlideId }
  | { kind: "element-text"; owner: ElementOwner; elementId: SlideElementId }
  | {
      kind: "table-cell";
      owner: ElementOwner;
      elementId: SlideElementId;
      cellId: TableCellId;
    }
  | {
      kind: "chart-title";
      owner: ElementOwner;
      elementId: SlideElementId;
    }
  | {
      kind: "chart-axis-title";
      owner: ElementOwner;
      elementId: SlideElementId;
      axis: "x" | "y";
    }
  | {
      kind: "chart-category-label";
      owner: ElementOwner;
      elementId: SlideElementId;
      categoryId: ChartCategoryId;
    }
  | {
      kind: "chart-series-name";
      owner: ElementOwner;
      elementId: SlideElementId;
      seriesId: ChartSeriesId;
    };
```

`element-text` covers authored Text elements on Masters, Layouts, and Slides.
Table cells, chart titles, axis titles, category labels, series names, and
Slide notes have their own stable addresses. Every address resolves to exactly one
`RichContent`, or the operation fails. Prompt Content is not a Rich Content
target: it is the exact plain-text revision of a dedicated Derived Output.
Deck title, optional Slide title, and image alt text are deliberately plain
metadata/accessibility strings, not presentational Rich Content or Formula
targets.

## Canonical operation vocabulary

```ts
type SlideOperation =
  // Plain metadata and canvas
  | { type: "deck.rename"; title: string }
  | { type: "deck.set-lifecycle"; lifecycle: SlideLifecycle }
  | { type: "deck.set-canvas"; canvas: SlideCanvas }

  // The single embedded Theme and its typed registries
  | { type: "theme.update"; metadata: SlideThemeMetadata }
  | { type: "theme.token.create"; token: ThemeToken }
  | { type: "theme.token.update"; tokenId: ThemeTokenId; token: ThemeToken }
  | {
      type: "theme.token.delete";
      tokenId: ThemeTokenId;
      replacementTokenId?: ThemeTokenId;
    }
  | { type: "text-style.update-normal"; style: SlideTextStyle }

  // Deck-owned Master registry
  | { type: "master.create"; master: MasterSlide }
  | {
      type: "master.update";
      masterSlideId: MasterSlideId;
      metadata: MasterSlideMetadata;
      background: SlideBackground;
    }
  | { type: "master.delete"; masterSlideId: MasterSlideId }

  // Deck-owned Layout and slot registries
  | { type: "layout.create"; layout: SlideLayout }
  | {
      type: "layout.update";
      layoutId: SlideLayoutId;
      metadata: SlideLayoutMetadata;
      masterSlideId: MasterSlideId;
      background?: SlideBackground;
    }
  | { type: "layout.delete"; layoutId: SlideLayoutId; replacementLayoutId?: SlideLayoutId }
  | { type: "layout.slot.create"; layoutId: SlideLayoutId; slot: LayoutSlot }
  | { type: "layout.slot.update"; layoutId: SlideLayoutId; slotId: LayoutSlotId; slot: LayoutSlot }
  | { type: "layout.slot.delete"; layoutId: SlideLayoutId; slotId: LayoutSlotId }

  // Ordered Slides and live Layout selection
  | { type: "slide.insert"; slide: Slide; afterSlideId?: SlideId }
  | { type: "slide.move"; slideId: SlideId; afterSlideId?: SlideId }
  | { type: "slide.delete"; slideId: SlideId }
  | { type: "slide.set-title"; slideId: SlideId; title?: string }
  | { type: "slide.set-background"; slideId: SlideId; background?: SlideBackground }
  | { type: "slide.set-layout"; slideId: SlideId; layoutId: SlideLayoutId }

  // Heterogeneous positioned elements in a Master, Layout, or Slide
  | { type: "element.insert"; owner: ElementOwner; element: SlideElement }
  | {
      type: "element.move";
      owner: ElementOwner;
      elementId: SlideElementId;
      parentGroupId: SlideGroupId | null;
      zIndex: number;
      /** Destination placement; free geometry is explicit, slot geometry is live. */
      placement: SlideElementPlacement;
    }
  | { type: "element.delete"; owner: ElementOwner; elementId: SlideElementId }
  | {
      /** Exact inverse primitive; rejected by public deck.submit. */
      type: "element.restore-subtree";
      owner: ElementOwner;
      elements: SlideElement[];
    }
  | {
      type: "element.set-placement";
      owner: ElementOwner;
      elementId: SlideElementId;
      placement: SlideElementPlacement;
    }
  | { type: "element.set-locked"; owner: ElementOwner; elementId: SlideElementId; locked: boolean }
  | { type: "element.set-hidden"; owner: ElementOwner; elementId: SlideElementId; hidden: boolean }

  // Every authored Rich Content surface uses one operation boundary
  | {
      type: "rich-content.apply";
      target: RichContentTarget;
      operations: RichTextOperation[];
    }

  // Exact Prompt Content revision adoption; internal only
  | {
      type: "prompt-content.apply-derived-output";
      slideId: SlideId;
      elementId: SlideElementId;
      output: DerivedOutputRef;
    }

  // Element-kind presentation and payload changes
  | {
      type: "text-box.set-presentation";
      owner: ElementOwner;
      elementId: SlideElementId;
      textBox: TextBoxPresentation;
    }
  | { type: "geometry.set"; owner: ElementOwner; elementId: SlideElementId; geometry: GeometryDefinition }
  | { type: "line.set"; owner: ElementOwner; elementId: SlideElementId; line: LineDefinition }
  | { type: "image.set"; owner: ElementOwner; elementId: SlideElementId; image: ImageElementData }

  // Table structure and cell presentation; cell content uses rich-content.apply
  | { type: "table.set-presentation"; owner: ElementOwner; elementId: SlideElementId; presentation: TablePresentation }
  | {
      type: "table.row.insert";
      owner: ElementOwner;
      elementId: SlideElementId;
      row: TableRow;
      afterRowId?: TableRowId;
    }
  | { type: "table.row.move"; owner: ElementOwner; elementId: SlideElementId; rowId: TableRowId; afterRowId?: TableRowId }
  | { type: "table.row.delete"; owner: ElementOwner; elementId: SlideElementId; rowId: TableRowId }
  | {
      type: "table.column.insert";
      owner: ElementOwner;
      elementId: SlideElementId;
      column: TableColumn;
      afterColumnId?: TableColumnId;
    }
  | {
      type: "table.column.move";
      owner: ElementOwner;
      elementId: SlideElementId;
      columnId: TableColumnId;
      afterColumnId?: TableColumnId;
    }
  | { type: "table.column.delete"; owner: ElementOwner; elementId: SlideElementId; columnId: TableColumnId }
  | {
      type: "table.cell.set-presentation";
      owner: ElementOwner;
      elementId: SlideElementId;
      cellId: TableCellId;
      presentation?: TableCellPresentation;
    }
  | {
      type: "table.cells.merge";
      owner: ElementOwner;
      elementId: SlideElementId;
      merge: TableCellMerge;
    }
  | {
      type: "table.cells.unmerge";
      owner: ElementOwner;
      elementId: SlideElementId;
      mergeId: TableMergeId;
    }

  // Chart data/specification; label text uses rich-content.apply
  | { type: "chart.set-data"; owner: ElementOwner; elementId: SlideElementId; data: ChartData }
  | {
      type: "chart.set-specification";
      owner: ElementOwner;
      elementId: SlideElementId;
      specification: ChartSpecification;
    }
  | {
      type: "chart.label.set-presentation";
      owner: ElementOwner;
      elementId: SlideElementId;
      target:
        | { kind: "title" }
        | { kind: "axis-title"; axis: "x" | "y" }
        | { kind: "category-label"; categoryId: ChartCategoryId }
        | { kind: "series-name"; seriesId: ChartSeriesId };
      presentation: ChartLabelPresentation;
    };
```

The vocabulary is intentionally heterogeneous at the payload layer and uniform
at the geometry, ownership, ordering, and Rich Content layers. Element
kind is stable for the life of an Element ID. Changing kind is deletion plus
insertion with a new identity.

Whole-Theme replacement or import is not a primitive. An administrative Theme
import can be expanded into normal Theme metadata and token operations. A
whole Deck-design import is separately composed from Theme, Normal Text Style,
Master, and Layout operations so those sibling design registries are not
misrepresented as children of Theme.

## Element parentage, coordinates, and z-order

Masters, Layouts, and Slides each own a flat Element record. Every Element has:

```ts
interface SlideElementBase {
  id: SlideElementId;
  kind: SlideElement["kind"];
  parentGroupId: SlideGroupId | null;
  /** Sole sibling paint-order authority. */
  zIndex: number;
  locked: boolean;
  hidden: boolean;
}

type FramedElementPlacement =
  | { kind: "free"; frame: ElementFrame }
  | { kind: "layout-slot"; slotId: LayoutSlotId };

/** The complete kind-specific placement union; Group/straight-line are free. */
type SlideElementPlacement = SlideElement["placement"];

interface ElementFrame {
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
}
```

There are no root-order arrays, Group child arrays, fractional ranks, or second
z-order fields. For every parent container, direct children have unique,
contiguous `zIndex` values `0..n-1`, back-to-front. Insert, move, reorder,
delete, restore, grouping, and ungrouping renumber the affected sibling set
atomically. The normalized forward operation records the admitted destination;
its inverse records the exact old parent, index, and placement.

`parentGroupId` is the only membership authority. A Group is a positioned
Element and may contain heterogeneous descendants. Child `xPt`/`yPt` values
are local to the parent Group. Nested Groups are allowed, acyclic, and bounded.
A Group's `zIndex` competes only with its siblings; descendants can never
interleave with elements outside that Group.

Moving a free Element to a different parent always supplies an explicit
destination-local frame in its placement. The reducer never guesses whether
the caller wanted local coordinates preserved or world-space appearance
preserved. Editors can use a pure geometry helper to calculate a destination
frame before submitting the operation.

## Master, Layout, and slot composition

One Deck Theme supplies typed tokens. The protected Normal Text Style and the
Master and Layout registries are sibling records under `DeckSnapshot.design`;
Masters and Layouts are live canonical records, not copied templates:

```text
Theme tokens + protected Normal Text Style
  -> selected Master elements
  -> selected Layout elements and slots
  -> Slide elements and slot bindings
```

Every Layout names one Master and every Slide selects one Layout.
`slide.set-layout` changes that live selection; it does not copy Master or
Layout Elements into the Slide. A Slide-owned Element may use one stable
slot in its selected Layout, and each slot accepts at most one live Slide
Element. Slot compatibility is validated against the Element kind.

A Layout slot is metadata with a frame, accepted Element kinds, and a required
flag. It is not an
Element, has no `zIndex`, and never paints by itself. Geometry has exactly one
authority:

- `{ kind: "layout-slot", slotId }` stores no Element frame and resolves the
  selected live Layout slot's frame;
- `{ kind: "free", frame }` owns the explicit Element frame;
- Master/Layout Elements and child Elements inside Groups must be free;
- only a root Slide Element may use a Layout slot.

Moving or resizing a slot-placed Element first changes its placement to
`free` with an explicit frame. Returning it to a slot removes the Element-owned
frame. `zIndex` remains on the Slide Element in either case.

Deleting a Master is rejected while a Layout references it. Deleting a Layout
is rejected while a Slide selects it unless the operation supplies a valid
replacement Layout; replacement rewrites those selections atomically. Deleting
a slot is rejected while a Slide Element binds it. Exact inverse operations
restore every rewritten selection and binding.

Master/Layout authored Text, Slide text, notes, Table cells, and Chart labels
remain ordinary `RichContent` values. Live
composition does not merge or rewrite Rich Content identities.

## Theme tokens and the protected Normal Text Style

Theme tokens are typed canonical values. References are also typed: a color
property cannot name a length token, and a font-family property cannot name a
color token. Token aliases must remain type-compatible and acyclic.

`theme.token.update` preserves identity and type. Changing type is delete plus
create with a new token ID. Deleting a referenced token requires a compatible
replacement and atomically rewrites aliases, kind-specific Master/Layout/Slide
appearance, Table cell presentation, and Chart presentation references before
removal.

There is exactly one Text Style with protected `systemRole: "normal"`. It can
be edited through `text-style.update-normal`, but it cannot be deleted,
renamed to another role, or supplemented by a named Text Style registry.
Every Rich Content surface starts from Normal and then applies inline Rich
Text marks. Resolution order is:

1. Theme tokens;
2. the protected Normal Text Style for text properties;
3. kind-specific embedded Element/cell/label appearance;
4. supplementary inline Rich Text marks.

Historical appearance depends only on the Deck revision and immutable external
references named by it.

## Tables and Charts

A Table owns stable row IDs, stable column IDs, explicit row/column order,
every addressed cell's `RichContent`, optional cell presentation, and a merge
registry. Row/column order is Table structure and is unrelated to Element
z-order.

`table.cells.merge` creates one stable `TableMergeId` for a rectangular region
whose row and column members are contiguous. One designated anchor cell is
rendered; all covered cells retain their canonical content and presentation so
unmerge and exact compensation are lossless. Merge regions cannot overlap.
`table.cells.unmerge` removes exactly one merge record. Row/column deletion may
not strand a partial merge: the same operation batch must first unmerge it, or
the reducer rejects the deletion. Inverses restore the merge ID and region.

Chart v1 stores bounded literal numeric series. Series, category, and datum
names plus title and axis labels are authored `RichContent` targets. A Formula
atom can therefore generate label text, but it is not a live numeric-series
source. Formula-backed chart series require a separate freeze/compute/settle
model and are outside this representation.

## Rich Content and Formula discovery

`rich-content.apply` resolves the target, delegates to Rich Text, and stores
Rich Text's normalized forward and exact inverse batches inside the Deck
ChangeSet. Formula atoms may occur in every `RichContentTarget`, including
Master/Layout text, Table cells, and Chart labels.

The reducer returns formula changes alongside the ordinary apply result:

```ts
interface SlideFormulaChange {
  target: RichContentTarget;
  atomId: string;
  expression: string;
}

interface SlideApplyResult {
  snapshot: DeckSnapshot;
  forward: SlideOperation[];
  inverse: SlideOperation[];
  touchedIds: string[];
  formulaChanges: SlideFormulaChange[];
}
```

A Formula change is emitted only when an atom is newly introduced or its
expression changes. Applying a Formula settlement does not recursively request
another evaluation. Master/Layout/Slide/Table/Chart creation operations also
scan their complete introduced Rich Content and emit changes for new Formula
atoms.

The serial mutation transaction creates one durable Formula evaluation attempt
per change. Dispatch occurs only after that transaction commits.

## Exact inverse rules

`applyOperations` computes inverses from the actual before state while applying
the batch. Inverses are stored in reverse execution order:

- setters restore the exact prior value, including absence;
- registry creation inverts to deletion, and deletion restores the complete
  record plus every rewritten reference;
- Slide insertion/deletion restores exact ordering and content;
- `slide.set-layout` restores the prior live selection and slot placements;
- `element.set-placement` restores whether the prior geometry came from the
  Element or its live Layout slot, plus the exact prior free frame if any;
- Element insertion inverts to deletion;
- Element deletion restores the complete flat subtree with exact parent IDs,
  placements, transforms, flags, and sibling z-order;
- Element move restores the old parent, placement, and sibling position;
- all sibling renumbering is a deterministic consequence of the recorded
  move/insert/delete and is covered by the affected-container footprint;
- Rich Text uses Rich Text's exact inverse operations;
- Table row/column deletion restores structure, every cell's content and presentation,
  and exact row/column order;
- Table merge/unmerge restores the exact merge identity, rectangle, anchor,
  and the pre-merge content/presentation of every covered cell;
- Prompt adoption restores the prior exact `DerivedOutputRef`;
- Formula settlement restores the atom's prior settlement fields without
  changing its authored expression.

Undo and redo never synthesize a best-effort edit. Compensation submits the
stored inverse batch as a new ChangeSet after verifying complete retained
history and touched-ID disjointness.

## Public versus internal operation boundary

The operation union is the durable replay language, but public `deck.submit`
rejects:

- `prompt-content.apply-derived-output`;
- `element.restore-subtree`;
- an `element.insert`, `slide.insert`, `master.create`, or `layout.create` that
  introduces Prompt Content or a caller-selected Derived Output ID;
- a mutation that changes an existing Element into Prompt Content;
- reserved internal request IDs.

Prompt Content settlement and exact compensation use internal admission.
Refresh settlement may set only the same dedicated `outputId` frozen by its
attempt. Compensation may restore an older exact revision of that same output.

Formula settlement also uses internal admission, but it enters through
`rich-content.apply` with Rich Text's `apply-formula-settlement` operation. It
may update only the frozen FormulaAtom at the frozen target.

Deleting Prompt Content through ordinary structural operations is allowed.
The transaction changes local ownership state to `historical` (no longer
attached to live Deck state). That state never authorizes deletion: Slide has
no Derived Outputs deletion call, and Derived Outputs alone owns retention.

## Touched IDs and stale rebase

Touched IDs combine stable identities with semantic container/property
sentinels. At minimum:

| Change | Required footprint |
|---|---|
| Deck metadata/canvas | the corresponding `$deck:*` sentinel |
| Theme metadata or tokens | Theme/token ID and every rewritten reference |
| Normal Text Style update | the protected Normal Text Style sentinel |
| Master/Layout CRUD | registry sentinel, record ID, referenced Master/Layout, complete deleted subtree |
| Layout slot CRUD | Layout ID, slot ID, and affected Slide bindings |
| Slide insert/move/delete | `$deck:slides`, Slide ID, selected Layout, complete deleted subtree |
| Element insert/delete | owner and parent-container sentinel plus complete subtree IDs |
| Element move/reorder | old and new parent-container sentinels, Element ID, relevant anchors |
| Element geometry/payload | owner and Element ID |
| Rich Content | target sentinel plus Rich Text atom/mark footprint |
| Table structure | Table ID, row/column registry sentinel, affected row/column/cell targets |
| Table cell presentation/content | stable cell target and its atom/mark footprint |
| Table merge/unmerge | Table ID, merge ID, and every covered row/column/cell target |
| Chart label/content | Chart/label IDs and its atom/mark footprint |
| Prompt adoption | Slide and Prompt Element IDs |
| Formula settlement | exact Rich Content target and FormulaAtom ID |

A stale `deck.submit` is admitted only when the authored revision can be
reconstructed, every intervening ChangeSet is contiguous, and the submitted
footprint is disjoint from all intervening footprints. The operations are then
applied to the current snapshot and inverted from that current state.

Parent-container sentinels intentionally make concurrent sibling reorders
conflict: contiguous `zIndex` renumbering is one atomic ordering decision.

## Command contracts

```ts
interface SlideCommandRequest {
  requestId: string;
  origin: "interactive" | "agent" | "automation";
  command: SlideCommand;
}

type SlideCommand =
  | {
      type: "deck.create";
      deckId: string;
      title: string;
      initialSlideId: string;
      initialLayoutId: string;
      canvas?: SlideCanvas;
      design?: DeckDesignSystem;
    }
  | {
      type: "deck.submit";
      deckId: string;
      expectedRevision: number;
      operations: SlideOperation[];
    }
  | {
      type: "deck.compensate";
      deckId: string;
      targetChangeSetId: string;
      intent: "undo" | "redo";
      expectedRevision: number;
    }
  | {
      type: "prompt-content.create.request";
      deckId: string;
      expectedRevision: number;
      slideId: string;
      /** Full positioned shell except the DerivedOutputRef, which Slide owns. */
      element: PromptContentElementShell;
      prompt: string;
      contextEntries: ContextEntry[];
      stabilisationText: string;
    }
  | {
      type: "prompt-content.update-definition";
      deckId: string;
      promptContentElementId: string;
      expectedDefinitionRevision: number;
      prompt: string;
      contextEntries: ContextEntry[];
      stabilisationText: string;
    }
  | {
      type: "prompt-content.refresh.request";
      deckId: string;
      promptContentElementId: string;
      expectedRevision: number;
    }
  | {
      type: "formula.evaluate.request";
      deckId: string;
      target: RichContentTarget;
      formulaAtomId: string;
    };

type SlideCommandResult =
  | { type: "deck.created"; head: DeckHead }
  | { type: "deck.changed"; changeSet: SlideChangeSet }
  | { type: "prompt-content.create-requested"; attemptId: string }
  | { type: "prompt-content.definition-updated"; output: DerivedOutput }
  | { type: "prompt-content.refresh-requested"; attemptId: string }
  | { type: "formula.evaluate-requested"; attemptId: string };
```

Creation must produce one valid Theme, the protected Normal Text Style, at
least one Master, at least one Layout, and a first Slide selecting a Layout.
IDs are explicit so replay never invents
canonical identity. Defaults may be filled by the trusted create helper before
the revision-zero Base is committed.

No public command accepts project, database, table prefix, user storage scope,
actor ID, queue, or response mode. Actor attribution is injected at trusted
construction.

## Query contracts

```ts
type SlideQuery =
  | { type: "deck.list"; cursor?: string; lifecycle?: SlideLifecycle }
  | { type: "deck.load"; deckId: string; revision?: number }
  | { type: "deck.history"; deckId: string; cursor?: string; limit: number }
  | { type: "deck.attempt"; deckId: string; attemptId: string };

type SlideQueryResult =
  | { type: "deck.listed"; items: DeckHead[]; nextCursor?: string }
  | {
      type: "deck.loaded";
      head: DeckHead;
      snapshot: DeckSnapshot;
      promptContentRevisions: DerivedOutputRevision[];
    }
  | { type: "deck.history"; items: SlideChangeSet[]; nextCursor?: string }
  | { type: "deck.attempt"; attempt: SlideAttempt };
```

`deck.load` resolves exactly one immutable revision for every live Prompt
Content Element. A missing `outputId@appliedRevision` is an explicit typed 404;
it is never omitted and never replaced by the output's current head. The
returned array therefore has one entry per live Prompt Content Element.

Master→Layout→Slide composition, resolved Theme values, slot bindings, outline,
and effective z-order are discardable projections over the loaded snapshot.
They do not create independent persistence or query variants in v1.

## Idempotency and compensation

The application digests the complete canonical command value. Within a Deck,
an identical `(requestId, requestDigest)` retry returns the exact stored typed
result; divergent reuse returns `idempotency_mismatch`. Mutation receipts are
atomic with ChangeSets. Async request receipts are atomic with their attempts.

Before dispatching any command, the service also checks the delegated Prompt
definition claim namespace so a request ID left pending across the Derived
Outputs database cannot be reused for a different Slide command.

Compensation requires the exact current revision, a retained target ChangeSet,
and a complete contiguous tail. It rejects any touched-ID intersection. Missing
proof is a compensation conflict rather than a guessed undo.

## Prompt Content workflows

Prompt Content remains conceptually identical to Document Prompt Blocks, but
its canonical owner is one positioned Slide Element.

### Dedicated creation

```text
serial public command
  -> validate expected Deck revision, Slide, selected Layout/slot, parent Group,
     x/y/z, full Prompt Element shell, Normal Text Style, and definition
  -> check current tree, permanent identity ledger, prior creation reservation,
     and ownership for the requested Element ID
  -> atomically store prompt-content-create attempt + command receipt
  -> return 202 and dispatch slide.prompt-content.create.compute

concurrent compute
  -> claim compute-stage receipt
  -> DerivedOutputs.declare(definition, stable idempotency key)
  -> register local output ownership as pending
  -> DerivedOutputs.refresh(outputId, stable initial-refresh key)
  -> persist exact candidate head revision
  -> dispatch slide.prompt-content.create.settle

serial settlement
  -> claim settle-stage receipt
  -> reload Deck and revalidate frozen parent, z position, slot, and Element ID
  -> internally insert PromptContentElement(outputId@revision)
  -> atomically append ChangeSet, settle attempt, and attach ownership
  -> or mark stale/failed and detach local ownership
```

Declaration and refresh use keyed Derived Outputs calls. Crash replay reuses
the same keys and therefore the same dedicated output and immutable revision.

### Definition update

Slide durably claims `(deckId, requestId, requestDigest)` and freezes the
Element's `outputId` before calling keyed
`DerivedOutputs.updateDefinition`. Completion atomically stores the Slide
receipt and marks the claim complete. No Deck ChangeSet is appended until an
output revision is adopted.

### Refresh and exact adoption

Refresh freezes `(slideId, elementId, outputId, appliedRevision, deckRevision)`.
Compute calls keyed `DerivedOutputs.refresh`; an unchanged head terminates as
`unchanged`. Settlement adopts a candidate only when the Element still exists
as Prompt Content and names the exact frozen output and applied revision.
Otherwise the attempt becomes `stale`.

## Formula evaluation workflow

Formula evaluation mirrors Document and applies to every `RichContentTarget`.

```text
serial freeze
  -> automatic discovery in an accepted mutation, or formula.evaluate.request
  -> resolve exact target and FormulaAtom
  -> persist expression, expression digest, target, atom ID, and Deck revision
  -> atomically create attempt (with mutation or explicit command receipt)
  -> dispatch slide.formula.evaluate.compute

concurrent compute
  -> claim compute-stage receipt
  -> parse frozen expression through Formula
  -> build one immutable SlideFormulaResolver snapshot
  -> evaluate, including Structured Data names exposed by that snapshot
  -> persist resolver snapshot digest and candidate Rich Text settlement
  -> dispatch slide.formula.evaluate.settle

serial settlement
  -> claim settle-stage receipt
  -> resolve the same RichContentTarget and FormulaAtom
  -> require the same expression digest and no intervening touch of the atom
  -> internally apply Rich Text's formula-settlement operation
  -> atomically append ChangeSet and settle attempt
  -> otherwise mark stale
```

Parse, resolution, or evaluation diagnostics become an ordinary FormulaAtom
diagnostic settlement; infrastructure failure fails the attempt. Formula
accepted values and display text are frozen in Rich Content, so Deck loading
does not reevaluate formulas.

## Internal Jobs and recovery

```ts
type SlideInternalJobIntent =
  | { type: "slide.compact"; deckId: string; idempotencyKey: string }
  | { type: "slide.prompt-content.create.compute"; attemptId: string; idempotencyKey: string }
  | { type: "slide.prompt-content.create.settle"; attemptId: string; idempotencyKey: string }
  | { type: "slide.prompt-content.refresh.compute"; attemptId: string; idempotencyKey: string }
  | { type: "slide.prompt-content.refresh.settle"; attemptId: string; idempotencyKey: string }
  | { type: "slide.formula.evaluate.compute"; attemptId: string; idempotencyKey: string }
  | { type: "slide.formula.evaluate.settle"; attemptId: string; idempotencyKey: string };
```

Compaction and all settlements use the serial queue. Prompt and Formula compute
use the concurrent queue. Dispatch occurs only after authoritative state
commits and returns after scheduler admission, not Job completion.

Queue-capacity admission failures receive one deduplicated capped-backoff
in-process redrive per intent key. Other failures remain recoverable from
durable state. Startup resets interrupted stage claims, lists non-terminal
attempts, and redispatches compute for `requested`/`computing` attempts or
settlement for `proposed` attempts.

## Endpoints and error mapping

| Method | Path | Job | Queue | Response |
|---|---|---|---|---|
| `POST` | `/slides/command` | `slides.command.v1` | serial | inline |
| `POST` | `/slides/query` | `slides.query.v1` | concurrent | inline |

Creation returns `201`; Prompt/Formula attempt admission returns `202`; other
success returns `200`. Typed validation failures map to `400`, missing Deck,
attempt, or exact Derived Output revision to `404`, revision/idempotency/
definition/compensation conflicts to `409`, pruned history to `410`, and an
unexpected failure to a safe generic `500`.

Wire decoders reject unknown fields recursively, invalid discriminants,
non-finite coordinates, non-contiguous z-order, cyclic parentage, malformed
Rich Content, invalid Formula wire values, duplicate IDs, excessive nesting,
and configured size/count limits before the capability runtime executes.

## Activity boundary

Every accepted Deck creation, mutation, or compensation writes one accepted
fact to the local activity outbox in the same transaction. Rejections, exact
retries, compute stages, and definition-only Derived Output updates write no
Slide fact. Activity publishing, feeds, Presence, and undo endpoints remain
outside Slide; the outbox is the durable integration boundary.
