This page is the self-contained backend data-model contract for the Taurus Omega Deck resource. It defines the persisted aggregate, slide canvas, layout-template system, visual-object vocabulary, styling inheritance, rich content, prompt generation, Formula interpolation, accessors, mutators, concurrency, persistence, and acceptance proof.

The central authored hierarchy is:

**Deck → Slide → VisualObject → RichContent → TextBlock → TextRun → TextAtom**

This is not one uniform containment chain for every object. Only text-bearing VisualObjects continue into RichContent. A **LayoutTemplate** is not a canvas object or another content level. It is a reusable arrangement of placeholder definitions that a Slide may adopt. A **VisualObject** is anything positioned and rendered on the slide canvas.

## 1. Settled decisions

1. One Deck is one Resource and owns an ordered sequence of Slides.
2. Deck defines the default canvas size, theme, typography, palette, spacing, and default LayoutTemplate.
3. Every Slide has a concrete canvas configuration and may reference one LayoutTemplate.
4. `VisualObject` is the inclusive term for anything appearing on the canvas. `Layer` is only the rendering-order property of a VisualObject, not the domain noun.
5. LayoutTemplate and VisualObject are distinct. A template supplies positioned placeholders and defaults; a slide contains materialized VisualObjects and overrides.
6. Text-bearing objects use one Deck-native rich-content model based on blocks, runs, atoms, and marks.
7. Prompt-driven content is a production mode for content, not a separate visual-object kind. Completed prompt output is persisted as ordinary typed content plus generation evidence.
8. Formula is reused as the single typed value and evaluation system. Deck does not define a second expression language or value enum.
9. Formula interpolation inside prose uses explicit expression atoms, with a canonical authored syntax such as `{{ expression }}` at import/editor boundaries. The persisted model stores parsed Formula expressions, not delimiter strings.
10. Tables may be literal, Formula-derived, prompt-generated, or mixed at cell level. Their displayed values use Formula’s value contract.
11. Shapes may contain text. Lines and connectors are VisualObjects with geometry and stroke styling.
12. Every Slide owns `Notes`. Notes are lightweight rich text associated with the slide but are not positioned on the canvas and are not VisualObjects.
13. Rendering, selection handles, snapping UI, export, transitions, and presenter mode consume this model but are not authoritative state unless explicitly listed below.

## 2. Aggregate hierarchy

```go
type Deck struct {
    ID          DeckID
    Resource    kernel.ResourceKey
    Name        string
    Description string
    Revision    kernel.Version

    Canvas      CanvasDefaults
    Theme       DeckTheme
    Templates   []LayoutTemplate
    Slides      []Slide

    CreatedAt   time.Time
    UpdatedAt   time.Time
}

type Slide struct {
    ID          SlideID
    Name        string
    TemplateID  *LayoutTemplateID
    Canvas      SlideCanvas
    Objects     []VisualObject // ordered back-to-front
    Notes       SlideNotes
    Hidden      bool
}

type SlideNotes struct {
    Block TextBlock
}

`SlideNotes` deliberately has no frame, object style, background, template binding, or independent block list. It is one paragraph-like `TextBlock` whose Runs contain text or Formula Atoms and Marks. The initial contract constrains `Block.Kind` to `paragraph`; richer note organization can be added later without changing the fact that Notes belong to the Slide rather than the canvas. Their eventual editor or presentation treatment is a frontend concern.
```

Stable IDs are required for Deck, Slide, LayoutTemplate, VisualObject, content block, run, atom, table row, table column, table cell, and generation evidence.

Recommended prefixes: `dck_`, `sld_`, `tpl_`, `obj_`, `blk_`, `run_`, `atm_`, `row_`, `col_`, `cell_`, `gen_`.

## 3. Canvas and coordinate system

Deck-level canvas defaults establish the physical shape of every newly created slide.

```go
type CanvasDefaults struct {
    Width       float64
    Height      float64
    Unit        CanvasUnit // point | pixel | logical
    Orientation Orientation
    SafeArea    Insets
}

type SlideCanvas struct {
    WidthOverride  *float64
    HeightOverride *float64
    Background     BackgroundStyle
    Padding        Insets
}
```

Coordinates are stored in deck canvas units, not viewport pixels or percentages. A VisualObject owns an axis-aligned frame and an optional transform:

```go
type Frame struct { X, Y, Width, Height float64 }
type Transform struct {
    RotationDegrees float64
    FlipHorizontal  bool
    FlipVertical    bool
}
```

The frame must have finite values and non-negative width and height. Rotation is normalized by validation. Rendering may derive bounding boxes, handles, and snap lines; those are not persisted.

## 4. Terminology and content hierarchy

- **Deck**: the persisted presentation resource. It owns global visual defaults, reusable layout templates, and ordered slides.
- **DeckTheme**: the Deck-level style system: palette, fonts, typography roles, and reusable object styles.
- **LayoutTemplate**: a reusable slide arrangement made from slot definitions. It is not visible by itself and is not part of the slide canvas.
- **Slide**: one canvas in the Deck. It owns canvas/background overrides, ordered VisualObjects, and Notes.
- **VisualObject**: one positioned canvas item, such as a text box, shape, line, image, table, chart, equation, embed, or group.
- **RichContent**: editable textual content held by a text-bearing VisualObject, shape, table cell, code object, or Slide Notes.
- **TextBlock**: one paragraph-like structural unit inside RichContent. Examples are a paragraph, heading, bullet item, numbered item, quote, or code paragraph. A Block is therefore a block of text, not a slide object and not another canvas primitive.
- **TextRun**: a contiguous sequence of atoms sharing the same Marks.
- **TextAtom**: the smallest value-producing text unit: authored text or a Formula expression.
- **Mark**: an inline presentation override applied to a Run, such as bold, font, size, color, highlight, or link.

Styling follows the content hierarchy rather than introducing separate styling objects into the hierarchy. Deck, Slide, and VisualObject carry structural visual styling; TextBlock carries paragraph/list styling; TextRun carries Marks. TextAtom owns content or a Formula expression, not styling.

## 5. Layout templates

A LayoutTemplate is a reusable slide arrangement. It may represent title, section, content, two-column, comparison, image-led, chart-led, table-led, quote, blank, or a custom arrangement.

```go
type LayoutTemplate struct {
    ID          LayoutTemplateID
    Name        string
    Description string
    Canvas      TemplateCanvasStyle
    Slots       []TemplateSlot
}

type TemplateSlot struct {
    ID          SlotID
    Role        SlotRole
    Accepts     []VisualObjectKind
    Frame       Frame
    Transform   Transform
    Style       VisualStyle
    Content     *ContentDefaults
    Required    bool
}
```

A template slot is not itself a Slide object. When a Slide adopts a template, slots are materialized or associated with slide objects through `SlotID`. A slide object may override geometry, style, and content without mutating the template. Template edits affect only non-overridden properties.

The implementation must track override state explicitly; it must not infer overrides by comparing values.

```go
type TemplateBinding struct {
    TemplateID LayoutTemplateID
    SlotID     *SlotID
    Overrides  OverrideMask
}
```

Changing templates must be deterministic: retain compatible assigned content, create missing required slots, and leave incompatible former objects as unbound freeform objects unless the command explicitly deletes them.

## 6. Visual objects

```go
type VisualObject struct {
    ID        VisualObjectID
    Kind      VisualObjectKind
    Name      string
    Frame     Frame
    Transform Transform
    Binding   *TemplateBinding
    Style     VisualStyle
    Locked    bool
    Hidden    bool
    Data      VisualObjectData
}
```

Closed initial vocabulary:

- `text`: text box, title, subtitle, label, paragraph, or list.
- `shape`: rectangle, rounded rectangle, ellipse, triangle, diamond, polygon, or other enumerated geometric shape; may contain rich text.
- `line`: straight line, arrow, elbow connector, or curved connector.
- `image`: referenced raster or vector asset with crop and fit configuration.
- `table`: deck-owned table with stable row, column, and cell identities.
- `chart`: chart configuration backed by a Formula table value or a live Sheet chart/range reference.
- `equation`: standalone mathematical expression using Formula/equation source and display configuration.
- `code`: styled code content with language metadata.
- `embed`: live or pinned preview of another Resource, file, URL, Document region, Sheet range, or another slide.
- `group`: ordered child objects sharing a parent transform.

Bullets and numbered lists are not VisualObject kinds. They are block kinds inside a text-bearing object. A callout is normally a styled shape plus optional connector, grouped when useful; it does not require a distinct primitive.

Each `Kind` has exactly one matching typed payload. A generic `json.RawMessage` payload is not the canonical in-memory model.

## 7. Geometry-specific payloads

### 6.1 Shapes

```go
type ShapeData struct {
    Shape   ShapeKind
    Content *RichContent
}
```

Initial shape kinds include rectangle, rounded rectangle, ellipse, triangle, diamond, pentagon, hexagon, star, and freeform polygon. Shape text is laid out within the shape’s content box and inherits normal text styling.

### 6.2 Lines and connectors

```go
type LineData struct {
    Kind       LineKind
    Start      Point
    End        Point
    StartArrow ArrowHead
    EndArrow   ArrowHead
    Route      []Point
    StartBind  *ConnectionAnchor
    EndBind    *ConnectionAnchor
}
```

Connections may bind to another object’s edge or named anchor. Moving a bound object preserves the binding; the renderer or layout engine derives the routed path.

### 6.3 Groups

A group owns child VisualObjects in local coordinates. Cycles are invalid. Ungrouping converts child frames into slide coordinates without changing visual placement.

## 8. Styling model

Styling follows explicit inheritance:

**Deck theme → LayoutTemplate slot → Slide → VisualObject → content block → run marks**

Each level stores only authored overrides. Accessors may return authored style or fully resolved style.

```go
type DeckTheme struct {
    DefaultFont       FontRef
    DefaultTextColor  ColorValue
    DefaultBackground ColorValue
    Palette           map[string]ColorValue
    Typography        map[string]TextStyle
    ObjectStyles      map[string]VisualStyle
}

type VisualStyle struct {
    Fill       *FillStyle
    Stroke     *StrokeStyle
    Opacity    *float64
    Shadow     *ShadowStyle
    Corner     *CornerStyle
    Padding    *Insets
    Text       *TextStyle
}

type TextStyle struct {
    Font       *FontRef
    Size       *float64
    Weight     *FontWeight
    Color      *ColorValue
    LineHeight *float64
    Tracking   *float64
    Alignment  *TextAlignment
    Vertical   *VerticalAlignment
}
```

Colors may be concrete values or theme-token references. Font changes on a specific shape or text box are VisualObject-level text-style overrides. Mixed formatting inside content uses Marks.

Marks apply to contiguous runs and include: bold, italic, underline, strike, code, subscript, superscript, foreground color, highlight color, font family, font size, font weight, link, and semantic inline reference. Paragraph-level alignment, indentation, list level, spacing, and line height belong to blocks rather than marks.

Resolved styling is derived and must not be persisted redundantly.

## 9. Rich content

All text-bearing objects use one model:

```go
type RichContent struct { Blocks []TextBlock }

type TextBlock struct {
    ID         BlockID
    Kind       TextBlockKind
    Runs       []TextRun
    ListLevel  int
    Alignment  *TextAlignment
    Spacing    BlockSpacing
}

type TextRun struct {
    ID    RunID
    Marks []Mark
    Atoms []TextAtom
}

type TextAtom struct {
    ID      AtomID
    Kind    TextAtomKind
    Text    *string
    Formula *FormulaAtom
}
```

Block kinds: paragraph, heading, bullet, ordered, quote, and code. A bullet point is therefore a `bullet` block with a nesting level, not a special box type. A text box may freely contain paragraphs and lists.

Atom kinds are `text` and `formula`. Emoji and line breaks are text. Links are Marks. Inline references may be Marks or Formula expressions depending on whether they are navigational or value-producing.

## 10. Formula values and interpolation

Deck reuses Omega Formula exactly. It does not create `DeckValue`, a Deck parser, or Deck-specific evaluation kinds.

Literal content, Formula-derived content, and prompt-generated content all expose Formula-compatible typed values beneath their rendering. Display text is a projection of the value plus formatting.

For prose interpolation, an editor or importer may accept:

```
Revenue increased to {{ revenue_q3 }} from {{ revenue_q2 }}.
```

The canonical model stores this as text atoms separated by Formula atoms. Delimiters are syntax at the authoring boundary only.

```go
type FormulaAtom struct {
    Expression formula.Expression
    Cached     formula.Value
    Status     ResolutionStatus
    EvaluatedAt *time.Time
    Error      *formula.ErrorValue
}
```

Formula results may be null, number, text, logic, function, list, record, or table according to Formula’s canonical contract. Scalar values render inline. Structured values require an object-specific renderer:

- in prose, a list/record/table renders through an explicit compact formatter or reports an unsupported-render error;
- in a table object, a table value populates the table projection;
- in a chart object, a table value supplies chart data;
- in a generic object inspector, nested structures remain inspectable.

Formula source is authored state. Cached value, status, and evaluation metadata are derived state and may be refreshed without rewriting unrelated content.

## 11. Content production modes

Prompting is orthogonal to object kind. Any content-bearing target may have a production descriptor:

```go
type ContentProduction struct {
    Mode       ProductionMode // literal | formula | prompt | mixed
    Prompt     *PromptConfig
    Generated  *GeneratedContent
    Display    *EditableDisplay
    Evidence   []KnowledgeEvidence
    Generation *GenerationRecord
}

type GeneratedContent struct {
    Value       formula.Value
    Content     *RichContent
    Revision    int64
    GeneratedAt time.Time
}

type EditableDisplay struct {
    Content       RichContent
    UserEdited    bool
    Revision      int64
    History       []DisplayRevision
}

type DisplayRevision struct {
    Content   RichContent
    Source    DisplayRevisionSource // generated | refresh | force_refresh | user_edit
    Revision  int64
    CreatedAt time.Time
}
```

A prompt may target an entire text object, selected blocks, a table, selected table cells, chart data/configuration, equation source, or image request metadata. The prompt configuration follows the same conceptual contract as a Document PromptBlock: instruction, context/resource bindings, expected output shape, model policy, and generation status.

Completed generation is persisted as ordinary canonical content. The prompt configuration and evidence remain available for rerun, inspection, and provenance, but renderers do not need a provider to display the slide.

Prompt execution is a service operation, not a model mutator. The provider result is validated and converted into one atomic Deck command. Rerunning must support replace, append, and targeted-patch strategies.

## 12. Tables

```go
type TableData struct {
    Columns    []TableColumn
    Rows       []TableRow
    Cells      map[TableCellKey]TableCell
    HeaderRows int
    HeaderCols int
    Style      TableStyle
    Source     *TableSource
}
```

Rows, columns, and cells have stable identities. Each cell stores a Formula-compatible value and optional RichContent projection. The value is authoritative; RichContent is used when the cell contains intentionally rich prose rather than a simple scalar rendering.

A TableSource may be literal, Formula expression, prompt generation, Sheet range, or pinned snapshot. Mixed tables are permitted: a Formula-derived base table may have explicit authored overrides, tracked separately from source data.

Table mutation must support insert/delete/move row or column, set cell value, set cell rich content, apply cell/table style, merge/unmerge cells, bind/unbind source, refresh source, and regenerate selected ranges.

## 13. Charts and embeds

A chart is a VisualObject, not a Sheet-owned object copied into Deck.

```go
type ChartData struct {
    Kind       ChartKind
    Data       ChartDataSource
    Encoding   ChartEncoding
    Style      ChartStyle
    Snapshot   *SnapshotRef
}
```

The data source may be a Formula table expression, Sheet range, Sheet chart reference, literal table, or prompt-produced table. A pinned snapshot freezes the rendered data while retaining the live source reference.

An Embed stores a typed Resource reference, display mode, optional snapshot, and fallback preview. Deck never embeds another resource’s entire aggregate directly.

## 14. Accessors

Required read operations include:

- GetDeck, GetSlide, ListSlides, GetSlideByIndex.
- GetTemplate, ListTemplates, ResolveTemplateBinding.
- GetObject, ListObjects, HitOrder, GetGroupChildren.
- GetAuthoredStyle and ResolveStyle at every relevant level.
- GetRichContent, GetBlock, GetRun, GetAtom.
- GetTable, GetTableCell, ResolveTableProjection.
- ResolveFormulaAtom and ResolveAllFormulas.
- GetGenerationEvidence and GetSourceStatus.
- Export canonical snapshot for renderer, indexing, and persistence verification.

Reads return copies or immutable views; callers cannot mutate aggregate state through returned references.

## 15. Mutators and commands

All mutations execute through version-checked commands and return a new revision plus a ChangeSet.

Deck-level: rename deck, set description, update canvas defaults, update theme, create/update/delete/reorder template.

Slide-level: insert, duplicate, delete, reorder, rename, hide/show, set template, detach template, update canvas/background.

Object-level: create, duplicate, delete, reorder, move, resize, transform, lock, hide, group, ungroup, bind slot, detach slot, replace kind-compatible payload.

Style-level: set/clear deck token, slide override, object style, block style, and run marks.

Content-level: insert/delete/move block; insert/delete/split/merge run; insert/delete/replace atom; apply/remove mark; set Formula expression; refresh cached Formula value.

Table-level and prompt-level operations follow Sections 11 and 10.

Every command validates IDs, object-kind/payload agreement, geometry, template binding, group acyclicity, table shape, content tree, Formula expression, style tokens, and configured limits before commit.

## 15. Concurrency, history, and collaboration

The Deck aggregate has a monotonic revision. Every command carries expected revision, actor, operation ID, and timestamp. Stale commands return a typed conflict and do not partially apply.

ChangeSets contain typed forward operations and sufficient inverse information for undo. Operations address stable IDs, not array indexes alone. Reordering uses neighboring IDs or an ordering key so concurrent insertions can be reconciled deterministically.

Presence, cursors, selections, and drag previews are ephemeral collaboration state and are not persisted in the canonical Deck. A committed move/resize/style/content command is persisted and broadcast only after storage succeeds.

## 16. Persistence

Recommended relational split:

- `decks`: identity, metadata, revision, canvas defaults, theme JSON, timestamps.
- `deck_templates`: one row per LayoutTemplate.
- `deck_slides`: one row per Slide with ordering key and canvas JSON.
- `deck_objects`: one row per top-level or grouped VisualObject with parent ID, ordering key, frame, transform, style, binding, and typed payload JSON.
- `deck_content`: normalized or JSON content tree keyed by owning object/table cell.
- `deck_generations`: prompt configuration, evidence, generation record, and target.
- `deck_changes`: optional durable operation log/history.

A transaction locks the deck head revision, checks expected revision, writes all affected rows, increments revision once, records the ChangeSet, and commits. Failed validation or persistence leaves no partial mutation.

Unknown enum values must fail decoding with a typed unsupported-version error rather than silently degrading.

## 17. Knowledge extraction

The extractor emits semantic units for deck metadata, slide summaries, object content, table regions, Formula expressions and resolved values, prompt evidence, and live-resource references. It preserves Deck, Slide, VisualObject, block, and table-cell IDs for citation and deep linking.

Purely decorative shapes and lines are excluded unless they contain text, references, alt text, or semantic labels.

## 18. Validation invariants

- IDs are unique within their scope.
- Slide and object order is deterministic.
- VisualObject kind matches exactly one payload.
- Frames and transforms are finite and valid.
- Template bindings reference existing templates and slots.
- Override masks accurately distinguish inherited from authored properties.
- Groups are acyclic and children have one parent.
- Text trees contain valid blocks, runs, atoms, and marks.
- Formula atoms use Formula expressions and values, never a Deck-specific value type.
- Tables have valid stable row/column/cell references and non-overlapping merged regions.
- Prompt output conforms to the requested target shape before commit.
- Theme tokens resolve or produce a typed unresolved-token error.
- Resource references are syntactically valid; availability may be checked separately through Reader ports.

## 19. Terminal acceptance proof

An implementation is complete when terminal tests can:

1. Create a Deck with a 16:9 canvas, theme, and default typography.
2. Create title and two-column LayoutTemplates with placeholder slots.
3. Add slides, apply templates, override one slot, change the template, and prove only non-overridden properties update.
4. Add text, shape-with-text, ellipse, line/arrow, image, table, chart, equation, embed, and group objects.
5. Apply deck, template, slide, object, block, and run-level styles and prove resolved inheritance.
6. Create paragraph, bullet, and ordered blocks with mixed Marks.
7. Parse authored `{{ expression }}` interpolation into Formula atoms, evaluate them through Formula, persist cached values, and refresh them.
8. Generate a text object and a table through a prompt port, validate the result, persist ordinary content plus evidence, and render without the provider.
9. Bind a chart to a Formula table and a Sheet range; pin and unpin a snapshot.
10. Perform row/column/cell table edits and mixed source overrides.
11. Group, move, rotate, reorder, lock, hide, duplicate, and ungroup objects while preserving identity and placement.
12. Reject stale revisions, invalid bindings, cyclic groups, invalid Formula expressions, malformed prompt output, and unknown style tokens atomically.
13. Persist, reload, compare canonical snapshots, replay ChangeSets, and undo representative operations.
14. Extract citeable knowledge units with stable slide/object/content identities.

## 20. Explicit exclusions for this model version

Transitions, animations, build sequences, speaker notes, presenter timers, cue cards, rehearsal state, and live-presentation session state are excluded. They may be added as separate presentation capabilities without changing the authoring hierarchy.

Comments are also deferred unless the shared resource comment capability is ready. Their eventual anchors should be Deck, Slide, VisualObject, or rich-text range IDs rather than embedded anonymous coordinates.

## 21. Implementation guidance

The implementation should mirror the current Omega Document capability where the concepts truly align: stable aggregate identities, typed composition, explicit style inheritance, content atoms and Marks, version-checked mutation, transactional persistence, ChangeSets, and extraction.

It should not copy Document’s linear block hierarchy onto the canvas, and it should not copy Sheet’s grid model. Deck’s distinctive primitive is the positioned VisualObject within a Slide canvas.

Formula remains the value/evaluation authority. Prompt remains a content-production mechanism. LayoutTemplate remains reusable arrangement. VisualObject remains the canonical visible primitive.

## Sources reviewed

- Taurus Omega — Product Vision & Architecture Synthesis.
- Taurus Omega — Deck (Slides) Data Model and Deck Data Model v3.
- Taurus Omega Document capability and recent styling model.
- Taurus Omega Formula contract.
- Taurus Nova and original Taurus slide/deck construction resources.
- Taurus Omega federated service, kernel, change, persistence, and extraction conventions.

## Implementation contract additions

### Prompt refresh and editable display stability

Prompt-produced content has two related but distinct representations:

1. `GeneratedContent` is the latest canonical model result produced from the prompt and its current bindings.
2. `EditableDisplay` is the visible, user-editable RichContent shown on the slide.

The display begins as a projection of the generated content, but the user may edit its text, structure, Formula atoms, and Marks. Such edits do not overwrite the latest generated result. They set `UserEdited=true` and create a display-history revision.

A normal refresh receives the prior generated result, current editable display, user-edit flag, and current source data as context. It asks for an update rather than an unrelated rewrite. The accepted result follows these rules:

- when source data and generated meaning are materially unchanged, preserve the user-edited display exactly;
- when source data changes, update the display while preserving user-established phrasing, structure, and styling wherever compatible;
- when a targeted patch is returned, modify only the identified blocks, runs, atoms, table cells, or object configuration;
- a force refresh may replace the display, but it still records the replaced revision and does not silently discard history;
- the visible display is stale-never-empty: a failed refresh retains the last accepted display and records the failure state.

This is the Deck equivalent of the Document PromptBlock distinction between latest generated output and editable visible display.

### Core service interfaces

```go
type Reader interface {
    GetDeck(ctx context.Context, key kernel.ResourceKey) (Deck, error)
    GetSlide(ctx context.Context, key kernel.ResourceKey, slideID SlideID) (Slide, error)
    ListSlides(ctx context.Context, key kernel.ResourceKey) ([]SlideSummary, error)
    GetObject(ctx context.Context, key kernel.ResourceKey, slideID SlideID, objectID VisualObjectID) (VisualObject, error)
    GetNotes(ctx context.Context, key kernel.ResourceKey, slideID SlideID) (SlideNotes, error)
    ResolveStyle(ctx context.Context, key kernel.ResourceKey, target StyleTarget) (ResolvedStyle, error)
    ExportSnapshot(ctx context.Context, key kernel.ResourceKey) (Snapshot, error)
}

type Mutator interface {
    Execute(ctx context.Context, op kernel.OperationContext, command Command) (MutationResult, error)
}

type MutationResult struct {
    Revision  kernel.Version
    ChangeSet change.Set
}
```

Commands are typed structs implementing `Command`; the canonical service does not expose generic map patches.

```go
type Command interface {
    CommandName() string
    ExpectedVersion() kernel.Version
}

type SetSlideNotes struct {
    DeckID          DeckID
    SlideID         SlideID
    Notes           SlideNotes
    Version         kernel.Version
}

type ReplaceNotesAtoms struct {
    DeckID          DeckID
    SlideID         SlideID
    FromAtom        AtomID
    ThroughAtom     AtomID
    Replacement     []TextAtom
    Version         kernel.Version
}

type ApplyNotesMarks struct {
    DeckID          DeckID
    SlideID         SlideID
    FromAtom        AtomID
    ThroughAtom     AtomID
    Marks           []Mark
    Version         kernel.Version
}

type RefreshPromptContent struct {
    DeckID          DeckID
    SlideID         SlideID
    Target          ContentTarget
    Strategy        RefreshStrategy // update | replace | append | targeted_patch | force_replace
    ExpectedDisplay int64
    Version         kernel.Version
}
```

### Transport endpoints

The first HTTP transport may map directly to the Reader and typed commands:

```
POST   /v1/decks
GET    /v1/decks/{deck_id}
PATCH  /v1/decks/{deck_id}
DELETE /v1/decks/{deck_id}

POST   /v1/decks/{deck_id}/slides
GET    /v1/decks/{deck_id}/slides/{slide_id}
PATCH  /v1/decks/{deck_id}/slides/{slide_id}
DELETE /v1/decks/{deck_id}/slides/{slide_id}
POST   /v1/decks/{deck_id}/slides:reorder

GET    /v1/decks/{deck_id}/slides/{slide_id}/notes
PUT    /v1/decks/{deck_id}/slides/{slide_id}/notes
POST   /v1/decks/{deck_id}/slides/{slide_id}/notes:apply-marks

POST   /v1/decks/{deck_id}/slides/{slide_id}/objects
GET    /v1/decks/{deck_id}/slides/{slide_id}/objects/{object_id}
PATCH  /v1/decks/{deck_id}/slides/{slide_id}/objects/{object_id}
DELETE /v1/decks/{deck_id}/slides/{slide_id}/objects/{object_id}
POST   /v1/decks/{deck_id}/slides/{slide_id}/objects:reorder
POST   /v1/decks/{deck_id}/slides/{slide_id}/objects:group
POST   /v1/decks/{deck_id}/slides/{slide_id}/objects/{object_id}:ungroup

POST   /v1/decks/{deck_id}/content:refresh
POST   /v1/decks/{deck_id}/formulas:resolve
GET    /v1/decks/{deck_id}/snapshot
```

Every write request carries the expected Deck revision. Conflicts return the current revision and a typed conflict description. Prompt refresh also carries the expected display revision so a generated result cannot overwrite user edits made while generation was running.

### Persistence additions

The per-slide persisted representation includes `notes_json` beside canvas and object state. Notes changes are slide-scoped writes and must not rewrite unrelated slides.

Prompt-bearing content persists the prompt configuration, latest generated content, editable display, user-edit flag, bounded display history, evidence, generation status, and last error. Provider request/response payloads and transient retrieval traces are operational records rather than canonical Deck state.

### Additional acceptance proof

1. Create a slide and set Notes containing two Runs with different Marks; save and reload with stable Atom IDs.
2. Edit a prompt-generated text object, refresh with unchanged source data, and prove the edited display remains byte-for-byte equivalent.
3. Refresh the same object with changed source data and prove the accepted update preserves compatible authored Marks and records both generated and display revisions.
4. Begin a refresh, edit the display concurrently, and prove the stale refresh is rejected by display revision rather than overwriting the edit.
5. Update Notes and prove that no VisualObject, geometry, template binding, or unrelated slide row changes.
