# clone.go

Current state companion for `clone.go`. Deep-copy suite (cloneBase, cloneRows, cloneRow, cloneBlock, cloneAtoms, cloneChangeOps, etc.), lookup helpers, insert helpers, and mark range utilities.

## Code breakdown

```go
package document

import (
	"unicode/utf8"
)

// --- deep copies (never share slices with the base or with op payloads) ---

func cloneBase(base Base) Base {
	base.StyleRegistry = cloneStyleRegistry(base.StyleRegistry)
	if base.DefaultTypography != nil {
		custom := *base.DefaultTypography
		base.DefaultTypography = &custom
	}
	base.Header = cloneRows(base.Header)
	base.Footer = cloneRows(base.Footer)
	base.Rows = cloneRows(base.Rows)
	return base
}

// cloneStoredBase makes a fully independent copy of a stored Base for handing
// out on load. It is cloneBase plus the Template (which cloneBase leaves
// shared), so a caller that mutates a loaded document cannot alter stored state
// or race a concurrent load. Use this on the store's read path.
func cloneStoredBase(base Base) Base {
	base = cloneBase(base)
	base.Template = cloneTemplateInfo(base.Template)
	return base
}

func cloneRows(rows []Row) []Row {
	if len(rows) == 0 {
		return nil
	}
	out := make([]Row, len(rows))
	for i, r := range rows {
		out[i] = cloneRow(r)
	}
	return out
}

func cloneMarks(marks []Mark) []Mark {
	if len(marks) == 0 {
		return nil
	}
	out := make([]Mark, len(marks))
	for i, m := range marks {
		out[i] = cloneMark(m)
	}
	return out
}

func cloneChangeOps(ops []ChangeOp) []ChangeOp {
	out := make([]ChangeOp, len(ops))
	for i, op := range ops {
		out[i] = op
		if op.Row != nil {
			row := cloneRow(*op.Row)
			out[i].Row = &row
		}
		if op.Block != nil {
			block := cloneBlock(*op.Block)
			out[i].Block = &block
		}
		if op.Atom != nil {
			atom := *op.Atom
			out[i].Atom = &atom
		}
		if op.Mark != nil {
			mark := cloneMark(*op.Mark)
			out[i].Mark = &mark
		}
		if op.Style != nil {
			style := cloneStyleDefinition(*op.Style)
			out[i].Style = &style
		}
		if op.StyleRef != nil {
			out[i].StyleRef = cloneBlockStyleRef(op.StyleRef)
		}
		if op.StyleOverrides != nil {
			overrides := cloneStyleOverrides(*op.StyleOverrides)
			out[i].StyleOverrides = &overrides
		}
		if op.CustomTypography != nil {
			custom := *op.CustomTypography
			out[i].CustomTypography = &custom
		}
		if op.Template != nil {
			out[i].Template = cloneTemplateInfo(op.Template)
		}
		if op.PageLayout != nil {
			layout := *op.PageLayout
			out[i].PageLayout = &layout
		}
		if op.SetKind != nil {
			kind := *op.SetKind
			out[i].SetKind = &kind
		}
		if op.SetSubKind != nil {
			subKind := *op.SetSubKind
			out[i].SetSubKind = &subKind
		}
		if op.ListData != nil {
			data := cloneListBlockData(*op.ListData)
			out[i].ListData = &data
		}
		if op.SetListType != nil {
			listType := *op.SetListType
			out[i].SetListType = &listType
		}
		if op.ListStart != nil {
			start := *op.ListStart
			out[i].ListStart = &start
		}
		if op.Item != nil {
			item := cloneListItem(*op.Item)
			out[i].Item = &item
		}
		if op.SetText != nil {
			text := *op.SetText
			out[i].SetText = &text
		}
		if op.InsertText != nil {
			text := *op.InsertText
			out[i].InsertText = &text
		}
		if op.LineHeight != nil {
			height := *op.LineHeight
			out[i].LineHeight = &height
		}
		if op.Indent != nil {
			indent := *op.Indent
			out[i].Indent = &indent
		}
		if op.HorizontalAlign != nil {
			alignment := *op.HorizontalAlign
			out[i].HorizontalAlign = &alignment
		}
		if op.VerticalAlign != nil {
			alignment := *op.VerticalAlign
			out[i].VerticalAlign = &alignment
		}
		if len(op.Tracks) > 0 {
			out[i].Tracks = cloneTracks(op.Tracks)
		}
		if op.PageBreak != nil {
			pb := *op.PageBreak
			out[i].PageBreak = &pb
		}
		if op.KeepWithNext != nil {
			kn := *op.KeepWithNext
			out[i].KeepWithNext = &kn
		}
		if len(op.Header) > 0 {
			out[i].Header = cloneRows(op.Header)
		}
		if len(op.Footer) > 0 {
			out[i].Footer = cloneRows(op.Footer)
		}
		if op.Formula != nil {
			fd := cloneFormula(op.Formula)
			out[i].Formula = &fd
		}
	}
	return out
}

func cloneChangeSet(cs ChangeSet) ChangeSet {
	cs.Ops = cloneChangeOps(cs.Ops)
	cs.InverseOps = cloneChangeOps(cs.InverseOps)
	cs.Summary = cloneChangeSummary(cs.Summary)
	return cs
}

func cloneRow(r Row) Row {
	blocks := make([]Block, len(r.Blocks))
	for i, b := range r.Blocks {
		blocks[i] = cloneBlock(b)
	}
	return Row{ID: r.ID, Style: r.Style, Tracks: cloneTracks(r.Tracks), Blocks: blocks}
}

func cloneBlock(b Block) Block {
	atoms := cloneAtoms(b.Atoms)
	var marks []Mark
	if len(b.Marks) > 0 {
		marks = make([]Mark, len(b.Marks))
		for i, mark := range b.Marks {
			marks[i] = cloneMark(mark)
		}
	}
	return Block{
		ID: b.ID, Kind: b.Kind, SubKind: b.SubKind, Style: b.Style, Inferred: b.Inferred,
		StyleRef: cloneBlockStyleRef(b.StyleRef), Atoms: atoms, Marks: marks, Data: cloneBlockData(b.Data),
		Context: cloneBlockContext(b.Context),
	}
}

func cloneAtoms(atoms []Atom) []Atom {
	if len(atoms) == 0 {
		return nil
	}
	out := make([]Atom, len(atoms))
	copy(out, atoms)
	for i := range out {
		out[i].Data = cloneAtomData(out[i].Data)
	}
	return out
}

func cloneAtomData(d AtomData) AtomData {
	if fd, ok := d.(FormulaData); ok {
		if len(fd.Dependencies) > 0 {
			fd.Dependencies = append([]FormulaDep(nil), fd.Dependencies...)
		}
		if len(fd.History) > 0 {
			fd.History = append([]FormulaHistoryEntry(nil), fd.History...)
		}
		return fd
	}
	return d
}

func cloneMark(mark Mark) Mark {
	if len(mark.Attrs) > 0 {
		attrs := make(map[string]string, len(mark.Attrs))
		for key, value := range mark.Attrs {
			attrs[key] = value
		}
		mark.Attrs = attrs
	}
	return mark
}

// cloneBlockData deep-copies a block's typed payload so a clone never shares the
// payload's slices with the original. Only PromptData exists today.
func cloneBlockData(d BlockData) BlockData {
	switch v := d.(type) {
	case PromptData:
		if len(v.Evidence) > 0 {
			v.Evidence = append([]EvidenceSpan(nil), v.Evidence...)
		}
		if len(v.Sources) > 0 {
			v.Sources = append([]SourceVersion(nil), v.Sources...)
		}
		if len(v.OutputHistory) > 0 {
			v.OutputHistory = append([]PromptOutputRevision(nil), v.OutputHistory...)
		}
		if v.Persona != nil {
			ref := *v.Persona
			v.Persona = &ref
		}
		return v
	case ListBlockData:
		return cloneListBlockData(v)
	case ImageData:
		return v
	default:
		return d
	}
}

// cloneListBlockData deep-copies a list's items so a clone never shares an item's
// atom or mark slices with the original.
func cloneListBlockData(d ListBlockData) ListBlockData {
	if len(d.Items) == 0 {
		d.Items = nil
		return d
	}
	items := make([]ListItem, len(d.Items))
	for i, it := range d.Items {
		items[i] = cloneListItem(it)
	}
	d.Items = items
	return d
}

// cloneListItem deep-copies one list item's atoms and marks.
func cloneListItem(it ListItem) ListItem {
	return ListItem{
		Level:   it.Level,
		Checked: it.Checked,
		Atoms:   cloneAtoms(it.Atoms),
		Marks:   cloneMarks(it.Marks),
	}
}

// --- lookups ---

// blockExists reports whether any row contains a block with the given id.
func blockExists(rows []Row, id string) bool {
	_, _, ok := blockLoc(rows, id)
	return ok
}

// blockLoc returns the row and block index of the block with the given id.
func blockLoc(rows []Row, id string) (int, int, bool) {
	for ri := range rows {
		if bi := indexOfBlock(rows[ri].Blocks, id); bi >= 0 {
			return ri, bi, true
		}
	}
	return 0, 0, false
}

// atomExists reports whether any block anywhere contains an atom with the id.
func atomExists(rows []Row, id string) bool {
	for ri := range rows {
		for bi := range rows[ri].Blocks {
			if indexOfAtom(rows[ri].Blocks[bi].Atoms, id) >= 0 {
				return true
			}
		}
	}
	return false
}

func rowIndex(rows []Row, id string) int {
	for i := range rows {
		if rows[i].ID == id {
			return i
		}
	}
	return -1
}

func indexOfBlock(blocks []Block, id string) int {
	for i := range blocks {
		if blocks[i].ID == id {
			return i
		}
	}
	return -1
}

func indexOfAtom(atoms []Atom, id string) int {
	for i := range atoms {
		if atoms[i].ID == id {
			return i
		}
	}
	return -1
}

func indexOfMark(marks []Mark, id string) int {
	for i := range marks {
		if marks[i].ID == id {
			return i
		}
	}
	return -1
}

// --- inserts ---

func insertRowAt(rows []Row, i int, r Row) []Row {
	out := make([]Row, 0, len(rows)+1)
	out = append(out, rows[:i]...)
	out = append(out, r)
	return append(out, rows[i:]...)
}

func insertBlockAt(blocks []Block, i int, b Block) []Block {
	out := make([]Block, 0, len(blocks)+1)
	out = append(out, blocks[:i]...)
	out = append(out, b)
	return append(out, blocks[i:]...)
}

func insertAtomAt(atoms []Atom, i int, a Atom) []Atom {
	out := make([]Atom, 0, len(atoms)+1)
	out = append(out, atoms[:i]...)
	out = append(out, a)
	return append(out, atoms[i:]...)
}

// --- mark ranges ---

// validMarkRange reports whether a mark's Start..End is a non-empty, ordered
// range over existing atoms, at rune boundaries.
func validMarkRange(atoms []Atom, m Mark) bool {
	if !validAnchor(atoms, m.Start) || !validAnchor(atoms, m.End) {
		return false
	}
	return anchorLess(atoms, m.Start, m.End)
}

// validAnchor reports whether an anchor points at a rune boundary within an
// existing atom of the block.
func validAnchor(atoms []Atom, a Anchor) bool {
	i := indexOfAtom(atoms, a.AtomID)
	if i < 0 {
		return false
	}
	text := atoms[i].Text
	if a.Offset < 0 || a.Offset > len(text) {
		return false
	}
	return a.Offset == len(text) || utf8.RuneStart(text[a.Offset])
}

// anchorLess reports whether anchor a comes strictly before b, ordering by the
// atom's position in the block and then by byte offset.
func anchorLess(atoms []Atom, a, b Anchor) bool {
	ai, bi := indexOfAtom(atoms, a.AtomID), indexOfAtom(atoms, b.AtomID)
	if ai != bi {
		return ai < bi
	}
	return a.Offset < b.Offset
}

// sanitizeBlockMarks drops marks whose range no longer fits the block's atoms —
// after an atom is removed or its text shrinks — keeping the block's marks valid.
func sanitizeBlockMarks(b *Block) {
	if len(b.Marks) == 0 {
		return
	}
	kept := make([]Mark, 0, len(b.Marks))
	for _, m := range b.Marks {
		if validMarkRange(b.Atoms, m) {
			kept = append(kept, m)
		}
	}
	b.Marks = kept
}
```
