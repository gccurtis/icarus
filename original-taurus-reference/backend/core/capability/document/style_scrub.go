package document

// StyleScrubReport contains synthetic counts only. It never retains a rejected
// value and is safe to expose in migration logs.
type StyleScrubReport struct {
	ValuesCleared     int
	MarksRemoved      int
	OperationsRemoved int
}

func (r *StyleScrubReport) add(other StyleScrubReport) {
	r.ValuesCleared += other.ValuesCleared
	r.MarksRemoved += other.MarksRemoved
	r.OperationsRemoved += other.OperationsRemoved
}

func (r StyleScrubReport) Empty() bool {
	return r.ValuesCleared == 0 && r.MarksRemoved == 0 && r.OperationsRemoved == 0
}

// ScrubUnsafeStyles neutralizes legacy unsafe style payloads in a Base while
// preserving all text and structural units. An invalid mark is removed; an
// invalid custom-typography property is cleared independently so safe sibling
// properties survive unchanged.
func ScrubUnsafeStyles(base *Base) StyleScrubReport {
	var report StyleScrubReport
	report.add(scrubCustomTypography(&base.DefaultTypography))
	for i := range base.StyleRegistry.Definitions {
		report.add(scrubCustomTypography(&base.StyleRegistry.Definitions[i].Custom))
	}
	for _, rows := range []*[]Row{&base.Header, &base.Footer, &base.Rows} {
		scrubRows(*rows, &report)
	}
	return report
}

// ScrubUnsafeStyleOps returns a scrubbed copy of stored operations. Unsafe
// add/update-mark operations become absent no-ops; nested block/style payloads
// retain their safe content.
func ScrubUnsafeStyleOps(ops []ChangeOp) ([]ChangeOp, StyleScrubReport) {
	out := cloneChangeOps(ops)
	kept := out[:0]
	var report StyleScrubReport
	for i := range out {
		op := &out[i]
		if op.Mark != nil {
			if keep, markReport := scrubMark(op.Mark); !keep {
				report.add(markReport)
				op.Mark = nil
				if op.Op == OpAddMark || op.Op == OpUpdateMark {
					report.OperationsRemoved++
					continue
				}
			} else {
				report.add(markReport)
			}
		}
		report.add(scrubCustomTypography(&op.CustomTypography))
		if op.Style != nil {
			report.add(scrubCustomTypography(&op.Style.Custom))
		}
		if op.StyleRef != nil {
			report.add(scrubCustomTypography(&op.StyleRef.Overrides.Custom))
			normalizeBlockStyleRef(&op.StyleRef)
		}
		if op.StyleOverrides != nil {
			report.add(scrubCustomTypography(&op.StyleOverrides.Custom))
			normalizeStyleOverrides(op.StyleOverrides)
		}
		if op.Row != nil {
			scrubRows([]Row{*op.Row}, &report)
			row := cloneRow(*op.Row)
			op.Row = &row
		}
		if op.Block != nil {
			scrubBlock(op.Block, &report)
		}
		scrubRows(op.Header, &report)
		scrubRows(op.Footer, &report)
		if op.ListData != nil {
			scrubListData(op.ListData, &report)
		}
		if op.Item != nil {
			scrubMarks(&op.Item.Marks, &report)
		}
		kept = append(kept, *op)
	}
	if len(kept) == 0 {
		return []ChangeOp{}, report
	}
	return kept, report
}

func scrubRows(rows []Row, report *StyleScrubReport) {
	for ri := range rows {
		for bi := range rows[ri].Blocks {
			scrubBlock(&rows[ri].Blocks[bi], report)
		}
	}
}

func scrubBlock(block *Block, report *StyleScrubReport) {
	if block.StyleRef != nil {
		report.add(scrubCustomTypography(&block.StyleRef.Overrides.Custom))
		normalizeBlockStyleRef(&block.StyleRef)
	}
	scrubMarks(&block.Marks, report)
	if data, ok := block.Data.(ListBlockData); ok {
		scrubListData(&data, report)
		block.Data = data
	}
}

func scrubListData(data *ListBlockData, report *StyleScrubReport) {
	for i := range data.Items {
		scrubMarks(&data.Items[i].Marks, report)
	}
}

func scrubMarks(marks *[]Mark, report *StyleScrubReport) {
	if marks == nil || len(*marks) == 0 {
		return
	}
	kept := (*marks)[:0]
	for i := range *marks {
		mark := (*marks)[i]
		keep, markReport := scrubMark(&mark)
		report.add(markReport)
		if keep {
			kept = append(kept, mark)
		}
	}
	if len(kept) == 0 {
		*marks = nil
		return
	}
	*marks = kept
}

func scrubMark(mark *Mark) (bool, StyleScrubReport) {
	var report StyleScrubReport
	switch mark.Kind {
	case MarkKindLink:
		report.ValuesCleared += removeUnknownAttrs(mark.Attrs, "href")
		if ValidateLinkHref(mark.Attrs["href"]) != nil {
			report.ValuesCleared++
			report.MarksRemoved++
			return false, report
		}
	case MarkKindFont:
		report.ValuesCleared += removeUnknownAttrs(mark.Attrs, "family", "size")
		if family, ok := mark.Attrs["family"]; ok && ValidateFontFamily(family) != nil {
			delete(mark.Attrs, "family")
			report.ValuesCleared++
		}
		if size, ok := mark.Attrs["size"]; ok && ValidateFontSize(size) != nil {
			delete(mark.Attrs, "size")
			report.ValuesCleared++
		}
		if len(mark.Attrs) == 0 {
			report.MarksRemoved++
			return false, report
		}
	case MarkKindFg, MarkKindBg:
		report.ValuesCleared += removeUnknownAttrs(mark.Attrs, "value")
		if ValidateCSSColor(mark.Attrs["value"]) != nil {
			report.ValuesCleared++
			report.MarksRemoved++
			return false, report
		}
	case MarkKindBold, MarkKindItalic, MarkKindUnderline, MarkKindStrike, MarkKindCode:
		report.ValuesCleared += len(mark.Attrs)
		mark.Attrs = nil
	default:
		// This migration owns style safety, not the broader content vocabulary.
		// Existing whole-base validation continues to fail closed on unknown kinds.
	}
	if len(mark.Attrs) == 0 {
		mark.Attrs = nil
	}
	return true, report
}

func removeUnknownAttrs(attrs map[string]string, allowed ...string) int {
	removed := 0
	for key := range attrs {
		keep := false
		for _, candidate := range allowed {
			if key == candidate {
				keep = true
				break
			}
		}
		if !keep {
			delete(attrs, key)
			removed++
		}
	}
	return removed
}

func scrubCustomTypography(custom **CustomTypography) StyleScrubReport {
	if custom == nil || *custom == nil {
		return StyleScrubReport{}
	}
	report := StyleScrubReport{}
	value := *custom
	if value.FontFamily != "" && ValidateFontFamily(value.FontFamily) != nil {
		value.FontFamily = ""
		report.ValuesCleared++
	}
	if value.FontSize != "" && ValidateFontSize(value.FontSize) != nil {
		value.FontSize = ""
		report.ValuesCleared++
	}
	if value.Foreground != "" && ValidateCSSColor(value.Foreground) != nil {
		value.Foreground = ""
		report.ValuesCleared++
	}
	if value.Background != "" && ValidateCSSColor(value.Background) != nil {
		value.Background = ""
		report.ValuesCleared++
	}
	*custom = normalizeCustomTypography(value)
	return report
}
