package document

func duplicateBase(src Base) Base {
	idMap := make(map[string]string)
	collectIDs(src, idMap)
	return Base{
		PageLayout:        src.PageLayout,
		LayoutRules:       src.LayoutRules,
		DefaultTypography: cloneCustomTypography(src.DefaultTypography),
		StyleRegistry:     duplicateStyleRegistry(src.StyleRegistry, idMap),
		Template:          cloneTemplateInfo(src.Template),
		Header:            duplicateRows(src.Header, idMap),
		Footer:            duplicateRows(src.Footer, idMap),
		Rows:              duplicateRows(src.Rows, idMap),
	}
}

func cloneCustomTypography(src *CustomTypography) *CustomTypography {
	if src == nil {
		return nil
	}
	out := *src
	return &out
}

func collectIDs(base Base, idMap map[string]string) {
	for i := range base.Header {
		collectRowIDs(&base.Header[i], idMap)
	}
	for i := range base.Footer {
		collectRowIDs(&base.Footer[i], idMap)
	}
	for i := range base.Rows {
		collectRowIDs(&base.Rows[i], idMap)
	}
	for i := range base.StyleRegistry.Definitions {
		idMap[base.StyleRegistry.Definitions[i].ID] = newID()
	}
	for i := range base.StyleRegistry.Defaults {
		idMap[base.StyleRegistry.Defaults[i].StyleID] = newID()
	}
}

func collectRowIDs(row *Row, idMap map[string]string) {
	idMap[row.ID] = newID()
	for i := range row.Blocks {
		collectBlockIDs(&row.Blocks[i], idMap)
	}
}

func collectBlockIDs(block *Block, idMap map[string]string) {
	idMap[block.ID] = newID()
	for i := range block.Atoms {
		idMap[block.Atoms[i].ID] = newID()
	}
	for i := range block.Marks {
		idMap[block.Marks[i].ID] = newID()
	}
}

func duplicateRows(src []Row, idMap map[string]string) []Row {
	if len(src) == 0 {
		return nil
	}
	out := make([]Row, len(src))
	for i := range src {
		out[i] = duplicateRow(src[i], idMap)
	}
	return out
}

func duplicateRow(src Row, idMap map[string]string) Row {
	return Row{
		ID:     idMap[src.ID],
		Style:  src.Style,
		Tracks: duplicateTracks(src.Tracks),
		Blocks: duplicateBlocks(src.Blocks, idMap),
	}
}

func duplicateTracks(src []Track) []Track {
	if len(src) == 0 {
		return nil
	}
	out := make([]Track, len(src))
	copy(out, src)
	return out
}

func duplicateBlocks(src []Block, idMap map[string]string) []Block {
	if len(src) == 0 {
		return nil
	}
	out := make([]Block, len(src))
	for i := range src {
		out[i] = duplicateBlock(src[i], idMap)
	}
	return out
}

func duplicateBlock(src Block, idMap map[string]string) Block {
	return Block{
		ID:       idMap[src.ID],
		Kind:     src.Kind,
		Style:    src.Style,
		Inferred: src.Inferred,
		StyleRef: duplicateStyleRef(src.StyleRef, idMap),
		Atoms:    duplicateAtoms(src.Atoms, idMap),
		Marks:    duplicateMarks(src.Marks, idMap),
		Data:     cloneBlockData(src.Data),
	}
}

func duplicateStyleRef(ref *BlockStyleRef, idMap map[string]string) *BlockStyleRef {
	if ref == nil {
		return nil
	}
	dup := cloneBlockStyleRef(ref)
	if newID, ok := idMap[ref.StyleID]; ok {
		dup.StyleID = newID
	}
	return dup
}

func duplicateAtoms(src []Atom, idMap map[string]string) []Atom {
	if len(src) == 0 {
		return nil
	}
	out := make([]Atom, len(src))
	for i := range src {
		out[i] = duplicateAtom(src[i], idMap)
	}
	return out
}

func duplicateAtom(src Atom, idMap map[string]string) Atom {
	return Atom{
		ID:   idMap[src.ID],
		Kind: src.Kind,
		Text: src.Text,
		Data: cloneAtomData(src.Data),
	}
}

func duplicateMarks(src []Mark, idMap map[string]string) []Mark {
	if len(src) == 0 {
		return nil
	}
	out := make([]Mark, len(src))
	for i := range src {
		out[i] = duplicateMark(src[i], idMap)
	}
	return out
}

func duplicateMark(src Mark, idMap map[string]string) Mark {
	dst := src
	dst.ID = idMap[src.ID]
	if newID, ok := idMap[src.Start.AtomID]; ok {
		dst.Start.AtomID = newID
	}
	if newID, ok := idMap[src.End.AtomID]; ok {
		dst.End.AtomID = newID
	}
	if len(src.Attrs) > 0 {
		dst.Attrs = make(map[string]string, len(src.Attrs))
		for k, v := range src.Attrs {
			dst.Attrs[k] = v
		}
	}
	return dst
}

func duplicateStyleRegistry(src StyleRegistry, idMap map[string]string) StyleRegistry {
	dst := StyleRegistry{
		Definitions: make([]StyleDefinition, len(src.Definitions)),
		Defaults:    make([]StyleDefault, len(src.Defaults)),
	}
	for i, def := range src.Definitions {
		d := cloneStyleDefinition(def)
		d.ID = idMap[d.ID]
		dst.Definitions[i] = d
	}
	for i, dflt := range src.Defaults {
		d := dflt
		d.StyleID = idMap[d.StyleID]
		dst.Defaults[i] = d
	}
	return dst
}
