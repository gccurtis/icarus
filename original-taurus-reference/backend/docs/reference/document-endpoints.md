# Document Endpoints Reference

All endpoints are scoped to the session's selected project and require
authentication. Write operations require `owner` or `edit` role. Responses are
JSON.

## Shared types

### Document

```go
type Document struct {
    ID        string    `json:"id"`                  // server-assigned hex ID
    ProjectID string    `json:"projectId"`           // owning project
    Name      string    `json:"name"`                // canonical display name
    Base      Base      `json:"base"`                // resolved content (rows, layout, styles)
    CreatedAt time.Time `json:"createdAt"`           // RFC3339
    UpdatedAt time.Time `json:"updatedAt"`           // RFC3339
    Revision  int64     `json:"revision"`            // latest change-set sequence
    Lifecycle string    `json:"lifecycle,omitempty"` // "active" (default) or "trashed"
    TrashedAt time.Time `json:"trashedAt,omitempty"` // when moved to trash; zero when active
}
```

### Base

```go
type Base struct {
    PageLayout    PageLayout    `json:"pageLayout"`
    LayoutRules   LayoutRules   `json:"layoutRules"`
    StyleRegistry StyleRegistry `json:"styleRegistry,omitempty"` // named style definitions
    Header        []Row         `json:"header,omitempty"`        // recurring header region
    Footer        []Row         `json:"footer,omitempty"`        // recurring footer region
    Rows          []Row         `json:"rows"`                    // body content
}
```

### PageLayout

```go
type PageLayout struct {
    Width        LayoutUnit `json:"width"`        // typographic points
    Height       LayoutUnit `json:"height"`
    MarginTop    LayoutUnit `json:"marginTop"`
    MarginRight  LayoutUnit `json:"marginRight"`
    MarginBottom LayoutUnit `json:"marginBottom"`
    MarginLeft   LayoutUnit `json:"marginLeft"`
}
```

`LayoutUnit` is an integer representing typographic points (1/72 inch).

### LayoutRules

```go
type LayoutRules struct {
    MaxFontHeight LayoutUnit `json:"maxFontHeight"` // caps vertical span of a row
    MinRowPadding LayoutUnit `json:"minRowPadding"` // minimum empty space within a row
    CharWidth     LayoutUnit `json:"charWidth"`     // average mono-space glyph width for wrapping
}
```

### Row

```go
type Row struct {
    ID     string   `json:"id"`              // stable identifier
    Style  RowStyle `json:"style"`           // height, flow, page-break, keep-with-next
    Tracks []Track  `json:"tracks,omitempty"` // horizontal proportion columns
    Blocks []Block  `json:"blocks"`           // ordered content blocks
}
```

### Track

```go
type Track struct {
    Weight int `json:"weight"` // proportional width share; 0 = auto
    MinW   int `json:"minW"`   // minimum width in points
    Gap    int `json:"gap"`    // right-hand gutter in points
}
```

### Block

```go
type Block struct {
    ID       string        `json:"id"`
    Kind     string        `json:"kind"`              // see Block kinds below
    Style    BlockStyle    `json:"style"`             // alignment, line-height
    StyleRef *BlockStyleRef `json:"styleRef,omitempty"` // reference to a named style in the registry
    Inferred bool          `json:"inferred,omitempty"`  // server-inferred prompt direction
    Atoms    []Atom        `json:"atoms,omitempty"`     // inline content (text, formulas, marks)
    Marks    []Mark        `json:"marks,omitempty"`     // ad-hoc inline formatting
    Data     BlockData     `json:"data,omitempty"`      // kind-specific payload (quote, code, image, etc.)
}
```

Block kinds: `paragraph`, `heading_1` through `heading_6`, `quote`, `code`,
`divider`, `callout`, `list_item`, `image`, `prompt`.

### Atom

```go
type Atom struct {
    ID           string       `json:"id"`
    Kind         string       `json:"kind"`                    // "text", "formula"
    Text         string       `json:"text,omitempty"`          // display string
    Formula      *FormulaData `json:"formula,omitempty"`       // formula binding and result
}
```

### FormulaData

```go
type FormulaData struct {
    Expression    string            `json:"expression"`              // raw formula expression
    Dependencies  []FormulaDep      `json:"dependencies,omitempty"`  // named formula references
    Result        *FormulaResult    `json:"result,omitempty"`        // last evaluated value or error
    State         string            `json:"state"`                   // "pending", "evaluated", "error"
    LastGoodText  string            `json:"lastGoodText,omitempty"`  // fallback display when in error
    DependencyFingerprints map[string]string `json:"dependencyFingerprints,omitempty"`
}
```

### PromptData (block.Data when kind is "prompt")

```go
type PromptData struct {
    Instruction       string              `json:"instruction"`                 // user-authored direction
    Direction         string              `json:"direction"`                   // inferred prompt role
    EvidenceHistory   []EvidenceSpan      `json:"evidenceHistory,omitempty"`  // grounded citations
    OutputRevisions   []PromptOutputRevision `json:"outputRevisions,omitempty"` // generated output history
    CurrentText       string              `json:"currentText,omitempty"`      // visible output text
    LastGoodText      string              `json:"lastGoodText,omitempty"`     // fallback restore target
    SourceVersions    []PromptSourceVersion `json:"sourceVersions,omitempty"` // knowledge source snapshots
    Usage             Usage               `json:"usage,omitempty"`            // model token cost
    Insufficient      bool                `json:"insufficient,omitempty"`     // retrieval found nothing
    Contradiction     bool                `json:"contradiction,omitempty"`    // contradictory evidence
}
```

### PromptOutputRevision

```go
type PromptOutputRevision struct {
    RevisionID string `json:"revisionId"` // immutable ID
    Text       string `json:"text"`       // generated content
    CreatedAt  string `json:"createdAt"`  // RFC3339 timestamp
    Origin     string `json:"origin"`     // "initial", "refresh", "restored"
}
```

### EvidenceSpan

```go
type EvidenceSpan struct {
    SourceType string  `json:"sourceType"` // "document", "file", etc.
    SourceID   string  `json:"sourceId"`
    Start      int     `json:"start"`      // byte offset within source
    End        int     `json:"end"`
    Text       string  `json:"text"`       // excerpt
    Relevance  float64 `json:"relevance"`  // 0.0-1.0 similarity score
}
```

### Mark

```go
type Mark struct {
    ID      string `json:"id"`
    Kind    string `json:"kind"`              // "bold", "italic", "underline", "strikethrough", "code"
    Anchor  Anchor `json:"anchor"`            // start position
    EndAnchor Anchor `json:"endAnchor"`       // end position (exclusive)
    Data    MarkData `json:"data,omitempty"`  // kind-specific payload (e.g. link URL)
}
```

### Anchor

```go
type Anchor struct {
    AtomID string `json:"atomId"` // which atom the position references
    Offset int    `json:"offset"` // byte offset within that atom
}
```

### StyleOverview

```go
type StyleOverview struct {
    ID          string `json:"id"`
    Name        string `json:"name"`
    Description string `json:"description,omitempty"`
    DefaultFor  string `json:"defaultFor,omitempty"` // block kind this is the default for
}
```

### StyleDefinition (full definition)

```go
type StyleDefinition struct {
    ID          string          `json:"id"`
    Name        string          `json:"name"`
    Description string          `json:"description,omitempty"`
    DefaultFor  string          `json:"defaultFor,omitempty"`
    BlockStyle  BlockStyle      `json:"blockStyle"`
}
```

### BlockStyle

```go
type BlockStyle struct {
    HorizontalAlign HorizontalAlignment `json:"horizontalAlign"` // "left", "center", "right", "justify"
    VerticalAlign   VerticalAlignment   `json:"verticalAlign"`   // "top", "middle", "bottom"
    LineHeight      LayoutUnit          `json:"lineHeight,omitempty"`
}
```

### StyleRegistry

```go
type StyleRegistry map[string]*StyleDefinition  // keyed by style ID
```

### BlockStyleRef

```go
type BlockStyleRef struct {
    StyleID   string         `json:"styleId"`   // references a key in StyleRegistry
    Overrides *StyleOverrides `json:"overrides,omitempty"` // per-block deviations
}
```

### StyleOverrides

```go
type StyleOverrides struct {
    HorizontalAlign *HorizontalAlignment `json:"horizontalAlign,omitempty"`
    VerticalAlign   *VerticalAlignment   `json:"verticalAlign,omitempty"`
    LineHeight      *LayoutUnit          `json:"lineHeight,omitempty"`
}
```

### BlockData (kind-specific payloads)

Only stored for blocks where the kind has typed data beyond the generic
fields. Key variants:

- **Quote** — `QuoteData{ Source string, SourceURL string, Attribution string }`
- **Code** — `CodeData{ Language string }`
- **Divider** — `DividerData{ Thickness int, Style string }` (style: "solid", "dashed", "dotted")
- **Callout** — `CalloutData{ Type string, Icon string, Title string }` (type: "info", "warning", "success", "error")
- **List item** — `ListData{ ListType string, Ordinal int, Checked *bool, Indent int }` (listType: "bulleted", "numbered", "checklist")
- **Image** — `ImageData{ URL string, Alt string, Width int, Height int }`

### ChangeSet

```go
type ChangeSet struct {
    ID               string        `json:"id"`               // server-assigned
    DocumentID       string        `json:"documentId"`
    AuthorID         string        `json:"authorId"`
    AuthorName       string        `json:"authorName"`
    SubmissionID     string        `json:"submissionId,omitempty"` // client idempotency key
    AuthoredRevision int64         `json:"authoredRevision"`       // the head the client observed
    PriorRevision    int64         `json:"priorRevision"`          // actual head at admission (differs after rebase)
    Seq              int64         `json:"seq"`                    // monotonic sequence within document
    CreatedAt        time.Time     `json:"createdAt"`
    Ops              []ChangeOp    `json:"ops"`                    // the applied operations
    UndoOf           string        `json:"undoOf,omitempty"`       // changeSetID this compensates
    RedoOf           string        `json:"redoOf,omitempty"`       // undo changeSetID this compensates
    Summary          ChangeSummary `json:"summary"`                // bounded operation metadata
}
```

### ChangeOp

```go
type ChangeOp struct {
    Op OpType `json:"op"` // the operation kind (see OpType table below)

    // Structural anchors — each op references targets by ID.
    AfterRow, RowID         string  // for row ops
    AfterBlock, BlockID     string  // for block ops
    AfterAtom, AtomID       string  // for atom ops
    MarkID                  string  // for mark ops
    FromRowID, FromAfterRow string  // for moves
    FromBlockID, FromAfterBlock string
    FromAfterAtom           string
    OtherBlockID            string  // for split/join
    StyleID                 string  // for style ops
    ReplacementStyleID      string  // for style replacement
    DefaultBlockKind        string  // for style default assignment

    // Payloads — each op kind carries the relevant embedded value(s).
    Row            *Row             `json:"row,omitempty"`
    Block          *Block           `json:"block,omitempty"`
    Atom           *Atom            `json:"atom,omitempty"`
    Mark           *Mark            `json:"mark,omitempty"`
    Style          *StyleDefinition `json:"style,omitempty"`
    StyleRef       *BlockStyleRef   `json:"styleRef,omitempty"`
    StyleOverrides *StyleOverrides  `json:"styleOverrides,omitempty"`
    PageLayout     *PageLayout      `json:"pageLayout,omitempty"`
    Tracks         []Track          `json:"tracks,omitempty"`
    DeltaWeight    int              `json:"deltaWeight,omitempty"`
    PageBreak      *bool            `json:"pageBreak,omitempty"`
    KeepWithNext   *bool            `json:"keepWithNext,omitempty"`
    RevisionID     string           `json:"revisionId,omitempty"`
    Header         []Row            `json:"header,omitempty"`
    Footer         []Row            `json:"footer,omitempty"`
    Formula        *FormulaData     `json:"formula,omitempty"`
    SetKind        *string          `json:"setKind,omitempty"`
    SetText        *string          `json:"setText,omitempty"`
    InsertText     *string          `json:"insertText,omitempty"`
    LineHeight     *LayoutUnit      `json:"lineHeight,omitempty"`
    HorizontalAlign *HorizontalAlignment `json:"horizontalAlign,omitempty"`
    VerticalAlign   *VerticalAlignment   `json:"verticalAlign,omitempty"`

    // Offsets — byte ranges within atoms.
    StartOffset, EndOffset int

    // Content hashes — used by splice_atom_text for precondition checks.
    ExpectedTextHash      string `json:"expectedTextHash,omitempty"`
    ExpectedOtherTextHash string `json:"expectedOtherTextHash,omitempty"`
    ExpectedMarkHash      string `json:"expectedMarkHash,omitempty"`
}
```

### OpType values

| OpType | Category | What it does |
|---|---|---|
| `insert_row` | structure | Insert a new Row after `AfterRow` (or at start if empty) |
| `delete_row` | structure | Delete the Row identified by `RowID` |
| `insert_block` | structure | Insert a Block after `AfterBlock` into Row `RowID` |
| `delete_block` | structure | Delete the Block identified by `BlockID` |
| `set_block` | structure | Replace the Block identified by `BlockID` with a new one (preserves ID) |
| `insert_atom` | content | Insert an Atom after `AfterAtom` into Block `BlockID` |
| `delete_atom` | content | Delete the Atom identified by `AtomID` |
| `set_atom_text` | content | Replace the text of Atom `AtomID` |
| `add_mark` | formatting | Add a Mark to Block `BlockID` |
| `remove_mark` | formatting | Remove Mark `MarkID` from Block `BlockID` |
| `splice_atom_text` | content | Insert or delete bytes within Atom `AtomID` at `StartOffset`–`EndOffset` |
| `move_row` | reorder | Move Row `RowID` after `AfterRow` |
| `move_block` | reorder | Move Block `BlockID` to after `AfterBlock` in Row `RowID` |
| `move_atom` | reorder | Move Atom `AtomID` to after `AfterAtom` in Block `BlockID` |
| `update_mark` | formatting | Replace Mark `MarkID` with a new definition (preserves ID) |
| `split_block` | content | Split Block `BlockID` at Atom `AtomID` / offset, creating `Block` |
| `join_blocks` | content | Join Block `OtherBlockID` into Block `BlockID` |
| `set_page_layout` | layout | Replace the document's PageLayout |
| `set_block_alignment` | layout | Set horizontal/vertical alignment on Block `BlockID` |
| `set_block_line_height` | layout | Set line-height on Block `BlockID` |
| `set_row_tracks` | layout | Set the track columns on Row `RowID` |
| `resize_adjacent_tracks` | layout | Shift weight between adjacent track columns on Row `RowID` |
| `set_row_flow` | flow | Set page-break and keep-with-next on Row `RowID` |
| `set_header` | layout | Replace the document Header region |
| `set_footer` | layout | Replace the document Footer region |
| `put_style_definition` | style | Insert or update a named style definition |
| `delete_style_definition` | style | Remove a named style definition |
| `set_style_default` | style | Set a style as the default for a block kind |
| `assign_block_style` | style | Assign a style reference to Block `BlockID` |
| `set_block_style_overrides` | style | Set per-block style overrides on Block `BlockID` |
| `replace_style` | style | Replace all uses of `StyleID` with `ReplacementStyleID` |
| `set_prompt` | content | Set the prompt instruction on a prompt Block |
| `resolve_block` | content | Replace a prompt Block's output with a new resolution |
| `set_atom_formula` | content | Set or update the formula binding on Atom `AtomID` |
| `refresh_formula` | content | Apply a server-computed formula result to Atom `AtomID` |
| `restore_prompt_output` | content | Append a restored previous prompt output revision |

### ChangeSummary

```go
type ChangeSummary struct {
    OperationCount int             `json:"operationCount"`
    OperationTypes []OpType        `json:"operationTypes"`
    Affected       AffectedObjects `json:"affected"`
    Truncated      bool            `json:"truncated,omitempty"`
}

type AffectedObjects struct {
    DocumentWide bool     `json:"documentWide,omitempty"`
    RowIDs       []string `json:"rowIds"`
    BlockIDs     []string `json:"blockIds"`
    AtomIDs      []string `json:"atomIds"`
    MarkIDs      []string `json:"markIds"`
    StyleIDs     []string `json:"styleIds"`
}
```

### HistoryEntry

```go
type HistoryEntry struct {
    ID               string        `json:"id"`               // changeSetID
    Revision         int64         `json:"revision"`         // seq number
    AuthoredRevision int64         `json:"authoredRevision"` // head the client observed
    PriorRevision    int64         `json:"priorRevision"`    // actual head at admission
    CreatedAt        string        `json:"createdAt"`        // RFC3339Nano
    Author           Actor         `json:"author"`
    SubmissionID     string        `json:"submissionId,omitempty"`
    UndoOf           string        `json:"undoOf,omitempty"`
    RedoOf           string        `json:"redoOf,omitempty"`
    Summary          ChangeSummary `json:"summary"`
    DetailAvailable  bool          `json:"detailAvailable"` // full ChangeSet still retained
    CanUndo          bool          `json:"canUndo"`         // current user can undo this
    CanRedo          bool          `json:"canRedo"`         // current user can redo this
}
```

### Actor

```go
type Actor struct {
    ID   string `json:"id"`
    Name string `json:"name"`
}
```

### AdmissionConflict (409 response)

```go
type AdmissionConflict struct {
    Code             string `json:"code"`             // "document_revision_conflict" | "document_submission_conflict"
    ExpectedRevision int64  `json:"expectedRevision"` // the revision the client submitted against
    CurrentRevision  int64  `json:"currentRevision"`  // the actual current head
    ResyncRevision   int64  `json:"resyncRevision"`   // the revision to resync to
}
```

### Standard error body

```json
{"error": "<human-readable message>"}
```

---

## Endpoints

### 1. List documents

```
GET /documents
```

**Access:** any role (including read)

**Request body:** none

**Query parameters:** none

**Response (200):**
```json
{
  "documents": [ Document, ... ]
}
```

**Error (500):** `{"error": "could not list documents"}`

**What it does:** Returns every active document in the selected project with
resolved content (pending change sets applied). Trashed documents are excluded.

---

### 2. Create document

```
POST /documents
```

**Access:** owner or edit

**Request body:**
```json
{
  "name":       "My Document",  // required, non-empty after trimming
  "pageLayout": {               // optional; server default (US Letter) if omitted
    "width":        612,
    "height":       792,
    "marginTop":    72,
    "marginRight":  72,
    "marginBottom": 72,
    "marginLeft":   72
  },
  "rows": [ Row, ... ]          // optional; initial content
}
```

**Response (201):** a `Document` object with server-assigned IDs.

**Errors:**
| Status | Condition |
|---|---|
| 400 | Invalid JSON, empty name, or invalid content |
| 403 | Read role |
| 500 | Store failure |

**What it does:** Creates a new document in the selected project. The server
assigns IDs to any rows/blocks/atoms that lack one, captures configured layout
rules as a snapshot, supplies default page geometry, and normalizes styles.

---

### 3. Get document

```
GET /documents/:documentID
```

**Access:** any role

**Request body:** none

**Response (200):** a `Document` object with all pending change sets applied.

**Errors:**
| Status | Condition |
|---|---|
| 404 | Not found or belongs to another project |
| 500 | Store failure or change-set replay failure |

**What it does:** Returns one document scoped to the selected project. A
document in another project returns 404 — existence is not leaked.

---

### 4. Rename document

```
PATCH /documents/:documentID
```

**Access:** owner or edit

**Request body:**
```json
{
  "name": "New Name"  // required, non-empty after trimming
}
```

**Response (200):** a `Document` object with updated name and timestamp.  A
normalised no-op (same name) returns the document as-is without an activity
fact.

**Errors:**
| Status | Condition |
|---|---|
| 400 | Invalid JSON or empty name |
| 403 | Read role |
| 404 | Not found |
| 500 | Store failure |

---

### 5. Trash document

```
DELETE /documents/:documentID
```

**Access:** owner or edit

**Request body:** none

**Response (200):** `{"status": "trashed"}`

**Errors:**
| Status | Condition |
|---|---|
| 403 | Read role |
| 404 | Not found |
| 500 | Store failure |

**What it does:** Moves a document to trash (lifecycle → `"trashed"`, sets
`TrashedAt`). Content and history are preserved.  Trashed documents are hidden
from List but remain Gettable.

---

### 6. Restore document

```
POST /documents/:documentID/restore
```

**Access:** owner or edit

**Request body:** none

**Response (200):** `{"status": "restored"}`

**Errors:**
| Status | Condition |
|---|---|
| 403 | Read role |
| 404 | Not found or not in trash |
| 500 | Store failure |

**What it does:** Moves a trashed document back to active (lifecycle →
`"active"`, clears `TrashedAt`). Fails if the document is not currently
trashed.

---

### 7. Purge document

```
DELETE /documents/:documentID/purge
```

**Access:** owner or edit

**Request body:** none

**Response (200):** `{"status": "purged"}`

**Errors:**
| Status | Condition |
|---|---|
| 403 | Read role |
| 404 | Not found or not in trash |
| 500 | Store failure |

**What it does:** Permanently deletes a trashed document and all its change
sets, history, and submission receipts. Irreversible. Must be in trash first.

---

### 8. Duplicate document

```
POST /documents/:documentID/duplicate
```

**Access:** owner or edit

**Request body:** none

**Response (201):** a `Document` object — the duplicate with fresh internal IDs.

The duplicate name is the source name with a numbered suffix (`" (1)"`,
`" (2)"`, etc.) incremented until no collision with an existing active document
in the project.

Every internal ID (rows, blocks, atoms, marks, style definitions, style
defaults) is regenerated. All cross-references are remapped: block
`StyleRef.StyleID`, mark `Start.AtomID` and `End.AtomID`, style
`Defaults[].StyleID`. Content, formula data, prompt data, image data, list
data, marks, tracks, headers, footers — all preserved unchanged. The source
document ID is recorded in the activity fact (`sourceKind: "document.duplicate"`,
`sourceID`).

**Errors:**
| Status | Condition |
|---|---|
| 403 | Read role |
| 404 | Not found or wrong project |
| 500 | Store failure |

---

### 9. Submit changes

```
POST /documents/:documentID/changes
```

**Access:** owner or edit

**Request body:**
```json
{
  "submissionId":     "client-gen-uuid",  // required, ≤128 UTF-8 bytes, no control chars
  "expectedRevision": 3,                  // required, the revision the client edited from
  "operations":       [ ChangeOp, ... ]   // required, non-empty array
}
```

**Response (201):** a `ChangeSet` object.

**Errors:**
| Status | Body key | Condition |
|---|---|---|
| 400 | — | Invalid JSON |
| 400 | — | `expectedRevision` missing |
| 400 | — | Invalid submissionId (empty, too long, control chars) or negative revision |
| 400 | — | Operations empty or malformed |
| 403 | — | Read role |
| 404 | — | Document not found |
| 409 | `document_revision_conflict` | Submitted revision is not the current head and semantic rebase rejected it |
| 409 | `document_submission_conflict` | Same submissionId with different operations |
| 409 | — | Operation references content that is missing or mismatched |
| 409 | — | CAS race during append |
| 500 | — | Store failure |

**What it does:** Accepts a revision-bound, idempotent batch of operations.
The server validates each op, evaluates any formula atoms, checks idempotency
(retry with same submissionId + identical payload returns the original
ChangeSet), attempts semantic rebase if the revision is stale, resolves against
the current document, derives inverse operations for undo, and atomically
appends the change set.

---

### 10. List history

```
GET /documents/:documentID/history
```

**Access:** any role

**Query parameters:**
| Parameter | Type | Default | Description |
|---|---|---|---|
| `cursor` | string | none | Opaque base64 cursor from `nextCursor` |
| `limit` | int | 20 | Page size, 1–100 |

**Response (200):**
```json
{
  "entries": [ HistoryEntry, ... ],
  "nextCursor": "<base64>" | null
}
```

**Errors:**
| Status | Condition |
|---|---|
| 400 | Limit out of range or invalid cursor |
| 404 | Document not found |
| 500 | Store failure |

**What it does:** Returns a bounded, newest-first page of revision summaries.
Each entry shows operation kinds and affected object IDs (never content).
`CanUndo`/`CanRedo` are true only when the entry is the current head and
authored by the requesting user.

---

### 11. Get change set

```
GET /documents/:documentID/history/:changeSetID
```

**Access:** any role

**Response (200):** a `ChangeSet` object (private fields excluded).

**Errors:**
| Status | Condition |
|---|---|
| 404 | Document not found |
| 404 | Change set detail is not retained (pruned) |
| 500 | Store failure |

**What it does:** Returns the full retained ChangeSet including all
operations. Private fields (`InverseOps`, `SubmissionHash`) are excluded from
JSON via `json:"-"`.

---

### 12. Undo

```
POST /documents/:documentID/changes/:changeSetID/undo
```

**Access:** owner or edit

**Request body:** none

**Response (201):** a `ChangeSet` object with `UndoOf` set to the target
changeSetID.

**Errors:**
| Status | Condition |
|---|---|
| 403 | Read role |
| 403 | Current user is not the revision author |
| 404 | Document or change set not found |
| 409 | Target is not the current head |
| 409 | Target is itself an undo (must redo explicitly) |
| 409 | Target has no retained inverse operations |
| 409 | Concurrent edit changed the document state |
| 500 | Store failure |

**What it does:** Appends a compensating change set that reverses the target
revision using its stored `InverseOps`. Target must be authored by the
requesting user AND be the current document head. Cannot undo an undo.

---

### 13. Redo

```
POST /documents/:documentID/changes/:changeSetID/redo
```

**Access:** owner or edit

**Request body:** none

**Response (201):** a `ChangeSet` object with `RedoOf` set to the target
changeSetID.

**Errors:**
| Status | Condition |
|---|---|
| 403 | Read role |
| 403 | Current user is not the undo revision author |
| 404 | Document or change set not found |
| 409 | Target is not the current head |
| 409 | Target is not an undo (no `UndoOf` or already has `RedoOf`) |
| 409 | Target has no retained inverse operations |
| 409 | Concurrent edit changed the document state |
| 500 | Store failure |

**What it does:** Appends a compensating change set that reverses an undo
revision. Target must be an undo authored by the requesting user and be the
current head.

---

### 14. Revision hints

```
GET /documents/revision-hints
```

**Access:** any role

**Response (200):**
```json
{
  "<documentID>": 7,
  "<documentID>": 3
}
```

A `map[string]int64` — one entry per active document.

**Error (500):** `{"error": "could not get revision hints"}`

**What it does:** Returns a lightweight `{documentID: revision}` map for every
active document in the selected project. Clients poll this to detect staleness
before editing.

---

### 15. Resolve prompt block

```
POST /documents/:documentID/blocks/:blockID/resolve
```

**Access:** owner or edit

**Dispatch:** async — returns 202, polls at `GET /jobs/:jobID`

**Request body:**
```json
{
  "mode": "auto"  // optional: "reload", "refresh", or ""/omitted (= auto)
}
```

- **reload:** always re-resolves (plan queries → retrieve → synthesize)
- **refresh:** skips when neither the prompt instruction nor project knowledge
  changed since the last resolution
- **auto:** reload if the block has no output text yet; refresh otherwise

**Response (202):**
```json
{
  "jobId": "<hex>",
  "status": "pending"
}
```

Poll `GET /jobs/:jobID` for completion. When the job finishes, its result
body is:

```json
{
  "status":   "ok",
  "evidence": 3,
  "skipped":  false,
  "usage":    { "promptTokens": 450, "totalTokens": 520 }
}
```

`status` may be `"ok"`, `"insufficient"` (no retrieval results), or
`"contradiction"` (conflicting evidence). `skipped` is true for a refresh that
found nothing changed. `evidence` is the count of evidence spans grounded in
the output.

**Errors:**
| Status | Condition |
|---|---|
| 403 | Read role |
| 500 | Job enqueue failure |

**What it does:** Runs the prompt block resolution pipeline asynchronously:
plan retrieval queries → retrieve evidence from the knowledge lattice →
synthesize a grounded answer → incorporate back into the document. The
resolution replaces the block's output text and records evidence, source
versions, and usage cost.

---

### 16. Rebase (dev)

```
POST /dev/documents/:documentID/rebase
```

**Access:** owner or edit

**Dispatch:** async — returns 202, polls at `GET /jobs/:jobID`

**Request body:** none

**Response (202):**
```json
{
  "jobId": "<hex>",
  "status": "pending"
}
```

**Errors:**
| Status | Condition |
|---|---|
| 403 | Read role |
| 500 | Job enqueue failure |

**What it does:** Folds pending change sets into a new stored base. If a
history limit is configured, prunes summary history while retaining pending
reconstruction detail and the current-head undo/redo recipe. Idempotent — no-op
when nothing is pending. Dev-only maintenance endpoint.

---

## Role summary

| Role | Permitted endpoints |
|---|---|
| `read` | List, Get, History, GetChangeSet, RevisionHints |
| `edit` | All read endpoints + Create, Rename, Trash, Restore, Purge, Duplicate, SubmitChanges, Undo, Redo, Resolve, Rebase |
| `owner` | Same as edit |
