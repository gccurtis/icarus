---
title: "Model — Slides Capability & Runtime Contract"
notion_page_id: "3abb6410e50281df8762c162e9a6eb13"
notion_url: "https://app.notion.com/3abb6410e50281df8762c162e9a6eb13"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-28 21:13:21Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Model — Slides Capability & Runtime Contract

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

The Slides capability is a project-scoped, collaborative presentation resource. Its aggregate is a Deck containing Slides and typed VisualObjects. This specification is a standalone implementation contract for a coding agent. It aligns Slides with the current Taurus Omega runtime: stable-ID operations, exact revision compare-and-swap, append-only ChangeSets, replayable bases, author-scoped undo/redo, durable idempotent jobs, and narrow ports assembled in wiring. The runtime authority is the [Taurus Omega runtime model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/runtime-model.md); the concurrency pattern is the current [Document submission service](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/service_submit.go).
## 1. Product contract
- The resource family is **Slides**. The aggregate type is `Deck`.
- The structural hierarchy is `Deck → SlideSection → Slide → VisualObject`, with an **Unsectioned** projection for slides whose `SectionID` is empty.
- Sections are named, stable-ID, ranked groups. Slides are unnamed, stable-ID entities referred to by current position, thumbnail/content, template name, or stable ID.
- Moving a slide changes its section/rank projection and never changes its SlideID.
- Text inside a visual object uses `RichContent → TextBlock → TextRun → TextAtom`.
- The word `Block` means a text block only. A slide object is always a `VisualObject`.
- Each Slide has one lightweight Notes `TextBlock`.
- VisualObjects are typed rather than opaque bags.
- Geometry is stored as integer English Metric Units (EMU) for deterministic layout and Office interoperability.
- Layout templates define slots and default layout; slide objects remain ordinary stable-ID objects with explicit overrides.
- A Template Library may store named/versioned slide templates and deck templates. Materialization produces fresh Slides-owned IDs and normal ChangeSets.
- The exact representation of prompt blocks versus template parameters remains an explicit future decision; the core Slides aggregate does not guess it.
- Formula and prompt results follow the same stale-safe generation pattern as Documents.
- Human editors and AI agents use the same typed operations.
## 2. Runtime placement
```plain text
core/capability/slides/
  model.go
  geometry.go
  rich_content.go
  operations.go
  submission.go
  service.go
  service_submit.go
  service_history.go
  service_rebase.go
  validation.go
  errors.go
  memory_store.go

core/platform/storage/sqlite/
  sqlite_slides.go

core/transport/httpapi/
  slides_handlers.go

core/wiring/
  slides.go
```
Slides is a leaf capability. It owns Deck state and Slides ChangeSets, receives an authorized project scope, and repeats that scope in storage. Formula evaluation, file reads, prompt production, chart snapshots, activity, resource catalog, and durable jobs are ports implemented by wiring adapters.
Use concurrent inline dispatch for reads, serial inline dispatch keyed by `DeckID` for canonical mutations, and deferred durable work for prompt production, chart rendering, media processing, export, thumbnail generation, and rebase. The keyed mutex is an optimization; SQLite revision CAS is authoritative.
## 3. Aggregate model
```go
type Deck struct {
    ID          string
    ProjectID   string
    Name        string
    Base        DeckBase
    CreatorID   string
    CreatorName string
    CreatedAt   time.Time
    UpdatedAt   time.Time
    Revision    int64
    BaseSeq     int64
    Lifecycle   string
    TrashedAt   *time.Time
}

type DeckBase struct {
    Canvas    Canvas
    Theme     DeckTheme
    Templates []LayoutTemplate
    Sections  []SlideSection
    Slides    []Slide
}

type SlideSection struct {
    ID   string
    Rank string
    Name string
}

type Canvas struct {
    WidthEMU  int64
    HeightEMU int64
}
```
Recommended default canvas is 16:9 at `12_192_000 × 6_858_000` EMU. Other sizes are allowed if positive and within configured limits.
Sections are ordered by deterministic `Rank` and stable `ID`. The empty SectionID is reserved for the UI projection **Unsectioned** and is not persisted as a synthetic `SlideSection`. Flattened deck order is Unsectioned first, then named sections by rank; slides are ordered within each group by slide rank and stable ID. A product decision may later place Unsectioned last, but it must remain one deterministic projection everywhere.
`Base` is the rebased snapshot at `BaseSeq`. A read resolves it with ChangeSets through `Revision`. Rebase compacts pending operations into Base without changing the logical revision or invalidating client history.
## 4. Slide and notes
```go
type Slide struct {
    ID             string
    SectionID      string // empty means the Unsectioned projection
    Rank           string // scoped to SectionID
    TemplateID     string
    CanvasOverride *Canvas
    Objects        []VisualObject
    Notes          TextBlock
    Hidden         bool
}

type TextBlock struct {
    ID    string
    Runs  []TextRun
    Marks []TextMark
    Style ParagraphStyle
}

type TextRun struct {
    ID    string
    Atoms []TextAtom
}

type TextAtom struct {
    ID   string
    Kind string // text | formula
    Text string
    Data TextAtomData
}
```
A Slide deliberately has no `Name` field. Human references use current ordinal (“slide 7”), section plus ordinal, thumbnail/content, resolved template name, or stable SlideID. Ordinals are revision-specific projections and are never accepted as mutation identity.
Slides are ordered by deterministic rank within `SectionID`. Insert and move operations use a target `SectionID` and an `AfterSlideID` anchor in that same group; clients do not submit array indexes as durable identity. Moving between sections retains SlideID and assigns a new rank in the target group.
Deleting a non-empty section requires an explicit rehome destination: another SectionID or empty for Unsectioned. It never implicitly deletes the section’s slides.
Notes start as one paragraph-like `TextBlock`, sufficient for speaker notes and agent context. The shape is deliberately compatible with future multiple-block notes without requiring a second notes document aggregate.
Text atoms, marks, and anchors are owned by the Slides capability. Their wire semantics deliberately mirror Documents, but Slides does not import the Document domain. A formula atom stores expression, accepted result, dependencies, state, and result history in a Slides-owned contract; wiring translates Formula results at the port boundary.
## 5. Visual objects
```go
type VisualObject struct {
    ID            string
    Kind          VisualObjectKind
    ParentGroupID string
    Rank          string
    Frame         Frame
    Transform     Transform
    Binding       TemplateBinding
    Style         ObjectStyle
    Locked        bool
    Hidden        bool
    Data          VisualObjectData
}

type Frame struct {
    XEMU      int64
    YEMU      int64
    WidthEMU  int64
    HeightEMU int64
}

type Transform struct {
    RotationMicroDegrees int32
    FlipHorizontal       bool
    FlipVertical         bool
}
```
Supported first-class kinds:
<table header-row="true">
<tr>
<td>Kind</td>
<td>Typed data</td>
</tr>
<tr>
<td>`text`</td>
<td>`TextObjectData{Content RichContent, AutoFit, VerticalAlign, Insets}`</td>
</tr>
<tr>
<td>`shape`</td>
<td>`ShapeObjectData{ShapeType, Content, Fill, Stroke}`</td>
</tr>
<tr>
<td>`line`</td>
<td>`LineObjectData{Start, End, Stroke, StartMarker, EndMarker}`</td>
</tr>
<tr>
<td>`image`</td>
<td>`ImageObjectData{FileID, Crop, Fit, AltText}`</td>
</tr>
<tr>
<td>`table`</td>
<td>`TableObjectData{Rows, Columns, Cells, Style}`</td>
</tr>
<tr>
<td>`chart`</td>
<td>`ChartObjectData{Binding, Spec, SnapshotFileID, AltText}`</td>
</tr>
<tr>
<td>`equation`</td>
<td>`EquationObjectData{Source, Format}`</td>
</tr>
<tr>
<td>`embed`</td>
<td>`EmbedObjectData{Provider, URL, SnapshotFileID, AltText}`</td>
</tr>
<tr>
<td>`group`</td>
<td>`GroupObjectData{ChildIDs}`</td>
</tr>
</table>
The tagged union is closed for validation but versioned for extension. Unknown future object payloads may be retained for round-trip compatibility but are not editable until the server supports their schema.
Groups are shallow ownership references over otherwise flat stable-ID objects. A child has at most one `ParentGroupID`. Cycles are invalid. Geometry remains slide-relative, so ungrouping does not alter visible placement.
## 6. Rich content and generated content
```go
type RichContent struct {
    Blocks []TextBlock
}

type GeneratedContentState struct {
    Prompt            RichContent
    Status            string // idle | queued | running | ready | error
    AcceptedContent   RichContent
    LastGoodContent   RichContent
    Evidence          []EvidenceRef
    GenerationToken   string
    SourceRevision    int64
    DisplayRevision   int64
    Diagnostic        *GenerationDiagnostic
}
```
Text may be directly edited or produced from a prompt. A refresh never clears accepted display while work is running. Failure keeps `LastGoodContent` visible and records a diagnostic. A generated result may be applied only if its generation token, source revision, and display revision still match; otherwise it is stale and discarded or surfaced for manual comparison.
Formula atoms use Formula's eight value kinds. Formula failures are diagnostics, not extra values. Behavior is supplied through a `FormulaEvaluator` port; the Slides package does not import Formula service logic.
## 7. Templates and styles
```go
type LayoutTemplate struct {
    ID      string
    Name    string
    Slots   []TemplateSlot
    Objects []TemplateObject
}

type TemplateSlot struct {
    ID           string
    Role         string // title | subtitle | body | media | chart | footer
    Frame        Frame
    DefaultStyle ObjectStyle
}

type TemplateBinding struct {
    TemplateID string
    SlotID     string
    Overrides  OverrideMask
}

type TemplateAssetRef struct {
    AssetID string
    Version int64
    Kind    string // slide | deck
}
```
`LayoutTemplate.Name` names the reusable layout/template; it never names a materialized Slide. Template objects are background or repeated presentation elements. Slots describe suggested placements. Binding an ordinary VisualObject to a slot does not move its identity into the template. `OverrideMask` makes inheritance explicit by field so later template edits can update unoverridden values without clobbering slide customization.
Style resolution order:
1. Deck theme defaults;
2. template object or slot defaults;
3. VisualObject style;
4. text block, run, or atom overrides.
Resolved style is a projection. Canonical state stores authored values and override masks.
The Template Library is a separate authority for named/versioned assets:
- a **slide template** can materialize a new slide or be applied to an existing slide under an explicit override policy;
- a **deck template** can initialize a new Deck or import sections/slides/templates into an existing Deck;
- saving the current slide or whole deck creates a library asset/version without renaming any source slide;
- upload/import may parse a source deck into a proposed template asset before publication.
Materialization allocates fresh section, slide, object, block, run, atom, mark, slot, and other runtime IDs. The source asset/version is retained only as provenance. Large saves/uploads/imports use durable jobs; their accepted deck mutations return as ordinary typed ChangeSets.
The exact package schema for template parameters, prompt blocks, and authored text is intentionally not fixed here. It requires a separate design decision and must not leak an unreviewed representation into the core aggregate.
## 8. Change submission
```go
type SlidesChangeSubmission struct {
    SubmissionID     string
    ExpectedRevision int64
    Operations       []SlidesOperation
}

type SlidesChangeSet struct {
    ID               string
    DeckID           string
    AuthorID         string
    AuthorName       string
    SubmissionID     string
    AuthoredRevision int64
    PriorRevision    int64
    Seq              int64
    CreatedAt        time.Time
    Operations       []SlidesOperation
    UndoOf           string
    RedoOf           string
    Summary          SlidesChangeSummary

    SubmissionHash   string
    InverseOps       []SlidesOperation
}
```
The server normalizes the operation list and hashes it with the deck, author, and expected revision. An identical retry returns the original ChangeSet. A reused `SubmissionID` with a different fingerprint conflicts.
Fresh changes require exact head revision. A distinct stale submission is admitted only when durable semantic footprints prove it disjoint from every intervening ChangeSet. Absence of proof is a conflict.
Undo and redo append current-head compensation. They are author-scoped by default and do not rewrite earlier ChangeSets. A rebase folds operations into Base and advances `BaseSeq` only.
## 9. Operation vocabulary
<table header-row="true">
<tr>
<td>Area</td>
<td>Operations</td>
</tr>
<tr>
<td>Deck</td>
<td>`rename_deck`, `set_canvas`, `set_theme`</td>
</tr>
<tr>
<td>Sections</td>
<td>`create_section`, `rename_section`, `move_section`, `delete_section`</td>
</tr>
<tr>
<td>Templates</td>
<td>`create_template`, `update_template`, `delete_template`, `bind_object_to_slot`, `detach_object_from_slot`</td>
</tr>
<tr>
<td>Slides</td>
<td>`insert_slide`, `duplicate_slide`, `move_slide`, `set_slide_hidden`, `set_slide_template`, `delete_slide`</td>
</tr>
<tr>
<td>Objects</td>
<td>`create_object`, `update_object_data`, `move_resize_object`, `reorder_object`, `group_objects`, `ungroup_objects`, `delete_object`</td>
</tr>
<tr>
<td>Text</td>
<td>`insert_text`, `delete_text`, `replace_text`, `set_text_marks`, `set_paragraph_style`</td>
</tr>
<tr>
<td>Notes</td>
<td>`replace_notes`, `splice_notes`, `set_notes_style`</td>
</tr>
<tr>
<td>Tables</td>
<td>`insert_table_rows`, `insert_table_columns`, `delete_table_rows`, `delete_table_columns`, `set_table_cell_content`</td>
</tr>
<tr>
<td>Generated content</td>
<td>`set_prompt`, `request_refresh`, `apply_generated_result`, `reject_generated_result`</td>
</tr>
<tr>
<td>Derived media</td>
<td>`apply_chart_snapshot`, `apply_embed_snapshot`, `apply_thumbnail`</td>
</tr>
</table>
There is deliberately no `rename_slide` or `set_slide_name` operation.
`delete_section` includes an explicit `RehomeSectionID`; empty means Unsectioned. `insert_slide` and `move_slide` include target `SectionID` and a same-group `AfterSlideID` anchor.
Bulk create, upload, or import may produce many canonical operations but must use the durable job path after configured limits. Every operation addresses Deck, Section, Slide, VisualObject, TextBlock, TextRun, and TextAtom by stable ID.
## 10. Conflict footprints
```go
type SlidesFootprint struct {
    DeckMetadata  bool
    Theme         bool
    TemplateIDs   []string
    SectionIDs    []string
    SlideIDs      []string
    ObjectIDs     []string
    TextTargets   []TextTarget
    NotesSlideIDs []string
    Structural    bool
}
```
- Edits to objects on different slides may rebase.
- Edits to distinct objects on one slide may rebase.
- Geometry or data changes to the same object conflict unless fields are explicitly mergeable.
- Text splices in the same atom may transform only when UTF-8 ranges are provably disjoint; ambiguous anchors conflict.
- Concurrent section or slide inserts after the same anchor are accepted and deterministically ranked.
- Renaming one section can rebase across object/text edits that do not depend on section metadata.
- Moving a slide conflicts with stale structural operations targeting that slide or deleting its source/target section, but does not change SlideID.
- Deleting a non-empty section conflicts when its explicit rehome target no longer exists or when stale operations depend on the old grouping.
- Deleting a slide conflicts with any stale operation targeting its objects or notes.
- Template changes conflict with stale operations that rely on the same inherited fields unless the stale operation explicitly overrides them.
- A generated result conflicts when its source, display, or generation token changed.
- Chart snapshot application is accepted only for the binding and revision it rendered.
Footprints are stored with ChangeSets for a configured rebase window. Compacted evidence is treated as unavailable, not reconstructed heuristically.
## 11. Behavior ports and jobs
```go
type FormulaEvaluator interface {
    Evaluate(ctx context.Context, scope Scope, req FormulaRequest) (FormulaResult, error)
}

type ContentProducer interface {
    Produce(ctx context.Context, scope Scope, req ProductionRequest) (ProductionResult, error)
}

type FileReader interface {
    GetFile(ctx context.Context, scope Scope, fileID string) (FileMetadata, error)
}

type ChartRenderer interface {
    Render(ctx context.Context, scope Scope, req ChartRenderRequest) (ChartSnapshot, error)
}

type TemplateCatalog interface {
    GetAsset(ctx context.Context, scope Scope, assetID string, version int64) (TemplatePackage, error)
    SaveSlide(ctx context.Context, scope Scope, req SaveSlideTemplateRequest) (TemplateAssetRef, error)
    SaveDeck(ctx context.Context, scope Scope, req SaveDeckTemplateRequest) (TemplateAssetRef, error)
}
```
Jobs are at-least-once:
- prompt production;
- chart and embed snapshots;
- image normalization;
- deck import/export;
- slide-template save/materialization;
- deck-template upload, save, and materialization;
- thumbnails;
- rebase.
Each job carries a stable job ID, deterministic submission ID, Deck ID when materializing into an existing deck, project scope, source revision, target generation token where applicable, and template asset/version provenance where applicable. Completion returns through a typed operation or a bounded accepted ChangeSet. Retried or late work cannot overwrite newer edits.
Exports, thumbnails, and template previews are derived artifacts. Their file references may be cached on the aggregate only when useful, but the deck model remains authoritative for re-rendering.
## 12. Persistence
Recommended normalized-base plus log schema:
<table header-row="true">
<tr>
<td>Table</td>
<td>Purpose</td>
</tr>
<tr>
<td>`slide_decks`</td>
<td>Aggregate metadata, project, revision, base sequence, canvas, lifecycle</td>
</tr>
<tr>
<td>`slide_base_templates`</td>
<td>Rebased deck-local layout template definitions</td>
</tr>
<tr>
<td>`slide_base_sections`</td>
<td>Rebased named section records and deterministic ranks</td>
</tr>
<tr>
<td>`slide_base_slides`</td>
<td>Rebased unnamed slide records, SectionID, rank, and notes</td>
</tr>
<tr>
<td>`slide_base_objects`</td>
<td>Rebased typed VisualObjects</td>
</tr>
<tr>
<td>`slide_base_text`</td>
<td>Rich-content blocks, runs, atoms, marks</td>
</tr>
<tr>
<td>`slide_change_sets`</td>
<td>Immutable ops, inverse ops, footprint, submission metadata</td>
</tr>
</table>
Required constraints:
- unique `(deck_id, seq)`;
- unique `(deck_id, submission_id)`;
- unique stable child IDs within a deck;
- unique section rank within a deck;
- unique slide rank within `(deck_id, section_id)`, treating empty SectionID as the Unsectioned group;
- foreign keys from named sections, slides, objects, and text projections to the deck;
- a non-empty slide `section_id` references a section in the same deck;
- project ID on every parent lookup;
- compare-and-swap update by `(project_id, deck_id, expected_revision)`.
There is no slide-name column or secondary name index.
Appending a ChangeSet, advancing the revision, and recording Activity occur in one SQLite transaction. The memory store must satisfy the identical behavioral contract.
A slide-specific read may load the target section metadata, one slide's rebased projection, pending deck/theme/template operations, and pending operations whose footprints intersect that section or slide. Full-deck reads remain available for search, export, template save, and rebase.
## 13. Service and API
```go
type Reader interface {
    GetDeck(ctx context.Context, scope Scope, deckID string) (DeckView, error)
    GetSlide(ctx context.Context, scope Scope, deckID, slideID string) (SlideView, error)
    History(ctx context.Context, scope Scope, deckID string, q HistoryQuery) ([]SlidesChangeSet, error)
}

type Mutator interface {
    CreateDeck(ctx context.Context, scope Scope, cmd CreateDeck) (Deck, error)
    Submit(ctx context.Context, scope Scope, deckID string, sub SlidesChangeSubmission) (SlidesChangeSet, error)
    Undo(ctx context.Context, scope Scope, deckID string, cmd UndoCommand) (SlidesChangeSet, error)
    Redo(ctx context.Context, scope Scope, deckID string, cmd RedoCommand) (SlidesChangeSet, error)
}
```
Canonical HTTP surface:
- `POST /slides`
- `GET /slides/{deckID}`
- `GET /slides/{deckID}/slides/{slideID}`
- `POST /slides/{deckID}/changes`
- `GET /slides/{deckID}/changes`
- `POST /slides/{deckID}/undo`
- `POST /slides/{deckID}/redo`
- `POST /slides/{deckID}/export`
- `POST /slides/{deckID}/slides/{slideID}/thumbnail`
The path uses the resource-family name while the returned aggregate is a Deck. Responses include revision, base sequence, stable IDs, resolved style, and derived-artifact freshness.
## 14. Agent operation surface
Expose bounded functions to:
- inspect deck structure, theme, templates, and one slide;
- insert, duplicate, move, or delete slides;
- create typed VisualObjects;
- edit geometry, styles, text, notes, and table cells;
- bind objects to template slots;
- attach media by stable file reference;
- set prompts and request generation;
- request chart snapshots or exports;
- submit, undo, and redo changes.
Agent functions compile to `SlidesChangeSubmission`. Reads always identify the deck revision. Writes require `SubmissionID` and `ExpectedRevision`. Large deck generation uses a durable job that commits bounded ChangeSets, preserving the same history and concurrency rules as human editing.
## 15. Validation and errors
Reject:
- wrong-project or missing IDs;
- negative or overflowing geometry;
- objects entirely outside configured canvas limits;
- group cycles or multiple parents;
- invalid template slot bindings;
- duplicate stable child IDs;
- unsupported object kinds or invalid typed payloads;
- malformed rich-text anchors;
- stale generated or snapshot results;
- deleting a template still referenced without an explicit detach policy;
- oversized synchronous payloads.
Stable codes include `deck_not_found`, `slide_not_found`, `object_not_found`, `revision_conflict`, `submission_reused`, `invalid_geometry`, `invalid_group`, `template_in_use`, `generated_result_stale`, and `limit_exceeded`.
## 16. Translation-ready Go contract
The earlier sections are normative. This section supplies the concrete Go patterns, persistence port, mutation algorithm, and representative DDL a coding agent should begin from.
### 16.1 Closed VisualObject data union
Use the same discriminator-plus-typed-payload technique as the current Document `BlockData` model. The interface is closed by an unexported method, and `VisualObject.UnmarshalJSON` chooses the concrete payload from `Kind`.
```go
type VisualObjectKind string

const (
    ObjectText     VisualObjectKind = "text"
    ObjectShape    VisualObjectKind = "shape"
    ObjectLine     VisualObjectKind = "line"
    ObjectImage    VisualObjectKind = "image"
    ObjectTable    VisualObjectKind = "table"
    ObjectChart    VisualObjectKind = "chart"
    ObjectEquation VisualObjectKind = "equation"
    ObjectEmbed    VisualObjectKind = "embed"
    ObjectGroup    VisualObjectKind = "group"
)

type VisualObjectData interface {
    visualObjectKind() VisualObjectKind
}

type TextObjectData struct {
    Content       RichContent  `json:"content"`
    AutoFit       AutoFitMode  `json:"autoFit"`
    VerticalAlign string       `json:"verticalAlign"`
    Insets        Insets       `json:"insets"`
    Generated     *GeneratedContentState `json:"generated,omitempty"`
}

func (TextObjectData) visualObjectKind() VisualObjectKind { return ObjectText }

type ShapeObjectData struct {
    ShapeType string      `json:"shapeType"`
    Content   RichContent `json:"content"`
    Fill      FillStyle   `json:"fill"`
    Stroke    StrokeStyle `json:"stroke"`
}

func (ShapeObjectData) visualObjectKind() VisualObjectKind { return ObjectShape }

type LineObjectData struct {
    Start       PointEMU    `json:"start"`
    End         PointEMU    `json:"end"`
    Stroke      StrokeStyle `json:"stroke"`
    StartMarker string      `json:"startMarker,omitempty"`
    EndMarker   string      `json:"endMarker,omitempty"`
}

func (LineObjectData) visualObjectKind() VisualObjectKind { return ObjectLine }

type ImageObjectData struct {
    FileID  string `json:"fileId"`
    Crop    Crop   `json:"crop"`
    Fit     string `json:"fit"`
    AltText string `json:"altText"`
}

func (ImageObjectData) visualObjectKind() VisualObjectKind { return ObjectImage }

type TableObjectData struct {
    RowIDs    []string    `json:"rowIds"`
    ColumnIDs []string    `json:"columnIds"`
    Cells     []TableCell `json:"cells"` // sparse by rowId + columnId
    Style     TableStyle  `json:"style"`
}

func (TableObjectData) visualObjectKind() VisualObjectKind { return ObjectTable }

type ChartObjectData struct {
    Binding        ChartBinding `json:"binding"`
    Spec           ChartSpec    `json:"spec"`
    SnapshotFileID string       `json:"snapshotFileId,omitempty"`
    SourceRevision int64        `json:"sourceRevision,omitempty"`
    AltText        string       `json:"altText"`
}

func (ChartObjectData) visualObjectKind() VisualObjectKind { return ObjectChart }

type EquationObjectData struct {
    Source string `json:"source"`
    Format string `json:"format"` // latex initially
}

func (EquationObjectData) visualObjectKind() VisualObjectKind { return ObjectEquation }

type EmbedObjectData struct {
    Provider       string `json:"provider"`
    URL            string `json:"url"`
    SnapshotFileID string `json:"snapshotFileId,omitempty"`
    AltText        string `json:"altText"`
}

func (EmbedObjectData) visualObjectKind() VisualObjectKind { return ObjectEmbed }

type GroupObjectData struct {
    ChildIDs []string `json:"childIds"`
}

func (GroupObjectData) visualObjectKind() VisualObjectKind { return ObjectGroup }
```
Define equally concrete payloads for line, equation, and embed. The decoder is not optional:
```go
func (o *VisualObject) UnmarshalJSON(data []byte) error {
    var raw struct {
        ID            string           `json:"id"`
        Kind          VisualObjectKind `json:"kind"`
        ParentGroupID string           `json:"parentGroupId"`
        Rank          string           `json:"rank"`
        Frame         Frame            `json:"frame"`
        Transform     Transform        `json:"transform"`
        Binding       TemplateBinding  `json:"binding"`
        Style         ObjectStyle      `json:"style"`
        Locked        bool             `json:"locked"`
        Hidden        bool             `json:"hidden"`
        Data          json.RawMessage  `json:"data"`
    }
    if err := json.Unmarshal(data, &raw); err != nil {
        return err
    }

    o.ID, o.Kind, o.ParentGroupID, o.Rank = raw.ID, raw.Kind, raw.ParentGroupID, raw.Rank
    o.Frame, o.Transform, o.Binding, o.Style = raw.Frame, raw.Transform, raw.Binding, raw.Style
    o.Locked, o.Hidden = raw.Locked, raw.Hidden

    switch raw.Kind {
    case ObjectText:
        var v TextObjectData
        if err := json.Unmarshal(raw.Data, &v); err != nil { return err }
        o.Data = v
    case ObjectShape:
        var v ShapeObjectData
        if err := json.Unmarshal(raw.Data, &v); err != nil { return err }
        o.Data = v
    case ObjectLine:
        var v LineObjectData
        if err := json.Unmarshal(raw.Data, &v); err != nil { return err }
        o.Data = v
    case ObjectImage:
        var v ImageObjectData
        if err := json.Unmarshal(raw.Data, &v); err != nil { return err }
        o.Data = v
    case ObjectTable:
        var v TableObjectData
        if err := json.Unmarshal(raw.Data, &v); err != nil { return err }
        o.Data = v
    case ObjectChart:
        var v ChartObjectData
        if err := json.Unmarshal(raw.Data, &v); err != nil { return err }
        o.Data = v
    case ObjectEquation:
        var v EquationObjectData
        if err := json.Unmarshal(raw.Data, &v); err != nil { return err }
        o.Data = v
    case ObjectEmbed:
        var v EmbedObjectData
        if err := json.Unmarshal(raw.Data, &v); err != nil { return err }
        o.Data = v
    case ObjectGroup:
        var v GroupObjectData
        if err := json.Unmarshal(raw.Data, &v); err != nil { return err }
        o.Data = v
    default:
        return fmt.Errorf("%w: %q", ErrUnsupportedObjectKind, raw.Kind)
    }
    return ValidateVisualObject(*o)
}
```
`MarshalJSON` may rely on the concrete interface value, but contract tests must round-trip every object kind. The server rejects a non-nil payload whose `visualObjectKind()` does not equal the outer `Kind`.
### 16.2 Slides-owned rich text
```go
type RichContent struct {
    Blocks []TextBlock `json:"blocks"`
}

type TextBlock struct {
    ID    string         `json:"id"`
    Runs  []TextRun      `json:"runs"`
    Marks []TextMark     `json:"marks,omitempty"`
    Style ParagraphStyle `json:"style"`
}

type TextRun struct {
    ID    string     `json:"id"`
    Atoms []TextAtom `json:"atoms"`
}

type TextAtom struct {
    ID   string       `json:"id"`
    Kind TextAtomKind `json:"kind"` // text | formula
    Text string       `json:"text"` // accepted display text
    Data TextAtomData `json:"data,omitempty"`
}

type TextAnchor struct {
    AtomID string `json:"atomId"`
    Offset int    `json:"offset"` // UTF-8 byte offset on a rune boundary
}

type TextMark struct {
    ID    string            `json:"id"`
    Kind  string            `json:"kind"`
    Attrs map[string]string `json:"attrs,omitempty"`
    Start TextAnchor        `json:"start"`
    End   TextAnchor        `json:"end"`
}
```
This model is intentionally local to Slides. Under the [Omega dependency rule](https://github.com/gccurtis/taurus-omega/blob/main/docs/orientation/README.md), wiring may translate it to Document or Chat shapes, but no capability imports another domain. Formula atom payloads and the Formula evaluator request/response are also Slides-owned DTOs.
### 16.3 Service construction
```go
type IDSource interface {
    New() string
}

type Enqueuer interface {
    Enqueue(ctx context.Context, request JobRequest) (Job, error)
}

type Service struct {
    store           Store
    formula         FormulaEvaluator
    producer        ContentProducer
    files           FileReader
    charts          ChartRenderer
    enqueuer        Enqueuer
    ids             IDSource
    now             func() time.Time
    rebaseThreshold int
    historyLimit    int
}

type Options struct {
    FormulaEvaluator FormulaEvaluator
    ContentProducer  ContentProducer
    FileReader       FileReader
    ChartRenderer    ChartRenderer
    Enqueuer         Enqueuer
    IDSource         IDSource
    RebaseThreshold  int
    HistoryLimit     int
}

func New(store Store, opts Options) (*Service, error) {
    if store == nil {
        return nil, errors.New("slides: store is required")
    }
    if opts.IDSource == nil {
        opts.IDSource = CryptoIDSource{}
    }
    if opts.RebaseThreshold < 1 {
        opts.RebaseThreshold = DefaultRebaseThreshold
    }
    return &Service{
        store:           store,
        formula:         opts.FormulaEvaluator,
        producer:        opts.ContentProducer,
        files:           opts.FileReader,
        charts:          opts.ChartRenderer,
        enqueuer:        opts.Enqueuer,
        ids:             opts.IDSource,
        now:             time.Now,
        rebaseThreshold: opts.RebaseThreshold,
        historyLimit:    opts.HistoryLimit,
    }, nil
}
```
Nil optional ports disable the associated Formula, generation, File, chart, export, or rebase operation with a stable error. Deck creation, direct editing, history, and in-memory tests remain available.
### 16.4 Typed operation envelope and payloads
```go
type OperationType string

type SlidesOperation struct {
    Type OperationType       `json:"type"`
    Data SlidesOperationData `json:"data"`
}

type SlidesOperationData interface {
    operationType() OperationType
}

const (
    OpRenameDeck           OperationType = "rename_deck"
    OpSetCanvas            OperationType = "set_canvas"
    OpSetTheme             OperationType = "set_theme"
    OpCreateSection        OperationType = "create_section"
    OpRenameSection        OperationType = "rename_section"
    OpMoveSection          OperationType = "move_section"
    OpDeleteSection        OperationType = "delete_section"
    OpCreateTemplate       OperationType = "create_template"
    OpUpdateTemplate       OperationType = "update_template"
    OpDeleteTemplate       OperationType = "delete_template"
    OpBindObjectToSlot     OperationType = "bind_object_to_slot"
    OpDetachObjectFromSlot OperationType = "detach_object_from_slot"
    OpInsertSlide          OperationType = "insert_slide"
    OpDuplicateSlide       OperationType = "duplicate_slide"
    OpMoveSlide            OperationType = "move_slide"
    OpSetSlideHidden       OperationType = "set_slide_hidden"
    OpSetSlideTemplate     OperationType = "set_slide_template"
    OpDeleteSlide          OperationType = "delete_slide"
    OpCreateObject         OperationType = "create_object"
    OpUpdateObjectData     OperationType = "update_object_data"
    OpMoveResizeObject     OperationType = "move_resize_object"
    OpReorderObject        OperationType = "reorder_object"
    OpGroupObjects         OperationType = "group_objects"
    OpUngroupObjects       OperationType = "ungroup_objects"
    OpDeleteObject         OperationType = "delete_object"
    OpInsertText           OperationType = "insert_text"
    OpDeleteText           OperationType = "delete_text"
    OpReplaceText          OperationType = "replace_text"
    OpSpliceText           OperationType = "splice_text"
    OpSetTextMarks         OperationType = "set_text_marks"
    OpSetParagraphStyle    OperationType = "set_paragraph_style"
    OpReplaceNotes         OperationType = "replace_notes"
    OpSpliceNotes          OperationType = "splice_notes"
    OpSetNotesStyle        OperationType = "set_notes_style"
    OpInsertTableRows      OperationType = "insert_table_rows"
    OpInsertTableColumns   OperationType = "insert_table_columns"
    OpDeleteTableRows      OperationType = "delete_table_rows"
    OpDeleteTableColumns   OperationType = "delete_table_columns"
    OpSetTableCellContent  OperationType = "set_table_cell_content"
    OpSetPrompt            OperationType = "set_prompt"
    OpRequestRefresh       OperationType = "request_refresh"
    OpApplyGenerated       OperationType = "apply_generated_result"
    OpRejectGenerated      OperationType = "reject_generated_result"
    OpApplyChartSnapshot   OperationType = "apply_chart_snapshot"
    OpApplyEmbedSnapshot   OperationType = "apply_embed_snapshot"
    OpApplyThumbnail       OperationType = "apply_thumbnail"
)

type CreateSectionOp struct {
    Section SlideSection `json:"section"`
    AfterID string       `json:"afterId,omitempty"`
}
func (CreateSectionOp) operationType() OperationType { return OpCreateSection }

type RenameSectionOp struct {
    SectionID string `json:"sectionId"`
    Name      string `json:"name"`
}
func (RenameSectionOp) operationType() OperationType { return OpRenameSection }

type MoveSectionOp struct {
    SectionID string `json:"sectionId"`
    AfterID   string `json:"afterId,omitempty"`
}
func (MoveSectionOp) operationType() OperationType { return OpMoveSection }

type DeleteSectionOp struct {
    SectionID       string `json:"sectionId"`
    RehomeSectionID string `json:"rehomeSectionId,omitempty"` // empty -> Unsectioned
}
func (DeleteSectionOp) operationType() OperationType { return OpDeleteSection }

type InsertSlideOp struct {
    Slide   Slide  `json:"slide"`
    AfterID string `json:"afterId,omitempty"` // same SectionID group
}
func (InsertSlideOp) operationType() OperationType { return OpInsertSlide }

type MoveSlideOp struct {
    SlideID   string `json:"slideId"`
    SectionID string `json:"sectionId,omitempty"` // empty -> Unsectioned
    AfterID   string `json:"afterId,omitempty"`    // same target group
}
func (MoveSlideOp) operationType() OperationType { return OpMoveSlide }

type CreateObjectOp struct {
    SlideID string       `json:"slideId"`
    Object  VisualObject `json:"object"`
    AfterID string       `json:"afterId,omitempty"`
}
func (CreateObjectOp) operationType() OperationType { return OpCreateObject }

type MoveResizeObjectOp struct {
    SlideID  string    `json:"slideId"`
    ObjectID string    `json:"objectId"`
    Frame    Frame     `json:"frame"`
    Transform Transform `json:"transform"`
}
func (MoveResizeObjectOp) operationType() OperationType { return OpMoveResizeObject }

type SpliceTextOp struct {
    SlideID  string `json:"slideId"`
    ObjectID string `json:"objectId"`
    BlockID  string `json:"blockId"`
    AtomID   string `json:"atomId"`
    Start    int    `json:"start"` // UTF-8 byte offset
    End      int    `json:"end"`
    Text     string `json:"text"`
}
func (SpliceTextOp) operationType() OperationType { return OpSpliceText }

type ReplaceNotesOp struct {
    SlideID string    `json:"slideId"`
    Notes   TextBlock `json:"notes"`
}
func (ReplaceNotesOp) operationType() OperationType { return OpReplaceNotes }

type ApplyGeneratedResultOp struct {
    SlideID         string        `json:"slideId"`
    ObjectID        string        `json:"objectId"`
    GenerationToken string        `json:"generationToken"`
    SourceRevision  int64         `json:"sourceRevision"`
    DisplayRevision int64         `json:"displayRevision"`
    Content         RichContent   `json:"content"`
    Evidence        []EvidenceRef `json:"evidence,omitempty"`
}
func (ApplyGeneratedResultOp) operationType() OperationType { return OpApplyGenerated }
```
The payload declarations above cover operations with the most important structural and concurrency invariants. Every constant in the closed vocabulary must receive an equally concrete Slides-owned payload before the operation is enabled. Implement `SlidesOperation.UnmarshalJSON` as a closed switch. Server normalization fills missing section, slide, object, block, run, atom, and mark IDs before hashing the accepted ChangeSet representation. Client submission hashing occurs before those server IDs are assigned, matching the Document idempotency contract.
### 16.5 Pure apply and validation
```go
func ApplyOperations(
    before DeckBase,
    ops []SlidesOperation,
    ids IDSource,
) (after DeckBase, inverse []SlidesOperation, fp SlidesFootprint, err error) {
    after = before.DeepCopy()
    for _, op := range ops {
        var inv []SlidesOperation
        var part SlidesFootprint

        switch data := op.Data.(type) {
        case CreateSectionOp:
            inv, part, err = applyCreateSection(&after, data, ids)
        case RenameSectionOp:
            inv, part, err = applyRenameSection(&after, data)
        case MoveSectionOp:
            inv, part, err = applyMoveSection(&after, data)
        case DeleteSectionOp:
            inv, part, err = applyDeleteAndRehomeSection(&after, data)
        case InsertSlideOp:
            inv, part, err = applyInsertSlide(&after, data, ids)
        case MoveSlideOp:
            inv, part, err = applyMoveSlide(&after, data)
        case CreateObjectOp:
            inv, part, err = applyCreateObject(&after, data, ids)
        case MoveResizeObjectOp:
            inv, part, err = applyGeometry(&after, data)
        case SpliceTextOp:
            inv, part, err = applyTextSplice(&after, data, ids)
        case ReplaceNotesOp:
            inv, part, err = applyReplaceNotes(&after, data)
        case ApplyGeneratedResultOp:
            inv, part, err = applyGeneratedResult(&after, data)
        default:
            err = ErrUnsupportedOperation
        }
        if err != nil {
            return DeckBase{}, nil, SlidesFootprint{}, err
        }
        inverse = append(inv, inverse...)
        fp.Merge(part)
    }
    if err := ValidateDeckBase(after); err != nil {
        return DeckBase{}, nil, SlidesFootprint{}, err
    }
    return after, inverse, fp.Normalize(), nil
}
```
Validation includes:
- positive canvas and frame dimensions;
- bounded EMU arithmetic without overflow;
- unique stable IDs;
- unique section ranks within the deck and unique slide ranks within each SectionID group;
- every non-empty Slide.SectionID resolving to a section in the same deck;
- every section name being non-empty after normalization; duplicate names may be allowed but require disambiguation by ID;
- no slide-name field or slide-rename operation in accepted payloads;
- every `AfterSlideID` resolving within the target SectionID group;
- delete-section rehome target existing, differing from the deleted section, and receiving all member slides atomically;
- object data kind matching;
- valid group topology;
- valid template bindings and override masks;
- valid UTF-8 anchors and mark ranges;
- table cells referencing existing row and column IDs;
- chart bindings carrying a resource ID and revision;
- no missing File reference at apply time when a File reader is configured.
### 16.6 Store port
```go
type Store interface {
    Create(
        ctx context.Context,
        scope Scope,
        deck Deck,
        activity ActivityFact,
    ) error

    DeckByID(
        ctx context.Context,
        scope Scope,
        deckID string,
    ) (Deck, error)

    ChangeSetsSince(
        ctx context.Context,
        scope Scope,
        deckID string,
        seq int64,
    ) ([]SlidesChangeSet, error)

    ChangeSetBySubmission(
        ctx context.Context,
        scope Scope,
        deckID, submissionID string,
    ) (SlidesChangeSet, error)

    ChangeSetByID(
        ctx context.Context,
        scope Scope,
        deckID, changeSetID string,
    ) (SlidesChangeSet, error)

    AppendChangeSet(
        ctx context.Context,
        scope Scope,
        expectedRevision int64,
        change SlidesChangeSet,
        activity ActivityFact,
    ) error

    ReplaceBase(
        ctx context.Context,
        scope Scope,
        deckID string,
        expectedBaseSeq, newBaseSeq int64,
        base DeckBase,
    ) error

    SlideProjection(
        ctx context.Context,
        scope Scope,
        deckID, slideID string,
    ) (SlideProjection, error)
}

type Scope struct {
    ProjectID string
}
```
`AppendChangeSet` must perform revision CAS, ChangeSet insertion, head advancement, and Activity insertion in one transaction. `ReplaceBase` performs a physical compare-and-swap on `base_seq`; it never advances logical `revision`.
### 16.7 Submission and generated-result flow
```go
func (s *Service) Submit(
    ctx context.Context,
    scope Scope,
    deckID string,
    author Actor,
    sub SlidesChangeSubmission,
) (SlidesChangeSet, error) {
    hash, err := ValidateAndHashSubmission(sub)
    if err != nil {
        return SlidesChangeSet{}, err
    }
    if prior, ok, err := s.findRetry(ctx, scope, deckID, sub.SubmissionID); err != nil {
        return SlidesChangeSet{}, err
    } else if ok {
        if prior.SubmissionHash != hash {
            return SlidesChangeSet{}, ErrSubmissionConflict
        }
        return prior, nil
    }

    head, intervening, err := s.resolveHead(ctx, scope, deckID)
    if err != nil {
        return SlidesChangeSet{}, err
    }
    if head.Revision != sub.ExpectedRevision {
        if err := ProveDisjoint(sub, intervening, sub.ExpectedRevision); err != nil {
            return SlidesChangeSet{}, NewRevisionConflict(head.Revision, err)
        }
    }

    ops := AssignStableIDs(sub.Operations, s.ids)
    _, inverse, footprint, err := ApplyOperations(head.Base, ops, s.ids)
    if err != nil {
        return SlidesChangeSet{}, err
    }
    cs := NewChangeSet(head, author, sub, ops, inverse, footprint, hash, s.now())
    if err := s.store.AppendChangeSet(
        ctx, scope, head.Revision, cs, ActivityFor(cs),
    ); err != nil {
        return SlidesChangeSet{}, TranslateStoreConflict(err, head.Revision)
    }
    s.enqueueDerivedWork(scope, deckID, cs)
    return cs, nil
}

func (s *Service) ApplyProduction(
    ctx context.Context,
    scope Scope,
    result ProductionResult,
) (SlidesChangeSet, error) {
    deck, err := s.GetDeck(ctx, scope, result.DeckID)
    if err != nil {
        return SlidesChangeSet{}, err
    }
    obj := deck.MustObject(result.SlideID, result.ObjectID)
    generated := obj.MustGeneratedState()
    if generated.GenerationToken != result.GenerationToken ||
       generated.SourceRevision != result.SourceRevision ||
       generated.DisplayRevision != result.DisplayRevision {
        return SlidesChangeSet{}, ErrGeneratedResultStale
    }
    return s.Submit(ctx, scope, result.DeckID, SystemActor, SlidesChangeSubmission{
        SubmissionID:     "production:" + result.JobID,
        ExpectedRevision: deck.Revision,
        Operations: []SlidesOperation{NewApplyGeneratedResult(result)},
    })
}
```
The system completion is ordinary history. It does not update an object out of band.
### 16.8 Undo, redo, and rebase
```go
func (s *Service) Undo(
    ctx context.Context,
    scope Scope,
    deckID, authorID, targetID string,
) (SlidesChangeSet, error) {
    head, err := s.store.DeckByID(ctx, scope, deckID)
    if err != nil {
        return SlidesChangeSet{}, err
    }
    target, err := s.store.ChangeSetByID(ctx, scope, deckID, targetID)
    if err != nil {
        return SlidesChangeSet{}, err
    }
    if target.AuthorID != authorID {
        return SlidesChangeSet{}, ErrUndoForbidden
    }
    if target.Seq != head.Revision {
        return SlidesChangeSet{}, ErrUndoConflict
    }
    if target.UndoOf != "" || len(target.InverseOps) == 0 {
        return SlidesChangeSet{}, ErrUndoUnavailable
    }
    return s.submitCompensation(
        ctx, scope, head, authorID,
        "undo:"+target.ID,
        target.InverseOps,
        target.ID, "",
    )
}

func (s *Service) Rebase(
    ctx context.Context,
    scope Scope,
    deckID string,
) error {
    stored, err := s.store.DeckByID(ctx, scope, deckID)
    if err != nil {
        return err
    }
    changes, err := s.store.ChangeSetsSince(ctx, scope, deckID, stored.BaseSeq)
    if err != nil {
        return err
    }
    through := stored.Revision
    resolved, err := Replay(stored.Base, ChangeSetsThrough(changes, through))
    if err != nil {
        return err
    }
    return s.store.ReplaceBase(
        ctx, scope, deckID,
        stored.BaseSeq, through, resolved,
    )
}
```
Redo compensates the current-head undo and records `RedoOf`. Undo never attempts to erase an earlier revision from beneath later work. Rebase jobs use deterministic keys and may safely rerun; a successful rebase advances `BaseSeq` only.
### 16.9 Representative SQLite DDL
```sql
CREATE TABLE slide_decks (
    id             TEXT PRIMARY KEY,
    project_id     TEXT NOT NULL,
    name           TEXT NOT NULL,
    creator_id     TEXT NOT NULL,
    creator_name   TEXT NOT NULL,
    revision       INTEGER NOT NULL DEFAULT 0,
    base_seq       INTEGER NOT NULL DEFAULT 0,
    lifecycle      TEXT NOT NULL DEFAULT 'active',
    canvas_json    BLOB NOT NULL,
    theme_json     BLOB NOT NULL,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL,
    trashed_at     TEXT
);
CREATE INDEX slide_decks_project_updated
    ON slide_decks(project_id, updated_at DESC, id);

CREATE TABLE slide_base_templates (
    deck_id       TEXT NOT NULL,
    id            TEXT NOT NULL,
    template_json BLOB NOT NULL,
    PRIMARY KEY (deck_id, id),
    FOREIGN KEY (deck_id) REFERENCES slide_decks(id) ON DELETE CASCADE
);

CREATE TABLE slide_base_sections (
    deck_id TEXT NOT NULL,
    id      TEXT NOT NULL,
    rank    TEXT NOT NULL,
    name    TEXT NOT NULL,
    PRIMARY KEY (deck_id, id),
    UNIQUE (deck_id, rank),
    FOREIGN KEY (deck_id) REFERENCES slide_decks(id) ON DELETE CASCADE
);

CREATE TABLE slide_base_slides (
    deck_id       TEXT NOT NULL,
    id            TEXT NOT NULL,
    section_id    TEXT NOT NULL DEFAULT '',
    rank          TEXT NOT NULL,
    template_id   TEXT,
    notes_json    BLOB NOT NULL,
    hidden        INTEGER NOT NULL,
    slide_json    BLOB NOT NULL,
    PRIMARY KEY (deck_id, id),
    UNIQUE (deck_id, section_id, rank),
    FOREIGN KEY (deck_id) REFERENCES slide_decks(id) ON DELETE CASCADE
);
CREATE INDEX slide_base_slides_order
    ON slide_base_slides(deck_id, section_id, rank, id);

CREATE TABLE slide_base_objects (
    deck_id         TEXT NOT NULL,
    slide_id        TEXT NOT NULL,
    id              TEXT NOT NULL,
    kind            TEXT NOT NULL,
    parent_group_id TEXT,
    rank            TEXT NOT NULL,
    frame_json      BLOB NOT NULL,
    object_json     BLOB NOT NULL,
    PRIMARY KEY (deck_id, id),
    FOREIGN KEY (deck_id) REFERENCES slide_decks(id) ON DELETE CASCADE
);
CREATE INDEX slide_base_objects_slide_order
    ON slide_base_objects(deck_id, slide_id, rank, id);

CREATE TABLE slide_change_sets (
    id                TEXT PRIMARY KEY,
    deck_id           TEXT NOT NULL,
    project_id        TEXT NOT NULL,
    submission_id     TEXT NOT NULL,
    submission_hash   TEXT NOT NULL,
    author_id         TEXT NOT NULL,
    author_name       TEXT NOT NULL,
    authored_revision INTEGER NOT NULL,
    prior_revision    INTEGER NOT NULL,
    seq               INTEGER NOT NULL,
    operations_json   BLOB NOT NULL,
    inverse_ops_json  BLOB NOT NULL,
    footprint_json    BLOB NOT NULL,
    undo_of           TEXT,
    redo_of           TEXT,
    summary_json      BLOB NOT NULL,
    created_at        TEXT NOT NULL,
    UNIQUE (deck_id, seq),
    UNIQUE (deck_id, submission_id),
    FOREIGN KEY (deck_id) REFERENCES slide_decks(id) ON DELETE CASCADE
);
```
SQLite cannot express the same-deck optional section foreign key cleanly while reserving empty string for Unsectioned without a synthetic row. Enforce `section_id == '' || sectionExists(deck_id, section_id)` in the transactional store and contract tests. A later normalized schema may use nullable `section_id` plus a composite foreign key.
Rich content may remain embedded within `object_json` and `notes_json` for the first increment because it is always read with its object or slide. Normalize atoms only if later queries require cross-object text addressing without loading the parent payload.
### 16.10 Endpoint DTO example
```go
type SubmitChangesRequest struct {
    SubmissionID     string            `json:"submissionId"`
    ExpectedRevision int64             `json:"expectedRevision"`
    Operations       []SlidesOperation `json:"operations"`
}

type SubmitChangesResponse struct {
    ChangeSetID string              `json:"changeSetId"`
    Revision    int64               `json:"revision"`
    ChangeSet   SlidesChangeSetView `json:"changeSet"`
}

func (h *Handler) SubmitChanges(
    ctx context.Context,
    access AccessContext,
    deckID string,
    req SubmitChangesRequest,
) (SubmitChangesResponse, error) {
    scope := Scope{ProjectID: access.ProjectID}
    actor := Actor{ID: access.UserID, Name: access.UserName}
    cs, err := h.slides.Submit(ctx, scope, deckID, actor, SlidesChangeSubmission{
        SubmissionID:     req.SubmissionID,
        ExpectedRevision: req.ExpectedRevision,
        Operations:       req.Operations,
    })
    if err != nil {
        return SubmitChangesResponse{}, MapEndpointError(err)
    }
    return SubmitChangesResponse{
        ChangeSetID: cs.ID,
        Revision:    cs.Seq,
        ChangeSet:   ProjectChangeSet(cs),
    }, nil
}
```
The transport gate constructs `AccessContext`; request JSON cannot choose a project or author. Handlers contain mapping only, with no mutation or conflict policy.
## 17. Acceptance criteria
1. The hierarchy is unambiguously `Deck → SlideSection → Slide → VisualObject`, with deterministic Unsectioned projection behavior.
2. Sections have stable IDs, names, and ranks; slides have stable IDs and ranks but no names.
3. Slide ordinals are derived and never accepted as durable mutation identity.
4. Moving/reordering a slide never changes SlideID.
5. `Block` appears only in rich text and notes.
6. All geometry uses deterministic integer EMU.
7. Every edit addresses stable IDs and commits through a ChangeSet.
8. Retries are idempotent and stale edits fail closed without proof.
9. Disjoint section/slide/object edits can rebase when footprints prove safety.
10. Deleting a non-empty section requires explicit atomic rehoming.
11. Undo/redo append compensation at the current head.
12. Rebase changes only the physical Base boundary.
13. Generated content remains visible during refresh and cannot be overwritten by stale jobs.
14. Layout templates preserve explicit overrides, and template names never become slide names.
15. Slide-template and deck-template materialization allocate fresh runtime IDs and use normal validation/ChangeSets.
16. The prompt-block/template-parameter representation remains an explicit later design decision.
17. Persistence, revision advancement, and Activity are atomic.
18. Memory and SQLite stores share contract tests.
19. Resource, search, activity, file, Formula, agent, annotation, and template-library integrations occur through wiring adapters.
## Sources
- [Taurus Omega orientation and dependency rules](https://github.com/gccurtis/taurus-omega/blob/main/docs/orientation/README.md)
- [Taurus Omega runtime model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/runtime-model.md)
- [Current Document model](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/model.go)
- [Current Document submission contract](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/submission.go)
- [Current Document SQLite store](https://github.com/gccurtis/taurus-omega/blob/main/core/platform/storage/sqlite/sqlite_document.go)
- [Formula data model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/capabilities/formula/data-model.md)
- <mention-page url="https://app.notion.com/p/3a5b6410e50281cf9c47ea916a10241d"/>
- <mention-page url="https://app.notion.com/p/3a6b6410e50281d3aff6cb92f54476cd"/>

