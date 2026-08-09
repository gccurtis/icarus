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
                   └─ Element = text | table | chart | image
                              | geometry | line | group

Text-bearing surfaces (a Text element body, a table cell) hold a TextSource:
authored Rich Content, or a reference to a Derived Output. Slide notes are
authored Rich Content only.
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
  /** Only "normal" exists for now, and only it is protected. */
  systemRole?: SlideSystemStyleRole;
  text?: SlideTextStyleProperties;
  box?: BoxAppearance;
}

type SlideSystemStyleRole = "normal";
```

This is `DocumentStyleRegistry` with the element-kind default in place of the
block-kind default: named, reusable, `basedOnStyleId` inheritance, live
references from elements, and a per-kind default for newly inserted elements.

**`Normal` is the only protected style** — it cannot be deleted or have its
role reassigned, though its name and visual properties stay editable. Document
additionally protects `heading-1`…`heading-6` because outline level is derived
from those roles; Slides has no outline, so it protects nothing else yet. The
role is a union rather than a boolean precisely so more can be added without a
representation change.

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
  notes: RichContent;                // authored only; never generated
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
  | TextElement        // body: SlideTextSource
  | TableElement       // cells hold SlideTextSource
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

### Text is a source, not an element kind

A text-bearing surface holds one of two things:

```ts
type SlideTextSource =
  | { kind: "rich";   content: RichContent }
  | { kind: "prompt"; output: DerivedOutputRef };

/** The two surfaces that hold one, in any of the three planes. */
//  TextElement.body   TableCell.body
```

**Prompt is a property of content, not a kind of element.** Document makes
`PromptBlock` a block kind, and that is right *there*, because a Document block
is its content — a paragraph is text. A Slide element is a positioned box, and
its frame, `zIndex`, rotation, lock, style, group membership, and slot binding
are all completely indifferent to whether its text was typed or generated.
Modelling `PromptElement` as a union member duplicates every one of those
concerns, and makes "turn this text box into a prompt" a delete-plus-insert that
throws away the element's identity, its slot binding, and its place in a group.
As a content-level union it is one operation that touches only the body.

The payoff is table cells. A cell whose text is generated needs no new element
kind and no new machinery — it is a cell whose body happens to be a `prompt`
source.

**A prompt is live in all three planes.** A Master or Layout element may hold
one, because the backdrop is authored content like anything else — a generated
footer or standing summary on a Master is a real thing to want, and the plane an
element sits in has nothing to do with where its text came from.

**Slide notes are authored only** and hold `RichContent` directly rather than a
text source. Notes are the author's own aside — the thing you write *about* the
deck — so handing them to a model inverts what they are for.

**Rich sources get formulas for free.** Rich Text owns atoms, marks, positions,
ranges, normalization, and **formula atoms**, so Slides writes no formula code.
A user types `{{ revenue / units }}`, Rich Text converts it to a formula atom,
and Slides does what Document does — records the Rich Text operation in its
ChangeSet, creates one durable evaluation attempt per changed atom, evaluates
against a frozen project resolver snapshot, and settles conditionally.

**Prompt sources hold a reference and nothing else.** The prompt text, its
Context scope, stabilisation text, evidence, and every generated revision belong
to Derived Outputs. Generated text never enters the snapshot; `deck.load`
resolves each prompt source on read, exactly as `document.load` does. Every
prompt source owns one dedicated output, and no output is bound at two sites.

A prompt source carries no Rich Content, so it carries no formula atoms and no
marks — the dependency projection skips it. Converting `rich → prompt` captures
the displaced Rich Content in the operation's exact inverse, so undo restores it
verbatim.

Chart labels, alt text, slot names, style names, and the Deck and Slide titles
are **not** text sources. They are metadata or too small to be worth generating,
and keeping them plain keeps the union to the two surfaces that earn it.

### Addressing a prompt

Because a prompt can sit in a cell, a Deck-wide address is needed where Document
needed only a `blockId`:

```ts
type PromptSite =
  | { kind: "element-body"; container: ElementContainerRef; elementId: SlideElementId }
  | { kind: "table-cell";   container: ElementContainerRef; elementId: SlideElementId;
      cellId: TableCellId };
```

The container is part of the site, not decoration: two planes may hold elements
with the same ID, and without it their ownership rows would collide.

The site is what `prompt_outputs` records alongside the output, what refresh and
update-definition name, and what settlement re-resolves to decide whether an
attempt is still live.

The site is also the **dedupe key**. There is no request id, so two requests to
prompt or refresh the same place are the same request however they were
labelled, and `getLivePromptAttemptBySite` is what says so.

Both of the site-keyed unique indexes are **partial on non-terminal state** —
one live output per site, one live creation attempt per site, not one ever. A
detached output and a finished attempt are history: undoing a prompt creation
has to leave the site promptable again. Reusing a finished attempt row instead
does not work, because its stage receipts survive it and a `completed` receipt
turns the next claim into a silent no-op.

Attaching is exclusive. When a mutation binds an output to a site, anything else
still claiming that site is detached in the same transaction — the Deck is the
authority on what a site holds. The case that forces this is undo, a new
creation at the same site, then redo: the redo re-attaches the original while
the new attempt's output is still pending, and one of them has to lose.

## Commands and queries

Two endpoints, matching Document: `POST /slides/command` (serial) and
`POST /slides/query` (concurrent).

There is no request ID on the envelope. Every mutating command carries
`expectedRevision`, so a duplicate arrives holding a revision the head has
already passed and is told so — the compare-and-set *is* the retry guard, and a
receipt keyed by request ID would only answer the same question twice.

```ts
interface SlideCommandRequest {
  /** Slides keeps its own vocabulary; the 1-init adapter maps it to Activity's. */
  origin: SlideOrigin;
  actorId?: string;
  command: SlideCommand;
}

/** Identical to `DocumentOrigin`; `interactive` maps to Activity's `user`. */
type SlideOrigin = "interactive" | "agent" | "automation";

type SlideCommand =
  | { type: "deck.create"; title: string; canvas?: SlideCanvas }
  | { type: "deck.submit"; deckId: DeckId; expectedRevision: number;
      operations: SlideOperation[] }
  | { type: "deck.compensate"; deckId: DeckId; targetChangeSetId: string;
      intent: "undo" | "redo"; expectedRevision: number }
  | { type: "deck.delete"; deckId: DeckId; expectedRevision: number }
  | { type: "prompt.create.request"; deckId: DeckId; expectedRevision: number;
      target: PromptCreateTarget;
      prompt: string; contextEntries: ContextEntry[]; stabilisationText: string }
  | { type: "prompt.update-definition"; deckId: DeckId; site: PromptSite;
      expectedDefinitionRevision: number; prompt: string;
      contextEntries: ContextEntry[]; stabilisationText: string }
  | { type: "prompt.refresh.request"; deckId: DeckId; site: PromptSite;
      expectedRevision: number }
  | { type: "formula.evaluate.request"; deckId: DeckId;
      target: RichContentTarget; formulaAtomId: string };

type SlideQuery =
  | { type: "deck.list"; cursor?: string; lifecycle?: DeckLifecycle }
  | { type: "deck.load"; deckId: DeckId; revision?: number }
  | { type: "deck.outline"; deckId: DeckId; revision?: number }
  | { type: "deck.history"; deckId: DeckId; cursor?: string; limit: number }
  | { type: "deck.attempt"; deckId: DeckId; attemptId: string };
```

## The outline

`deck.outline` returns the Deck's text as Markdown. It is a projection and only
a projection — nothing takes an outline as input, and a Deck is authored through
operations alone.

It exists because the Knowledge lattice consumes text, and that requirement
decides every judgement in it:

- One `#` heading per Slide, taken from the first text in reading order. A Slide
  has no title field and a Layout slot carries a name rather than a role, so no
  slot can be trusted to be "the title"; reading order is the only honest rule,
  and in practice what a Slide says first is what it is about.
- Remaining text becomes `-` bullets, tables render as Markdown tables so the
  grid survives, and Slide notes become a `>` blockquote.
- **Master and Layout text is excluded.** It is chrome — a confidentiality
  footer, a running header — repeated behind every Slide, and emitting it would
  put the same sentence in the lattice once per Slide.
- A prompt source contributes nothing until it has settled, because it has no
  text until then.

It reads a snapshot, so it accepts a `revision` exactly as `deck.load` does.

A prompt either fills a surface that already exists or brings one into being:

```ts
type PromptCreateTarget =
  /** The element does not exist yet. The service allocates its ID at freeze and
      returns it on the 202; the caller names placement, never an identifier. */
  | { kind: "new-text-element"; container: ElementContainerRef;
      placement: ElementPlacement; styleId?: string }
  /** Convert an authored surface. Its Rich Content lands in the exact inverse. */
  | { kind: "existing"; site: PromptSite };
```

`deck.create` allocates the Deck ID and its first Slide; the caller supplies no
identifiers for things that do not exist yet. It is the one command with no
revision to compare against, so a retry makes a second Deck. That is accepted
rather than engineered around: the duplicate is visible in `deck.list`, where a
caller can see it and delete it.

`deck.delete` is terminal and distinct from `set-lifecycle → trashed`, which is
reversible. Prompt outputs are detached, not destroyed — Derived Outputs owns
their lifecycle.

Operations cover deck metadata, theme tokens, styles, slide insert/move/delete,
element insert/update/move/delete/group/ungroup, table structure, and
`rich-text.apply`. Each returns forward operations, exact inverses, and touched
IDs.

## Persistence

Own SQLite file `./data/slides.db`, project-hashed table prefix, Base +
append-only ChangeSets — Document's model exactly. Tables: `resources`, `decks`,
`history`, `bases`, `change_sets`, `identity_ledger`, `attempts`,
`stage_receipts`, `prompt_outputs`, `retained_outputs`, `transaction_outbox`.

Accepted mutations stage an Activity transaction in the same database
transaction. Its key is `slides:<deckId>:<revision>:<kind>` — derived from
committed state rather than allocated, because exactly one transaction is ever
recorded for a given Deck revision. Republication after a crash recomputes the
same key and collapses into the existing row.

## Invariants

1. One positive canvas, one theme, one style registry, at least one Slide.
2. Slide order is `slideOrder`; element order is sibling `zIndex` only —
   unique and contiguous within a parent.
3. Group membership is acyclic; no empty Groups survive a ChangeSet.
4. Token references resolve to a token of the matching kind.
5. Every `rich` text source holds valid normalized Rich Content.
6. One distinct dedicated Derived Output per live `prompt` text source, and no
   output bound at two sites. Deleting a source detaches the ownership row; it
   never destroys the output, because compensation can restore the source.
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
