# Slides capability — design summary

## Purpose

Slide is a regular, project-scoped capability whose implementation lives at
`3-capabilities/slide/`. Its public resource routes and Job names use the
plural `slides` form. It owns editable presentation structure: Decks, ordered
Slides, structural Groups, positioned Shapes, embedded reusable Styles,
revisions, exact inverses, and retained history.

Its canonical aggregate is intentionally small:

```text
DeckSnapshot
  ├─ title, lifecycle, revision
  ├─ one deck-level canvas size
  ├─ embedded SlideStyleRegistry
  └─ slideOrder[] + slides record
       └─ Slide
            ├─ title, background, Rich Text notes
            └─ rootElementIds[] + flat elements record
                 ├─ Group → ordered childElementIds[]
                 └─ Shape → frame, transform, style, typed payload
                      ├─ authored Text
                      ├─ Prompt Content → exact dedicated DerivedOutputRef
                      ├─ Geometry
                      ├─ straight Line
                      ├─ immutable-snapshot Image
                      ├─ literal accepted-value Table
                      └─ literal accepted-value Chart
```

Arrays are the only ordering authority. Slide order, root z-order, and Group
child z-order are explicit arrays ordered back-to-front. There are no ranks,
implicit one-element Groups, duplicated parent pointers, or persisted group
transforms.

## Ownership boundaries

Slides owns:

- Deck and Slide identity, lifecycle, ordering, canvas, and background;
- Group membership, z-order, hidden state, and locked state;
- Shape frames, transforms, selected Styles, presentation overrides, and typed payloads;
- authored Rich Content in Text Shapes and Slide notes;
- exact Derived Output references accepted by Prompt Content Shapes;
- literal accepted values copied into Table and Chart Shapes;
- Base snapshots, ChangeSets, inverse operations, identity tombstones, command
  receipts, durable attempts, Prompt ownership, and accepted-activity outbox facts.

Slides does not own:

- Rich Text atoms, marks, links, references, formulas, ranges, or operations;
- Prompt definitions, Context scope, stabilization text, evidence, generation,
  freshness, or immutable output revisions;
- Formula, Structured Data, analysis, or Media runtimes;
- external mutable Themes or master-layout registries;
- rendered pixels, thumbnails, exports, browser selections, or caches.

Rich Text is embedded for authored text and notes. Derived Outputs is injected
through a narrow port for Prompt Content declaration, revision reads,
definition updates, refresh, and eventual deletion. `FormulaWireValue` is used
only as a bounded JSON-safe accepted-value contract; Slides never evaluates it
or resolves a mutable value source during a read.

## Style model

The Style Registry is embedded in every Deck snapshot. A Style is a named,
stable-ID bundle of visual and text properties with optional inheritance. Every
Shape kind names a default Style, and every Shape selects a Style.

Presentation resolves as:

1. Shape-kind default Style;
2. Shape-selected Style;
3. local Shape presentation override;
4. supplementary inline Rich Text marks for authored Text Shapes.

The resolved Shape overlay is authoritative. Inline marks add properties that
the Shape overlay does not fix. Prompt Content has no inline Rich Text state;
the resolved Shape Style formats the exact Derived Output revision's text.

Styles, defaults, and inheritance are canonical Deck state, so historical
appearance never depends on a mutable external Theme table. Master Slides,
tokens, and layout placeholders are deferred.

## Group and Shape boundary

A Group is structural. It contains only identity, ordered child membership,
lock state, and visibility state. It has no frame, fill, stroke, content, or
stored transform.

A Shape is visual. It carries one slide-space frame, rotation/flips, selected
Style, optional presentation overrides, and a typed payload. Group bounds are
derived from all descendant Shape bounds, including hidden descendants.

A group transform gesture is expanded into explicit descendant Shape
frame/transform operations before admission. This makes history and conflicts
address the Shapes that actually changed and prevents visibility from changing
transform geometry.

## Prompt Content

Prompt-generated content is a distinct `PromptContentShape`, not an alternate
source for an authored Text Shape. It stores only:

```ts
interface PromptContentShape extends ShapeBase {
  shapeKind: "prompt-content";
  output: DerivedOutputRef;
  textBox: TextBoxPresentation;
}
```

Every Prompt Content Shape receives a new dedicated Derived Output. Generic
Shape insertion, replacement, or source switching cannot introduce Prompt
Content or attach an arbitrary existing output.

Creation mirrors Document's durable workflow:

```text
serial freeze
  → validate expected Deck revision, Slide, placement, Shape ID, Style, frame,
    text-box presentation, and prompt definition
  → persist a prompt-create attempt

concurrent compute
  → idempotently declare a dedicated Derived Output
  → run its first refresh
  → register pending output ownership and persist the exact candidate revision

serial settlement
  → revalidate the frozen placement and Shape identity
  → insert PromptContentShape with outputId@appliedRevision
  → append ChangeSet and atomically mark ownership attached
```

Refresh freezes the current `(shapeId, outputId, appliedRevision)`, calls
Derived Outputs outside the serial transaction, and conditionally adopts a
newer exact revision through an internal ChangeSet operation. Definition and
stabilization-text updates mutate only Derived Outputs. Slides first stores a
durable delegated-command claim with the frozen output ID so an exact retry
cannot retarget after the Shape moves or disappears.

Deleting Prompt Content detaches rather than immediately deletes its output;
retained Deck history may still reference the immutable revision. Duplication
is deferred until it can declare distinct outputs for every copied Prompt
Content Shape.

## Shape scope in v1

- Authored Text and notes embed validated, normalized `RichContent`.
- Geometry uses a bounded built-in primitive set; arbitrary SVG/custom paths
  are excluded.
- Lines are straight and use normalized endpoints inside a positive frame.
- Images store immutable file/version/digest/MIME references, normalized crop,
  fit, and accessibility fields. Slides does not store image bytes.
- Tables and Charts embed bounded accepted `FormulaWireValue` data. They never
  read mutable Formula, Data, or analysis state during load or presentation.

If linked external values are added later, they require a durable freeze,
compute, and conditional-settlement workflow that copies an accepted value
into canonical Deck state.

## Revisions, identity, and activity

The Deck is the atomic revision unit. Creation writes revision zero as a full
Base. Every accepted mutation appends one ChangeSet containing canonical
forward operations, exact inverse operations, touched IDs, semantic digest,
and optional compensation metadata.

A permanent identity ledger prevents reuse of deleted Slide, Group, Shape,
Style, Rich Text atom, and Rich Text mark IDs. Exact undo/redo compensation may
reactivate only the same identity kind. Moving an identity does not replace it.

Activity begins with an accepted domain fact written in the same Slides-store
transaction as the mutation. Rejected calls and identical retries do not create
facts. A future integration-owned publisher may feed Activity; Slides does not
construct or import an Activity management capability.

## Persistence and construction

Slides uses its own SQLite file, `./data/slides.db`, with table names derived
from a trusted hash of the configured project ID. Project ID selects the store
at construction. User ID is optional activity attribution and never a storage
scope.

The removable integration boundary is:

```text
apps/backend/src/3-capabilities/slide/
apps/backend/src/4-job-wiring/slide/
apps/backend/src/1-init/create/slide.ts
apps/backend/src/1-init/startBackend.ts  # one construction/registration block
```

No existing capability stores a backlink to Slides. Rich Text and Derived
Outputs require no changes: Slides consumes their existing interfaces. The
public API remains:

- `POST /slides/command` — serial command admission or durable async freeze;
- `POST /slides/query` — concurrent list/load/history/attempt reads.

## Representation-v1 invariants

1. A Deck has one positive canvas size and at least one Slide.
2. `slideOrder` contains every Slide exactly once.
3. Every Slide element occurs exactly once in its root/Group ordering tree.
4. Ordering arrays are back-to-front; no rank or parent pointer is canonical.
5. Groups are acyclic, structurally non-empty, bounded in depth, and have no
   persisted geometry or transform.
6. Every Shape has a valid positive frame, normalized transform, resolvable
   Style, and valid bounded payload.
7. Every Rich Content value passes Rich Text validation and normalization.
8. Every live Prompt Content Shape has one distinct dedicated Derived Output
   at a positive immutable revision.
9. IDs are never reused after deletion except by exact same-kind compensation.
10. Historical presentation depends only on the Deck revision and exact
    immutable references stored by that revision.

## Explicitly deferred

- Mutable Theme resources, master Slides, layout placeholders, and token systems.
- Deck/Slide/Group/Prompt duplication.
- Custom paths, gradients, curved/elbow lines, animations, and transitions.
- Live Formula, Structured Data, analysis, or Media integration.
- Generic embeds, video, and audio.
- Rendering engines, thumbnails, exports, render caches, and pixel geometry.
- Activity publishing/management and detached-output garbage collection.

Read [canonical model](canonical-model.md) for exact representation types and
validation rules. Read [operations](operations.md), [store](store.md), and
[file architecture](file-architecture.md) for the command, persistence, and
construction contracts; those documents must follow the boundaries summarized
here.
