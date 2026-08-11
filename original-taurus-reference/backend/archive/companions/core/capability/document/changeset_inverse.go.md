# changeset_inverse.go

Current state companion for `changeset_inverse.go`. Inverse computation for every operation kind plus inverse helpers.

## Code breakdown

```go
package document

import "strings"

func inverseForOp(before, after Base, op ChangeOp) ([]ChangeOp, error) {
	beforeRows, afterRows := before.Rows, after.Rows
	switch op.Op {
	case OpSetPageLayout:
		layout := before.PageLayout
		return []ChangeOp{{Op: OpSetPageLayout, PageLayout: &layout}}, nil

	case OpSetDefaultTypography:
		// Restore the prior document default; a nil prior clears it on apply.
		var prior *CustomTypography
		if before.DefaultTypography != nil {
			custom := *before.DefaultTypography
			prior = &custom
		}
		return []ChangeOp{{Op: OpSetDefaultTypography, CustomTypography: prior}}, nil

	case OpPutStyleDefinition:
		if op.Style == nil {
			return nil, ErrInvalidChangeSet
		}
		if definition, _, ok := styleDefinitionByID(before.StyleRegistry, op.Style.ID); ok {
			copy := cloneStyleDefinition(definition)
			return []ChangeOp{{Op: OpPutStyleDefinition, Style: &copy}}, nil
		}
		return []ChangeOp{{Op: OpDeleteStyleDefinition, StyleID: op.Style.ID}}, nil

	case OpDeleteStyleDefinition:
		definition, _, ok := styleDefinitionByID(before.StyleRegistry, op.StyleID)
		if !ok {
			return nil, ErrConflict
		}
		copy := cloneStyleDefinition(definition)
		return []ChangeOp{{Op: OpPutStyleDefinition, Style: &copy}}, nil

	case OpSetStyleDefault:
		if !blockKinds[op.DefaultBlockKind] {
			return nil, ErrConflict
		}
		inverse := ChangeOp{Op: OpSetStyleDefault, DefaultBlockKind: op.DefaultBlockKind}
		if index := styleDefaultIndex(before.StyleRegistry.Defaults, op.DefaultBlockKind); index >= 0 {
			inverse.StyleID = before.StyleRegistry.Defaults[index].StyleID
		}
		return []ChangeOp{inverse}, nil

	case OpAssignBlockStyle:
		ri, bi, ok := blockLoc(beforeRows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		inverse := ChangeOp{Op: OpAssignBlockStyle, BlockID: op.BlockID, StyleRef: &BlockStyleRef{}}
		if beforeRows[ri].Blocks[bi].StyleRef != nil {
			inverse.StyleRef = cloneBlockStyleRef(beforeRows[ri].Blocks[bi].StyleRef)
		}
		return []ChangeOp{inverse}, nil

	case OpSetBlockStyleOverrides:
		ri, bi, ok := blockLoc(beforeRows, op.BlockID)
		if !ok || beforeRows[ri].Blocks[bi].StyleRef == nil {
			return nil, ErrConflict
		}
		overrides := cloneStyleOverrides(beforeRows[ri].Blocks[bi].StyleRef.Overrides)
		return []ChangeOp{{Op: OpSetBlockStyleOverrides, BlockID: op.BlockID, StyleOverrides: &overrides}}, nil

	case OpSetBlockCustomTypography:
		ri, bi, ok := blockLoc(beforeRows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		// Restore whatever custom typography the block carried before (nil = clear).
		var before *CustomTypography
		if ref := beforeRows[ri].Blocks[bi].StyleRef; ref != nil && ref.Overrides.Custom != nil {
			value := *ref.Overrides.Custom
			before = &value
		}
		return []ChangeOp{{Op: OpSetBlockCustomTypography, BlockID: op.BlockID, CustomTypography: before}}, nil

	case OpReplaceStyle:
		definition, _, ok := styleDefinitionByID(before.StyleRegistry, op.StyleID)
		if !ok {
			return nil, ErrConflict
		}
		usage := styleUsage(before, op.StyleID)
		inverse := []ChangeOp{{Op: OpPutStyleDefinition, Style: func() *StyleDefinition {
			copy := cloneStyleDefinition(definition)
			return &copy
		}()}}
		for _, blockKind := range usage.DefaultKinds {
			inverse = append(inverse, ChangeOp{Op: OpSetStyleDefault, DefaultBlockKind: blockKind, StyleID: op.StyleID})
		}
		for _, usageBlock := range usage.Blocks {
			ref := usageBlock.Ref
			inverse = append(inverse, ChangeOp{Op: OpAssignBlockStyle, BlockID: usageBlock.BlockID, StyleRef: &ref})
		}
		return inverse, nil

	case OpSetRowTracks:
		i := rowIndex(beforeRows, op.RowID)
		if i < 0 || beforeRows[i].Tracks == nil {
			return nil, ErrConflict
		}
		tracks := cloneTracks(beforeRows[i].Tracks)
		return []ChangeOp{{Op: OpSetRowTracks, RowID: op.RowID, Tracks: tracks}}, nil

	case OpSetBlockLineHeight:
		ri, bi, ok := blockLoc(beforeRows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		height := beforeRows[ri].Blocks[bi].Style.LineHeight
		return []ChangeOp{{Op: OpSetBlockLineHeight, BlockID: op.BlockID, LineHeight: &height}}, nil

	case OpSetBlockIndent:
		ri, bi, ok := blockLoc(beforeRows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		indent := beforeRows[ri].Blocks[bi].Style.Indent
		return []ChangeOp{{Op: OpSetBlockIndent, BlockID: op.BlockID, Indent: &indent}}, nil

	case OpSetRowFlow:
		i := rowIndex(beforeRows, op.RowID)
		if i < 0 {
			return nil, ErrConflict
		}
		inv := ChangeOp{Op: OpSetRowFlow, RowID: op.RowID}
		if op.PageBreak != nil {
			pb := beforeRows[i].Style.PageBreak
			inv.PageBreak = &pb
		}
		if op.KeepWithNext != nil {
			kn := beforeRows[i].Style.KeepWithNext
			inv.KeepWithNext = &kn
		}
		return []ChangeOp{inv}, nil

	case OpSetHeader:
		header := cloneRows(before.Header)
		return []ChangeOp{{Op: OpSetHeader, Header: header}}, nil

	case OpSetFooter:
		footer := cloneRows(before.Footer)
		return []ChangeOp{{Op: OpSetFooter, Footer: footer}}, nil

	case OpSetTemplate:
		// Restore the prior descriptor (a nil prior clears the template on apply).
		return []ChangeOp{{Op: OpSetTemplate, Template: cloneTemplateInfo(before.Template)}}, nil

	case OpSetContextVariable:
		// Restore the variable's prior binding — free text or a resource ref.
		var prior string
		var priorRes *ResourceRef
		if v := before.Template.contextVariable(strings.TrimSpace(op.ContextVarName)); v != nil {
			prior = v.BoundContext
			if v.BoundResource != nil {
				ref := *v.BoundResource
				priorRes = &ref
			}
		}
		return []ChangeOp{{Op: OpSetContextVariable, ContextVarName: op.ContextVarName, BoundContext: prior, BoundResource: priorRes}}, nil

	case OpResizeAdjacentTracks:
		ri := rowIndex(beforeRows, op.RowID)
		if ri < 0 || beforeRows[ri].Tracks == nil {
			return nil, ErrConflict
		}
		delta := -op.DeltaWeight
		return []ChangeOp{{
			Op: OpResizeAdjacentTracks, RowID: op.RowID,
			BlockID: op.BlockID, OtherBlockID: op.OtherBlockID,
			DeltaWeight: delta,
		}}, nil

	case OpSetBlockAlignment:
		ri, bi, ok := blockLoc(beforeRows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		inverse := ChangeOp{Op: OpSetBlockAlignment, BlockID: op.BlockID}
		if op.HorizontalAlign != nil {
			value := beforeRows[ri].Blocks[bi].Style.HorizontalAlign
			inverse.HorizontalAlign = &value
		}
		if op.VerticalAlign != nil {
			value := beforeRows[ri].Blocks[bi].Style.VerticalAlign
			inverse.VerticalAlign = &value
		}
		return []ChangeOp{inverse}, nil

	case OpInsertRow:
		return []ChangeOp{{Op: OpDeleteRow, RowID: op.Row.ID}}, nil

	case OpDeleteRow:
		i := rowIndex(beforeRows, op.RowID)
		if i < 0 {
			return nil, ErrConflict
		}
		afterRow := ""
		if i > 0 {
			afterRow = beforeRows[i-1].ID
		}
		row := cloneRow(beforeRows[i])
		return []ChangeOp{{Op: OpInsertRow, AfterRow: afterRow, Row: &row}}, nil

	case OpInsertBlock:
		return []ChangeOp{{Op: OpDeleteBlock, BlockID: op.Block.ID}}, nil

	case OpDeleteBlock:
		ri, bi, ok := blockLoc(beforeRows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		afterBlock := ""
		if bi > 0 {
			afterBlock = beforeRows[ri].Blocks[bi-1].ID
		}
		block := cloneBlock(beforeRows[ri].Blocks[bi])
		return []ChangeOp{{
			Op: OpInsertBlock, RowID: beforeRows[ri].ID, AfterBlock: afterBlock, Block: &block,
		}}, nil

	case OpSetBlock:
		ri, bi, ok := blockLoc(beforeRows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		kind := beforeRows[ri].Blocks[bi].Kind
		return []ChangeOp{{Op: OpSetBlock, BlockID: op.BlockID, SetKind: &kind}}, nil

	case OpSetBlockSubkind:
		ri, bi, ok := blockLoc(beforeRows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		subKind := beforeRows[ri].Blocks[bi].SubKind
		return []ChangeOp{{Op: OpSetBlockSubkind, BlockID: op.BlockID, SetSubKind: &subKind}}, nil

	case OpSetBlockData, OpSetListType, OpSetListItem:
		// Any list-data mutation inverts by restoring the block's whole prior
		// list payload — set_block_data with the pre-op ListBlockData.
		ri, bi, ok := blockLoc(beforeRows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		prior, isList := beforeRows[ri].Blocks[bi].Data.(ListBlockData)
		if beforeRows[ri].Blocks[bi].Kind != BlockKindList || !isList {
			return nil, ErrConflict
		}
		data := cloneListBlockData(prior)
		return []ChangeOp{{Op: OpSetBlockData, BlockID: op.BlockID, ListData: &data}}, nil

	case OpInsertAtom:
		return []ChangeOp{{Op: OpDeleteAtom, BlockID: op.BlockID, AtomID: op.Atom.ID}}, nil

	case OpDeleteAtom:
		ri, bi, ok := blockLoc(beforeRows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		ai := indexOfAtom(beforeRows[ri].Blocks[bi].Atoms, op.AtomID)
		if ai < 0 {
			return nil, ErrConflict
		}
		afterAtom := ""
		if ai > 0 {
			afterAtom = beforeRows[ri].Blocks[bi].Atoms[ai-1].ID
		}
		atom := beforeRows[ri].Blocks[bi].Atoms[ai]
		inverse := []ChangeOp{{
			Op: OpInsertAtom, BlockID: op.BlockID, AfterAtom: afterAtom, Atom: &atom,
		}}
		return append(inverse, restoreSanitizedMarks(beforeRows[ri].Blocks[bi], blockByID(afterRows, op.BlockID))...), nil

	case OpSetAtomText:
		ri, bi, ok := blockLoc(beforeRows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		ai := indexOfAtom(beforeRows[ri].Blocks[bi].Atoms, op.AtomID)
		if ai < 0 {
			return nil, ErrConflict
		}
		text := beforeRows[ri].Blocks[bi].Atoms[ai].Text
		inverse := []ChangeOp{{
			Op: OpSetAtomText, BlockID: op.BlockID, AtomID: op.AtomID, SetText: &text,
		}}
		return append(inverse, restoreSanitizedMarks(beforeRows[ri].Blocks[bi], blockByID(afterRows, op.BlockID))...), nil

	case OpSpliceAtomText, OpMoveRow, OpMoveBlock, OpMoveAtom, OpUpdateMark, OpSplitBlock, OpJoinBlocks:
		return inverseEditingOp(before, after, op)

	case OpAddMark:
		return []ChangeOp{{Op: OpRemoveMark, BlockID: op.BlockID, MarkID: op.Mark.ID}}, nil

	case OpRemoveMark:
		ri, bi, ok := blockLoc(beforeRows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		mi := indexOfMark(beforeRows[ri].Blocks[bi].Marks, op.MarkID)
		if mi < 0 {
			return nil, ErrConflict
		}
		return restoreSanitizedMarks(
			beforeRows[ri].Blocks[bi],
			afterRows[ri].Blocks[bi],
		), nil

	case OpSetPrompt, OpResolveBlock, OpSetBlockPersona:
		// All three change only the prompt block's PromptData (instruction, output,
		// or persona — each clearing ResolvedAt), so restoring the prior block's
		// data via resolve_block restores the prior persona and ResolvedAt too.
		ri, bi, ok := blockLoc(beforeRows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		block := cloneBlock(beforeRows[ri].Blocks[bi])
		return []ChangeOp{{Op: OpResolveBlock, BlockID: op.BlockID, Block: &block}}, nil

	case OpSetBlockContext:
		ri, bi, ok := blockLoc(beforeRows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		prior := beforeRows[ri].Blocks[bi]
		// Restore the prior context selection. For a prompt block, also restore the
		// prior prompt data (which carries the prior ResolvedAt that apply cleared)
		// by replacing the block's resolved output — mirroring set_prompt's inverse.
		inverse := []ChangeOp{{Op: OpSetBlockContext, BlockID: op.BlockID, BlockContext: cloneBlockContext(prior.Context)}}
		if prior.Kind == BlockKindPrompt {
			block := cloneBlock(prior)
			inverse = append(inverse, ChangeOp{Op: OpResolveBlock, BlockID: op.BlockID, Block: &block})
		}
		return inverse, nil

	case OpSetAtomFormula:
		ri, bi, ok := blockLoc(beforeRows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		ai := indexOfAtom(beforeRows[ri].Blocks[bi].Atoms, op.AtomID)
		if ai < 0 {
			return nil, ErrConflict
		}
		beforeAtom := beforeRows[ri].Blocks[bi].Atoms[ai]
		if fd, ok := beforeAtom.Data.(FormulaData); ok {
			cf := cloneFormula(&fd)
			return []ChangeOp{{Op: OpSetAtomFormula, BlockID: op.BlockID, AtomID: op.AtomID, Formula: &cf}}, nil
		}
		text := beforeAtom.Text
		return []ChangeOp{{Op: OpSetAtomText, BlockID: op.BlockID, AtomID: op.AtomID, SetText: &text}}, nil

	case OpRefreshFormula:
		ri, bi, ok := blockLoc(beforeRows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		ai := indexOfAtom(beforeRows[ri].Blocks[bi].Atoms, op.AtomID)
		if ai < 0 {
			return nil, ErrConflict
		}
		fd, ok := beforeRows[ri].Blocks[bi].Atoms[ai].Data.(FormulaData)
		if !ok {
			return nil, ErrConflict
		}
		cf := cloneFormula(&fd)
		return []ChangeOp{{Op: OpSetAtomFormula, BlockID: op.BlockID, AtomID: op.AtomID, Formula: &cf}}, nil

	case OpRestorePromptOutput:
		ri, bi, ok := blockLoc(beforeRows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		block := cloneBlock(beforeRows[ri].Blocks[bi])
		return []ChangeOp{{Op: OpResolveBlock, BlockID: op.BlockID, Block: &block}}, nil
	}
	return nil, ErrInvalidChangeSet
}

func blockByID(rows []Row, id string) Block {
	ri, bi, ok := blockLoc(rows, id)
	if !ok {
		return Block{}
	}
	return rows[ri].Blocks[bi]
}

func restoreSanitizedMarks(before, after Block) []ChangeOp {
	sameOrder := len(before.Marks) == len(after.Marks)
	if sameOrder {
		for i := range before.Marks {
			if before.Marks[i].ID != after.Marks[i].ID {
				sameOrder = false
				break
			}
		}
	}
	if sameOrder {
		return nil
	}

	var inverse []ChangeOp
	// Sanitization only removes marks, but removing the survivors too lets the
	// inverse re-add the complete original slice in its exact order.
	for _, mark := range after.Marks {
		inverse = append(inverse, ChangeOp{Op: OpRemoveMark, BlockID: before.ID, MarkID: mark.ID})
	}
	for _, mark := range before.Marks {
		copy := cloneMark(mark)
		inverse = append(inverse, ChangeOp{Op: OpAddMark, BlockID: before.ID, Mark: &copy})
	}
	return inverse
}

// applyOp applies one op to the revisioned base. Document-wide layout is handled
```
