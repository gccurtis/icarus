package resource

import (
	"errors"
	"io"
	"strings"
	"unicode/utf8"
)

// LineSlicer provides bounded, one-based line slicing for textual projections.
// It handles empty files, final newline/no final newline, CRLF, and oversized
// lines with a configurable byte limit per line.
type LineSlicer struct {
	MaxLineBytes  int
	MaxTotalBytes int
	MaxLines      int
}

// DefaultLineSlicer returns a LineSlicer with sensible defaults.
func DefaultLineSlicer() LineSlicer {
	return LineSlicer{
		MaxLineBytes:  64 * 1024,   // 64KB per line
		MaxTotalBytes: 1024 * 1024, // 1MB total
		MaxLines:      2000,
	}
}

// Slice extracts the requested line range from text, enforcing byte and line
// limits. Lines are 1-based and inclusive. Returns the sliced text, the actual
// start/end lines, and whether the result was truncated.
func (s LineSlicer) Slice(text string, startLine, endLine int) (sliced string, actualStart, actualEnd int, truncated bool) {
	if text == "" {
		return "", 0, 0, false
	}

	spans := lineSpans(text)
	if len(spans) == 0 {
		return "", 0, 0, false
	}

	first := 1
	if startLine > 0 {
		first = startLine
	}
	last := len(spans)
	if endLine > 0 {
		last = endLine
	}

	if first > len(spans) {
		// Requested start past end; return nothing.
		return "", 0, 0, false
	}
	if last > len(spans) {
		last = len(spans)
	}
	if last < first {
		last = first
	}

	start := spans[first-1].start
	end := spans[last-1].end

	// Enforce byte limit.
	lineCount := last - first + 1
	if lineCount > s.MaxLines {
		last = first + s.MaxLines - 1
		if last > len(spans) {
			last = len(spans)
		}
		end = spans[last-1].end
		truncated = true
	}
	if end-start > s.MaxTotalBytes {
		// Trim to byte limit at line boundary.
		for last > first && spans[last-1].end-start > s.MaxTotalBytes {
			last--
		}
		end = spans[last-1].end
		truncated = true
	}

	return text[start:end], first, last, truncated
}

// LineCount returns the number of lines in text, consistent with lineSpans.
func LineCount(text string) int {
	return len(lineSpans(text))
}

// lineSpan is one line's byte range in text, including its trailing newline.
type lineSpan struct{ start, end int }

// lineSpans splits text into 1-based lines by byte offset. A trailing newline
// does not create a final empty line; a trailing final-line without newline is
// still a line.
func lineSpans(text string) []lineSpan {
	if text == "" {
		return nil
	}
	var spans []lineSpan
	start := 0
	for i := 0; i < len(text); i++ {
		if text[i] == '\n' {
			spans = append(spans, lineSpan{start: start, end: i + 1})
			start = i + 1
		}
	}
	if start < len(text) {
		spans = append(spans, lineSpan{start: start, end: len(text)})
	}
	return spans
}

// CountingReader wraps an io.Reader and counts bytes read.
type CountingReader struct {
	Reader io.Reader
	Count  int64
}

func (r *CountingReader) Read(p []byte) (int, error) {
	n, err := r.Reader.Read(p)
	r.Count += int64(n)
	return n, err
}

// NormalizeNewlines converts CRLF to LF in place.
func NormalizeNewlines(text string) string {
	return strings.ReplaceAll(text, "\r\n", "\n")
}

// ValidateTextProjection applies the Resource text-projection policy before
// line slicing. UTF-8 is required so a byte budget can never split a model
// response into invalid text, and an oversized physical line is refused rather
// than returned as a misleading partial line.
func ValidateTextProjection(text string, maxLineBytes int) error {
	if !utf8.ValidString(text) {
		return ErrContentNotTextual
	}
	if maxLineBytes < 1 {
		return errors.New("resource text projection has no line budget")
	}
	for _, span := range lineSpans(text) {
		if span.end-span.start > maxLineBytes {
			return ErrReadLimitExceeded
		}
	}
	return nil
}
