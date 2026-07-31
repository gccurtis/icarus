package document

import (
	"sort"
	"strings"
)

// Markdown is a compact interchange for a block's inline content, used by the
// agent's document tools so a model reads and writes prose without ever
// computing a byte offset. It is deliberately a small subset — bold, italic,
// code, strike, and links — the inline styling markdown expresses cleanly. Block
// kind (heading level, and so on) and block-level style are carried separately.

// RenderBlockMarkdown renders one block's atoms and inline marks to markdown.
// Mark endpoints are resolved by their (atomId, byte-offset) anchors over the
// block's concatenated text. Non-overlapping marks render exactly.
func RenderBlockMarkdown(block Block) string {
	var flat strings.Builder
	atomStart := make(map[string]int, len(block.Atoms))
	pos := 0
	for _, atom := range block.Atoms {
		if atom.Kind != "" && atom.Kind != "text" {
			continue
		}
		atomStart[atom.ID] = pos
		flat.WriteString(atom.Text)
		pos += len(atom.Text)
	}
	text := flat.String()

	type insertion struct {
		at   int
		text string
		open bool
		code bool
	}
	var inserts []insertion
	for _, mark := range block.Marks {
		s, ok1 := atomStart[mark.Start.AtomID]
		e, ok2 := atomStart[mark.End.AtomID]
		if !ok1 || !ok2 {
			continue
		}
		start, end := s+mark.Start.Offset, e+mark.End.Offset
		if start < 0 || end > len(text) || start >= end {
			continue
		}
		open, closing := markDelimiters(mark)
		if open == "" && closing == "" {
			continue
		}
		isCode := mark.Kind == "code"
		inserts = append(inserts, insertion{at: start, text: open, open: true, code: isCode})
		inserts = append(inserts, insertion{at: end, text: closing, open: false, code: isCode})
	}
	if len(inserts) == 0 {
		return escapeInlineText(text)
	}
	// Stable order by position; at the same position, closes precede opens so
	// adjacent spans nest rather than interleave.
	sort.SliceStable(inserts, func(i, j int) bool {
		if inserts[i].at != inserts[j].at {
			return inserts[i].at < inserts[j].at
		}
		return !inserts[i].open && inserts[j].open
	})
	var out strings.Builder
	prev := 0
	codeDepth := 0 // inside a code span, content is literal and must not be escaped
	writeSeg := func(seg string) {
		if codeDepth > 0 {
			out.WriteString(seg)
		} else {
			out.WriteString(escapeInlineText(seg))
		}
	}
	for _, in := range inserts {
		writeSeg(text[prev:in.at])
		out.WriteString(in.text)
		if in.code {
			if in.open {
				codeDepth++
			} else if codeDepth > 0 {
				codeDepth--
			}
		}
		prev = in.at
	}
	writeSeg(text[prev:])
	return out.String()
}

// escapeInlineText backslash-escapes the inline-markdown metacharacters in plain
// text, so a literal "*", "_", etc. round-trips through ParseBlockMarkdown
// instead of being re-interpreted as emphasis or a link.
func escapeInlineText(s string) string {
	if !strings.ContainsAny(s, "\\*_`~[]") {
		return s
	}
	var b strings.Builder
	b.Grow(len(s) + 8)
	for i := 0; i < len(s); i++ {
		switch s[i] {
		case '\\', '*', '_', '`', '~', '[', ']':
			b.WriteByte('\\')
		}
		b.WriteByte(s[i])
	}
	return b.String()
}

func markDelimiters(mark Mark) (open, closing string) {
	switch mark.Kind {
	case "bold":
		return "**", "**"
	case "italic":
		return "_", "_"
	case "code":
		return "`", "`"
	case "strike":
		return "~~", "~~"
	case "underline":
		return "<u>", "</u>"
	case "link":
		return "[", "](" + mark.Attrs["href"] + ")"
	}
	return "", ""
}

// ParseBlockMarkdown parses a restricted inline-markdown string into a block's
// atoms and whole-atom marks. Each styled run becomes its own atom, so no caller
// ever computes a byte offset. Supported: **bold**, _italic_ / *italic*, `code`,
// ~~strike~~, and [text](href). Unrecognized markup is kept as literal text.
func ParseBlockMarkdown(markdown string, newID func() string) ([]Atom, []Mark) {
	runs := parseInlineRuns(markdown)
	var atoms []Atom
	var marks []Mark
	for _, run := range runs {
		if run.text == "" {
			continue
		}
		id := newID()
		atoms = append(atoms, Atom{ID: id, Kind: "text", Text: run.text})
		if run.kind == "" {
			continue
		}
		mark := Mark{ID: newID(), Kind: run.kind, Start: Anchor{AtomID: id, Offset: 0}, End: Anchor{AtomID: id, Offset: len(run.text)}}
		if run.href != "" {
			mark.Attrs = map[string]string{"href": run.href}
		}
		marks = append(marks, mark)
	}
	if len(atoms) == 0 {
		atoms = append(atoms, Atom{ID: newID(), Kind: "text", Text: ""})
	}
	return atoms, marks
}

type inlineRun struct {
	text string
	kind string // "" | bold | italic | code | strike | link
	href string
}

func parseInlineRuns(s string) []inlineRun {
	var runs []inlineRun
	var plain strings.Builder
	flush := func() {
		if plain.Len() > 0 {
			runs = append(runs, inlineRun{text: plain.String()})
			plain.Reset()
		}
	}
	i := 0
	for i < len(s) {
		// A backslash escapes the following metacharacter into a literal, so it is
		// never interpreted as markup (mirrors escapeInlineText on render).
		if s[i] == '\\' && i+1 < len(s) && isInlineSpecial(s[i+1]) {
			plain.WriteByte(s[i+1])
			i += 2
			continue
		}
		if strings.HasPrefix(s[i:], "**") {
			if j := strings.Index(s[i+2:], "**"); j >= 0 {
				flush()
				runs = append(runs, inlineRun{text: s[i+2 : i+2+j], kind: "bold"})
				i += 2 + j + 2
				continue
			}
		}
		if strings.HasPrefix(s[i:], "~~") {
			if j := strings.Index(s[i+2:], "~~"); j >= 0 {
				flush()
				runs = append(runs, inlineRun{text: s[i+2 : i+2+j], kind: "strike"})
				i += 2 + j + 2
				continue
			}
		}
		if c := s[i]; c == '*' || c == '_' {
			// Emphasis must flank non-space text (so "5 * 3" is literal); an
			// underscore is additionally not intra-word (so "snake_case" is literal).
			if j := findEmphasisClose(s, i, c); j >= 0 {
				flush()
				runs = append(runs, inlineRun{text: s[i+1 : j], kind: "italic"})
				i = j + 1
				continue
			}
		}
		if s[i] == '`' {
			if j := strings.IndexByte(s[i+1:], '`'); j >= 0 {
				flush()
				runs = append(runs, inlineRun{text: s[i+1 : i+1+j], kind: "code"})
				i += 1 + j + 1
				continue
			}
		}
		if s[i] == '[' {
			if close := strings.Index(s[i:], "]("); close >= 0 {
				rest := s[i+close+2:]
				if end := strings.IndexByte(rest, ')'); end >= 0 {
					flush()
					runs = append(runs, inlineRun{text: s[i+1 : i+close], kind: "link", href: rest[:end]})
					i += close + 2 + end + 1
					continue
				}
			}
		}
		plain.WriteByte(s[i])
		i++
	}
	flush()
	return runs
}

// findEmphasisClose returns the index of the emphasis closer for the delimiter c
// opened at i, or -1 if this is not a valid emphasis span. The opener must be
// followed by non-space and the closer preceded by non-space (so spaced "5 * 3"
// stays literal); an underscore additionally may not sit inside a word (so
// "snake_case" stays literal).
func findEmphasisClose(s string, i int, c byte) int {
	if i+1 >= len(s) || isInlineSpace(s[i+1]) {
		return -1
	}
	if c == '_' && i > 0 && isAlphaNum(s[i-1]) {
		return -1
	}
	for k := i + 1; k < len(s); k++ {
		if s[k] != c {
			continue
		}
		if isInlineSpace(s[k-1]) {
			continue // closer needs non-space immediately before it
		}
		if c == '_' && k+1 < len(s) && isAlphaNum(s[k+1]) {
			continue // an underscore inside a word does not close emphasis
		}
		return k
	}
	return -1
}

func isInlineSpecial(b byte) bool {
	switch b {
	case '\\', '*', '_', '`', '~', '[', ']':
		return true
	}
	return false
}

func isInlineSpace(b byte) bool { return b == ' ' || b == '\t' }

func isAlphaNum(b byte) bool {
	return (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || (b >= '0' && b <= '9')
}
