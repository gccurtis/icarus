# windows.go

Row-window projections for bounded large-document loading: a body-less Descriptor and a RowManifest (heights + cumulative offsets from the same metrics Paginate uses) lay out the scroll region, a RowWindow pages in full rows, and Locate maps an atom or index to a jump target. All read projections, all revision-stamped. See repo conventions (AGENTS.md).

## Code breakdown

```go
package document

import (
	"strconv"
	"strings"
)

// Row-window projections give large documents bounded loading. A Descriptor and
// RowManifest lay out the scroll region without any row bodies; a RowWindow pages
// in full rows; Locate maps an atom or index to a jump target. Every projection
// is revision-stamped — the same head revision GET /documents reports — so a
// client detects a mid-scroll edit and re-syncs. These are read projections over
// existing document state; they add no storage. Heights and offsets come from
// the same rowHeight metrics Paginate (record 0041) uses, so the client needs no
// layout logic.

// Row-window sizing: count defaults to defaultRowWindow and is capped at
// maxRowWindow so a single call can never pull an unbounded slice.
const (
	defaultRowWindow = 50
	maxRowWindow     = 200
)

// Descriptor is a document's shape without row bodies: enough to allocate the
// scroll region and resolve styles in one small payload.
type Descriptor struct {
	ID            string        `json:"id"`
	Name          string        `json:"name"`
	Revision      int64         `json:"revision"`
	PageLayout    PageLayout    `json:"pageLayout"`
	LayoutRules   LayoutRules   `json:"layoutRules"`
	StyleRegistry StyleRegistry `json:"styleRegistry,omitempty"`
	RowCount      int           `json:"rowCount"`
}

// RowMetric is one row's layout position: its height and the cumulative offset
// of its top from the start of the document body.
type RowMetric struct {
	ID     string     `json:"id"`
	Height LayoutUnit `json:"height"`
	Offset LayoutUnit `json:"offset"`
}

// RowManifest is the ordered per-row metrics plus the revision they hold for.
type RowManifest struct {
	Revision int64       `json:"revision"`
	Rows     []RowMetric `json:"rows"`
}

// RowWindow is a contiguous slice of full rows plus the revision and the
// resolved window bounds.
type RowWindow struct {
	Revision int64 `json:"revision"`
	From     int   `json:"from"`
	Count    int   `json:"count"`
	Rows     []Row `json:"rows"`
}

// RowLocation is a jump target: the row an atom id or index lands in.
type RowLocation struct {
	RowID  string     `json:"rowId"`
	Index  int        `json:"index"`
	Offset LayoutUnit `json:"offset"`
}

// Descriptor returns a document's body-less shape, revision-stamped.
func (d *Documents) Descriptor(projectID, id string) (Descriptor, error) {
	doc, err := d.Get(projectID, id)
	if err != nil {
		return Descriptor{}, err
	}
	return Descriptor{
		ID:            doc.ID,
		Name:          doc.Name,
		Revision:      doc.Revision,
		PageLayout:    doc.Base.PageLayout,
		LayoutRules:   doc.Base.LayoutRules,
		StyleRegistry: doc.Base.StyleRegistry,
		RowCount:      len(doc.Base.Rows),
	}, nil
}

// RowManifest returns each row's height and cumulative top offset.
func (d *Documents) RowManifest(projectID, id string) (RowManifest, error) {
	doc, err := d.Get(projectID, id)
	if err != nil {
		return RowManifest{}, err
	}
	metrics, err := rowMetrics(doc.Base)
	if err != nil {
		return RowManifest{}, err
	}
	return RowManifest{Revision: doc.Revision, Rows: metrics}, nil
}

// RowWindow returns the rows in [from, from+count), where from is a row id or a
// zero-based index (empty means the start). count is clamped to [1, maxRowWindow].
func (d *Documents) RowWindow(projectID, id, from string, count int) (RowWindow, error) {
	doc, err := d.Get(projectID, id)
	if err != nil {
		return RowWindow{}, err
	}
	start, err := resolveRowIndex(doc.Base.Rows, from)
	if err != nil {
		return RowWindow{}, err
	}
	if count <= 0 {
		count = defaultRowWindow
	}
	if count > maxRowWindow {
		count = maxRowWindow
	}
	end := start + count
	if end > len(doc.Base.Rows) {
		end = len(doc.Base.Rows)
	}
	rows := append([]Row(nil), doc.Base.Rows[start:end]...)
	return RowWindow{Revision: doc.Revision, From: start, Count: len(rows), Rows: rows}, nil
}

// Locate maps an atom id (byIndex false) or a zero-based row index (byIndex true)
// to its row and top offset, so a client can jump straight to it.
func (d *Documents) Locate(projectID, id, atomID string, index int, byIndex bool) (RowLocation, error) {
	doc, err := d.Get(projectID, id)
	if err != nil {
		return RowLocation{}, err
	}
	metrics, err := rowMetrics(doc.Base)
	if err != nil {
		return RowLocation{}, err
	}
	target := -1
	switch {
	case byIndex:
		if index < 0 || index >= len(doc.Base.Rows) {
			return RowLocation{}, ErrNotFound
		}
		target = index
	case strings.TrimSpace(atomID) != "":
		target = rowIndexOfAtom(doc.Base.Rows, strings.TrimSpace(atomID))
	}
	if target < 0 {
		return RowLocation{}, ErrNotFound
	}
	return RowLocation{RowID: doc.Base.Rows[target].ID, Index: target, Offset: metrics[target].Offset}, nil
}

// rowMetrics computes each row's height and running top offset using the same
// row metrics Paginate uses, so a manifest matches on-page layout.
func rowMetrics(base Base) ([]RowMetric, error) {
	if !validLayoutRules(base.LayoutRules) || !validPageLayout(base.PageLayout, base.LayoutRules) {
		return nil, ErrInvalidContent
	}
	contentWidth := base.PageLayout.Width - base.PageLayout.MarginLeft - base.PageLayout.MarginRight
	metrics := make([]RowMetric, 0, len(base.Rows))
	var offset LayoutUnit
	for _, row := range base.Rows {
		h := rowHeight(row, base.LayoutRules, contentWidth)
		metrics = append(metrics, RowMetric{ID: row.ID, Height: h, Offset: offset})
		offset += h
	}
	return metrics, nil
}

// resolveRowIndex turns a window's from into a start index: empty is the start,
// a small integer is an index, and anything else is matched as a row id.
func resolveRowIndex(rows []Row, from string) (int, error) {
	from = strings.TrimSpace(from)
	if from == "" {
		return 0, nil
	}
	if n, err := strconv.Atoi(from); err == nil {
		if n < 0 || n > len(rows) {
			return 0, ErrNotFound
		}
		return n, nil
	}
	for i, r := range rows {
		if r.ID == from {
			return i, nil
		}
	}
	return 0, ErrNotFound
}

func rowIndexOfAtom(rows []Row, atomID string) int {
	for i, r := range rows {
		for _, b := range r.Blocks {
			for _, a := range b.Atoms {
				if a.ID == atomID {
					return i
				}
			}
		}
	}
	return -1
}
```
