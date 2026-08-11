package document

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"unicode/utf8"
)

// textDigest is the lowercase SHA-256 precondition used by text splice, split,
// and join operations.
func textDigest(text string) string {
	sum := sha256.Sum256([]byte(text))
	return hex.EncodeToString(sum[:])
}

// markDigest is the lowercase SHA-256 of canonical JSON. encoding/json sorts
// string map keys, so equal Marks produce the same digest.
func markDigest(mark Mark) string {
	raw, _ := json.Marshal(mark)
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}

func validDigest(value string) bool {
	if len(value) != sha256.Size*2 {
		return false
	}
	for _, r := range value {
		if (r < '0' || r > '9') && (r < 'a' || r > 'f') {
			return false
		}
	}
	return true
}

// validateEditingOp checks the static shape of the R3 editing operations.
// Parent/order, digest, adjacency, and live range preconditions are checked
// while applying against the resolved Base.
func validateEditingOp(op ChangeOp) error {
	switch op.Op {
	case OpSpliceAtomText:
		if op.BlockID == "" || op.AtomID == "" || op.InsertText == nil ||
			op.StartOffset < 0 || op.EndOffset < op.StartOffset ||
			!utf8.ValidString(*op.InsertText) || !validDigest(op.ExpectedTextHash) {
			return ErrInvalidChangeSet
		}
	case OpMoveRow:
		if op.RowID == "" || op.RowID == op.FromAfterRow || op.RowID == op.AfterRow {
			return ErrInvalidChangeSet
		}
	case OpMoveBlock:
		if op.BlockID == "" || op.FromRowID == "" || op.RowID == "" ||
			op.BlockID == op.FromAfterBlock || op.BlockID == op.AfterBlock {
			return ErrInvalidChangeSet
		}
	case OpMoveAtom:
		if op.AtomID == "" || op.FromBlockID == "" || op.BlockID == "" ||
			op.AtomID == op.FromAfterAtom || op.AtomID == op.AfterAtom {
			return ErrInvalidChangeSet
		}
	case OpUpdateMark:
		if op.BlockID == "" || op.MarkID == "" || op.Mark == nil ||
			op.Mark.ID != op.MarkID || !validDigest(op.ExpectedMarkHash) {
			return ErrInvalidChangeSet
		}
		return validateMarkPayload(*op.Mark)
	case OpSplitBlock:
		if op.BlockID == "" || op.AtomID == "" || op.Row == nil ||
			op.StartOffset < 0 || !validDigest(op.ExpectedTextHash) {
			return ErrInvalidChangeSet
		}
		if err := validateSplitRowPayload(*op.Row); err != nil {
			return err
		}
	case OpJoinBlocks:
		if op.BlockID == "" || op.OtherBlockID == "" || op.BlockID == op.OtherBlockID ||
			!validDigest(op.ExpectedTextHash) || !validDigest(op.ExpectedOtherTextHash) {
			return ErrInvalidChangeSet
		}
	default:
		return ErrInvalidChangeSet
	}
	return nil
}

func validateSplitRowPayload(row Row) error {
	if len(row.Blocks) != 1 {
		return ErrInvalidChangeSet
	}
	block := row.Blocks[0]
	if block.Inferred || block.Data != nil || block.Kind == BlockKindPrompt ||
		len(block.Atoms) != 1 || len(block.Marks) != 0 ||
		block.Atoms[0].Text != "" {
		return ErrInvalidChangeSet
	}
	return validateBlockPayload(block)
}

func applyEditingOp(rows []Row, rules LayoutRules, op ChangeOp) ([]Row, error) {
	switch op.Op {
	case OpSpliceAtomText:
		return applySpliceAtomText(rows, op)
	case OpMoveRow:
		return applyMoveRow(rows, op)
	case OpMoveBlock:
		return applyMoveBlock(rows, op)
	case OpMoveAtom:
		return applyMoveAtom(rows, op)
	case OpUpdateMark:
		return applyUpdateMark(rows, op)
	case OpSplitBlock:
		return applySplitBlock(rows, rules, op)
	case OpJoinBlocks:
		return applyJoinBlocks(rows, op)
	default:
		return nil, ErrInvalidChangeSet
	}
}

func applySpliceAtomText(rows []Row, op ChangeOp) ([]Row, error) {
	ri, bi, ok := blockLoc(rows, op.BlockID)
	if !ok {
		return nil, ErrConflict
	}
	block := &rows[ri].Blocks[bi]
	ai := indexOfAtom(block.Atoms, op.AtomID)
	if ai < 0 || block.Atoms[ai].Kind != AtomKindText {
		return nil, ErrConflict
	}
	text := block.Atoms[ai].Text
	if textDigest(text) != op.ExpectedTextHash ||
		!validTextBoundary(text, op.StartOffset) ||
		!validTextBoundary(text, op.EndOffset) {
		return nil, ErrConflict
	}
	inserted := *op.InsertText
	block.Atoms[ai].Text = text[:op.StartOffset] + inserted + text[op.EndOffset:]
	transformMarksForSplice(block, op.AtomID, op.StartOffset, op.EndOffset, len(inserted))
	sanitizeBlockMarks(block)
	return rows, nil
}

func validTextBoundary(text string, offset int) bool {
	if !utf8.ValidString(text) || offset < 0 || offset > len(text) {
		return false
	}
	return offset == len(text) || utf8.RuneStart(text[offset])
}

func transformMarksForSplice(block *Block, atomID string, start, end, insertedBytes int) {
	for i := range block.Marks {
		mark := &block.Marks[i]
		if mark.Start.AtomID == atomID {
			mark.Start.Offset = transformSpliceOffset(
				mark.Start.Offset, start, end, insertedBytes, false,
			)
		}
		if mark.End.AtomID == atomID {
			mark.End.Offset = transformSpliceOffset(
				mark.End.Offset, start, end, insertedBytes, true,
			)
		}
	}
}

func transformSpliceOffset(offset, start, end, insertedBytes int, endAnchor bool) int {
	if offset < start {
		return offset
	}
	if offset > end {
		return offset + insertedBytes - (end - start)
	}
	if start == end {
		if endAnchor {
			return start + insertedBytes
		}
		return start
	}
	if offset == end {
		return start + insertedBytes
	}
	if endAnchor {
		return start + insertedBytes
	}
	return start
}

func applyMoveRow(rows []Row, op ChangeOp) ([]Row, error) {
	source := rowIndex(rows, op.RowID)
	if source < 0 || predecessorRowID(rows, source) != op.FromAfterRow {
		return nil, ErrConflict
	}
	if op.AfterRow != "" && rowIndex(rows, op.AfterRow) < 0 {
		return nil, ErrConflict
	}
	if op.AfterRow == op.FromAfterRow {
		return rows, nil
	}
	row := rows[source]
	rows = append(rows[:source:source], rows[source+1:]...)
	target := 0
	if op.AfterRow != "" {
		after := rowIndex(rows, op.AfterRow)
		if after < 0 {
			return nil, ErrConflict
		}
		target = after + 1
	}
	return insertRowAt(rows, target, row), nil
}

func applyMoveBlock(rows []Row, op ChangeOp) ([]Row, error) {
	sourceRow, sourceBlock, ok := blockLoc(rows, op.BlockID)
	if !ok || rows[sourceRow].ID != op.FromRowID ||
		predecessorBlockID(rows[sourceRow].Blocks, sourceBlock) != op.FromAfterBlock {
		return nil, ErrConflict
	}
	targetRow := rowIndex(rows, op.RowID)
	if targetRow < 0 {
		return nil, ErrConflict
	}
	if op.AfterBlock != "" && indexOfBlock(rows[targetRow].Blocks, op.AfterBlock) < 0 {
		return nil, ErrConflict
	}
	if op.FromRowID == op.RowID && op.FromAfterBlock == op.AfterBlock {
		return rows, nil
	}
	block := rows[sourceRow].Blocks[sourceBlock]
	sourceBlocks := rows[sourceRow].Blocks
	rows[sourceRow].Blocks = append(sourceBlocks[:sourceBlock:sourceBlock], sourceBlocks[sourceBlock+1:]...)
	targetRow = rowIndex(rows, op.RowID)
	target := 0
	if op.AfterBlock != "" {
		after := indexOfBlock(rows[targetRow].Blocks, op.AfterBlock)
		if after < 0 {
			return nil, ErrConflict
		}
		target = after + 1
	}
	rows[targetRow].Blocks = insertBlockAt(rows[targetRow].Blocks, target, block)
	normalizeRowTracks(&rows[sourceRow])
	if sourceRow != targetRow {
		normalizeRowTracks(&rows[rowIndex(rows, op.RowID)])
	}
	return rows, nil
}

func applyMoveAtom(rows []Row, op ChangeOp) ([]Row, error) {
	sourceRow, sourceBlock, ok := blockLoc(rows, op.FromBlockID)
	if !ok {
		return nil, ErrConflict
	}
	source := &rows[sourceRow].Blocks[sourceBlock]
	sourceAtom := indexOfAtom(source.Atoms, op.AtomID)
	if sourceAtom < 0 || predecessorAtomID(source.Atoms, sourceAtom) != op.FromAfterAtom {
		return nil, ErrConflict
	}
	targetRow, targetBlock, ok := blockLoc(rows, op.BlockID)
	if !ok {
		return nil, ErrConflict
	}
	target := &rows[targetRow].Blocks[targetBlock]
	if op.AfterAtom != "" && indexOfAtom(target.Atoms, op.AfterAtom) < 0 {
		return nil, ErrConflict
	}
	if op.FromBlockID == op.BlockID && op.FromAfterAtom == op.AfterAtom {
		return rows, nil
	}
	atom := source.Atoms[sourceAtom]
	source.Atoms = append(source.Atoms[:sourceAtom:sourceAtom], source.Atoms[sourceAtom+1:]...)
	targetRow, targetBlock, _ = blockLoc(rows, op.BlockID)
	target = &rows[targetRow].Blocks[targetBlock]
	insertAt := 0
	if op.AfterAtom != "" {
		after := indexOfAtom(target.Atoms, op.AfterAtom)
		if after < 0 {
			return nil, ErrConflict
		}
		insertAt = after + 1
	}
	target.Atoms = insertAtomAt(target.Atoms, insertAt, atom)
	if !validBlockMarkRanges(*source) || (source != target && !validBlockMarkRanges(*target)) {
		return nil, ErrConflict
	}
	return rows, nil
}

func validBlockMarkRanges(block Block) bool {
	for _, mark := range block.Marks {
		if !validMarkRange(block.Atoms, mark) {
			return false
		}
	}
	return true
}

func applyUpdateMark(rows []Row, op ChangeOp) ([]Row, error) {
	ri, bi, ok := blockLoc(rows, op.BlockID)
	if !ok {
		return nil, ErrConflict
	}
	block := &rows[ri].Blocks[bi]
	mi := indexOfMark(block.Marks, op.MarkID)
	if mi < 0 || markDigest(block.Marks[mi]) != op.ExpectedMarkHash ||
		!validMarkRange(block.Atoms, *op.Mark) {
		return nil, ErrConflict
	}
	block.Marks[mi] = cloneMark(*op.Mark)
	return rows, nil
}

func applySplitBlock(rows []Row, rules LayoutRules, op ChangeOp) ([]Row, error) {
	ri, bi, ok := blockLoc(rows, op.BlockID)
	if !ok || bi != 0 || len(rows[ri].Blocks) != 1 {
		return nil, ErrConflict
	}
	source := &rows[ri].Blocks[bi]
	if !editableSingleAtomBlock(*source) || source.Atoms[0].ID != op.AtomID {
		return nil, ErrConflict
	}
	text := source.Atoms[0].Text
	if textDigest(text) != op.ExpectedTextHash || !validTextBoundary(text, op.StartOffset) {
		return nil, ErrConflict
	}
	if rowIndex(rows, op.Row.ID) >= 0 ||
		blockExists(rows, op.Row.Blocks[0].ID) ||
		atomExists(rows, op.Row.Blocks[0].Atoms[0].ID) {
		return nil, ErrConflict
	}
	next := cloneRow(*op.Row)
	source.Atoms[0].Text = text[:op.StartOffset]
	next.Blocks[0].Atoms[0].Text = text[op.StartOffset:]
	return insertRowAt(rows, ri+1, next), nil
}

func applyJoinBlocks(rows []Row, op ChangeOp) ([]Row, error) {
	leftRow, leftBlock, ok := blockLoc(rows, op.BlockID)
	if !ok || leftBlock != 0 || len(rows[leftRow].Blocks) != 1 {
		return nil, ErrConflict
	}
	rightRow, rightBlock, ok := blockLoc(rows, op.OtherBlockID)
	if !ok || rightBlock != 0 || len(rows[rightRow].Blocks) != 1 ||
		rightRow != leftRow+1 {
		return nil, ErrConflict
	}
	left := &rows[leftRow].Blocks[leftBlock]
	right := rows[rightRow].Blocks[rightBlock]
	if !editableSingleAtomBlock(*left) || !editableSingleAtomBlock(right) ||
		textDigest(left.Atoms[0].Text) != op.ExpectedTextHash ||
		textDigest(right.Atoms[0].Text) != op.ExpectedOtherTextHash {
		return nil, ErrConflict
	}
	left.Atoms[0].Text += right.Atoms[0].Text
	return append(rows[:rightRow:rightRow], rows[rightRow+1:]...), nil
}

func editableSingleAtomBlock(block Block) bool {
	return !block.Inferred && block.Data == nil && block.Kind != BlockKindPrompt &&
		len(block.Atoms) == 1 && block.Atoms[0].Kind == AtomKindText &&
		len(block.Marks) == 0 && utf8.ValidString(block.Atoms[0].Text)
}

func inverseEditingOp(before, after Base, op ChangeOp) ([]ChangeOp, error) {
	switch op.Op {
	case OpSpliceAtomText:
		return inverseSpliceAtomText(before.Rows, after.Rows, op)
	case OpMoveRow:
		return inverseMoveRow(before.Rows, after.Rows, op)
	case OpMoveBlock:
		return inverseMoveBlock(before.Rows, after.Rows, op)
	case OpMoveAtom:
		return inverseMoveAtom(before.Rows, after.Rows, op)
	case OpUpdateMark:
		return inverseUpdateMark(before.Rows, after.Rows, op)
	case OpSplitBlock:
		return inverseSplitBlock(after.Rows, op)
	case OpJoinBlocks:
		return inverseJoinBlocks(before.Rows, after.Rows, op)
	default:
		return nil, ErrInvalidChangeSet
	}
}

func inverseSpliceAtomText(before, after []Row, op ChangeOp) ([]ChangeOp, error) {
	beforeBlock := blockByID(before, op.BlockID)
	afterBlock := blockByID(after, op.BlockID)
	beforeAtom := indexOfAtom(beforeBlock.Atoms, op.AtomID)
	afterAtom := indexOfAtom(afterBlock.Atoms, op.AtomID)
	if beforeAtom < 0 || afterAtom < 0 {
		return nil, ErrConflict
	}
	removed := beforeBlock.Atoms[beforeAtom].Text[op.StartOffset:op.EndOffset]
	inverse := ChangeOp{
		Op: OpSpliceAtomText, BlockID: op.BlockID, AtomID: op.AtomID,
		StartOffset: op.StartOffset, EndOffset: op.StartOffset + len(*op.InsertText),
		InsertText: &removed, ExpectedTextHash: textDigest(afterBlock.Atoms[afterAtom].Text),
	}
	return append([]ChangeOp{inverse}, restoreExactMarks(beforeBlock, afterBlock)...), nil
}

func inverseMoveRow(before, after []Row, op ChangeOp) ([]ChangeOp, error) {
	beforeIndex := rowIndex(before, op.RowID)
	afterIndex := rowIndex(after, op.RowID)
	if beforeIndex < 0 || afterIndex < 0 {
		return nil, ErrConflict
	}
	return []ChangeOp{{
		Op: OpMoveRow, RowID: op.RowID,
		FromAfterRow: predecessorRowID(after, afterIndex),
		AfterRow:     predecessorRowID(before, beforeIndex),
	}}, nil
}

func inverseMoveBlock(before, after []Row, op ChangeOp) ([]ChangeOp, error) {
	beforeRow, beforeBlock, ok := blockLoc(before, op.BlockID)
	if !ok {
		return nil, ErrConflict
	}
	afterRow, afterBlock, ok := blockLoc(after, op.BlockID)
	if !ok {
		return nil, ErrConflict
	}
	return []ChangeOp{{
		Op: OpMoveBlock, BlockID: op.BlockID,
		FromRowID:      after[afterRow].ID,
		FromAfterBlock: predecessorBlockID(after[afterRow].Blocks, afterBlock),
		RowID:          before[beforeRow].ID,
		AfterBlock:     predecessorBlockID(before[beforeRow].Blocks, beforeBlock),
	}}, nil
}

func inverseMoveAtom(before, after []Row, op ChangeOp) ([]ChangeOp, error) {
	beforeRow, beforeBlock, beforeAtom, ok := atomLoc(before, op.AtomID)
	if !ok {
		return nil, ErrConflict
	}
	afterRow, afterBlock, afterAtom, ok := atomLoc(after, op.AtomID)
	if !ok {
		return nil, ErrConflict
	}
	return []ChangeOp{{
		Op: OpMoveAtom, AtomID: op.AtomID,
		FromBlockID: after[afterRow].Blocks[afterBlock].ID,
		FromAfterAtom: predecessorAtomID(
			after[afterRow].Blocks[afterBlock].Atoms, afterAtom,
		),
		BlockID: before[beforeRow].Blocks[beforeBlock].ID,
		AfterAtom: predecessorAtomID(
			before[beforeRow].Blocks[beforeBlock].Atoms, beforeAtom,
		),
	}}, nil
}

func inverseUpdateMark(before, after []Row, op ChangeOp) ([]ChangeOp, error) {
	beforeBlock := blockByID(before, op.BlockID)
	afterBlock := blockByID(after, op.BlockID)
	beforeMark := indexOfMark(beforeBlock.Marks, op.MarkID)
	afterMark := indexOfMark(afterBlock.Marks, op.MarkID)
	if beforeMark < 0 || afterMark < 0 {
		return nil, ErrConflict
	}
	mark := cloneMark(beforeBlock.Marks[beforeMark])
	return []ChangeOp{{
		Op: OpUpdateMark, BlockID: op.BlockID, MarkID: op.MarkID, Mark: &mark,
		ExpectedMarkHash: markDigest(afterBlock.Marks[afterMark]),
	}}, nil
}

func inverseSplitBlock(after []Row, op ChangeOp) ([]ChangeOp, error) {
	left := blockByID(after, op.BlockID)
	right := blockByID(after, op.Row.Blocks[0].ID)
	if len(left.Atoms) != 1 || len(right.Atoms) != 1 {
		return nil, ErrConflict
	}
	return []ChangeOp{{
		Op: OpJoinBlocks, BlockID: op.BlockID, OtherBlockID: op.Row.Blocks[0].ID,
		ExpectedTextHash:      textDigest(left.Atoms[0].Text),
		ExpectedOtherTextHash: textDigest(right.Atoms[0].Text),
	}}, nil
}

func inverseJoinBlocks(before, after []Row, op ChangeOp) ([]ChangeOp, error) {
	leftBeforeRow, leftBeforeBlock, ok := blockLoc(before, op.BlockID)
	if !ok {
		return nil, ErrConflict
	}
	rightRow, _, ok := blockLoc(before, op.OtherBlockID)
	if !ok {
		return nil, ErrConflict
	}
	leftAfter := blockByID(after, op.BlockID)
	if len(leftAfter.Atoms) != 1 {
		return nil, ErrConflict
	}
	row := cloneRow(before[rightRow])
	row.Blocks[0].Atoms[0].Text = ""
	return []ChangeOp{{
		Op:      OpSplitBlock,
		BlockID: op.BlockID, AtomID: before[leftBeforeRow].Blocks[leftBeforeBlock].Atoms[0].ID,
		StartOffset:      len(before[leftBeforeRow].Blocks[leftBeforeBlock].Atoms[0].Text),
		ExpectedTextHash: textDigest(leftAfter.Atoms[0].Text),
		Row:              &row,
	}}, nil
}

func restoreExactMarks(before, after Block) []ChangeOp {
	if marksEqual(before.Marks, after.Marks) {
		return nil
	}
	var inverse []ChangeOp
	for _, mark := range after.Marks {
		inverse = append(inverse, ChangeOp{Op: OpRemoveMark, BlockID: before.ID, MarkID: mark.ID})
	}
	for _, mark := range before.Marks {
		copy := cloneMark(mark)
		inverse = append(inverse, ChangeOp{Op: OpAddMark, BlockID: before.ID, Mark: &copy})
	}
	return inverse
}

func marksEqual(left, right []Mark) bool {
	if len(left) != len(right) {
		return false
	}
	for i := range left {
		a, b := left[i], right[i]
		if a.ID != b.ID || a.Kind != b.Kind || a.Start != b.Start || a.End != b.End ||
			len(a.Attrs) != len(b.Attrs) {
			return false
		}
		for key, value := range a.Attrs {
			if b.Attrs[key] != value {
				return false
			}
		}
	}
	return true
}

func predecessorRowID(rows []Row, index int) string {
	if index <= 0 {
		return ""
	}
	return rows[index-1].ID
}

func predecessorBlockID(blocks []Block, index int) string {
	if index <= 0 {
		return ""
	}
	return blocks[index-1].ID
}

func predecessorAtomID(atoms []Atom, index int) string {
	if index <= 0 {
		return ""
	}
	return atoms[index-1].ID
}

func atomLoc(rows []Row, atomID string) (int, int, int, bool) {
	for ri := range rows {
		for bi := range rows[ri].Blocks {
			if ai := indexOfAtom(rows[ri].Blocks[bi].Atoms, atomID); ai >= 0 {
				return ri, bi, ai, true
			}
		}
	}
	return 0, 0, 0, false
}
