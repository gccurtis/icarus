package document

func diffBases(old, new Base, bounds DiffBounds) DiffResult {
	d := &differ{
		oldRows:    old.Rows,
		newRows:    new.Rows,
		oldIndex:   buildDiffRowIndex(old.Rows),
		newIndex:   buildDiffRowIndex(new.Rows),
		maxChanges: bounds.MaxChanges,
		maxTextLen: bounds.MaxTextLen,
	}
	if d.maxChanges <= 0 {
		d.maxChanges = 100
	}
	d.remaining = d.maxChanges
	if d.maxTextLen <= 0 {
		d.maxTextLen = 200
	}

	seenOld := map[string]bool{}
	for i, nr := range new.Rows {
		ore, ok := d.oldIndex[nr.ID]
		if !ok {
			d.addRow(nr, i)
		} else {
			seenOld[nr.ID] = true
			if ore.pos != i {
				d.add(DiffChange{Kind: "moved", Level: "row", ID: nr.ID, OldPos: ore.pos, NewPos: i})
			}
			d.diffBlocks(ore.pos, i)
		}
	}

	for i, or := range old.Rows {
		if !seenOld[or.ID] {
			d.add(DiffChange{Kind: "removed", Level: "row", ID: or.ID, OldPos: i})
		}
	}

	if d.remaining <= 0 {
		d.result.Truncated = true
		d.result.Changes = d.result.Changes[:d.maxChanges]
	}
	return d.result
}

type diffRowEntry struct {
	pos    int
	blocks map[string]diffBlockEntry
}

type diffBlockEntry struct {
	pos   int
	atoms map[string]diffAtomEntry
	marks map[string]int
}

type diffAtomEntry struct {
	pos int
}

func buildDiffRowIndex(rows []Row) map[string]diffRowEntry {
	idx := make(map[string]diffRowEntry, len(rows))
	for i, r := range rows {
		ri := diffRowEntry{pos: i, blocks: make(map[string]diffBlockEntry, len(r.Blocks))}
		for j, b := range r.Blocks {
			bi := diffBlockEntry{pos: j, atoms: make(map[string]diffAtomEntry, len(b.Atoms)), marks: make(map[string]int, len(b.Marks))}
			for k, a := range b.Atoms {
				bi.atoms[a.ID] = diffAtomEntry{pos: k}
			}
			for k, m := range b.Marks {
				bi.marks[m.ID] = k
			}
			ri.blocks[b.ID] = bi
		}
		idx[r.ID] = ri
	}
	return idx
}

type differ struct {
	oldRows    []Row
	newRows    []Row
	oldIndex   map[string]diffRowEntry
	newIndex   map[string]diffRowEntry
	result     DiffResult
	remaining  int
	maxChanges int
	maxTextLen int
}

func (d *differ) addRow(nr Row, pos int) {
	d.add(DiffChange{Kind: "added", Level: "row", ID: nr.ID, NewPos: pos})
	for i, b := range nr.Blocks {
		d.addBlock(b, nr.ID, i)
	}
}

func (d *differ) addBlock(b Block, rowID string, pos int) {
	d.add(DiffChange{Kind: "added", Level: "block", ID: b.ID, ParentID: rowID, NewPos: pos})
	for i, a := range b.Atoms {
		d.add(DiffChange{Kind: "added", Level: "atom", ID: a.ID, ParentID: b.ID, NewPos: i})
	}
	for i, m := range b.Marks {
		d.add(DiffChange{Kind: "added", Level: "mark", ID: m.ID, ParentID: b.ID, NewPos: i})
	}
}

func (d *differ) diffBlocks(oldRowPos, newRowPos int) {
	oldRow := d.oldRows[oldRowPos]
	newRow := d.newRows[newRowPos]
	oldBlocks := d.oldIndex[oldRow.ID].blocks
	seenOld := map[string]bool{}

	for i, nb := range newRow.Blocks {
		obe, ok := oldBlocks[nb.ID]
		if !ok {
			d.addBlock(nb, newRow.ID, i)
		} else {
			seenOld[nb.ID] = true
			if obe.pos != i {
				d.add(DiffChange{Kind: "moved", Level: "block", ID: nb.ID, ParentID: newRow.ID, OldPos: obe.pos, NewPos: i})
			}
			ob := oldRow.Blocks[obe.pos]
			if nb.Kind != ob.Kind {
				d.add(DiffChange{Kind: "content-changed", Level: "block", ID: nb.ID, OldKind: ob.Kind, NewKind: nb.Kind})
			}
			d.diffAtoms(ob, nb)
			d.diffMarks(ob, nb)
		}
	}

	for i, ob := range oldRow.Blocks {
		if !seenOld[ob.ID] {
			d.add(DiffChange{Kind: "removed", Level: "block", ID: ob.ID, ParentID: oldRow.ID, OldPos: i})
		}
	}
}

func (d *differ) diffAtoms(oldBlock, newBlock Block) {
	oldAtoms := oldBlockIndex(d.oldRows, d.oldIndex, oldBlock.ID).atoms
	seenOld := map[string]bool{}

	for i, na := range newBlock.Atoms {
		oae, ok := oldAtoms[na.ID]
		if !ok {
			d.add(DiffChange{Kind: "added", Level: "atom", ID: na.ID, ParentID: newBlock.ID, NewPos: i})
		} else {
			seenOld[na.ID] = true
			if oae.pos != i {
				d.add(DiffChange{Kind: "moved", Level: "atom", ID: na.ID, ParentID: newBlock.ID, OldPos: oae.pos, NewPos: i})
			}
			oa := oldBlock.Atoms[oae.pos]
			if na.Kind != oa.Kind || na.Text != oa.Text {
				ch := DiffChange{Kind: "content-changed", Level: "atom", ID: na.ID}
				if na.Kind != oa.Kind {
					ch.OldKind = oa.Kind
					ch.NewKind = na.Kind
				}
				if d.maxTextLen > 0 {
					ch.OldText = capText(oa.Text, d.maxTextLen)
					ch.NewText = capText(na.Text, d.maxTextLen)
				}
				d.add(ch)
			}
		}
	}

	for _, oa := range oldBlock.Atoms {
		if !seenOld[oa.ID] {
			d.add(DiffChange{Kind: "removed", Level: "atom", ID: oa.ID, ParentID: oldBlock.ID, OldPos: oldAtoms[oa.ID].pos})
		}
	}
}

func (d *differ) diffMarks(oldBlock, newBlock Block) {
	oldMarks := oldBlockIndex(d.oldRows, d.oldIndex, oldBlock.ID).marks
	seenOld := map[string]bool{}

	for i, nm := range newBlock.Marks {
		if _, ok := oldMarks[nm.ID]; !ok {
			d.add(DiffChange{Kind: "added", Level: "mark", ID: nm.ID, ParentID: newBlock.ID, NewPos: i})
		} else {
			seenOld[nm.ID] = true
		}
	}

	for _, om := range oldBlock.Marks {
		if !seenOld[om.ID] {
			d.add(DiffChange{Kind: "removed", Level: "mark", ID: om.ID, ParentID: oldBlock.ID, OldPos: oldMarks[om.ID]})
		}
	}
}

func (d *differ) add(ch DiffChange) {
	if d.remaining <= 0 {
		return
	}
	d.remaining--
	d.result.Changes = append(d.result.Changes, ch)
}

func oldBlockIndex(rows []Row, idx map[string]diffRowEntry, blockID string) diffBlockEntry {
	for _, r := range rows {
		if be, ok := idx[r.ID].blocks[blockID]; ok {
			return be
		}
	}
	return diffBlockEntry{}
}

func capText(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	runes := 0
	for i := range s {
		runes++
		if runes > maxLen {
			return s[:i] + "..."
		}
	}
	return s
}
