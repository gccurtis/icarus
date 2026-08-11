# changeset.go

Current state companion for `changeset.go`. Change operation vocabulary: all OpType constants, ChangeOp and ChangeSet structs, block/atom/mark kind validation predicates, error sentinels.

## Code breakdown

```go
package document

import (
	"errors"
	"time"
)

// OpType names one operation a change can make to revisioned document content,
// from document-wide page geometry down through rows, blocks, atoms and marks.
type OpType string

const (
	OpInsertRow       OpType = "insert_row"        // insert Row after AfterRow ("" = at the start)
	OpDeleteRow       OpType = "delete_row"        // remove the row RowID
	OpInsertBlock     OpType = "insert_block"      // insert Block into RowID after AfterBlock ("" = start)
	OpDeleteBlock     OpType = "delete_block"      // remove the block BlockID
	OpSetBlock        OpType = "set_block"         // set BlockID's Kind
	OpSetBlockSubkind OpType = "set_block_subkind" // set text block BlockID's SubKind (SetSubKind)
	OpSetBlockData    OpType = "set_block_data"    // replace list block BlockID's typed Data wholesale (ListData)
	OpSetListType     OpType = "set_list_type"     // set list block BlockID's marker type (SetListType) and start
	OpSetListItem     OpType = "set_list_item"     // insert/replace/remove list block BlockID's item at ListIndex (Item; nil removes)
	OpInsertAtom      OpType = "insert_atom"       // insert Atom into BlockID after AfterAtom ("" = start)
	OpDeleteAtom      OpType = "delete_atom"       // remove AtomID from BlockID
	OpSetAtomText     OpType = "set_atom_text"     // set AtomID's text within BlockID
	OpAddMark         OpType = "add_mark"          // add Mark to BlockID
	OpRemoveMark      OpType = "remove_mark"       // remove MarkID from BlockID
	OpSpliceAtomText  OpType = "splice_atom_text"  // replace one preconditioned UTF-8 byte range
	OpMoveRow         OpType = "move_row"          // move RowID after AfterRow
	OpMoveBlock       OpType = "move_block"        // move BlockID into RowID after AfterBlock
	OpMoveAtom        OpType = "move_atom"         // move AtomID into BlockID after AfterAtom
	OpUpdateMark      OpType = "update_mark"       // replace one preconditioned Mark in place
	OpSplitBlock      OpType = "split_block"       // split a single-atom text Block into a new Row
	OpJoinBlocks      OpType = "join_blocks"       // join adjacent single-atom text Blocks

	OpSetPageLayout            OpType = "set_page_layout"             // replace document-wide page geometry (PageLayout)
	OpSetDefaultTypography     OpType = "set_default_typography"      // set/clear the document default typography (CustomTypography)
	OpSetBlockAlignment        OpType = "set_block_alignment"         // set BlockID's supplied alignment fields
	OpSetBlockLineHeight       OpType = "set_block_line_height"       // set BlockID's line height (LineHeight)
	OpSetBlockIndent           OpType = "set_block_indent"            // set BlockID's indent level (Indent)
	OpSetRowTracks             OpType = "set_row_tracks"              // replace RowID's horizontal track layout
	OpResizeAdjacentTracks     OpType = "resize_adjacent_tracks"      // adjust weights of two adjacent blocks in a row
	OpSetRowFlow               OpType = "set_row_flow"                // set RowID's page-break and keep-with-next flags
	OpSetHeader                OpType = "set_header"                  // replace the document's recurring header rows
	OpSetFooter                OpType = "set_footer"                  // replace the document's recurring footer rows
	OpSetTemplate              OpType = "set_template"                // replace the document's template descriptor
	OpSetContextVariable       OpType = "set_context_variable"        // bind one template context variable document-wide
	OpPutStyleDefinition       OpType = "put_style_definition"        // create or replace one semantic style definition
	OpDeleteStyleDefinition    OpType = "delete_style_definition"     // remove one unused semantic style definition
	OpSetStyleDefault          OpType = "set_style_default"           // set or clear one document default style for a block kind
	OpAssignBlockStyle         OpType = "assign_block_style"          // replace one block's explicit style reference
	OpSetBlockStyleOverrides   OpType = "set_block_style_overrides"   // replace one block style ref's overrides
	OpSetBlockCustomTypography OpType = "set_block_custom_typography" // set/clear one block's free-form custom typography
	OpReplaceStyle             OpType = "replace_style"               // replace one style's usages and delete the old definition

	OpSetPrompt       OpType = "set_prompt"        // set prompt block BlockID's instruction (SetText)
	OpResolveBlock    OpType = "resolve_block"     // replace prompt block BlockID's generated content + data (Block)
	OpSetBlockContext OpType = "set_block_context" // set block BlockID's per-block context selection (BlockContext); clears a prompt block's ResolvedAt and prior-answer carryover
	OpSetBlockPersona OpType = "set_block_persona" // set prompt block BlockID's persona selection (BlockPersona; nil clears); clears ResolvedAt

	OpSetAtomFormula OpType = "set_atom_formula" // set AtomID's formula data (expression, result, state)

	OpRefreshFormula      OpType = "refresh_formula"       // re-evaluate a formula atom, append to history
	OpRestorePromptOutput OpType = "restore_prompt_output" // restore a previous prompt output revision
)

// Supported mark kinds. Marks style a range of a block's atoms; unknown kinds are
// rejected, so a renderer never has to guess.
const (
	MarkKindBold      = "bold"
	MarkKindItalic    = "italic"
	MarkKindUnderline = "underline"
	MarkKindStrike    = "strike"
	MarkKindCode      = "code"
	MarkKindLink      = "link" // requires Attrs["href"]
	MarkKindFont      = "font" // Attrs["family"] and/or Attrs["size"]
	MarkKindFg        = "fg"   // foreground color; Attrs["value"] is a CSS color
	MarkKindBg        = "bg"   // background/highlight color; Attrs["value"] is a CSS color
)

var markKinds = map[string]bool{
	MarkKindBold: true, MarkKindItalic: true, MarkKindUnderline: true,
	MarkKindStrike: true, MarkKindCode: true, MarkKindLink: true,
	MarkKindFont: true, MarkKindFg: true, MarkKindBg: true,
}

// validBlockKind reports whether a block kind is supported. An empty kind is
// allowed because it is defaulted to a paragraph before use.
func validBlockKind(kind string) bool { return kind == "" || blockKinds[kind] }

// validAtomKind reports whether an atom kind is supported. Only text atoms exist
// now; an empty kind is defaulted to text.
func validAtomKind(kind string) bool {
	return kind == "" || kind == AtomKindText || kind == AtomKindFormula
}

// validListType reports whether a list marker type is supported.
func validListType(t ListType) bool {
	switch t {
	case ListBullet, ListOrdered, ListCheck:
		return true
	}
	return false
}

// validBlockData reports whether a block's typed payload matches its kind: a
// prompt block carries PromptData (or nil, which normalizeBlock fills in), an
// image block carries ImageData, and every other kind carries none.
func validBlockData(b Block) bool {
	switch b.Kind {
	case BlockKindPrompt:
		if b.Data == nil {
			return true
		}
		_, ok := b.Data.(PromptData)
		return ok
	case BlockKindImage:
		if b.Data == nil {
			return false
		}
		_, ok := b.Data.(ImageData)
		return ok
	case BlockKindList:
		if b.Data == nil {
			return false
		}
		_, ok := b.Data.(ListBlockData)
		return ok
	default:
		return b.Data == nil
	}
}

// validSubKindStructure reports whether a block's SubKind is structurally valid
// for its kind, independent of the document's style registry. A text block's
// sub-kind must be a built-in or a syntactically valid style id (an empty value
// is defaulted to body before use); every other kind must carry no sub-kind.
// Registry membership for a custom sub-kind is checked separately, where the
// Base is available (see validBlockSubKind).
func validSubKindStructure(b Block) bool {
	if b.Kind != BlockKindText {
		return b.SubKind == ""
	}
	if b.SubKind == "" || builtinTextSubKinds[b.SubKind] {
		return true
	}
	return validStyleID(b.SubKind)
}

// validBlockSubKind reports whether a block's sub-kind is valid against a
// document's style registry: structurally sound, and — for a custom (non
// built-in) sub-kind on a text block — backed by a style definition that
// applies to the text kind.
func validBlockSubKind(registry StyleRegistry, b Block) bool {
	if !validSubKindStructure(b) {
		return false
	}
	if b.Kind != BlockKindText || b.SubKind == "" || builtinTextSubKinds[b.SubKind] {
		return true
	}
	definition, _, ok := styleDefinitionByID(registry, b.SubKind)
	return ok && styleAppliesTo(definition, BlockKindText)
}

// ChangeOp is one atomic change. Everything it targets is addressed by id (never
// by position), which is what lets ops be replayed in a canonical order and still
// land on the right unit. Only the fields relevant to Op are set.
type ChangeOp struct {
	Op OpType `json:"op"`

	// Anchors / targets, all by id.
	AfterRow   string `json:"afterRow,omitempty"`   // InsertRow / MoveRow destination anchor
	RowID      string `json:"rowId,omitempty"`      // row target or destination
	AfterBlock string `json:"afterBlock,omitempty"` // InsertBlock / MoveBlock destination anchor
	BlockID    string `json:"blockId,omitempty"`    // block target or destination
	AfterAtom  string `json:"afterAtom,omitempty"`  // InsertAtom / MoveAtom destination anchor
	AtomID     string `json:"atomId,omitempty"`     // DeleteAtom / SetAtomText target
	MarkID     string `json:"markId,omitempty"`     // RemoveMark / UpdateMark target
	// Exact source position preconditions for identity-preserving moves.
	FromRowID      string `json:"fromRowId,omitempty"`
	FromAfterRow   string `json:"fromAfterRow,omitempty"`
	FromBlockID    string `json:"fromBlockId,omitempty"`
	FromAfterBlock string `json:"fromAfterBlock,omitempty"`
	FromAfterAtom  string `json:"fromAfterAtom,omitempty"`
	// OtherBlockID is the right-hand Block consumed by JoinBlocks.
	OtherBlockID       string `json:"otherBlockId,omitempty"`
	StyleID            string `json:"styleId,omitempty"`
	ReplacementStyleID string `json:"replacementStyleId,omitempty"`
	DefaultBlockKind   string `json:"defaultBlockKind,omitempty"`

	// Payloads.
	Row            *Row             `json:"row,omitempty"`   // InsertRow / SplitBlock's new Row skeleton
	Block          *Block           `json:"block,omitempty"` // InsertBlock
	Atom           *Atom            `json:"atom,omitempty"`  // InsertAtom
	Mark           *Mark            `json:"mark,omitempty"`  // AddMark / UpdateMark
	Style          *StyleDefinition `json:"style,omitempty"`
	StyleRef       *BlockStyleRef   `json:"styleRef,omitempty"`
	StyleOverrides *StyleOverrides  `json:"styleOverrides,omitempty"`
	// CustomTypography carries the free-form typography for set_block_custom_typography.
	// Nil (with that op) clears the block's custom typography.
	CustomTypography *CustomTypography `json:"customTypography,omitempty"`
	// Template replaces the document's template descriptor (set_template).
	Template *TemplateInfo `json:"template,omitempty"`
	// BlockContext sets a block's per-block context selection (set_block_context).
	BlockContext *BlockContext `json:"blockContext,omitempty"`
	// BlockPersona sets a prompt block's persona selection (set_block_persona); a
	// nil ref with that op clears the block's persona.
	BlockPersona *PersonaRef `json:"blockPersona,omitempty"`
	// ContextVarName and BoundContext bind one template context variable
	// (set_context_variable); an empty BoundContext clears that variable's binding.
	// BoundResource binds the variable to a resource instead of free text; the two
	// bindings are mutually exclusive.
	ContextVarName string       `json:"contextVarName,omitempty"`
	BoundContext   string       `json:"boundContext,omitempty"`
	BoundResource  *ResourceRef `json:"boundResource,omitempty"`
	// PageLayout replaces the document-wide page geometry.
	PageLayout *PageLayout `json:"pageLayout,omitempty"` // SetPageLayout
	// Tracks payload for set_row_tracks.
	Tracks []Track `json:"tracks,omitempty"`
	// DeltaWeight is the weight transfer for resize_adjacent_tracks (positive =
	// left block gains, right block loses).
	DeltaWeight int `json:"deltaWeight,omitempty"`
	// Scalar layout flags — nil means leave unchanged.
	PageBreak    *bool `json:"pageBreak,omitempty"`    // SetRowFlow
	KeepWithNext *bool `json:"keepWithNext,omitempty"` // SetRowFlow
	// RevisionID is the source revision for restore_prompt_output.
	RevisionID string `json:"revisionId,omitempty"`
	// Header / Footer row payloads for set_header and set_footer.
	Header  []Row        `json:"header,omitempty"`  // SetHeader
	Footer  []Row        `json:"footer,omitempty"`  // SetFooter
	Formula *FormulaData `json:"formula,omitempty"` // SetAtomFormula / RefreshFormula

	// List editing payloads. ListData replaces a list block's whole payload
	// (set_block_data). SetListType + ListStart set the marker type and ordered
	// start (set_list_type). Item at ListIndex is inserted/replaced, or removed
	// when nil (set_list_item; ListIndex == len appends).
	ListData    *ListBlockData `json:"listData,omitempty"`
	SetListType *ListType      `json:"setListType,omitempty"`
	ListStart   *int           `json:"listStart,omitempty"`
	ListIndex   int            `json:"listIndex,omitempty"`
	Item        *ListItem      `json:"item,omitempty"`

	// Scalar setters — a nil pointer means "leave unchanged".
	SetKind    *string `json:"setKind,omitempty"`    // SetBlock
	SetSubKind *string `json:"setSubKind,omitempty"` // SetBlockSubkind
	SetText    *string `json:"setText,omitempty"`    // SetAtomText / SetPrompt (the instruction)
	// Text splice/split fields. Offsets are UTF-8 byte positions. The hashes are
	// lowercase SHA-256 of the exact current text bytes.
	StartOffset           int     `json:"startOffset,omitempty"`
	EndOffset             int     `json:"endOffset,omitempty"`
	InsertText            *string `json:"insertText,omitempty"`
	ExpectedTextHash      string  `json:"expectedTextHash,omitempty"`
	ExpectedOtherTextHash string  `json:"expectedOtherTextHash,omitempty"`
	// ExpectedMarkHash is lowercase SHA-256 of the canonical current Mark JSON.
	ExpectedMarkHash string `json:"expectedMarkHash,omitempty"`
	// Layout setters use pointers so an omitted field differs from explicitly
	// selecting its zero/default value.
	LineHeight      *LayoutUnit          `json:"lineHeight,omitempty"`      // SetBlockLineHeight
	Indent          *int                 `json:"indent,omitempty"`          // SetBlockIndent
	HorizontalAlign *HorizontalAlignment `json:"horizontalAlign,omitempty"` // SetBlockAlignment
	VerticalAlign   *VerticalAlignment   `json:"verticalAlign,omitempty"`   // SetBlockAlignment
}

// ChangeSet is a group of ops from one author, applied as a unit. Seq is assigned
// by the server when the changeset is appended, giving every changeset a total
// order per document; ops are resolved in Seq order, so the result is the same
// regardless of the order changesets are stored or retrieved.
type ChangeSet struct {
	ID           string `json:"id"`
	DocumentID   string `json:"documentId"`
	AuthorID     string `json:"authorId"`
	AuthorName   string `json:"authorName"`
	SubmissionID string `json:"submissionId,omitempty"`
	// AuthoredRevision is the head the client observed. PriorRevision is the
	// actual head at admission; they differ only after a proven semantic rebase.
	AuthoredRevision int64      `json:"authoredRevision"`
	PriorRevision    int64      `json:"priorRevision"`
	Seq              int64      `json:"seq"`
	CreatedAt        time.Time  `json:"createdAt"`
	Ops              []ChangeOp `json:"ops"`
	// UndoOf identifies the authored revision this compensating change reverses.
	// Empty means an ordinary edit.
	UndoOf string `json:"undoOf,omitempty"`
	// RedoOf identifies the undo revision this compensating change reverses.
	// Empty means the revision is not an explicit redo.
	RedoOf  string        `json:"redoOf,omitempty"`
	Summary ChangeSummary `json:"summary"`
	// SubmissionHash is the server-computed identity of the unnormalized
	// submission. Stores compare it when the same scoped SubmissionID is retried.
	SubmissionHash string `json:"-"`
	// InverseOps is the server-computed compensation stored with this revision.
	// It is private persistence state used by undo, not part of the public response.
	InverseOps []ChangeOp `json:"-"`
}

var (
	// ErrInvalidChangeSet is returned when a change set is empty or an op is
	// missing a field it needs (or carries an unsupported kind).
	ErrInvalidChangeSet = errors.New("change set is empty or invalid")
	// ErrConflict is returned when an op references content or prior state that
	// is not present in the current document (including a stale digest, parent,
	// predecessor, range, or adjacency precondition). The change no longer matches
	// the document, so it is rejected rather than silently relocated — preserving
	// the author's intent.
	ErrConflict = errors.New("change set conflicts with the current document")
)

// applyChangeSets resolves a base by replaying the ops of the given change sets,
// which must already be ordered by Seq. Each changeset's ops apply in array
// order. The result is deterministic for a given (base, ordered change sets).
//
// It works on a deep copy, so it never mutates the base it is given — important
// because that base may be shared (e.g. an in-memory store hands out rows that
// alias its stored copy). An op that references a missing id returns ErrConflict;
// for change sets already accepted and stored this cannot happen, so an error
// here signals corrupt stored data.
```
