package document

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"time"
)

const (
	// DefaultHistoryLimit is the number of revision summaries returned when a
	// caller omits limit.
	DefaultHistoryLimit = 20
	// MaxHistoryLimit bounds one History response.
	MaxHistoryLimit = 100
	// MaxAffectedIDsPerKind bounds each affected-object list in a summary.
	MaxAffectedIDsPerKind = 32
	// MaxAffectedIDBytes keeps one malformed or legacy ID from making a summary
	// unbounded. Oversized IDs are omitted and mark the summary truncated.
	MaxAffectedIDBytes = 128
	// MaxHistoryCursorBytes bounds cursor decoding work.
	MaxHistoryCursorBytes = 512
)

var (
	ErrInvalidHistoryCursor = errors.New("document history cursor is invalid")
	ErrInvalidHistoryLimit  = errors.New("document history limit must be between 1 and 100")
)

// AffectedObjects is a bounded, content-free index of stable object IDs touched
// by one accepted revision. DocumentWide marks page-layout operations.
type AffectedObjects struct {
	DocumentWide bool     `json:"documentWide,omitempty"`
	RowIDs       []string `json:"rowIds"`
	BlockIDs     []string `json:"blockIds"`
	AtomIDs      []string `json:"atomIds"`
	MarkIDs      []string `json:"markIds"`
	StyleIDs     []string `json:"styleIds"`
}

// ChangeSummary is the bounded list representation of one revision. It exposes
// operation kinds and affected stable IDs, never arbitrary content or inverse
// recipes.
type ChangeSummary struct {
	OperationCount int             `json:"operationCount"`
	OperationTypes []OpType        `json:"operationTypes"`
	Affected       AffectedObjects `json:"affected"`
	Truncated      bool            `json:"truncated,omitempty"`
}

// HistoryEntry is one retained revision summary. DetailAvailable reports whether
// its full ChangeSet remains retrievable. Eligibility is viewer-specific and
// only true for the current authored head.
type HistoryEntry struct {
	ID               string        `json:"id"`
	Revision         int64         `json:"revision"`
	AuthoredRevision int64         `json:"authoredRevision"`
	PriorRevision    int64         `json:"priorRevision"`
	CreatedAt        string        `json:"createdAt"`
	Author           Actor         `json:"author"`
	SubmissionID     string        `json:"submissionId,omitempty"`
	UndoOf           string        `json:"undoOf,omitempty"`
	RedoOf           string        `json:"redoOf,omitempty"`
	Summary          ChangeSummary `json:"summary"`
	DetailAvailable  bool          `json:"detailAvailable"`
	CanUndo          bool          `json:"canUndo"`
	CanRedo          bool          `json:"canRedo"`
	HasInverse       bool          `json:"-"`
}

// HistoryRequest describes a newest-first keyset page. A zero Limit selects the
// default.
type HistoryRequest struct {
	Limit  int
	Cursor string
}

// HistoryPage is one bounded page and an optional cursor for older revisions.
type HistoryPage struct {
	Entries    []HistoryEntry
	NextCursor string
}

// History returns retained summaries in descending revision order. A cursor is
// a traversal boundary bound to this Document, never authorization.
func (d *Documents) History(projectID, documentID, viewerID string, req HistoryRequest) (HistoryPage, error) {
	doc, err := d.store.DocumentByID(projectID, documentID)
	if err != nil {
		return HistoryPage{}, err
	}
	if doc.ProjectID != projectID {
		return HistoryPage{}, ErrNotFound
	}
	limit := req.Limit
	if limit == 0 {
		limit = DefaultHistoryLimit
	}
	if limit < 1 || limit > MaxHistoryLimit {
		return HistoryPage{}, ErrInvalidHistoryLimit
	}
	var beforeRevision int64
	if req.Cursor != "" {
		cursorDocumentID, cursorRevision, err := decodeHistoryCursor(req.Cursor)
		if err != nil || cursorDocumentID != documentID {
			return HistoryPage{}, ErrInvalidHistoryCursor
		}
		beforeRevision = cursorRevision
	}
	entries, err := d.store.ListChangeSetHistory(documentID, beforeRevision, limit+1)
	if err != nil {
		return HistoryPage{}, err
	}
	page := HistoryPage{Entries: entries}
	if len(page.Entries) > limit {
		page.Entries = page.Entries[:limit]
		page.NextCursor = encodeHistoryCursor(documentID, page.Entries[len(page.Entries)-1].Revision)
	}
	if page.Entries == nil {
		page.Entries = []HistoryEntry{}
	}
	for i := range page.Entries {
		entry := &page.Entries[i]
		eligible := entry.DetailAvailable && entry.HasInverse &&
			entry.Revision == doc.Revision && entry.Author.ID == viewerID
		entry.CanUndo = eligible && entry.UndoOf == ""
		entry.CanRedo = eligible && entry.UndoOf != "" && entry.RedoOf == ""
	}
	return page, nil
}

// ChangeSet returns one retained full revision after reauthorizing its Document.
// Private inverse and submission-fingerprint fields remain excluded from JSON.
func (d *Documents) ChangeSet(projectID, documentID, changeSetID string) (ChangeSet, error) {
	doc, err := d.store.DocumentByID(projectID, documentID)
	if err != nil {
		return ChangeSet{}, err
	}
	if doc.ProjectID != projectID {
		return ChangeSet{}, ErrNotFound
	}
	changeSet, err := d.store.ChangeSetByID(documentID, changeSetID)
	if err != nil {
		return ChangeSet{}, err
	}
	if err := validateStoredStyleOps(changeSet.Ops); err != nil {
		return ChangeSet{}, err
	}
	if err := validateStoredStyleOps(changeSet.InverseOps); err != nil {
		return ChangeSet{}, err
	}
	return changeSet, nil
}

type historyCursorPayload struct {
	Version    int    `json:"v"`
	DocumentID string `json:"documentId"`
	Revision   int64  `json:"revision"`
}

func encodeHistoryCursor(documentID string, revision int64) string {
	raw, _ := json.Marshal(historyCursorPayload{Version: 1, DocumentID: documentID, Revision: revision})
	return base64.RawURLEncoding.EncodeToString(raw)
}

func decodeHistoryCursor(cursor string) (string, int64, error) {
	if len(cursor) > MaxHistoryCursorBytes {
		return "", 0, ErrInvalidHistoryCursor
	}
	raw, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return "", 0, ErrInvalidHistoryCursor
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	var payload historyCursorPayload
	if err := dec.Decode(&payload); err != nil {
		return "", 0, ErrInvalidHistoryCursor
	}
	var extra any
	if err := dec.Decode(&extra); !errors.Is(err, io.EOF) ||
		payload.Version != 1 || payload.DocumentID == "" || payload.Revision < 1 {
		return "", 0, ErrInvalidHistoryCursor
	}
	return payload.DocumentID, payload.Revision, nil
}

// HistoryEntryForChangeSet produces the immutable summary record committed with
// a ChangeSet. Stores add retention availability when reading it back.
func HistoryEntryForChangeSet(cs ChangeSet) HistoryEntry {
	authorName := cs.AuthorName
	if authorName == "" {
		authorName = cs.AuthorID
	}
	return HistoryEntry{
		ID: cs.ID, Revision: cs.Seq, AuthoredRevision: cs.AuthoredRevision,
		PriorRevision: cs.PriorRevision,
		CreatedAt:     cs.CreatedAt.UTC().Format(time.RFC3339Nano),
		Author:        Actor{ID: cs.AuthorID, Name: authorName}, SubmissionID: cs.SubmissionID,
		UndoOf: cs.UndoOf, RedoOf: cs.RedoOf, Summary: cloneChangeSummary(cs.Summary),
		DetailAvailable: true, HasInverse: len(cs.InverseOps) > 0,
	}
}

func cloneHistoryEntry(entry HistoryEntry) HistoryEntry {
	entry.Summary = cloneChangeSummary(entry.Summary)
	return entry
}

func cloneChangeSummary(summary ChangeSummary) ChangeSummary {
	summary.OperationTypes = append([]OpType(nil), summary.OperationTypes...)
	summary.Affected.RowIDs = append([]string(nil), summary.Affected.RowIDs...)
	summary.Affected.BlockIDs = append([]string(nil), summary.Affected.BlockIDs...)
	summary.Affected.AtomIDs = append([]string(nil), summary.Affected.AtomIDs...)
	summary.Affected.MarkIDs = append([]string(nil), summary.Affected.MarkIDs...)
	summary.Affected.StyleIDs = append([]string(nil), summary.Affected.StyleIDs...)
	return summary
}

// SummarizeChangeOps derives bounded, content-free History metadata from an
// accepted operation batch.
func SummarizeChangeOps(ops []ChangeOp) ChangeSummary {
	summary := ChangeSummary{OperationCount: len(ops)}
	types := make(map[OpType]bool)
	ids := affectedIDCollector{summary: &summary}
	for _, op := range ops {
		if !types[op.Op] {
			types[op.Op] = true
			summary.OperationTypes = append(summary.OperationTypes, op.Op)
		}
		ids.add(&summary.Affected.RowIDs, op.RowID)
		ids.add(&summary.Affected.RowIDs, op.FromRowID)
		ids.add(&summary.Affected.BlockIDs, op.BlockID)
		ids.add(&summary.Affected.BlockIDs, op.FromBlockID)
		ids.add(&summary.Affected.BlockIDs, op.OtherBlockID)
		ids.add(&summary.Affected.AtomIDs, op.AtomID)
		ids.add(&summary.Affected.MarkIDs, op.MarkID)
		ids.add(&summary.Affected.StyleIDs, op.StyleID)
		ids.add(&summary.Affected.StyleIDs, op.ReplacementStyleID)
		if op.Style != nil {
			ids.add(&summary.Affected.StyleIDs, op.Style.ID)
		}
		switch op.Op {
		case OpSetPageLayout, OpSetDefaultTypography:
			summary.Affected.DocumentWide = true
		case OpPutStyleDefinition, OpDeleteStyleDefinition, OpSetStyleDefault, OpReplaceStyle:
			summary.Affected.DocumentWide = true
		case OpSetRowTracks, OpResizeAdjacentTracks, OpSetRowFlow, OpSetAtomFormula, OpRefreshFormula:
			summary.Affected.DocumentWide = true
		case OpSetTemplate, OpSetContextVariable:
			summary.Affected.DocumentWide = true
		case OpSetHeader, OpSetFooter:
		case OpInsertRow, OpSplitBlock:
			if op.Row != nil {
				ids.row(*op.Row)
			}
		case OpInsertBlock, OpResolveBlock:
			if op.Block != nil {
				ids.block(*op.Block)
			}
		case OpInsertAtom:
			if op.Atom != nil {
				ids.add(&summary.Affected.AtomIDs, op.Atom.ID)
			}
		case OpAddMark, OpUpdateMark:
			if op.Mark != nil {
				ids.mark(*op.Mark)
			}
		case OpAssignBlockStyle:
			if op.StyleRef != nil {
				ids.add(&summary.Affected.StyleIDs, op.StyleRef.StyleID)
			}
		}
	}
	if summary.OperationTypes == nil {
		summary.OperationTypes = []OpType{}
	}
	ids.fillEmpty()
	return summary
}

type affectedIDCollector struct {
	summary *ChangeSummary
}

func (c affectedIDCollector) add(ids *[]string, id string) {
	if id == "" {
		return
	}
	if len(id) > MaxAffectedIDBytes {
		c.summary.Truncated = true
		return
	}
	for _, existing := range *ids {
		if existing == id {
			return
		}
	}
	if len(*ids) >= MaxAffectedIDsPerKind {
		c.summary.Truncated = true
		return
	}
	*ids = append(*ids, id)
}

func (c affectedIDCollector) row(row Row) {
	c.add(&c.summary.Affected.RowIDs, row.ID)
	for _, block := range row.Blocks {
		c.block(block)
	}
}

func (c affectedIDCollector) block(block Block) {
	c.add(&c.summary.Affected.BlockIDs, block.ID)
	for _, atom := range block.Atoms {
		c.add(&c.summary.Affected.AtomIDs, atom.ID)
	}
	for _, mark := range block.Marks {
		c.mark(mark)
	}
}

func (c affectedIDCollector) mark(mark Mark) {
	c.add(&c.summary.Affected.MarkIDs, mark.ID)
	c.add(&c.summary.Affected.AtomIDs, mark.Start.AtomID)
	c.add(&c.summary.Affected.AtomIDs, mark.End.AtomID)
}

func (c affectedIDCollector) fillEmpty() {
	affected := &c.summary.Affected
	if affected.RowIDs == nil {
		affected.RowIDs = []string{}
	}
	if affected.BlockIDs == nil {
		affected.BlockIDs = []string{}
	}
	if affected.AtomIDs == nil {
		affected.AtomIDs = []string{}
	}
	if affected.MarkIDs == nil {
		affected.MarkIDs = []string{}
	}
	if affected.StyleIDs == nil {
		affected.StyleIDs = []string{}
	}
}
