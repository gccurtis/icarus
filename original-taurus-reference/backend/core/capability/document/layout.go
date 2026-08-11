package document

// LayoutUnit is one whole typographic point (1/72 inch). Integer units keep
// page geometry and pagination deterministic across renderers.
type LayoutUnit int

// HorizontalAlignment positions a block's content inside its horizontal cell.
type HorizontalAlignment string

const (
	HorizontalAlignLeft   HorizontalAlignment = "left"
	HorizontalAlignCenter HorizontalAlignment = "center"
	HorizontalAlignRight  HorizontalAlignment = "right"
)

// VerticalAlignment positions a block's content inside its row height.
type VerticalAlignment string

const (
	VerticalAlignTop    VerticalAlignment = "top"
	VerticalAlignMiddle VerticalAlignment = "middle"
	VerticalAlignBottom VerticalAlignment = "bottom"
)

// PageLayout is the document-wide page geometry. Pages are derived from this
// value and the ordered rows; they are not stored as mutable document objects.
type PageLayout struct {
	Width        LayoutUnit `json:"width"`
	Height       LayoutUnit `json:"height"`
	MarginTop    LayoutUnit `json:"marginTop"`
	MarginRight  LayoutUnit `json:"marginRight"`
	MarginBottom LayoutUnit `json:"marginBottom"`
	MarginLeft   LayoutUnit `json:"marginLeft"`
}

// LayoutRules are the effective row and block metrics captured when a document is
// created. Server configuration supplies the defaults, but the snapshot travels
// with the document so a later configuration change cannot silently repaginate
// existing content. MinRowPadding is applied above and below every row and cannot
// be changed per-row (row spacing is config-determined). MaxFontHeight sets the
// default line height for blocks that do not specify their own. CharWidth is the
// fixed per-character advance width used for deterministic line-breaking.
type LayoutRules struct {
	MaxFontHeight LayoutUnit `json:"maxFontHeight"`
	MinRowPadding LayoutUnit `json:"minRowPadding"`
	CharWidth     LayoutUnit `json:"charWidth"`
}

// RowStyle contains layout that belongs to one row. Row margins come from config
// (LayoutRules.MinRowPadding), not from this style. PageBreak forces a page break
// before this row; KeepWithNext prevents a page break between this row and the next.
type RowStyle struct {
	PageBreak    bool `json:"pageBreak,omitempty"`
	KeepWithNext bool `json:"keepWithNext,omitempty"`
}

// BlockStyle contains per-block layout: horizontal/vertical alignment, an
// optional explicit line height, and an indent level. When LineHeight is zero
// the block inherits LayoutRules.MaxFontHeight. Indent is a general block indent
// (0 = flush left), independent of list nesting. Inline formatting remains
// represented by marks over atom ranges.
type BlockStyle struct {
	HorizontalAlign HorizontalAlignment `json:"horizontalAlign"`
	VerticalAlign   VerticalAlignment   `json:"verticalAlign"`
	LineHeight      LayoutUnit          `json:"lineHeight"`
	Indent          int                 `json:"indent,omitempty"`
}

// MaxBlockIndent bounds a block's indent level.
const MaxBlockIndent = 16

// Page is one derived pagination result. RowIDs refer back to the canonical
// rows; Number is one-based and UsedHeight is the sum of their row heights.
type Page struct {
	Number     int        `json:"number"`
	RowIDs     []string   `json:"rowIds"`
	UsedHeight LayoutUnit `json:"usedHeight"`
}

func defaultPageLayout() PageLayout {
	return PageLayout{
		Width: 612, Height: 792,
		MarginTop: 72, MarginRight: 72, MarginBottom: 72, MarginLeft: 72,
	}
}

func defaultLayoutRules() LayoutRules {
	return LayoutRules{
		MaxFontHeight: 24, MinRowPadding: 4, CharWidth: 8,
	}
}

func normalizePageLayout(layout PageLayout) PageLayout {
	if layout == (PageLayout{}) {
		return defaultPageLayout()
	}
	return layout
}

func normalizeLayoutRules(rules LayoutRules) LayoutRules {
	defaults := defaultLayoutRules()
	if rules.MaxFontHeight <= 0 {
		rules.MaxFontHeight = defaults.MaxFontHeight
	}
	if rules.MinRowPadding <= 0 {
		rules.MinRowPadding = defaults.MinRowPadding
	}
	if rules.CharWidth <= 0 {
		rules.CharWidth = defaults.CharWidth
	}
	return rules
}

func normalizeBlockStyle(style *BlockStyle) {
	if style.HorizontalAlign == "" {
		style.HorizontalAlign = HorizontalAlignLeft
	}
	if style.VerticalAlign == "" {
		style.VerticalAlign = VerticalAlignTop
	}
}

func validHorizontalAlignment(value HorizontalAlignment) bool {
	return value == HorizontalAlignLeft || value == HorizontalAlignCenter || value == HorizontalAlignRight
}

func validVerticalAlignment(value VerticalAlignment) bool {
	return value == VerticalAlignTop || value == VerticalAlignMiddle || value == VerticalAlignBottom
}

func validBlockStyle(style BlockStyle) bool {
	return validHorizontalAlignment(style.HorizontalAlign) && validVerticalAlignment(style.VerticalAlign) &&
		validBlockIndent(style.Indent)
}

func validBlockIndent(indent int) bool {
	return indent >= 0 && indent <= MaxBlockIndent
}

func validLayoutRules(rules LayoutRules) bool {
	return rules.MaxFontHeight > 0 && rules.MinRowPadding >= 0 && rules.CharWidth > 0
}

func validBlockLineHeight(lineHeight LayoutUnit, rules LayoutRules) bool {
	return lineHeight == 0 || (lineHeight >= 8 && lineHeight <= 128)
}

func blockLineHeight(style BlockStyle, rules LayoutRules) LayoutUnit {
	if style.LineHeight > 0 {
		return style.LineHeight
	}
	return rules.MaxFontHeight
}

func rowHeight(row Row, rules LayoutRules, contentWidth LayoutUnit) LayoutUnit {
	if len(row.Blocks) == 0 {
		return rules.MaxFontHeight + 2*rules.MinRowPadding
	}
	var maxHeight LayoutUnit
	for i, block := range row.Blocks {
		bw := blockTrackWidth(row, i, contentWidth)
		bh := blockContentHeight(block, bw, rules)
		if bh > maxHeight {
			maxHeight = bh
		}
	}
	return maxHeight + 2*rules.MinRowPadding
}

func blockTrackWidth(row Row, blockIndex int, contentWidth LayoutUnit) LayoutUnit {
	if len(row.Tracks) == 0 || len(row.Blocks) <= 1 {
		return contentWidth
	}
	var totalWeight int
	var totalGap LayoutUnit
	for _, t := range row.Tracks {
		totalWeight += t.Weight
		totalGap += t.Gap
	}
	if totalWeight == 0 || contentWidth <= totalGap {
		return contentWidth
	}
	available := int(contentWidth - totalGap)
	return LayoutUnit(available * row.Tracks[blockIndex].Weight / totalWeight)
}

func blockContentHeight(block Block, blockWidth LayoutUnit, rules LayoutRules) LayoutUnit {
	lh := blockLineHeight(block.Style, rules)
	text := block.DisplayText()
	chars := len([]rune(text))
	if chars == 0 || blockWidth <= 0 {
		return lh
	}
	charsPerLine := int(blockWidth) / int(rules.CharWidth)
	if charsPerLine < 1 {
		charsPerLine = 1
	}
	lines := (chars + charsPerLine - 1) / charsPerLine
	return LayoutUnit(lines) * lh
}

func validPageLayout(layout PageLayout, rules LayoutRules) bool {
	if layout.Width <= 0 || layout.Height <= 0 ||
		layout.MarginTop < 0 || layout.MarginRight < 0 ||
		layout.MarginBottom < 0 || layout.MarginLeft < 0 {
		return false
	}
	if layout.MarginLeft+layout.MarginRight >= layout.Width {
		return false
	}
	minContentHeight := rules.MaxFontHeight + 2*rules.MinRowPadding
	return layout.Height-layout.MarginTop-layout.MarginBottom >= minContentHeight
}

// normalizeStoredBase returns a normalized copy of base: layout defaults filled
// in, row tracks apportioned, and block styles defaulted. It is pure — it clones
// its input and never writes through to the caller's Base — so a load never
// mutates stored state (see record 0092).
func normalizeStoredBase(base Base, pageLayout PageLayout, rules LayoutRules) Base {
	base = cloneBase(base)
	if base.PageLayout == (PageLayout{}) {
		base.PageLayout = pageLayout
	}
	if base.LayoutRules == (LayoutRules{}) {
		base.LayoutRules = rules
	}
	for ri := range base.Rows {
		normalizeRowTracks(&base.Rows[ri])
		for bi := range base.Rows[ri].Blocks {
			normalizeBlockStyle(&base.Rows[ri].Blocks[bi].Style)
		}
	}
	return base
}

// Paginate derives stable one-based pages by accumulating canonical rows until
// the next row would exceed the page's usable height. Each row's height is the
// tallest block's line height plus the config-determined row padding. Header and
// Footer rows repeat on every page. PageBreak forces a new page; KeepWithNext
// moves the previous row to a new page when the current row doesn't fit.
func Paginate(base Base) ([]Page, error) {
	if !validLayoutRules(base.LayoutRules) || !validPageLayout(base.PageLayout, base.LayoutRules) {
		return nil, ErrInvalidContent
	}

	contentWidth := base.PageLayout.Width - base.PageLayout.MarginLeft - base.PageLayout.MarginRight
	headerHeight := rowsHeight(base.Header, base.LayoutRules, contentWidth)
	footerHeight := rowsHeight(base.Footer, base.LayoutRules, contentWidth)
	extraHeight := headerHeight + footerHeight
	usableHeight := base.PageLayout.Height - base.PageLayout.MarginTop - base.PageLayout.MarginBottom
	if extraHeight >= usableHeight {
		return nil, ErrInvalidContent
	}
	contentHeight := usableHeight - extraHeight

	pages := []Page{{Number: 1, RowIDs: []string{}}}
	for _, row := range base.Rows {
		height := rowHeight(row, base.LayoutRules, contentWidth)
		page := &pages[len(pages)-1]

		if row.Style.PageBreak && len(page.RowIDs) > 0 {
			pages = append(pages, Page{Number: len(pages) + 1, RowIDs: []string{}})
			page = &pages[len(pages)-1]
		}

		if len(page.RowIDs) > 0 && page.UsedHeight+height > contentHeight {
			lastID := page.RowIDs[len(page.RowIDs)-1]
			var keptRowID string
			var keptHeight LayoutUnit
			if prevRowKeepNext(base.Rows, lastID) {
				keptRowID = lastID
				keptHeight = rowHeight(rowByID(base.Rows, lastID), base.LayoutRules, contentWidth)
				page.RowIDs = page.RowIDs[:len(page.RowIDs)-1]
				page.UsedHeight -= keptHeight
			}
			pages = append(pages, Page{Number: len(pages) + 1, RowIDs: []string{}})
			if len(pages) >= 2 && len(pages[len(pages)-2].RowIDs) == 0 {
				pages[len(pages)-2] = pages[len(pages)-1]
				pages = pages[:len(pages)-1]
			}
			page = &pages[len(pages)-1]
			if keptRowID != "" {
				page.RowIDs = append(page.RowIDs, keptRowID)
				page.UsedHeight = keptHeight
			}
		}

		page.RowIDs = append(page.RowIDs, row.ID)
		page.UsedHeight += height
	}
	return pages, nil
}

func rowsHeight(rows []Row, rules LayoutRules, contentWidth LayoutUnit) LayoutUnit {
	var total LayoutUnit
	for _, row := range rows {
		total += rowHeight(row, rules, contentWidth)
	}
	return total
}

func prevRowKeepNext(rows []Row, prevID string) bool {
	for _, r := range rows {
		if r.ID == prevID {
			return r.Style.KeepWithNext
		}
	}
	return false
}

func rowByID(rows []Row, id string) Row {
	for _, r := range rows {
		if r.ID == id {
			return r
		}
	}
	return Row{}
}
