# markdown_document.go

Document-level Markdown: serialize a whole document to Markdown and parse a Markdown upload into rows (one block per row). Block structure maps to block kinds; inline styling reuses RenderBlockMarkdown / ParseBlockMarkdown. Adds Documents.ExportMarkdown and Documents.ImportMarkdown. See repo conventions (AGENTS.md).

## Code breakdown

```go
package document

import (
	"strconv"
	"strings"
)

// ExportMarkdown resolves a document and serializes it to Markdown, scoped to a
// project (a document in another project is ErrNotFound).
func (d *Documents) ExportMarkdown(projectID, id string) (Document, string, error) {
	doc, err := d.Get(projectID, id)
	if err != nil {
		return Document{}, "", err
	}
	return doc, ExportMarkdown(doc.Base), nil
}

// ImportMarkdown creates a new document in a project from a Markdown source,
// parsing it into one block per row. It runs through the normal create path, so
// ids, validation, and Activity all behave as for any created document.
func (d *Documents) ImportMarkdown(projectID, name, markdown string, actors ...Actor) (Document, error) {
	rows := parseMarkdownRows(markdown, newID)
	return d.Create(projectID, name, Base{Rows: rows}, actors...)
}

// Document-level Markdown: serialize a whole document to Markdown, and parse a
// Markdown upload into rows. A text block's sub-kind maps to Markdown structure
// (body → paragraph, heading_N → #…######); a code block round-trips through a
// fenced block. Inline styling reuses RenderBlockMarkdown / ParseBlockMarkdown,
// so bold, italic, code, strike, and links round-trip. Markdown is a lossy
// export: a custom (non built-in) sub-kind serializes as a plain paragraph, and
// every non-representable block (prompt, image, divider) is skipped. One block
// per row, which matches how the agent's block tools model a document.

// headingSubKindPrefix maps a heading sub-kind to its Markdown line prefix. A
// body (or custom) sub-kind has no prefix and serializes as plain text.
var headingSubKindPrefix = map[string]string{
	SubKindHeading1: "# ",
	SubKindHeading2: "## ",
	SubKindHeading3: "### ",
	SubKindHeading4: "#### ",
	SubKindHeading5: "##### ",
	SubKindHeading6: "###### ",
}

// ExportMarkdown serializes a document body to Markdown: each text block becomes
// one line under its sub-kind's prefix, each code block a fenced block, and each
// callout a blockquote line, separated by a blank line. Non-representable blocks
// (prompt, image, divider) are skipped.
func ExportMarkdown(base Base) string {
	var blocks []string
	for _, row := range base.Rows {
		for _, b := range row.Blocks {
			switch b.Kind {
			case BlockKindText:
				blocks = append(blocks, headingSubKindPrefix[b.SubKind]+RenderBlockMarkdown(b))
			case BlockKindCode:
				blocks = append(blocks, "```\n"+b.DisplayText()+"\n```")
			case BlockKindCallout:
				// Markdown has no callout; a blockquote is the conventional, lossy
				// rendering for a highlighted aside (it re-imports as body text).
				blocks = append(blocks, "> "+RenderBlockMarkdown(b))
			case BlockKindList:
				if data, ok := b.Data.(ListBlockData); ok {
					blocks = append(blocks, renderListMarkdown(data))
				}
			}
		}
	}
	return strings.Join(blocks, "\n\n") + "\n"
}

// parseMarkdownRows parses a Markdown document into rows — one block per row.
// Blocks are separated by blank lines (except inside a fenced code block); the
// first line's prefix chooses the block (#…###### headings, ``` fence for code),
// and inline markdown is parsed by ParseBlockMarkdown. A run of plain lines
// becomes one body paragraph.
func parseMarkdownRows(md string, newID func() string) []Row {
	var rows []Row
	for _, chunk := range splitMarkdownBlocks(md) {
		if data, ok := parseListChunk(chunk, newID); ok {
			block := Block{ID: newID(), Kind: BlockKindList, Data: data}
			rows = append(rows, Row{ID: newID(), Blocks: []Block{block}})
			continue
		}
		kind, subKind, text, isCode := classifyMarkdownBlock(chunk)
		block := Block{ID: newID(), Kind: kind, SubKind: subKind}
		if isCode {
			block.Atoms = []Atom{{ID: newID(), Kind: AtomKindText, Text: text}}
			rows = append(rows, Row{ID: newID(), Blocks: []Block{block}})
			continue
		}
		block.Atoms, block.Marks = ParseBlockMarkdown(text, newID)
		if len(block.Atoms) == 0 {
			block.Atoms = []Atom{{ID: newID(), Kind: AtomKindText}}
		}
		rows = append(rows, Row{ID: newID(), Blocks: []Block{block}})
	}
	return rows
}

// splitMarkdownBlocks splits Markdown into blocks on blank-line boundaries. A
// fenced code block (opened and closed by a ``` line) is kept whole, so blank
// lines inside code do not split it.
func splitMarkdownBlocks(md string) []string {
	var blocks []string
	var cur []string
	inFence := false
	flush := func() {
		if len(cur) > 0 {
			blocks = append(blocks, strings.Join(cur, "\n"))
			cur = nil
		}
	}
	for _, line := range strings.Split(strings.ReplaceAll(md, "\r\n", "\n"), "\n") {
		if strings.HasPrefix(strings.TrimSpace(line), "```") {
			if !inFence {
				flush()
				inFence = true
				cur = append(cur, line)
				continue
			}
			// Closing fence: complete the code chunk.
			cur = append(cur, line)
			inFence = false
			flush()
			continue
		}
		if !inFence && strings.TrimSpace(line) == "" {
			flush()
			continue
		}
		cur = append(cur, line)
	}
	flush()
	return blocks
}

// classifyMarkdownBlock returns a block's kind, sub-kind (for text), inline text,
// and whether it is a code block, stripping the structural prefix. A heading uses
// only its first line; a quote strips the leading ">" from each line and becomes
// body text (the quote marker is not preserved); a fenced block becomes code; a
// plain block joins its lines into one body paragraph.
func classifyMarkdownBlock(chunk string) (kind, subKind, text string, isCode bool) {
	lines := strings.Split(chunk, "\n")
	first := lines[0]
	if strings.HasPrefix(strings.TrimSpace(first), "```") {
		body := lines
		if len(body) > 0 && strings.HasPrefix(strings.TrimSpace(body[0]), "```") {
			body = body[1:]
		}
		if len(body) > 0 && strings.HasPrefix(strings.TrimSpace(body[len(body)-1]), "```") {
			body = body[:len(body)-1]
		}
		return BlockKindCode, "", strings.Join(body, "\n"), true
	}
	if level, rest, ok := headingPrefix(first); ok {
		return BlockKindText, headingSubKindForLevel(level), strings.TrimSpace(rest), false
	}
	if strings.HasPrefix(strings.TrimSpace(first), ">") {
		var quoted []string
		for _, l := range lines {
			l = strings.TrimSpace(l)
			l = strings.TrimPrefix(l, ">")
			quoted = append(quoted, strings.TrimSpace(l))
		}
		return BlockKindText, SubKindBody, strings.Join(quoted, " "), false
	}
	return BlockKindText, SubKindBody, strings.Join(trimAll(lines), " "), false
}

// headingPrefix reports whether a line starts with 1..6 '#' followed by a space,
// returning the level and the remaining text.
func headingPrefix(line string) (int, string, bool) {
	line = strings.TrimLeft(line, " ")
	n := 0
	for n < len(line) && line[n] == '#' {
		n++
	}
	if n >= 1 && n <= 6 && n < len(line) && line[n] == ' ' {
		return n, line[n+1:], true
	}
	return 0, "", false
}

func trimAll(lines []string) []string {
	out := make([]string, 0, len(lines))
	for _, l := range lines {
		out = append(out, strings.TrimSpace(l))
	}
	return out
}

// renderListMarkdown renders one list block: each item on its own line, indented
// two spaces per level, under a marker chosen by the list type (`- `, `1. `
// counting from Start, or `- [ ] ` / `- [x] `). Inline styling reuses
// RenderBlockMarkdown over the item's atoms and marks.
func renderListMarkdown(data ListBlockData) string {
	n := data.Start
	if data.Type == ListOrdered && n < 1 {
		n = 1
	}
	lines := make([]string, 0, len(data.Items))
	for _, item := range data.Items {
		var marker string
		switch data.Type {
		case ListOrdered:
			marker = strconv.Itoa(n) + ". "
			n++
		case ListCheck:
			if item.Checked {
				marker = "- [x] "
			} else {
				marker = "- [ ] "
			}
		default:
			marker = "- "
		}
		indent := strings.Repeat("  ", item.Level)
		lines = append(lines, indent+marker+RenderBlockMarkdown(Block{Atoms: item.Atoms, Marks: item.Marks}))
	}
	return strings.Join(lines, "\n")
}

// parseListChunk parses a blank-line-delimited chunk into a list block when every
// line is a list item. It returns ok=false for any chunk that is not entirely
// list lines, so it can be tried before the ordinary block classifier. The list
// type (and ordered start) come from the first item.
func parseListChunk(chunk string, newID func() string) (ListBlockData, bool) {
	lines := strings.Split(chunk, "\n")
	var data ListBlockData
	first := true
	for _, raw := range lines {
		if strings.TrimSpace(raw) == "" {
			continue
		}
		level, listType, checked, number, text, ok := parseListLine(raw)
		if !ok {
			return ListBlockData{}, false
		}
		if first {
			data.Type = listType
			if listType == ListOrdered {
				data.Start = number
			}
			first = false
		}
		atoms, marks := ParseBlockMarkdown(text, newID)
		if len(atoms) == 0 {
			atoms = []Atom{{ID: newID(), Kind: AtomKindText}}
		}
		data.Items = append(data.Items, ListItem{Level: level, Checked: checked, Atoms: atoms, Marks: marks})
	}
	if first || len(data.Items) == 0 {
		return ListBlockData{}, false
	}
	return data, true
}

// parseListLine parses one markdown list line: its indent (two spaces per level,
// capped at MaxListItemLevel), marker type, checked state and ordered number, and
// the remaining inline text. ok is false for a line that is not a list item.
func parseListLine(line string) (level int, listType ListType, checked bool, number int, text string, ok bool) {
	line = strings.ReplaceAll(line, "\t", "  ")
	trimmed := strings.TrimLeft(line, " ")
	level = (len(line) - len(trimmed)) / 2
	if level > MaxListItemLevel {
		level = MaxListItemLevel
	}
	// Checkbox: `- [ ] ` / `- [x] ` (also `* ` / `+ ` bullets).
	for _, b := range []string{"- ", "* ", "+ "} {
		if rest, found := strings.CutPrefix(trimmed, b); found {
			if box, after, isBox := cutCheckbox(rest); isBox {
				return level, ListCheck, box, 0, after, true
			}
			return level, ListBullet, false, 0, rest, true
		}
	}
	// Ordered: `12. ` or `12) `.
	i := 0
	for i < len(trimmed) && trimmed[i] >= '0' && trimmed[i] <= '9' {
		i++
	}
	if i > 0 && i < len(trimmed) && (trimmed[i] == '.' || trimmed[i] == ')') && i+1 < len(trimmed) && trimmed[i+1] == ' ' {
		num, _ := strconv.Atoi(trimmed[:i])
		return level, ListOrdered, false, num, trimmed[i+2:], true
	}
	return 0, "", false, 0, "", false
}

// cutCheckbox recognizes a leading `[ ] ` / `[x] ` checkbox, returning its
// checked state and the text after it.
func cutCheckbox(s string) (checked bool, rest string, ok bool) {
	if r, found := strings.CutPrefix(s, "[ ] "); found {
		return false, r, true
	}
	if r, found := strings.CutPrefix(s, "[x] "); found {
		return true, r, true
	}
	if r, found := strings.CutPrefix(s, "[X] "); found {
		return true, r, true
	}
	return false, "", false
}
```
