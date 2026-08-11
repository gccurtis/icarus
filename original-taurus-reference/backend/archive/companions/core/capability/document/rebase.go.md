# rebase.go

Current state companion for `rebase.go`. This file mirrors the source exactly so the documented view cannot drift from the implementation.

Semantic rebase: classifies each operation's reads and writes into a footprint, then proves stale submissions safe by checking that no footprints overlap. Splice-in-splice conflicts are resolved by coordinate transformation. The proof and replay are deterministic and bounded.

## Code breakdown

### Complete source

```go
package document

import "strings"

// maxSemanticRebaseAttempts bounds proof retries when writers repeatedly race
// the admission CAS.
const maxSemanticRebaseAttempts = 8

// rebaseKey names one semantic fact an operation reads or writes. Presence and
// parent keys make destructive hierarchy changes overlap their descendants,
// while property and ordering keys let independent edits commute.
type rebaseKey struct {
	Kind string
	ID   string
}

type rebaseFootprint struct {
	Reads  map[rebaseKey]bool
	Writes map[rebaseKey]bool
}

func newRebaseFootprint() rebaseFootprint {
	return rebaseFootprint{
		Reads:  make(map[rebaseKey]bool),
		Writes: make(map[rebaseKey]bool),
	}
}

func (f rebaseFootprint) read(kind, id string) {
	if id != "" {
		f.Reads[rebaseKey{Kind: kind, ID: id}] = true
	}
}

func (f rebaseFootprint) write(kind, id string) {
	if id != "" {
		f.Writes[rebaseKey{Kind: kind, ID: id}] = true
	}
}

func rebaseFootprintsConflict(left, right rebaseFootprint) bool {
	for key := range left.Writes {
		if right.Writes[key] || right.Reads[key] {
			return true
		}
	}
	for key := range right.Writes {
		if left.Reads[key] {
			return true
		}
	}
	return false
}

type rebaseOperation struct {
	Op        ChangeOp
	Footprint rebaseFootprint
}

// rebaseStaleOperations proves and prepares one stale operation batch against
// the retained revisions after authoredRevision. It returns proven=false when
// history is insufficient or any pair overlaps. Stored replay failures remain
// errors because they indicate corrupt retained data, not a collaboration
// conflict.
func rebaseStaleOperations(
	base Base,
	baseSeq, authoredRevision, currentRevision int64,
	pending []ChangeSet,
	ops []ChangeOp,
) ([]ChangeOp, Base, bool, error) {
	if authoredRevision < baseSeq || authoredRevision >= currentRevision {
		return nil, Base{}, false, nil
	}
	if !contiguousChangeSets(pending, baseSeq, currentRevision) {
		return nil, Base{}, false, nil
	}

	authored := cloneBase(base)
	nextSet := 0
	for nextSet < len(pending) && pending[nextSet].Seq <= authoredRevision {
		var err error
		authored, err = applyOps(authored, pending[nextSet].Ops)
		if err != nil {
			return nil, Base{}, false, err
		}
		nextSet++
	}
	if authoredRevision > baseSeq &&
		(nextSet == 0 || pending[nextSet-1].Seq != authoredRevision) {
		return nil, Base{}, false, nil
	}

	incoming, err := describeRebaseOperations(authored, ops)
	if err != nil {
		return nil, Base{}, false, err
	}
	rebased := cloneChangeOps(ops)
	current := cloneBase(authored)

	for ; nextSet < len(pending); nextSet++ {
		for _, accepted := range pending[nextSet].Ops {
			acceptedFootprint, err := operationRebaseFootprint(current, accepted)
			if err != nil {
				return nil, Base{}, false, err
			}
			before := cloneBase(current)
			after, err := applyOp(cloneBase(current), accepted)
			if err != nil {
				return nil, Base{}, false, err
			}
			for i := range incoming {
				if incoming[i].Op.Op == OpSpliceAtomText && accepted.Op == OpSpliceAtomText {
					if incoming[i].Op.AtomID != accepted.AtomID {
						continue
					}
					if err := transformSpliceOver(&rebased[i], accepted, before, after); err != nil {
						return nil, Base{}, false, nil
					}
					continue
				}
				if rebaseFootprintsConflict(incoming[i].Footprint, acceptedFootprint) {
					return nil, Base{}, false, nil
				}
			}
			current = after
		}
	}

	if _, err := applyOps(cloneBase(current), rebased); err != nil {
		return nil, Base{}, false, nil
	}
	return rebased, current, true, nil
}

func contiguousChangeSets(sets []ChangeSet, baseSeq, currentRevision int64) bool {
	expected := baseSeq + 1
	for _, cs := range sets {
		if cs.Seq != expected {
			return false
		}
		expected++
	}
	return expected-1 == currentRevision
}

func describeRebaseOperations(base Base, ops []ChangeOp) ([]rebaseOperation, error) {
	current := cloneBase(base)
	out := make([]rebaseOperation, 0, len(ops))
	for _, op := range ops {
		footprint, err := operationRebaseFootprint(current, op)
		if err != nil {
			return nil, err
		}
		next, err := applyOp(current, op)
		if err != nil {
			return nil, err
		}
		out = append(out, rebaseOperation{Op: op, Footprint: footprint})
		current = next
	}
	return out, nil
}

func operationRebaseFootprint(base Base, op ChangeOp) (rebaseFootprint, error) {
	f := newRebaseFootprint()
	switch op.Op {
	case OpSetPageLayout:
		f.write("page-layout", "document")

	case OpSetDefaultTypography:
		f.write("document-typography", "document")

	case OpSetTemplate:
		// Replaces the whole descriptor.
		f.write("template", "document")

	case OpSetContextVariable:
		// Binds one variable; shares the "template" footprint so it conflicts with
		// a concurrent set_template (which would replace the whole descriptor) and
		// with another binding of the same variable.
		f.read("template", "document")
		f.write("template-var:"+strings.TrimSpace(op.ContextVarName), "document")

	case OpSetHeader:
		f.write("header", "document")

	case OpSetFooter:
		f.write("footer", "document")

	case OpSetRowFlow:
		if rowIndex(base.Rows, op.RowID) < 0 {
			return f, ErrConflict
		}
		f.read("row-presence", op.RowID)
		f.write("row-flow", op.RowID)

	case OpSetAtomFormula, OpRefreshFormula:
		if !readBlockPresence(f, base.Rows, op.BlockID) {
			return f, ErrConflict
		}
		f.write("atom-formula", op.AtomID)

	case OpRestorePromptOutput:
		if !readBlockPresence(f, base.Rows, op.BlockID) {
			return f, ErrConflict
		}
		f.write("prompt-restore", op.BlockID)

	case OpPutStyleDefinition:
		if op.Style == nil {
			return f, ErrConflict
		}
		f.write("style-definition", op.Style.ID)
		usage := styleUsage(base, op.Style.ID)
		for _, blockKind := range usage.DefaultKinds {
			f.read("style-default", blockKind)
		}
		for _, usageBlock := range usage.Blocks {
			f.read("block-kind", usageBlock.BlockID)
			f.read("block-style-ref", usageBlock.BlockID)
			f.read("block-style-overrides", usageBlock.BlockID)
		}

	case OpDeleteStyleDefinition:
		if _, _, ok := styleDefinitionByID(base.StyleRegistry, op.StyleID); !ok {
			return f, ErrConflict
		}
		f.write("style-definition", op.StyleID)
		usage := styleUsage(base, op.StyleID)
		for _, blockKind := range usage.DefaultKinds {
			f.read("style-default", blockKind)
		}
		for _, usageBlock := range usage.Blocks {
			f.read("block-style-ref", usageBlock.BlockID)
		}

	case OpSetStyleDefault:
		if !blockKinds[op.DefaultBlockKind] {
			return f, ErrConflict
		}
		f.write("style-default", op.DefaultBlockKind)
		if op.StyleID != "" {
			if _, _, ok := styleDefinitionByID(base.StyleRegistry, op.StyleID); !ok {
				return f, ErrConflict
			}
			f.read("style-definition", op.StyleID)
		}

	case OpAssignBlockStyle:
		if !readBlockPresence(f, base.Rows, op.BlockID) {
			return f, ErrConflict
		}
		f.read("block-kind", op.BlockID)
		f.write("block-style-ref", op.BlockID)
		f.write("block-style-overrides", op.BlockID)
		if ref := cloneBlockStyleRef(op.StyleRef); ref != nil {
			normalizeBlockStyleRef(&ref)
			if ref != nil {
				f.read("style-definition", ref.StyleID)
			}
		}

	case OpSetBlockStyleOverrides:
		if !readBlockPresence(f, base.Rows, op.BlockID) || op.StyleOverrides == nil {
			return f, ErrConflict
		}
		ri, bi, ok := blockLoc(base.Rows, op.BlockID)
		if !ok || base.Rows[ri].Blocks[bi].StyleRef == nil {
			return f, ErrConflict
		}
		f.read("block-kind", op.BlockID)
		f.read("block-style-ref", op.BlockID)
		f.read("style-definition", base.Rows[ri].Blocks[bi].StyleRef.StyleID)
		f.write("block-style-overrides", op.BlockID)

	case OpSetBlockCustomTypography:
		// Ungated and document-scoped: the block's presence is the only precondition
		// (no style definition or allowOverrides gate). It writes the SAME footprint
		// key as set_block_style_overrides, because that op replaces the whole
		// Overrides struct (Custom included) — so the two must be seen to conflict on
		// the same block, or a stale style-overrides edit would silently clobber a
		// committed custom-typography edit.
		if !readBlockPresence(f, base.Rows, op.BlockID) {
			return f, ErrConflict
		}
		f.read("block-kind", op.BlockID)
		f.write("block-style-overrides", op.BlockID)

	case OpReplaceStyle:
		if _, _, ok := styleDefinitionByID(base.StyleRegistry, op.StyleID); !ok {
			return f, ErrConflict
		}
		if _, _, ok := styleDefinitionByID(base.StyleRegistry, op.ReplacementStyleID); !ok {
			return f, ErrConflict
		}
		f.write("style-definition", op.StyleID)
		f.read("style-definition", op.ReplacementStyleID)
		usage := styleUsage(base, op.StyleID)
		for _, blockKind := range usage.DefaultKinds {
			f.write("style-default", blockKind)
		}
		for _, usageBlock := range usage.Blocks {
			f.read("block-kind", usageBlock.BlockID)
			f.write("block-style-ref", usageBlock.BlockID)
			f.write("block-style-overrides", usageBlock.BlockID)
		}

	case OpSetBlockLineHeight:
		if !readBlockPresence(f, base.Rows, op.BlockID) {
			return f, ErrConflict
		}
		f.write("block-line-height", op.BlockID)

	case OpSetBlockIndent:
		if !readBlockPresence(f, base.Rows, op.BlockID) {
			return f, ErrConflict
		}
		f.write("block-indent", op.BlockID)

	case OpSetBlockAlignment:
		if !readBlockPresence(f, base.Rows, op.BlockID) {
			return f, ErrConflict
		}
		if op.HorizontalAlign != nil {
			f.write("block-horizontal-align", op.BlockID)
		}
		if op.VerticalAlign != nil {
			f.write("block-vertical-align", op.BlockID)
		}

	case OpInsertRow:
		f.write("row-order", "document")
		if op.Row != nil {
			writeRowTree(f, *op.Row)
		}

	case OpDeleteRow:
		ri := rowIndex(base.Rows, op.RowID)
		if ri < 0 {
			return f, ErrConflict
		}
		f.write("row-order", "document")
		writeRowTree(f, base.Rows[ri])

	case OpMoveRow:
		if rowIndex(base.Rows, op.RowID) < 0 {
			return f, ErrConflict
		}
		f.read("row-presence", op.RowID)
		f.write("row-order", "document")

	case OpInsertBlock:
		if rowIndex(base.Rows, op.RowID) < 0 {
			return f, ErrConflict
		}
		f.read("row-presence", op.RowID)
		f.write("block-order", op.RowID)
		if op.Block != nil {
			writeBlockTree(f, op.RowID, *op.Block)
		}

	case OpDeleteBlock:
		ri, bi, ok := blockLoc(base.Rows, op.BlockID)
		if !ok {
			return f, ErrConflict
		}
		f.write("block-order", base.Rows[ri].ID)
		writeBlockTree(f, base.Rows[ri].ID, base.Rows[ri].Blocks[bi])

	case OpMoveBlock:
		if !readBlockPresence(f, base.Rows, op.BlockID) ||
			rowIndex(base.Rows, op.FromRowID) < 0 ||
			rowIndex(base.Rows, op.RowID) < 0 {
			return f, ErrConflict
		}
		f.read("row-presence", op.FromRowID)
		f.read("row-presence", op.RowID)
		f.write("block-order", op.FromRowID)
		f.write("block-order", op.RowID)
		f.write("block-parent", op.BlockID)

	case OpSetBlock:
		if !readBlockPresence(f, base.Rows, op.BlockID) {
			return f, ErrConflict
		}
		f.write("block-kind", op.BlockID)

	case OpSetBlockSubkind:
		if !readBlockPresence(f, base.Rows, op.BlockID) {
			return f, ErrConflict
		}
		f.write("block-subkind", op.BlockID)

	case OpSetBlockData, OpSetListType, OpSetListItem:
		// All list-data edits share one footprint per block, so concurrent edits
		// to the same list conflict while different lists stay independent.
		if !readBlockPresence(f, base.Rows, op.BlockID) {
			return f, ErrConflict
		}
		f.write("block-data", op.BlockID)

	case OpInsertAtom:
		if !readBlockPresence(f, base.Rows, op.BlockID) {
			return f, ErrConflict
		}
		f.write("atom-order", op.BlockID)
		if op.Atom != nil {
			writeAtomTree(f, op.BlockID, *op.Atom)
		}

	case OpDeleteAtom:
		ri, bi, ai, ok := atomLoc(base.Rows, op.AtomID)
		if !ok || base.Rows[ri].Blocks[bi].ID != op.BlockID {
			return f, ErrConflict
		}
		f.write("atom-order", op.BlockID)
		f.write("mark-state", op.BlockID)
		writeAtomTree(f, op.BlockID, base.Rows[ri].Blocks[bi].Atoms[ai])

	case OpMoveAtom:
		if !readAtomPresence(f, base.Rows, op.FromBlockID, op.AtomID) ||
			!readBlockPresence(f, base.Rows, op.BlockID) {
			return f, ErrConflict
		}
		f.write("atom-order", op.FromBlockID)
		f.write("atom-order", op.BlockID)
		f.write("atom-parent", op.AtomID)
		f.write("mark-state", op.FromBlockID)
		f.write("mark-state", op.BlockID)

	case OpSetAtomText, OpSpliceAtomText:
		if !readAtomPresence(f, base.Rows, op.BlockID, op.AtomID) {
			return f, ErrConflict
		}
		f.write("atom-text", op.AtomID)
		f.write("mark-state", op.BlockID)

	case OpAddMark:
		if !readBlockPresence(f, base.Rows, op.BlockID) || op.Mark == nil {
			return f, ErrConflict
		}
		readMarkAnchors(f, op.BlockID, *op.Mark)
		f.write("mark-order", op.BlockID)
		f.write("mark-state", op.BlockID)
		writeMarkTree(f, op.BlockID, *op.Mark)

	case OpRemoveMark:
		ri, bi, ok := blockLoc(base.Rows, op.BlockID)
		if !ok {
			return f, ErrConflict
		}
		mi := indexOfMark(base.Rows[ri].Blocks[bi].Marks, op.MarkID)
		if mi < 0 {
			return f, ErrConflict
		}
		f.write("mark-order", op.BlockID)
		f.write("mark-state", op.BlockID)
		writeMarkTree(f, op.BlockID, base.Rows[ri].Blocks[bi].Marks[mi])

	case OpUpdateMark:
		if !readBlockPresence(f, base.Rows, op.BlockID) || op.Mark == nil {
			return f, ErrConflict
		}
		ri, bi, ok := blockLoc(base.Rows, op.BlockID)
		if !ok || indexOfMark(base.Rows[ri].Blocks[bi].Marks, op.MarkID) < 0 {
			return f, ErrConflict
		}
		f.read("mark-presence", op.MarkID)
		readMarkAnchors(f, op.BlockID, *op.Mark)
		f.write("mark-state", op.BlockID)
		f.write("mark-value", op.MarkID)

	case OpSplitBlock:
		ri, bi, ok := blockLoc(base.Rows, op.BlockID)
		if !ok || bi != 0 || len(base.Rows[ri].Blocks) != 1 ||
			!readAtomPresence(f, base.Rows, op.BlockID, op.AtomID) {
			return f, ErrConflict
		}
		f.write("row-order", "document")
		f.write("atom-text", op.AtomID)
		f.write("mark-state", op.BlockID)
		if op.Row != nil {
			writeRowTree(f, *op.Row)
		}

	case OpJoinBlocks:
		leftRow, _, leftOK := blockLoc(base.Rows, op.BlockID)
		rightRow, _, rightOK := blockLoc(base.Rows, op.OtherBlockID)
		if !leftOK || !rightOK || rightRow != leftRow+1 {
			return f, ErrConflict
		}
		left := base.Rows[leftRow].Blocks[0]
		right := base.Rows[rightRow].Blocks[0]
		f.read("block-presence", left.ID)
		f.write("row-order", "document")
		if len(left.Atoms) == 1 {
			f.write("atom-text", left.Atoms[0].ID)
			f.write("mark-state", left.ID)
		}
		writeRowTree(f, base.Rows[rightRow])
		f.write("mark-state", right.ID)

	case OpSetPrompt, OpSetBlockPersona:
		// Both write the prompt block's data (instruction / persona, each clearing
		// ResolvedAt), so they conflict with a concurrent block-data edit but rebase
		// disjointly against other blocks.
		if !readBlockPresence(f, base.Rows, op.BlockID) {
			return f, ErrConflict
		}
		f.write("block-data", op.BlockID)

	case OpSetBlockContext:
		if !readBlockPresence(f, base.Rows, op.BlockID) {
			return f, ErrConflict
		}
		// The op writes the block's context selection and (clearing ResolvedAt) its
		// prompt data, so it conflicts with a concurrent edit to either facet of the
		// same block, but rebases disjointly against edits to other blocks.
		f.write("block-context", op.BlockID)
		f.write("block-data", op.BlockID)

	case OpResolveBlock:
		ri, bi, ok := blockLoc(base.Rows, op.BlockID)
		if !ok {
			return f, ErrConflict
		}
		block := base.Rows[ri].Blocks[bi]
		f.read("block-presence", op.BlockID)
		f.write("block-data", op.BlockID)
		f.write("atom-order", op.BlockID)
		f.write("mark-state", op.BlockID)
		for _, atom := range block.Atoms {
			writeAtomTree(f, op.BlockID, atom)
		}
		for _, mark := range block.Marks {
			writeMarkTree(f, op.BlockID, mark)
		}
		if op.Block != nil {
			for _, atom := range op.Block.Atoms {
				writeAtomTree(f, op.BlockID, atom)
			}
			for _, mark := range op.Block.Marks {
				writeMarkTree(f, op.BlockID, mark)
			}
		}

	default:
		return f, ErrInvalidChangeSet
	}
	return f, nil
}

func readBlockPresence(f rebaseFootprint, rows []Row, blockID string) bool {
	if _, _, ok := blockLoc(rows, blockID); !ok {
		return false
	}
	f.read("block-presence", blockID)
	return true
}

func readAtomPresence(f rebaseFootprint, rows []Row, blockID, atomID string) bool {
	ri, bi, ai, ok := atomLoc(rows, atomID)
	if !ok || rows[ri].Blocks[bi].ID != blockID || ai < 0 {
		return false
	}
	f.read("block-presence", blockID)
	f.read("atom-presence", atomID)
	f.read("atom-parent", atomID)
	return true
}

func readMarkAnchors(f rebaseFootprint, blockID string, mark Mark) {
	f.read("block-presence", blockID)
	f.read("atom-presence", mark.Start.AtomID)
	f.read("atom-parent", mark.Start.AtomID)
	f.read("atom-presence", mark.End.AtomID)
	f.read("atom-parent", mark.End.AtomID)
}

func writeRowTree(f rebaseFootprint, row Row) {
	f.write("row-presence", row.ID)
	f.write("row-height", row.ID)
	for _, block := range row.Blocks {
		writeBlockTree(f, row.ID, block)
	}
}

func writeBlockTree(f rebaseFootprint, _ string, block Block) {
	f.write("block-presence", block.ID)
	f.write("block-parent", block.ID)
	f.write("block-kind", block.ID)
	f.write("block-data", block.ID)
	f.write("block-horizontal-align", block.ID)
	f.write("block-vertical-align", block.ID)
	if block.StyleRef != nil {
		f.write("block-style-ref", block.ID)
		f.write("block-style-overrides", block.ID)
	}
	f.write("atom-order", block.ID)
	f.write("mark-order", block.ID)
	f.write("mark-state", block.ID)
	for _, atom := range block.Atoms {
		writeAtomTree(f, block.ID, atom)
	}
	for _, mark := range block.Marks {
		writeMarkTree(f, block.ID, mark)
	}
}

func writeAtomTree(f rebaseFootprint, _ string, atom Atom) {
	f.write("atom-presence", atom.ID)
	f.write("atom-parent", atom.ID)
	f.write("atom-text", atom.ID)
}

func writeMarkTree(f rebaseFootprint, _ string, mark Mark) {
	f.write("mark-presence", mark.ID)
	f.write("mark-value", mark.ID)
}

func transformSpliceOver(incoming *ChangeOp, accepted ChangeOp, before, after Base) error {
	if incoming.BlockID != accepted.BlockID || incoming.AtomID != accepted.AtomID {
		return ErrConflict
	}
	beforeText, ok := atomTextAt(before.Rows, incoming.BlockID, incoming.AtomID)
	if !ok || incoming.ExpectedTextHash != textDigest(beforeText) ||
		!validTextBoundary(beforeText, incoming.StartOffset) ||
		!validTextBoundary(beforeText, incoming.EndOffset) {
		return ErrConflict
	}

	switch {
	case accepted.StartOffset == accepted.EndOffset:
		position := accepted.StartOffset
		if position == incoming.StartOffset || position == incoming.EndOffset ||
			(position > incoming.StartOffset && position < incoming.EndOffset) {
			return ErrConflict
		}
		if position < incoming.StartOffset {
			delta := len(*accepted.InsertText)
			incoming.StartOffset += delta
			incoming.EndOffset += delta
		}
	case incoming.StartOffset == incoming.EndOffset:
		position := incoming.StartOffset
		if position == accepted.StartOffset || position == accepted.EndOffset ||
			(position > accepted.StartOffset && position < accepted.EndOffset) {
			return ErrConflict
		}
		if position > accepted.EndOffset {
			delta := len(*accepted.InsertText) - (accepted.EndOffset - accepted.StartOffset)
			incoming.StartOffset += delta
			incoming.EndOffset += delta
		}
	case accepted.EndOffset <= incoming.StartOffset:
		delta := len(*accepted.InsertText) - (accepted.EndOffset - accepted.StartOffset)
		incoming.StartOffset += delta
		incoming.EndOffset += delta
	case incoming.EndOffset <= accepted.StartOffset:
		// The accepted edit follows the incoming range, so its coordinates stay.
	default:
		return ErrConflict
	}

	afterText, ok := atomTextAt(after.Rows, incoming.BlockID, incoming.AtomID)
	if !ok {
		return ErrConflict
	}
	incoming.ExpectedTextHash = textDigest(afterText)
	return nil
}

func atomTextAt(rows []Row, blockID, atomID string) (string, bool) {
	ri, bi, ok := blockLoc(rows, blockID)
	if !ok {
		return "", false
	}
	ai := indexOfAtom(rows[ri].Blocks[bi].Atoms, atomID)
	if ai < 0 {
		return "", false
	}
	return rows[ri].Blocks[bi].Atoms[ai].Text, true
}
```
