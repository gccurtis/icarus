package document

import "strings"

// --- validation and id assignment (before apply) ---

// validateOps checks that a change set is non-empty and each op carries the
// fields and supported kinds it needs. Existence and range checks against live
// content happen later, in applyOp.
func validateOps(ops []ChangeOp) error {
	if len(ops) == 0 {
		return ErrInvalidChangeSet
	}
	for _, op := range ops {
		if err := validateStyleBearingOpPayload(op); err != nil {
			return err
		}
		switch op.Op {
		case OpSetPageLayout:
			if op.PageLayout == nil {
				return ErrInvalidChangeSet
			}
		case OpSetDefaultTypography:
			// A nil payload clears the default; a present one must satisfy the
			// canonical typography grammar.
			if err := validateCustomTypography(op.CustomTypography); err != nil {
				return ErrInvalidChangeSet
			}
		case OpSetBlockLineHeight:
			if op.BlockID == "" || op.LineHeight == nil || *op.LineHeight < 0 {
				return ErrInvalidChangeSet
			}
		case OpSetBlockIndent:
			if op.BlockID == "" || op.Indent == nil || !validBlockIndent(*op.Indent) {
				return ErrInvalidChangeSet
			}
		case OpSetBlockAlignment:
			if op.BlockID == "" || (op.HorizontalAlign == nil && op.VerticalAlign == nil) {
				return ErrInvalidChangeSet
			}
			if op.HorizontalAlign != nil && !validHorizontalAlignment(*op.HorizontalAlign) {
				return ErrInvalidChangeSet
			}
			if op.VerticalAlign != nil && !validVerticalAlignment(*op.VerticalAlign) {
				return ErrInvalidChangeSet
			}
		case OpSetRowTracks:
			if op.RowID == "" || op.Tracks == nil {
				return ErrInvalidChangeSet
			}
		case OpResizeAdjacentTracks:
			if op.RowID == "" || op.BlockID == "" || op.OtherBlockID == "" ||
				op.BlockID == op.OtherBlockID || op.DeltaWeight == 0 {
				return ErrInvalidChangeSet
			}
		case OpSetRowFlow:
			if op.RowID == "" || (op.PageBreak == nil && op.KeepWithNext == nil) {
				return ErrInvalidChangeSet
			}
		case OpSetHeader:
			if op.Header == nil {
				return ErrInvalidChangeSet
			}
			for _, r := range op.Header {
				for _, b := range r.Blocks {
					if err := validateBlockPayload(b); err != nil {
						return err
					}
				}
			}
		case OpSetFooter:
			if op.Footer == nil {
				return ErrInvalidChangeSet
			}
			for _, r := range op.Footer {
				for _, b := range r.Blocks {
					if err := validateBlockPayload(b); err != nil {
						return err
					}
				}
			}
		case OpSetTemplate:
			if op.Template == nil {
				return ErrInvalidChangeSet
			}
			if err := validateTemplateInfo(op.Template); err != nil {
				return err
			}
		case OpSetContextVariable:
			if strings.TrimSpace(op.ContextVarName) == "" || len(op.BoundContext) > maxContextVarBound {
				return ErrInvalidChangeSet
			}
			if op.BoundResource != nil {
				// A resource binding needs a well-formed ref and excludes free text.
				if strings.TrimSpace(op.BoundResource.Kind) == "" || strings.TrimSpace(op.BoundResource.ID) == "" || strings.TrimSpace(op.BoundContext) != "" {
					return ErrInvalidChangeSet
				}
			}
		case OpPutStyleDefinition:
			if op.Style == nil {
				return ErrInvalidChangeSet
			}
			if err := validateStyleDefinitionPayload(*op.Style); err != nil {
				return err
			}
		case OpDeleteStyleDefinition:
			if !validStyleID(op.StyleID) {
				return ErrInvalidChangeSet
			}
		case OpSetStyleDefault:
			if !blockKinds[op.DefaultBlockKind] {
				return ErrInvalidChangeSet
			}
			if op.StyleID != "" && !validStyleID(op.StyleID) {
				return ErrInvalidChangeSet
			}
		case OpAssignBlockStyle:
			if op.BlockID == "" {
				return ErrInvalidChangeSet
			}
			if err := validateStyleRefAssignmentPayload(op.StyleRef); err != nil {
				return err
			}
		case OpSetBlockStyleOverrides:
			if op.BlockID == "" || op.StyleOverrides == nil {
				return ErrInvalidChangeSet
			}
			if err := validateStyleOverridesPayload(*op.StyleOverrides); err != nil {
				return err
			}
		case OpSetBlockCustomTypography:
			// A nil payload is a clear; a present one must satisfy the canonical
			// typography grammar. The block need not exist yet at validation time
			// (checked on apply).
			if op.BlockID == "" {
				return ErrInvalidChangeSet
			}
			if err := validateCustomTypography(op.CustomTypography); err != nil {
				return err
			}
		case OpReplaceStyle:
			if !validStyleID(op.StyleID) || !validStyleID(op.ReplacementStyleID) || op.StyleID == op.ReplacementStyleID {
				return ErrInvalidChangeSet
			}
		case OpInsertRow:
			if op.Row == nil {
				return ErrInvalidChangeSet
			}
			for _, b := range op.Row.Blocks {
				if err := validateBlockPayload(b); err != nil {
					return err
				}
			}
		case OpDeleteRow:
			if op.RowID == "" {
				return ErrInvalidChangeSet
			}
		case OpInsertBlock:
			if op.RowID == "" || op.Block == nil {
				return ErrInvalidChangeSet
			}
			if err := validateBlockPayload(*op.Block); err != nil {
				return err
			}
		case OpDeleteBlock:
			if op.BlockID == "" {
				return ErrInvalidChangeSet
			}
		case OpSetBlock:
			if op.BlockID == "" || op.SetKind == nil || !blockKinds[*op.SetKind] {
				return ErrInvalidChangeSet
			}
		case OpSetBlockSubkind:
			// A blank sub-kind is defaulted to body on apply; a present one must be
			// a built-in or a syntactically valid style id. Registry membership and
			// the text-kind requirement are checked on apply.
			if op.BlockID == "" || op.SetSubKind == nil {
				return ErrInvalidChangeSet
			}
			if sk := *op.SetSubKind; sk != "" && !builtinTextSubKinds[sk] && !validStyleID(sk) {
				return ErrInvalidChangeSet
			}
		case OpSetBlockData:
			if op.BlockID == "" || op.ListData == nil {
				return ErrInvalidChangeSet
			}
			if err := validateListBlockData(*op.ListData); err != nil {
				return err
			}
		case OpSetListType:
			if op.BlockID == "" || op.SetListType == nil || !validListType(*op.SetListType) {
				return ErrInvalidChangeSet
			}
			if op.ListStart != nil && *op.ListStart < 0 {
				return ErrInvalidChangeSet
			}
		case OpSetListItem:
			// A nil Item removes; ListIndex is resolved against live content on apply.
			if op.BlockID == "" || op.ListIndex < 0 {
				return ErrInvalidChangeSet
			}
			if op.Item != nil {
				if err := validateListItem(*op.Item); err != nil {
					return err
				}
			}
		case OpInsertAtom:
			if op.BlockID == "" || op.Atom == nil {
				return ErrInvalidChangeSet
			}
			if err := validateAtomPayload(*op.Atom); err != nil {
				return err
			}
		case OpDeleteAtom:
			if op.BlockID == "" || op.AtomID == "" {
				return ErrInvalidChangeSet
			}
		case OpSetAtomText:
			if op.BlockID == "" || op.AtomID == "" || op.SetText == nil {
				return ErrInvalidChangeSet
			}
		case OpSpliceAtomText, OpMoveRow, OpMoveBlock, OpMoveAtom, OpUpdateMark, OpSplitBlock, OpJoinBlocks:
			if err := validateEditingOp(op); err != nil {
				return err
			}
		case OpAddMark:
			if op.BlockID == "" || op.Mark == nil {
				return ErrInvalidChangeSet
			}
			if err := validateMarkPayload(*op.Mark); err != nil {
				return err
			}
		case OpRemoveMark:
			if op.BlockID == "" || op.MarkID == "" {
				return ErrInvalidChangeSet
			}
		case OpSetPrompt:
			if op.BlockID == "" || op.SetText == nil {
				return ErrInvalidChangeSet
			}
		case OpSetBlockContext:
			if op.BlockID == "" {
				return ErrInvalidChangeSet
			}
			if err := validateBlockContext(op.BlockContext); err != nil {
				return err
			}
		case OpSetBlockPersona:
			if op.BlockID == "" {
				return ErrInvalidChangeSet
			}
			// A nil ref clears the persona; a present one must name a persona.
			if op.BlockPersona != nil &&
				(strings.TrimSpace(op.BlockPersona.ID) == "" || op.BlockPersona.Version < 0) {
				return ErrInvalidChangeSet
			}
		case OpResolveBlock:
			if op.BlockID == "" || op.Block == nil || op.Block.Kind != BlockKindPrompt {
				return ErrInvalidChangeSet
			}
			if err := validateBlockPayload(*op.Block); err != nil {
				return err
			}
		case OpSetAtomFormula:
			if op.BlockID == "" || op.AtomID == "" || op.Formula == nil {
				return ErrInvalidChangeSet
			}
		case OpRefreshFormula:
			if op.BlockID == "" || op.AtomID == "" {
				return ErrInvalidChangeSet
			}
		case OpRestorePromptOutput:
			if op.BlockID == "" || op.RevisionID == "" {
				return ErrInvalidChangeSet
			}
		default:
			return ErrInvalidChangeSet
		}
	}
	return nil
}

func validateStyleBearingOpPayload(op ChangeOp) error {
	if op.Mark != nil {
		if err := validateMarkPayload(*op.Mark); err != nil {
			return err
		}
	}
	if err := validateCustomTypography(op.CustomTypography); err != nil {
		return err
	}
	if op.Style != nil {
		if err := validateCustomTypography(op.Style.Custom); err != nil {
			return err
		}
	}
	if op.StyleRef != nil {
		if err := validateCustomTypography(op.StyleRef.Overrides.Custom); err != nil {
			return err
		}
	}
	if op.StyleOverrides != nil {
		if err := validateCustomTypography(op.StyleOverrides.Custom); err != nil {
			return err
		}
	}
	var base Base
	if op.Row != nil {
		base.Rows = append(base.Rows, *op.Row)
	}
	if op.Block != nil {
		base.Rows = append(base.Rows, Row{Blocks: []Block{*op.Block}})
	}
	base.Header = op.Header
	base.Footer = op.Footer
	if err := validateBaseStylePayloads(base); err != nil {
		return err
	}
	if op.ListData != nil {
		for _, item := range op.ListData.Items {
			for _, mark := range item.Marks {
				if err := validateMarkPayload(mark); err != nil {
					return err
				}
			}
		}
	}
	if op.Item != nil {
		for _, mark := range op.Item.Marks {
			if err := validateMarkPayload(mark); err != nil {
				return err
			}
		}
	}
	return nil
}

func validateStoredStyleOps(ops []ChangeOp) error {
	for _, op := range ops {
		if err := validateStyleBearingOpPayload(op); err != nil {
			return err
		}
	}
	return nil
}

func validateBlockPayload(b Block) error {
	if !validBlockKind(b.Kind) || !validBlockData(b) || !validSubKindStructure(b) {
		return ErrInvalidChangeSet
	}
	if b.Kind == BlockKindList {
		ld, _ := b.Data.(ListBlockData)
		if err := validateListBlockData(ld); err != nil {
			return err
		}
	}
	if b.Style.HorizontalAlign != "" && !validHorizontalAlignment(b.Style.HorizontalAlign) {
		return ErrInvalidChangeSet
	}
	if b.Style.VerticalAlign != "" && !validVerticalAlignment(b.Style.VerticalAlign) {
		return ErrInvalidChangeSet
	}
	if b.StyleRef != nil {
		if err := validateStyleRefPayload(*b.StyleRef); err != nil {
			return err
		}
	}
	for _, a := range b.Atoms {
		if err := validateAtomPayload(a); err != nil {
			return err
		}
	}
	for _, m := range b.Marks {
		if err := validateMarkPayload(m); err != nil {
			return err
		}
	}
	return nil
}

func validateAtomPayload(a Atom) error {
	if !validAtomKind(a.Kind) {
		return ErrInvalidChangeSet
	}
	return nil
}

// validateListBlockData bounds a list payload — a supported marker type, a
// non-negative start, and no more than MaxListItems items — and validates each
// item's level and inline content (atoms + marks) the way a text block's is.
func validateListBlockData(d ListBlockData) error {
	if !validListType(d.Type) || d.Start < 0 || len(d.Items) > MaxListItems {
		return ErrInvalidChangeSet
	}
	for _, item := range d.Items {
		if err := validateListItem(item); err != nil {
			return err
		}
	}
	return nil
}

// validateListItem bounds one list item's level and validates its inline content
// (atom kinds and mark kinds/ranges) the way a text block's is validated.
func validateListItem(item ListItem) error {
	if item.Level < 0 || item.Level > MaxListItemLevel {
		return ErrInvalidChangeSet
	}
	for _, a := range item.Atoms {
		if err := validateAtomPayload(a); err != nil {
			return err
		}
	}
	for _, m := range item.Marks {
		if err := validateMarkPayload(m); err != nil {
			return err
		}
		if !validMarkRange(item.Atoms, m) {
			return ErrInvalidChangeSet
		}
	}
	return nil
}

// validBlockDataContent reports whether a block's typed payload is internally
// valid beyond its type matching its kind — currently, that a list's items are
// within bounds and carry valid inline content. Non-list kinds are always true.
func validBlockDataContent(b Block) bool {
	if b.Kind != BlockKindList {
		return true
	}
	ld, ok := b.Data.(ListBlockData)
	return ok && validateListBlockData(ld) == nil
}

// validateContent fails closed on invalid layout/style or on a base whose
// blocks, atoms or marks carry an unsupported kind or invalid mark range. It
// backs Create, so a document is never stored with content the change ops would
// reject.
func validateContent(base Base) error {
	if !validLayoutRules(base.LayoutRules) || !validPageLayout(base.PageLayout, base.LayoutRules) {
		return ErrInvalidContent
	}
	if err := validateBaseStylePayloads(base); err != nil {
		return err
	}
	if !validStyleSystem(base) {
		return ErrInvalidContent
	}
	for _, rows := range [][]Row{base.Header, base.Footer, base.Rows} {
		for _, r := range rows {
			for _, b := range r.Blocks {
				if !validBlockKind(b.Kind) || !validBlockData(b) || !validBlockStyle(b.Style) || !validBlockSubKind(base.StyleRegistry, b) || !validBlockDataContent(b) {
					return ErrInvalidContent
				}
				for _, a := range b.Atoms {
					if !validAtomKind(a.Kind) {
						return ErrInvalidContent
					}
				}
				for _, m := range b.Marks {
					if err := validateMarkPayload(m); err != nil {
						return err
					}
					if !validMarkRange(b.Atoms, m) {
						return ErrInvalidContent
					}
				}
			}
		}
	}
	return nil
}

// validateBaseStylePayloads checks every style-bearing location without
// normalizing it first. Create calls this before its ordinary stored-state
// normalization so non-canonical input is rejected rather than silently
// rewritten.
func validateBaseStylePayloads(base Base) error {
	if err := validateCustomTypography(base.DefaultTypography); err != nil {
		return err
	}
	for _, definition := range base.StyleRegistry.Definitions {
		if err := validateCustomTypography(definition.Custom); err != nil {
			return err
		}
	}
	for _, rows := range [][]Row{base.Header, base.Footer, base.Rows} {
		for _, row := range rows {
			for _, block := range row.Blocks {
				if block.StyleRef != nil {
					if err := validateCustomTypography(block.StyleRef.Overrides.Custom); err != nil {
						return err
					}
				}
				for _, mark := range block.Marks {
					if err := validateMarkPayload(mark); err != nil {
						return err
					}
				}
				if data, ok := block.Data.(ListBlockData); ok {
					for _, item := range data.Items {
						for _, mark := range item.Marks {
							if err := validateMarkPayload(mark); err != nil {
								return err
							}
						}
					}
				}
			}
		}
	}
	return nil
}

func validateMarkPayload(m Mark) error {
	if !markKinds[m.Kind] {
		return ErrInvalidChangeSet
	}
	switch m.Kind {
	case MarkKindLink:
		if !onlyMarkAttrs(m.Attrs, "href") {
			return invalidStyle("mark.attrs", "link marks accept only href")
		}
		if err := ValidateLinkHref(m.Attrs["href"]); err != nil {
			return err
		}
	case MarkKindFont:
		if !markAttrsSubset(m.Attrs, "family", "size") {
			return invalidStyle("mark.attrs", "font marks accept only family and size")
		}
		family, hasFamily := m.Attrs["family"]
		size, hasSize := m.Attrs["size"]
		if (!hasFamily || family == "") && (!hasSize || size == "") {
			return invalidStyle("font.family", "a font mark requires family or size")
		}
		if hasFamily {
			if err := ValidateFontFamily(family); err != nil {
				return err
			}
		}
		if hasSize {
			if err := ValidateFontSize(size); err != nil {
				return err
			}
		}
	case MarkKindFg, MarkKindBg:
		if !onlyMarkAttrs(m.Attrs, "value") {
			return invalidStyle("mark.attrs", "color marks accept only value")
		}
		if err := ValidateCSSColor(m.Attrs["value"]); err != nil {
			return err
		}
	default:
		if len(m.Attrs) != 0 {
			return invalidStyle("mark.attrs", "this mark kind does not accept attributes")
		}
	}
	if m.Start.Offset < 0 || m.End.Offset < 0 {
		return ErrInvalidChangeSet
	}
	return nil
}

func onlyMarkAttrs(attrs map[string]string, allowed ...string) bool {
	if len(attrs) != len(allowed) {
		return false
	}
	for _, key := range allowed {
		if _, ok := attrs[key]; !ok {
			return false
		}
	}
	return true
}

func markAttrsSubset(attrs map[string]string, allowed ...string) bool {
	if len(attrs) == 0 || len(attrs) > len(allowed) {
		return false
	}
	for key := range attrs {
		found := false
		for _, candidate := range allowed {
			if key == candidate {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

// assignOpIDs gives new rows, blocks, atoms and marks introduced by
// content-creating ops an id (and default kind) when the caller did not supply
// one, so every unit has a stable identifier.
func assignOpIDs(ops []ChangeOp) {
	for i := range ops {
		switch ops[i].Op {
		case OpInsertRow:
			if r := ops[i].Row; r != nil {
				if r.ID == "" {
					r.ID = newID()
				}
				for j := range r.Blocks {
					normalizeBlock(&r.Blocks[j])
				}
			}
		case OpInsertBlock:
			if ops[i].Block != nil {
				normalizeBlock(ops[i].Block)
			}
		case OpInsertAtom:
			if a := ops[i].Atom; a != nil {
				if a.ID == "" {
					a.ID = newID()
				}
				if a.Kind == "" {
					a.Kind = AtomKindText
				}
			}
		case OpAddMark:
			if ops[i].Mark != nil && ops[i].Mark.ID == "" {
				ops[i].Mark.ID = newID()
			}
		case OpPutStyleDefinition:
			if ops[i].Style != nil {
				normalizeStyleDefinition(ops[i].Style)
			}
		case OpAssignBlockStyle:
			if ops[i].StyleRef != nil {
				normalizeBlockStyleRef(&ops[i].StyleRef)
			}
		case OpSetBlockStyleOverrides:
			if ops[i].StyleOverrides != nil {
				normalizeStyleOverrides(ops[i].StyleOverrides)
			}
		case OpSetBlockCustomTypography:
			ops[i].CustomTypography = normalizeCustomTypography(ops[i].CustomTypography)
		case OpResolveBlock:
			if ops[i].Block != nil {
				normalizeBlock(ops[i].Block)
			}
		case OpSplitBlock:
			if r := ops[i].Row; r != nil {
				if r.ID == "" {
					r.ID = newID()
				}
				for j := range r.Blocks {
					normalizeBlock(&r.Blocks[j])
				}
			}
		case OpSetHeader:
			for j := range ops[i].Header {
				if ops[i].Header[j].ID == "" {
					ops[i].Header[j].ID = newID()
				}
				for k := range ops[i].Header[j].Blocks {
					normalizeBlock(&ops[i].Header[j].Blocks[k])
				}
			}
		case OpSetFooter:
			for j := range ops[i].Footer {
				if ops[i].Footer[j].ID == "" {
					ops[i].Footer[j].ID = newID()
				}
				for k := range ops[i].Footer[j].Blocks {
					normalizeBlock(&ops[i].Footer[j].Blocks[k])
				}
			}
		case OpSetTemplate:
			normalizeTemplateInfo(ops[i].Template)
		case OpSetContextVariable:
			ops[i].ContextVarName = strings.TrimSpace(ops[i].ContextVarName)
			ops[i].BoundContext = strings.TrimSpace(ops[i].BoundContext)
			if r := ops[i].BoundResource; r != nil {
				r.Kind = strings.TrimSpace(r.Kind)
				r.ID = strings.TrimSpace(r.ID)
			}
		}
	}
}
