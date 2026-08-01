# Slides capability — design summary

## Purpose

Slide is a regular project-scoped capability under `3-capabilities/slide/`.
It owns versioned Deck editing: the embedded design system, live Master/Layout
inheritance, ordered Slides, flat heterogeneous elements, Rich Content,
dedicated Prompt Content outputs, revisions, exact inverses, retained history,
and accepted-activity facts.

Its aggregate is:

```text
DeckSnapshot
  ├─ RichContent title + lifecycle + revision
  ├─ one deck canvas
  ├─ DeckDesignSystem
  │    ├─ one embedded DeckTheme
  │    │    └─ typed color/font/length tokens + defaults
  │    ├─ SlideTextStyleRegistry
  │    │    └─ one protected Normal Style initially
  │    ├─ MasterSlide record
  │    └─ SlideLayout record (the reusable templates)
  │         └─ stable, non-painting Layout slots
  └─ slideOrder[] + Slide record
       └─ one flat elements record
            ├─ Group (membership through parentGroupId)
            ├─ Text → RichContent
            ├─ Prompt Content → exact dedicated DerivedOutputRef
            ├─ Geometry
            ├─ Straight Line
            ├─ Image → immutable General Files ref + RichContent alt
            ├─ Table → RichContent cells + per-cell fill/borders
            └─ Chart → literal numeric series + RichContent labels
```

There is no universal Shape wrapper, generic element Style, child-element
array, root-element array, or fractional rank. Each Master, Layout, and Slide
has one flat heterogeneous element record. `parentGroupId` supplies Group
membership and `element.zIndex` is the only sibling-order authority, unique and
contiguous `0..n-1` from back to front.

## Ownership boundaries

Slides owns:

- Deck/Slide identity, lifecycle, canvas, ordering, background, and revisions;
- the embedded Theme, typed token registry, protected Normal text Style, and
  user-created text Styles;
- deck-owned Master Slides, Layout templates, stable slots, and live links;
- element membership, placement, z-order, lock/visibility, typed appearance,
  and element-specific payloads;
- Rich Content in titles, notes, Text, image alternatives, Table cells, and
  Chart titles/labels;
- exact dedicated Derived Output references for Prompt Content;
- Base snapshots, ChangeSets, exact inverses, identity tombstones, command
  receipts, durable attempts, Prompt ownership, and activity outbox facts.

Slides does not own:

- Rich Text atoms, marks, links, references, Formula operations, ranges, or
  normalization;
- Formula parsing/evaluation or Structured Data resolution;
- Prompt definitions, Context scope, stabilization text, evidence, generation,
  freshness, or immutable output revisions;
- image bytes or mutable file contents;
- rendering, animation, or transition behavior;
- Activity management/undo endpoints or presence.

Rich Text, Formula plus its project resolver, Derived Outputs, General Files,
Jobs, and the activity fact sink are injected through narrow runtime ports.
Project ID selects the runtime and store. User identity is optional activity
attribution and never a storage scope.

## Design system, masters, and layouts

`DeckSnapshot.design` is one `DeckDesignSystem` containing four sibling values:

```ts
interface DeckDesignSystem {
  theme: DeckTheme;
  textStyles: SlideTextStyleRegistry;
  masters: Record<MasterSlideId, MasterSlide>;
  layouts: Record<SlideLayoutId, SlideLayout>;
}
```

The Theme is embedded, not an external aggregate. Its color, font, and length
tokens are strongly typed; a reference must resolve to the matching token kind.
Theme palette/typography defaults and element-specific appearance may retain
live token references, while literal values remain available for intentional
local overrides.

Only the Normal text Style is protected and present initially. It can be
visually edited or renamed, but cannot be deleted and its `normal` role cannot
be removed or reassigned. Callers may add inheriting text Styles. There is no
generic visual Style: Geometry, Straight Line, Table cell, and Chart appearance
is typed on those kinds and may use Theme tokens.

Master → Layout → Slide inheritance is live within one Deck revision. Layouts
reference Masters, Slides reference Layouts, and no layer copies another.
Layouts are the reusable Slide templates in v1. The composition planes are
fixed back-to-front as Master, Layout, then Slide.

A Layout slot is a stable, non-painting frame and optional text-Style default.
A Slide-owned framed root element can bind it through
`{ kind: "layout-slot", slotId }`; it then has no duplicate frame and follows
slot edits live. At most one compatible element binds a slot. Moving/resizing a
bound element detaches it to `{ kind: "free", frame }` using the then-current
resolved slot frame.

## Element model

`SlideElement` is a closed direct union:

```ts
type SlideElement =
  | SlideGroupElement
  | SlideTextElement
  | PromptContentElement
  | GeometryElement
  | StraightLineElement
  | ImageElement
  | TableElement
  | ChartElement;
```

The common fields are stable ID, kind, `parentGroupId`, `zIndex`, lock, and
visibility. Framed elements use a discriminated free-frame or live-slot
placement. Groups and lines use free point placement; Group coordinates are
local translations, and a Straight Line stores its finite end delta.

Coordinates are relative to the owner canvas at a root and relative to the
parent Group origin for descendants. Groups contain no child arrays and own no
visible appearance. Their bounds are derived from descendants. Move/delete/
group/ungroup operations update parent IDs and deterministically renumber only
the affected sibling sets; an empty Group is pruned in the same ChangeSet.

Tables have stable row, column, cell, and merge identities. Each cell owns
`RichContent`, optional text Style, fill, four borders, padding, and alignment.
Merge regions preserve covered cells for exact unmerge and undo.

Charts own bounded literal numeric categories/series. All chart titles, axis
titles, category labels, and series names are Rich Content. Formula-backed
numeric series are not silently approximated as a JSON blob; they wait for a
defined frozen-source settlement contract.

## Rich Content and Formula

All Slides-owned presented text uses Rich Content. The exact target union
covers Deck title, Slide title/notes, Text elements, image alternatives, Table
cells, and each Chart label location across Master/Layout/Slide owners. Titles
therefore change through `rich-text.apply`; there is no competing plain-string
rename operation. `DeckHead.title` is only a derived list-query projection.

Formula follows Document's workflow:

```text
Rich Text operation / {{ source }} helper
  → one ordinary Formula atom in RichContent
  → serial Deck ChangeSet + durable evaluation attempt + activity fact
  → concurrent Formula evaluation against one resolver snapshot
  → serial conditional Rich Text result/diagnostic settlement
```

Rich Text owns the Formula atom and the delimiter conversion. Formula owns
parsing and evaluation. The existing project resolver reaches Structured Data.
Slides observes changed Formula atom IDs and orchestrates durable compute and
settle Jobs; it never creates a Slide-specific Formula payload.

## Prompt Content and Derived Outputs

Prompt-generated content is a distinct `PromptContentElement`, not Text with a
different source. It stores only an exact `DerivedOutputRef`, optional text
Style, text-box presentation, and ordinary element placement.

Every Prompt Content element has its own dedicated Derived Output. Generic
element insertion/replacement cannot create Prompt Content or attach an
existing output. Creation uses the same three-stage pattern as Document:

```text
serial freeze
  → validate Deck revision, element owner/ID, placement, slot, and definition
  → persist prompt-create attempt

concurrent compute
  → idempotently declare one dedicated Derived Output
  → run initial refresh and persist exact candidate revision/ownership

serial settlement
  → revalidate frozen identity and placement
  → insert PromptContentElement(outputId@appliedRevision)
  → append ChangeSet, attach ownership, and write activity fact atomically
```

Refresh similarly freezes the exact current reference, computes outside the
Slides transaction, and conditionally adopts a newer immutable revision.
Definition and stabilization-text updates mutate Derived Outputs through its
narrow runtime. Deleting Prompt Content detaches the output because retained
Deck history may still reference it; later garbage collection needs retained-
history reachability.

## Revisions, ordering, and activity

The Deck is the atomic revision unit. Creation writes revision zero as a Base.
Every accepted mutation appends one canonical ChangeSet with forward
operations, exact inverses, touched IDs, semantic digest, and any compensation
metadata. A permanent identity ledger prevents reuse of deleted resource,
element, table, Style/token, and Rich Text IDs; exact same-kind compensation is
the only reactivation path.

Accepted activity begins as a domain fact written in the same Slides-store
transaction as the mutation. Rejected calls and identical retries do not emit
facts. A later integration publisher can forward those facts to Activity.
Slides neither depends on an Activity management capability nor owns Activity's
undo endpoint; Activity-triggered undo re-enters Slides as an ordinary
compensation command, avoiding a capability cycle.

## Persistence and construction

Slides uses its own SQLite file, `./data/slides.db`, with logical table names
derived from a trusted hash of the configured project ID. The removable
integration boundary remains:

```text
apps/backend/src/3-capabilities/slide/
apps/backend/src/4-job-wiring/slide/
apps/backend/src/1-init/create/slide.ts
apps/backend/src/1-init/startBackend.ts  # one construction/registration block
```

No existing capability stores a backlink to Slides. The public resource API is
the same two-endpoint command/query envelope used by adjacent capabilities:

- `POST /slides/command` — serial mutation admission or durable staged freeze;
- `POST /slides/query` — concurrent list/load/history/attempt reads.

## Representation-v1 invariants

1. One positive Deck canvas, embedded Theme, protected Normal Style, and at
   least one Slide.
2. Exact Slide order through `slideOrder`; exact element order through sibling
   `zIndex` only.
3. Live, resolvable Master → Layout → Slide references.
4. Flat owner stores, same-store acyclic parent Groups, and no empty Groups.
5. One compatible framed Slide root element per Layout slot, with one frame
   authority.
6. Resolvable typed tokens and text Styles; no generic Shape Style.
7. Valid normalized Rich Content in every text-bearing Slides field.
8. Stable Table cells/merges and bounded literal Chart values.
9. One distinct dedicated Derived Output per live Prompt Content element.
10. Permanent identity non-reuse and history depending only on revisioned state
    plus exact immutable resource references.

## Outside the backend domain and explicit deferrals

Rendering, animation, and transition behavior are outside the Slides backend
domain, not deferred backend work.

Representation v1 deliberately defers Deck/Slide/Prompt duplication, external
Theme sharing and token aliases, a third template resource beyond Layouts,
cross-plane z interleaving, stored Group transforms, custom paths/gradients/
curved lines, Formula-backed Chart numeric series, generic embeds/video/audio,
Activity publishing/management, and detached-output garbage collection.

The most important assumptions to validate before implementation hardens are:

- Layout is the template concept; no separate template registry is needed.
- Master, Layout, and Slide remain fixed stacking planes.
- A Layout slot admits at most one root framed element.
- Groups retain translation only, not rotation/scale.
- Chart numeric values are literal in v1; Formula applies to Rich Content labels
  until a numeric linked-source contract is designed.
- Prompt output remains external plain text referenced exactly rather than
  copied into Rich Content.

Read [canonical model](canonical-model.md) for exact types and validation.
[Operations](operations.md), [store](store.md), and
[file architecture](file-architecture.md) must use these names and boundaries.
