# changeset_apply.go

Current state companion for `changeset_apply.go`. Change operation application engine: applyChangeSets, applyOps, applyOpsWithInverse, applyOp, applyRowOp, cloneFormula.

## Code breakdown

```go
package document

import (
	"strings"
	"time"
)

func applyChangeSets(base Base, sets []ChangeSet) (Base, error) {
	current := cloneBase(base)
	for _, cs := range sets {
		var err error
		if current, err = applyOps(current, cs.Ops); err != nil {
			return Base{}, err
		}
	}
	return current, nil
}

// applyOps applies a slice of ops in order, stopping at the first that conflicts.
func applyOps(base Base, ops []ChangeOp) (Base, error) {
	var err error
	for _, op := range ops {
		if base, err = applyOp(base, op); err != nil {
			return Base{}, err
		}
	}
	return base, nil
}

// applyOpsWithInverse applies ops while computing the compensation that restores
// the exact input. Each op's inverse is prepended because undo must run the
// original batch backward. The returned base and inverse never alias the input.
func applyOpsWithInverse(base Base, ops []ChangeOp) (Base, []ChangeOp, error) {
	current := cloneBase(base)
	var inverse []ChangeOp
	for _, op := range ops {
		before := cloneBase(current)
		next, err := applyOp(current, op)
		if err != nil {
			return Base{}, nil, err
		}
		inv, err := inverseForOp(before, next, op)
		if err != nil {
			return Base{}, nil, err
		}
		inverse = append(inv, inverse...)
		current = next
	}
	return current, inverse, nil
}

// inverseForOp returns the operations that reverse op from its resulting state.
// Before/after snapshots make implicit side effects explicit: shortening text or
// deleting an atom can sanitize marks, so undo restores those removed marks too.
func applyOp(base Base, op ChangeOp) (Base, error) {
	switch op.Op {
	case OpPutStyleDefinition, OpDeleteStyleDefinition, OpSetStyleDefault,
		OpAssignBlockStyle, OpSetBlockStyleOverrides, OpSetBlockCustomTypography, OpReplaceStyle:
		return applyStyleOp(base, op)
	}
	if op.Op == OpSetPageLayout {
		if op.PageLayout == nil || !validPageLayout(*op.PageLayout, base.LayoutRules) {
			return Base{}, ErrInvalidChangeSet
		}
		base.PageLayout = *op.PageLayout
		return base, nil
	}
	if op.Op == OpSetDefaultTypography {
		// A nil or empty payload clears the document default; a present one is
		// bounded and stored verbatim.
		if op.CustomTypography == nil || op.CustomTypography.empty() {
			base.DefaultTypography = nil
			return base, nil
		}
		if err := validateCustomTypography(op.CustomTypography); err != nil {
			return Base{}, err
		}
		base.DefaultTypography = normalizeCustomTypography(op.CustomTypography)
		return base, nil
	}
	if op.Op == OpSetHeader {
		if op.Header == nil {
			return Base{}, ErrInvalidChangeSet
		}
		base.Header = cloneRows(op.Header)
		return base, nil
	}
	if op.Op == OpSetFooter {
		if op.Footer == nil {
			return Base{}, ErrInvalidChangeSet
		}
		base.Footer = cloneRows(op.Footer)
		return base, nil
	}
	if op.Op == OpSetTemplate {
		info := cloneTemplateInfo(op.Template)
		normalizeTemplateInfo(info)
		if err := validateTemplateInfo(info); err != nil {
			return Base{}, err
		}
		if templateClears(info) {
			base.Template = nil
		} else {
			base.Template = info
		}
		return base, nil
	}
	if op.Op == OpSetContextVariable {
		name := strings.TrimSpace(op.ContextVarName)
		v := base.Template.contextVariable(name)
		if name == "" || v == nil {
			return Base{}, ErrConflict // no template, or an undeclared variable
		}
		// Copy-on-write the template so the mutation never aliases the input base.
		info := cloneTemplateInfo(base.Template)
		target := info.contextVariable(name)
		if op.BoundResource != nil {
			// A resource binding replaces (and clears) the free-text binding.
			ref := *op.BoundResource
			target.BoundResource = &ref
			target.BoundContext = ""
		} else {
			target.BoundContext = strings.TrimSpace(op.BoundContext)
			target.BoundResource = nil
		}
		base.Template = info
		return base, nil
	}
	rows, err := applyRowOp(base.Rows, base.LayoutRules, base.StyleRegistry, op)
	if err != nil {
		return Base{}, err
	}
	base.Rows = rows
	return base, nil
}

// applyRowOp preserves the author's intent: an op whose anchor or target id is
// missing — or an insert that would duplicate an id, or a mark whose range does
// not fit the current atoms — returns ErrConflict rather than being relocated or
// dropped.
func applyRowOp(rows []Row, rules LayoutRules, registry StyleRegistry, op ChangeOp) ([]Row, error) {
	switch op.Op {
	case OpSpliceAtomText, OpMoveRow, OpMoveBlock, OpMoveAtom, OpUpdateMark, OpSplitBlock, OpJoinBlocks:
		return applyEditingOp(rows, rules, op)

	case OpSetRowTracks:
		ri := rowIndex(rows, op.RowID)
		if ri < 0 {
			return nil, ErrConflict
		}
		row := &rows[ri]
		if len(row.Blocks) <= 1 {
			if len(op.Tracks) > 0 {
				return nil, ErrConflict
			}
			row.Tracks = nil
			return rows, nil
		}
		contentWidth := 612 // default; validated against page layout at applyOp level
		if !validTracks(op.Tracks, rows, ri, contentWidth) {
			return nil, ErrInvalidChangeSet
		}
		row.Tracks = cloneTracks(op.Tracks)
		normalizeTrackWeights(row.Tracks)
		return rows, nil

	case OpResizeAdjacentTracks:
		ri := rowIndex(rows, op.RowID)
		if ri < 0 || rows[ri].Tracks == nil {
			return nil, ErrConflict
		}
		row := &rows[ri]
		leftIdx := indexOfBlock(row.Blocks, op.BlockID)
		rightIdx := indexOfBlock(row.Blocks, op.OtherBlockID)
		if leftIdx < 0 || rightIdx < 0 || leftIdx+1 != rightIdx {
			return nil, ErrConflict
		}
		if len(row.Tracks) != len(row.Blocks) ||
			row.Tracks[leftIdx].BlockID != op.BlockID ||
			row.Tracks[rightIdx].BlockID != op.OtherBlockID {
			return nil, ErrConflict
		}
		newLeft := row.Tracks[leftIdx].Weight + op.DeltaWeight
		newRight := row.Tracks[rightIdx].Weight - op.DeltaWeight
		if !validTrackWeight(newLeft) || !validTrackWeight(newRight) {
			return nil, ErrConflict
		}
		row.Tracks[leftIdx].Weight = newLeft
		row.Tracks[rightIdx].Weight = newRight
		return rows, nil

	case OpSetBlockLineHeight:
		ri, bi, ok := blockLoc(rows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		if op.LineHeight == nil || !validBlockLineHeight(*op.LineHeight, rules) {
			return nil, ErrInvalidChangeSet
		}
		rows[ri].Blocks[bi].Style.LineHeight = *op.LineHeight
		return rows, nil

	case OpSetBlockIndent:
		ri, bi, ok := blockLoc(rows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		if op.Indent == nil || !validBlockIndent(*op.Indent) {
			return nil, ErrInvalidChangeSet
		}
		rows[ri].Blocks[bi].Style.Indent = *op.Indent
		return rows, nil

	case OpSetRowFlow:
		i := rowIndex(rows, op.RowID)
		if i < 0 {
			return nil, ErrConflict
		}
		if op.PageBreak != nil {
			rows[i].Style.PageBreak = *op.PageBreak
		}
		if op.KeepWithNext != nil {
			rows[i].Style.KeepWithNext = *op.KeepWithNext
		}
		return rows, nil

	case OpSetBlockAlignment:
		ri, bi, ok := blockLoc(rows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		if op.HorizontalAlign != nil {
			rows[ri].Blocks[bi].Style.HorizontalAlign = *op.HorizontalAlign
		}
		if op.VerticalAlign != nil {
			rows[ri].Blocks[bi].Style.VerticalAlign = *op.VerticalAlign
		}
		return rows, nil

	case OpInsertRow:
		if op.Row == nil {
			return nil, ErrInvalidChangeSet
		}
		for _, block := range op.Row.Blocks {
			if !validStoredStyleRef(registry, block) || !validBlockSubKind(registry, block) {
				return nil, ErrConflict
			}
		}
		if rowIndex(rows, op.Row.ID) >= 0 {
			return nil, ErrConflict // duplicate row id
		}
		inserted := cloneRow(*op.Row)
		normalizeRowTracks(&inserted)
		if op.AfterRow == "" {
			return insertRowAt(rows, 0, inserted), nil
		}
		i := rowIndex(rows, op.AfterRow)
		if i < 0 {
			return nil, ErrConflict // anchor row is gone
		}
		return insertRowAt(rows, i+1, inserted), nil

	case OpDeleteRow:
		i := rowIndex(rows, op.RowID)
		if i < 0 {
			return nil, ErrConflict
		}
		return append(rows[:i:i], rows[i+1:]...), nil

	case OpInsertBlock:
		if op.Block == nil {
			return nil, ErrInvalidChangeSet
		}
		if blockExists(rows, op.Block.ID) {
			return nil, ErrConflict // duplicate block id
		}
		ri := rowIndex(rows, op.RowID)
		if ri < 0 {
			return nil, ErrConflict // target row is gone
		}
		block := cloneBlock(*op.Block)
		if !validStoredStyleRef(registry, block) || !validBlockSubKind(registry, block) {
			return nil, ErrConflict
		}
		if op.AfterBlock == "" {
			rows[ri].Blocks = insertBlockAt(rows[ri].Blocks, 0, block)
			normalizeRowTracks(&rows[ri])
			return rows, nil
		}
		bi := indexOfBlock(rows[ri].Blocks, op.AfterBlock)
		if bi < 0 {
			return nil, ErrConflict // anchor block is gone
		}
		rows[ri].Blocks = insertBlockAt(rows[ri].Blocks, bi+1, block)
		normalizeRowTracks(&rows[ri])
		return rows, nil

	case OpDeleteBlock:
		ri, bi, ok := blockLoc(rows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		b := rows[ri].Blocks
		rows[ri].Blocks = append(b[:bi:bi], b[bi+1:]...)
		normalizeRowTracks(&rows[ri])
		return rows, nil

	case OpSetBlock:
		ri, bi, ok := blockLoc(rows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		if op.SetKind != nil {
			block := &rows[ri].Blocks[bi]
			block.Kind = *op.SetKind
			// Keep the sub-kind consistent with the new kind: a text block
			// defaults to body, every other kind carries none.
			if block.Kind == BlockKindText {
				if block.SubKind == "" {
					block.SubKind = SubKindBody
				}
			} else {
				block.SubKind = ""
			}
			if !validStoredStyleRef(registry, *block) || !validBlockSubKind(registry, *block) {
				return nil, ErrConflict
			}
		}
		return rows, nil

	case OpSetBlockSubkind:
		ri, bi, ok := blockLoc(rows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		if op.SetSubKind == nil {
			return nil, ErrInvalidChangeSet
		}
		block := &rows[ri].Blocks[bi]
		if block.Kind != BlockKindText {
			return nil, ErrConflict // only text blocks carry a sub-kind
		}
		subKind := *op.SetSubKind
		if subKind == "" {
			subKind = SubKindBody
		}
		candidate := *block
		candidate.SubKind = subKind
		if !validBlockSubKind(registry, candidate) {
			return nil, ErrConflict
		}
		block.SubKind = subKind
		return rows, nil

	case OpSetBlockData:
		ri, bi, ok := blockLoc(rows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		block := &rows[ri].Blocks[bi]
		if block.Kind != BlockKindList {
			return nil, ErrConflict // only list blocks carry editable typed data
		}
		if op.ListData == nil {
			return nil, ErrInvalidChangeSet
		}
		data := cloneListBlockData(*op.ListData)
		if validateListBlockData(data) != nil {
			return nil, ErrInvalidChangeSet
		}
		block.Data = data
		return rows, nil

	case OpSetListType:
		ri, bi, ok := blockLoc(rows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		block := &rows[ri].Blocks[bi]
		data, isList := block.Data.(ListBlockData)
		if block.Kind != BlockKindList || !isList {
			return nil, ErrConflict
		}
		if op.SetListType == nil || !validListType(*op.SetListType) {
			return nil, ErrInvalidChangeSet
		}
		data = cloneListBlockData(data)
		data.Type = *op.SetListType
		if op.ListStart != nil {
			if *op.ListStart < 0 {
				return nil, ErrInvalidChangeSet
			}
			data.Start = *op.ListStart
		}
		block.Data = data
		return rows, nil

	case OpSetListItem:
		ri, bi, ok := blockLoc(rows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		block := &rows[ri].Blocks[bi]
		data, isList := block.Data.(ListBlockData)
		if block.Kind != BlockKindList || !isList {
			return nil, ErrConflict
		}
		if op.ListIndex < 0 || op.ListIndex > len(data.Items) {
			return nil, ErrConflict
		}
		data = cloneListBlockData(data)
		switch {
		case op.Item == nil:
			// Remove: an index past the last item has nothing to remove.
			if op.ListIndex >= len(data.Items) {
				return nil, ErrConflict
			}
			data.Items = append(data.Items[:op.ListIndex:op.ListIndex], data.Items[op.ListIndex+1:]...)
		default:
			item := cloneListItem(*op.Item)
			if validateListItem(item) != nil {
				return nil, ErrInvalidChangeSet
			}
			if op.ListIndex == len(data.Items) {
				if len(data.Items) >= MaxListItems {
					return nil, ErrConflict
				}
				data.Items = append(data.Items, item)
			} else {
				data.Items[op.ListIndex] = item
			}
		}
		block.Data = data
		return rows, nil

	case OpInsertAtom:
		if op.Atom == nil {
			return nil, ErrInvalidChangeSet
		}
		if atomExists(rows, op.Atom.ID) {
			return nil, ErrConflict // duplicate atom id
		}
		ri, bi, ok := blockLoc(rows, op.BlockID)
		if !ok {
			return nil, ErrConflict // target block is gone
		}
		blk := &rows[ri].Blocks[bi]
		if op.AfterAtom == "" {
			blk.Atoms = insertAtomAt(blk.Atoms, 0, *op.Atom)
			return rows, nil
		}
		ai := indexOfAtom(blk.Atoms, op.AfterAtom)
		if ai < 0 {
			return nil, ErrConflict // anchor atom is gone
		}
		blk.Atoms = insertAtomAt(blk.Atoms, ai+1, *op.Atom)
		return rows, nil

	case OpDeleteAtom:
		ri, bi, ok := blockLoc(rows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		blk := &rows[ri].Blocks[bi]
		ai := indexOfAtom(blk.Atoms, op.AtomID)
		if ai < 0 {
			return nil, ErrConflict
		}
		blk.Atoms = append(blk.Atoms[:ai:ai], blk.Atoms[ai+1:]...)
		sanitizeBlockMarks(blk)
		return rows, nil

	case OpSetAtomText:
		if op.SetText == nil {
			return nil, ErrInvalidChangeSet
		}
		ri, bi, ok := blockLoc(rows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		blk := &rows[ri].Blocks[bi]
		ai := indexOfAtom(blk.Atoms, op.AtomID)
		if ai < 0 {
			return nil, ErrConflict
		}
		blk.Atoms[ai].Text = *op.SetText
		sanitizeBlockMarks(blk)
		return rows, nil

	case OpAddMark:
		if op.Mark == nil {
			return nil, ErrInvalidChangeSet
		}
		ri, bi, ok := blockLoc(rows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		blk := &rows[ri].Blocks[bi]
		if indexOfMark(blk.Marks, op.Mark.ID) >= 0 {
			return nil, ErrConflict // duplicate mark id
		}
		if !validMarkRange(blk.Atoms, *op.Mark) {
			return nil, ErrConflict // range does not fit the current atoms
		}
		blk.Marks = append(blk.Marks, *op.Mark)
		return rows, nil

	case OpRemoveMark:
		ri, bi, ok := blockLoc(rows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		blk := &rows[ri].Blocks[bi]
		mi := indexOfMark(blk.Marks, op.MarkID)
		if mi < 0 {
			return nil, ErrConflict
		}
		blk.Marks = append(blk.Marks[:mi:mi], blk.Marks[mi+1:]...)
		return rows, nil

	case OpSetPrompt:
		if op.SetText == nil {
			return nil, ErrInvalidChangeSet
		}
		ri, bi, ok := blockLoc(rows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		blk := &rows[ri].Blocks[bi]
		if blk.Kind != BlockKindPrompt {
			return nil, ErrConflict // only a prompt block has an instruction
		}
		pd, _ := blk.Data.(PromptData)
		pd.Instruction = *op.SetText
		// The instruction changed, so the last resolution is stale: clear its
		// timestamp so a refresh re-resolves (the old output stays visible until
		// then).
		pd.ResolvedAt = time.Time{}
		blk.Data = pd
		return rows, nil

	case OpSetBlockContext:
		ri, bi, ok := blockLoc(rows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		blk := &rows[ri].Blocks[bi]
		blk.Context = cloneBlockContext(op.BlockContext)
		// The block's retrieval scope changed, so its last resolution is stale:
		// clear the timestamp so a refresh re-resolves (the old output stays
		// visible until then). The prior answer carryover is cleared too — it was
		// synthesized from a different source set, and feeding it to the next
		// resolution as a formatting draft leaks old-scope content into the new
		// scope. (set_prompt keeps the carryover: same scope, new question.)
		// Only a prompt block carries a resolution.
		if pd, ok := blk.Data.(PromptData); ok {
			pd.ResolvedAt = time.Time{}
			pd.LastInstruction = ""
			pd.LastOutput = ""
			blk.Data = pd
		}
		return rows, nil

	case OpSetBlockPersona:
		ri, bi, ok := blockLoc(rows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		blk := &rows[ri].Blocks[bi]
		if blk.Kind != BlockKindPrompt {
			return nil, ErrConflict // only a prompt block carries a persona
		}
		pd, _ := blk.Data.(PromptData)
		if op.BlockPersona != nil {
			ref := *op.BlockPersona
			pd.Persona = &ref
		} else {
			pd.Persona = nil
		}
		// The persona shapes resolution, so the last resolution is stale: clear the
		// timestamp so a refresh re-resolves under the new persona.
		pd.ResolvedAt = time.Time{}
		blk.Data = pd
		return rows, nil

	case OpResolveBlock:
		if op.Block == nil {
			return nil, ErrInvalidChangeSet
		}
		ri, bi, ok := blockLoc(rows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		blk := &rows[ri].Blocks[bi]
		if blk.Kind != BlockKindPrompt {
			return nil, ErrConflict // only a prompt block is resolved
		}
		nb := cloneBlock(*op.Block)
		rev := PromptOutputRevision{
			ID: newID(), Atoms: cloneAtoms(nb.Atoms), Marks: cloneMarks(nb.Marks),
			CreatedAt: time.Now().UTC(),
		}
		existingPD, _ := blk.Data.(PromptData)
		newPD, _ := nb.Data.(PromptData)
		newPD.OutputHistory = append(existingPD.OutputHistory, rev)
		blk.Atoms, blk.Marks, blk.Data, blk.Inferred = nb.Atoms, nb.Marks, newPD, true
		return rows, nil

	case OpSetAtomFormula:
		if op.Formula == nil {
			return nil, ErrInvalidChangeSet
		}
		ri, bi, ok := blockLoc(rows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		blk := &rows[ri].Blocks[bi]
		ai := indexOfAtom(blk.Atoms, op.AtomID)
		if ai < 0 {
			return nil, ErrConflict
		}
		atom := &blk.Atoms[ai]
		fd := cloneFormula(op.Formula)
		if fd.State == FormulaStateOK && fd.Result.Error == "" {
			atom.Text = fd.Result.Value
		} else if fd.State == FormulaStateError && fd.Result.Error != "" {
			atom.Text = fd.Result.Error
		}
		fd.History = append(fd.History, FormulaHistoryEntry{
			Result: fd.Result, Dependencies: fd.Dependencies,
			State: fd.State, EvaluatedAt: time.Now().UTC(),
		})
		atom.Kind = AtomKindFormula
		atom.Data = fd
		return rows, nil

	case OpRefreshFormula:
		ri, bi, ok := blockLoc(rows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		blk := &rows[ri].Blocks[bi]
		ai := indexOfAtom(blk.Atoms, op.AtomID)
		if ai < 0 || blk.Atoms[ai].Kind != AtomKindFormula {
			return nil, ErrConflict
		}
		atom := &blk.Atoms[ai]
		fd, ok := atom.Data.(FormulaData)
		if !ok {
			return nil, ErrConflict
		}
		if op.Formula != nil {
			if op.Formula.Expression != "" {
				fd.Expression = op.Formula.Expression
			}
			fd.Result = op.Formula.Result
			if op.Formula.State == FormulaStateOK && op.Formula.Result.Error == "" {
				atom.Text = op.Formula.Result.Value
			} else if op.Formula.State == FormulaStateError && op.Formula.Result.Error != "" {
				atom.Text = op.Formula.Result.Error
			}
			fd.History = append(fd.History, FormulaHistoryEntry{
				Result: op.Formula.Result, Dependencies: op.Formula.Dependencies,
				State: op.Formula.State, EvaluatedAt: time.Now().UTC(),
			})
		}
		atom.Data = fd
		return rows, nil

	case OpRestorePromptOutput:
		ri, bi, ok := blockLoc(rows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		blk := &rows[ri].Blocks[bi]
		if blk.Kind != BlockKindPrompt {
			return nil, ErrConflict
		}
		pd, ok := blk.Data.(PromptData)
		if !ok {
			return nil, ErrConflict
		}
		var found bool
		for _, rev := range pd.OutputHistory {
			if rev.ID == op.RevisionID {
				restored := PromptOutputRevision{
					ID:        newID(),
					Atoms:     cloneAtoms(rev.Atoms),
					Marks:     cloneMarks(rev.Marks),
					CreatedAt: time.Now().UTC(),
				}
				pd.OutputHistory = append(pd.OutputHistory, restored)
				blk.Atoms = cloneAtoms(restored.Atoms)
				blk.Marks = cloneMarks(restored.Marks)
				blk.Data = pd
				found = true
				break
			}
		}
		if !found {
			return nil, ErrConflict
		}
		return rows, nil
	}
	return nil, ErrInvalidChangeSet
}

func cloneFormula(fd *FormulaData) FormulaData {
	if fd == nil {
		return FormulaData{}
	}
	out := *fd
	if len(fd.Dependencies) > 0 {
		out.Dependencies = append([]FormulaDep(nil), fd.Dependencies...)
	}
	if len(fd.History) > 0 {
		out.History = append([]FormulaHistoryEntry(nil), fd.History...)
	}
	return out
}
```
