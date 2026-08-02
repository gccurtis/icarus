# Slides Capability — Design

Replaces `slides-design/` (5 files, ~3,400 lines). That design carried a
PowerPoint-grade inheritance system — Masters, Layouts, and stable Layout slots
as three composition planes — which is presentation machinery the backend has no
use for. The data model below is what was actually asked for.

## What the backend is for

The backend stores and persists data, and computes on it when asked. It does
**no rendering and has no opinion on display.** It does hold formatting and
styling data, because that is data.

Everything is stored so that concurrent clients on one project converge on the
same result: canonical state, revisioned, with exact inverses. A second client
pointed at the same database sees the same Deck.

Document is the reference implementation. Slides mirrors its shape deliberately:
one aggregate, one layout block for dimensions, one style registry, an ordered
container of content, and typed content kinds carrying `RichContent`.

## The data model

```text
Deck
  ├─ title, lifecycle, revision
  ├─ canvas          — slide dimensions (the analogue of Document's pageLayout)
  ├─ theme           — typed color/font/length tokens
  ├─ styles          — deck-level style registry: styling for all slides
  ├─ masters         — deck-wide backdrop: shared elements every Layout inherits
  ├─ layouts         — the reusable slide templates, each with named slots
  └─ slideOrder + slides
        └─ Slide
             ├─ layoutId, background, notes
             └─ elements — flat record, ordered by zIndex
                   └─ Element = text | prompt | table | chart | image
                              | geometry | line | group
```

A Deck has deck-level styling, Masters, and Layouts; a Deck has Slides; a Slide
has Elements.

**Masters and Layouts stay.** An earlier revision of this document cut them as
over-engineering. That was wrong on both halves of the test that matters:

- *How different is the product without it?* Very. Layout is a primary
  slide-authoring concept — "title slide", "two-column", "section header" — and
  it is how consistency is actually achieved and how a deck stays editable at
  scale. Removing it does not simplify the product, it removes a feature people
  expect.
- *How reversible is it?* Poorly. Masters and Layouts add two registries to the
  snapshot and slot binding to element placement. Adding them later is a
  representation-version bump plus a migration that has to invent Layout
  assignments for existing Slides. This is exactly the kind of thing that is
  cheap now and expensive later.

They also matter for Templates. A Deck template is far more useful when the
thing being parameterised has named Layouts, because a Layout slot is a natural
place for a Context Variable to land.

### Deck

```ts
interface DeckHead {
  id: DeckId;
  title: string;
  lifecycle: DeckLifecycle;          // active | archived | trashed
  revision: number;
  baseSeq: number;
  semanticDigest: string;
  createdAt: string;
  updatedAt: string;
}

interface DeckSnapshot {
  representationVersion: 1;
  revision: number;
  title: string;
  lifecycle: DeckLifecycle;
  canvas: SlideCanvas;
  theme: DeckTheme;
  styles: SlideStyleRegistry;
  masters: Record<MasterId, Master>;
  layouts: Record<LayoutId, Layout>;
  slideOrder: SlideId[];
  slides: Record<SlideId, Slide>;
}

/** Dimensions only. What a renderer does with them is not our concern. */
interface SlideCanvas {
  widthPt: number;
  heightPt: number;
}
```

`canvas` is to Slides what `pageLayout` is to Document: the dimension data a
client needs to lay out and print, held as data, with no rendering implied.

### Theme and styles

The theme holds typed tokens; the style registry holds reusable named styles.
This mirrors `DocumentStyleRegistry`, including a per-element-kind default.

```ts
interface DeckTheme {
  name: string;
  tokens: Record<DesignTokenId, DeckDesignToken>;
  palette: DeckThemePalette;
  typography: DeckThemeTypography;
}

type DeckDesignToken =
  | { id: DesignTokenId; kind: "color";  name: string; value: SlideColor }
  | { id: DesignTokenId; kind: "font";   name: string; family: string }
  | { id: DesignTokenId; kind: "length"; name: string; valuePt: number };

/** Either a literal or a live token reference of the matching kind. */
type ThemeValue<T> = { kind: "literal"; value: T } | { kind: "token"; tokenId: DesignTokenId };

interface SlideStyleRegistry {
  defaultStyleIdByElementKind: Record<SlideElementKind, string>;
  styles: SlideStyle[];
}

interface SlideStyle {
  id: string;
  name: string;
  basedOnStyleId?: string;
  text?: SlideTextStyleProperties;
  box?: BoxAppearance;
}
```

Tokens do not alias other tokens, so resolution cannot cycle. A token reference
must resolve to a token of the matching kind.

### Masters, Layouts, and slots

Three planes, fixed back to front: **Master → Layout → Slide**. Each is a
container of ordinary elements, so there is no second element model to learn.

```ts
interface Master {
  id: MasterId;
  name: string;
  background: SlideBackground;
  /** Elements painted behind every Slide using a Layout that names this Master. */
  elements: Record<SlideElementId, SlideElement>;
}

interface Layout {
  id: LayoutId;
  name: string;
  masterId: MasterId;
  background?: SlideBackground;         // overrides the Master's when present
  elements: Record<SlideElementId, SlideElement>;
  /** Named placeholders a Slide fills. Placement metadata only — never painted. */
  slots: Record<SlotId, LayoutSlot>;
}

interface LayoutSlot {
  id: SlotId;
  name: string;                          // "Title", "Body", "Left column"
  frame: ElementFrame;
  /** Which element kinds may bind here. Empty means any framed kind. */
  accepts: SlideElementKind[];
}
```

Inheritance is **live within one Deck revision**: a Layout references a Master
and a Slide references a Layout by ID, and no layer copies another. Editing a
Master changes every Slide beneath it immediately, which is the entire point.

A Slide element binds a slot instead of carrying its own frame:

```ts
type ElementPlacement =
  | { kind: "free"; frame: ElementFrame }
  | { kind: "slot"; slotId: SlotId };
```

A slot-bound element has **one frame authority** — the slot's — so it follows
slot edits live. Moving or resizing it detaches it to `{ kind: "free" }` using
the slot's then-current resolved frame, which is the behaviour users expect from
dragging a placeholder. At most one element per Slide may bind a given slot. An
unfilled slot is a completeness *hint* reported by a projection, never a
validity error — a half-finished Slide is legal.

### Slides and elements

```ts
interface Slide {
  id: SlideId;
  layoutId: LayoutId;
  title?: string;                    // plain metadata, not RichContent
  background?: SlideBackground;      // overrides the Layout's when present
  notes: RichContent;
  elements: Record<SlideElementId, SlideElement>;
}

interface SlideElementBase {
  id: SlideElementId;
  parentGroupId?: SlideElementId;
  /** Sole sibling-order authority: unique, contiguous 0..n-1, back to front. */
  zIndex: number;
  placement: ElementPlacement;       // free frame, or a live Layout slot
  rotationDegrees?: number;
  locked: boolean;
  hidden: boolean;
  styleId?: string;
}

type SlideElement =
  | GroupElement       // membership via parentGroupId; no child array
  | TextElement        // content: RichContent
  | PromptElement      // content: DerivedOutputRef
  | TableElement       // cells carry RichContent
  | ChartElement       // literal series; labels are RichContent
  | ImageElement       // immutable General Files ref + alt text
  | GeometryElement
  | LineElement;

type SlideElementKind = SlideElement["kind"];
```

**Tables are an ordinary element kind**, exactly as `TableBlock` is an ordinary
Document block. So are charts and images. None of them is deferrable — you make
a table on a slide.

Elements are stored flat per Slide. `parentGroupId` supplies group membership
and `zIndex` is the only ordering authority; there are no child arrays and no
fractional ranks. Group coordinates are local translations only.

### Content is Rich Content, and therefore gets formulas

Every element that carries authored text carries `RichContent` — Text elements,
Table cells, Chart labels, Slide notes. Rich Text owns atoms, marks, positions,
ranges, normalization, and **formula atoms**.

This is the single most important consequence of following Document: Slides
writes no formula code. A user types `{{ revenue / units }}`, Rich Text converts
it to a formula atom, and Slides does exactly what Document does — records the
Rich Text operation in its ChangeSet, creates one durable evaluation attempt per
changed atom, evaluates against a frozen project resolver snapshot, and settles
conditionally.

Prompt elements are the other content source. A Prompt element holds only a
`DerivedOutputRef`; the prompt, its Context scope, stabilisation text, evidence,
and generated revisions all belong to Derived Outputs. Every Prompt element owns
its own dedicated output.

So: content is either authored or prompt-derived, both resolve to Rich Content,
and both therefore support formulas. That is the whole content story.

## Commands and queries

Two endpoints, matching Document: `POST /slides/command` (serial) and
`POST /slides/query` (concurrent).

```ts
interface SlideCommandRequest {
  requestId: string;
  /** Activity's vocabulary directly; no composition-time translation. */
  origin: "user" | "agent" | "automation" | "system";
  command: SlideCommand;
}

type SlideCommand =
  | { type: "deck.create"; title: string; canvas?: SlideCanvas }
  | { type: "deck.submit"; deckId: DeckId; expectedRevision: number;
      operations: SlideOperation[] }
  | { type: "deck.compensate"; deckId: DeckId; targetChangeSetId: string;
      intent: "undo" | "redo"; expectedRevision: number }
  | { type: "deck.delete"; deckId: DeckId; expectedRevision: number }
  | { type: "prompt.create.request"; deckId: DeckId; expectedRevision: number;
      slideId: SlideId; element: PromptElementShell;
      prompt: string; contextEntries: ContextEntry[]; stabilisationText: string }
  | { type: "prompt.update-definition"; deckId: DeckId; elementId: SlideElementId;
      expectedDefinitionRevision: number; prompt: string;
      contextEntries: ContextEntry[]; stabilisationText: string }
  | { type: "prompt.refresh.request"; deckId: DeckId; elementId: SlideElementId;
      expectedRevision: number }
  | { type: "formula.evaluate.request"; deckId: DeckId;
      target: RichContentTarget; formulaAtomId: string };

type SlideQuery =
  | { type: "deck.list"; cursor?: string; lifecycle?: DeckLifecycle }
  | { type: "deck.load"; deckId: DeckId; revision?: number }
  | { type: "deck.history"; deckId: DeckId; cursor?: string; limit: number }
  | { type: "deck.attempt"; deckId: DeckId; attemptId: string };
```

`deck.create` allocates the Deck ID and its first Slide; the caller supplies no
identifiers for things that do not exist yet. Replay safety comes from a
`requestId`-keyed create receipt, as `document.create` does.

`deck.delete` is terminal and distinct from `set-lifecycle → trashed`, which is
reversible. Prompt outputs are detached, not destroyed — Derived Outputs owns
their lifecycle.

Operations cover deck metadata, theme tokens, styles, slide insert/move/delete,
element insert/update/move/delete/group/ungroup, table structure, and
`rich-text.apply`. Each returns forward operations, exact inverses, and touched
IDs.

## Persistence

Own SQLite file `./data/slides.db`, project-hashed table prefix, Base +
append-only ChangeSets — Document's model exactly. Tables: `decks`, `bases`,
`change_sets`, `command_receipts`, `create_receipts`, `identity_ledger`,
`attempts`, `stage_receipts`, `prompt_outputs`, `activity_outbox`.

Accepted mutations write an Activity fact in the same transaction; the fact
carries the command `origin` and its `factId` is the idempotency key Activity
derives its transaction ID from.

## Invariants

1. One positive canvas, one theme, one style registry, at least one Slide.
2. Slide order is `slideOrder`; element order is sibling `zIndex` only —
   unique and contiguous within a parent.
3. Group membership is acyclic; no empty Groups survive a ChangeSet.
4. Token references resolve to a token of the matching kind.
5. Every text-bearing field holds valid normalized Rich Content.
6. One distinct dedicated Derived Output per live Prompt element.
7. Permanent identity non-reuse; exact same-kind compensation is the only
   reactivation path.
8. No command carries a project, user scope, table prefix, actor ID, queue, or
   response mode.

## Inventory: what the old design had, and what happened to it

Judged on two questions: **how different is the product without it**, and **how
reversible is adding it later**. Anything that scores badly on both belongs in
v1.

| Feature | Verdict | Product difference | Reversibility |
|---|---|---|---|
| Masters, Layouts, slots | **Kept** — restored after being wrongly cut | High: layout is a primary authoring concept and the natural anchor for Deck templates | Poor: two snapshot registries + placement change ⇒ version bump and a migration inventing Layout assignments |
| Embedded Theme with typed tokens | **Kept** | High: consistent colour/type across a deck is table stakes | Poor: token references are a value shape; retrofitting means rewriting every literal |
| Reusable named styles | **Kept, and widened** | High for knowledge work | Poor: style selection lives on elements |
| Tables, charts, images | **Kept** | High: you make a table on a slide | Poor: element union members |
| Groups, z-order, lock/hide | **Kept** | High | Poor: structural |
| `presentation.ts` domain module | **Kept** (restored) | — | It exists to resolve Master→Layout→Slide; it returns with them |
| Slot completeness projection | **Kept** as a projection | Low on its own | Trivial: a pure read over the snapshot |
| Deck/Slide duplication | Deferred | Low: copy is a convenience | Good: a command over existing state, no model change |
| External theme sharing, token aliases | Deferred | Low: one embedded theme covers a deck | Good: additive; aliases need a cycle guard |
| Group rotation and scale | Deferred | Low: translation covers grouping | Fair: adds a transform to Group, a small version bump |
| Custom paths, gradients, curved lines | Deferred | Medium for design-heavy decks | Good: new members of the typed appearance unions |
| Formula-backed chart series | Deferred | Medium | Fair: needs a frozen-source settlement contract, like cell formulas |
| Embeds, video, audio | Deferred | Low for now | Good: new element kinds; the union is closed but extending it is additive |

### The two substitutions worth naming

The old design had **exactly one protected `Normal` text style** and no style
selection on elements — all other appearance was typed per element kind. This
document replaces that with a `SlideStyleRegistry` carrying named styles and a
per-element-kind default, mirroring `DocumentStyleRegistry`. That is *more*
styling capability, not less, and it is the same model authors already meet in
Document.

The old `formulaDependencies.ts` projection is gone because formula atoms live
in Rich Content and the ordinary `dependencies.ts` projection already walks it.
Nothing is lost.

### How to add a deferred item later

Everything in the deferred list is additive to a closed union or a new optional
snapshot field, so the recipe is the same each time: extend the union or add the
field, bump `representationVersion` only if existing decks must be rewritten
(most of these do not — an absent field reads as the current behaviour), add the
operations and their exact inverses, extend `validation.ts`, and add wire
decoding. The identity ledger gains a kind only if the feature introduces new
stable IDs.

## Deferred

Rendering, thumbnails, exports, pixel geometry, animation, and transitions are
**outside the backend boundary** — not deferred work.

Inside the boundary, see the inventory above. Templates integration is also
deferred: Slides would add a `TemplateResourceAdapter` once Document proves that
contract.

## Implementation

See [`slides-implementation-plan.md`](slides-implementation-plan.md).
