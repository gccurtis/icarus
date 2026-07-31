package knowledge

import (
	"fmt"
	"strings"
	"testing"
)

// The differential oracle for streaming ingest.
//
// windowSpans is the definition of what a window is. An incremental windower fed
// the same text in arbitrary chunks must produce **byte-identical** spans — same
// ordinals, same starts, same ends — because a span's byte identity is what the
// reuse map keys on. A windower that agreed "closely" would silently re-embed
// every window it disagreed about, and cite ranges that no longer match the text
// they were built from.
//
// Chunk boundaries are the adversary here, and the shapes that matter are the
// ones that land mid-decision: between a terminator and the whitespace that
// closes its sentence, inside a multi-byte rune, and inside an oversized sentence
// being hard-split.
func streamSpans(t *testing.T, text string, target, overlap int, chunk func(int) int) []windowSpan {
	t.Helper()
	w := newStreamWindower(target, overlap)
	var out []windowSpan
	for at := 0; at < len(text); {
		n := chunk(at)
		if n < 1 {
			n = 1
		}
		if at+n > len(text) {
			n = len(text) - at
		}
		out = appendSpans(out, w.write(text[at:at+n]))
		at += n
	}
	return appendSpans(out, w.close())
}

// appendSpans drops the text the streaming path carries, so the oracle compares
// exactly what windowSpans returns. The text itself is checked separately, by
// TestStreamedWindowTextIsExactlyItsRange.
func appendSpans(out []windowSpan, pieces []windowPiece) []windowSpan {
	for _, p := range pieces {
		out = append(out, p.windowSpan)
	}
	return out
}

// The chunkings worth trying. Fixed small sizes walk boundaries across every
// offset; the prime sizes avoid accidentally aligning with the fixture's own
// period, which is how a windower with an off-by-one passes a byte-aligned test.
func chunkings() map[string]func(int) int {
	return map[string]func(int) int{
		"whole":  func(int) int { return 1 << 30 },
		"1":      func(int) int { return 1 },
		"2":      func(int) int { return 2 },
		"3":      func(int) int { return 3 },
		"7":      func(int) int { return 7 },
		"13":     func(int) int { return 13 },
		"64":     func(int) int { return 64 },
		"997":    func(int) int { return 997 },
		"ragged": func(at int) int { return 1 + (at*7+3)%11 },
	}
}

// The fixtures. Each one exercises a decision the windower makes, and the
// multibyte and oversized cases are where a chunk boundary can land inside an
// indivisible unit.
func windowFixtures() map[string]string {
	return map[string]string{
		"empty":              "",
		"whitespace":         "   \n  \t ",
		"one short sentence": "A short line.",
		"no terminator":      strings.Repeat("unterminated text with no stops ", 20),
		"newline blocks":     strings.Repeat("block line here\n", 40),
		"terminator run":     strings.Repeat("Wait... then go. End! Really? Yes. ", 20),
		"leading blanks":     "   \n  Leading blanks. Then more text here.  \n\n",
		"multibyte":          strings.Repeat("héllo wörld. café ünïcode! ends hére. ", 20),
		"one long sentence":  strings.Repeat("x", 5000),
		"long then short":    strings.Repeat("y", 3000) + ". Short after. " + strings.Repeat("z", 2000),
		"crlf":               strings.Repeat("line one.\r\nline two.\r\n", 40),
		"blank interior":     "First sentence here.\n\n\n\n   \n\n\nSecond sentence here.",
		"prose":              strings.Repeat("Sentence number one is here. And a second one follows it. ", 30),
	}
}

func TestStreamWindowerMatchesWindowSpansByteForByte(t *testing.T) {
	geometries := []struct{ target, overlap int }{
		{4000, 400}, // production
		{200, 40},   // the unit-test geometry
		{40, 20},
		{40, 0}, // no overlap: windows tile exactly
		{5, 2},  // smaller than a multibyte rune's worth of runes
		{1, 0},  // degenerate
	}
	for fname, text := range windowFixtures() {
		for _, g := range geometries {
			want := windowSpans(text, g.target, g.overlap)
			for cname, chunk := range chunkings() {
				got := streamSpans(t, text, g.target, g.overlap, chunk)
				label := fmt.Sprintf("%s/target=%d,overlap=%d/chunk=%s", fname, g.target, g.overlap, cname)
				if len(got) != len(want) {
					t.Errorf("%s: %d spans, want %d\n got %v\nwant %v", label, len(got), len(want), got, want)
					continue
				}
				for i := range want {
					if got[i] != want[i] {
						t.Errorf("%s: span %d = %+v, want %+v", label, i, got[i], want[i])
					}
				}
			}
		}
	}
}

// Ordinals stay contiguous from zero, whatever was dropped. They are the window's
// index in the kept list, not a counter over candidates, and the reuse map's
// stability depends on that.
func TestStreamWindowerOrdinalsAreContiguous(t *testing.T) {
	for fname, text := range windowFixtures() {
		for cname, chunk := range chunkings() {
			got := streamSpans(t, text, 200, 40, chunk)
			for i, s := range got {
				if s.ordinal != i {
					t.Errorf("%s/chunk=%s: span %d has ordinal %d", fname, cname, i, s.ordinal)
				}
			}
		}
	}
}

// No blank window, ever. An embeddings provider that rejects an empty string
// answers the WHOLE batch with an empty result, so one blank window zeroes the
// vectors of every window beside it — the failure this filter exists to prevent,
// and it has to survive streaming.
func TestStreamWindowerNeverEmitsABlankWindow(t *testing.T) {
	for fname, text := range windowFixtures() {
		for cname, chunk := range chunkings() {
			for _, s := range streamSpans(t, text, 200, 40, chunk) {
				if s.start < 0 || s.end > len(text) || s.start > s.end {
					t.Fatalf("%s/chunk=%s: span %+v out of range for %d bytes", fname, cname, s, len(text))
				}
				if strings.TrimSpace(text[s.start:s.end]) == "" {
					t.Errorf("%s/chunk=%s: blank window %+v", fname, cname, s)
				}
			}
		}
	}
}

// splitOversized built a byte offset per rune of an oversized sentence — 40MB of
// table for a 5MB single-sentence file. The streaming path must reach the same
// spans while holding a counter instead.
func TestOversizedSentencesSplitWithoutAnOffsetTable(t *testing.T) {
	// One sentence, no terminators, far longer than the target.
	text := strings.Repeat("abcdé", 20000) // 100k runes, 120k bytes
	want := windowSpans(text, 4000, 400)
	if len(want) < 20 {
		t.Fatalf("fixture produced %d windows; it must be many to be a test", len(want))
	}
	got := streamSpans(t, text, 4000, 400, func(int) int { return 1000 })
	if len(got) != len(want) {
		t.Fatalf("%d spans, want %d", len(got), len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("span %d = %+v, want %+v", i, got[i], want[i])
		}
	}
}

// Invalid UTF-8 must not be where the two disagree. windowSpans counts runes with
// `for range` semantics, which yields one iteration per invalid byte; a streaming
// decoder that used utf8.RuneCountInString or skipped invalid bytes would drift,
// and the drift would only appear on real-world files with mixed encodings.
func TestStreamWindowerAgreesOnInvalidUTF8(t *testing.T) {
	text := "Valid text here. " + string([]byte{0xff, 0xfe, 0x80}) + " more text. " +
		strings.Repeat("tail sentence here. ", 30) + string([]byte{0xc3}) // truncated 2-byte lead
	want := windowSpans(text, 200, 40)
	for cname, chunk := range chunkings() {
		got := streamSpans(t, text, 200, 40, chunk)
		if len(got) != len(want) {
			t.Errorf("chunk=%s: %d spans, want %d", cname, len(got), len(want))
			continue
		}
		for i := range want {
			if got[i] != want[i] {
				t.Errorf("chunk=%s: span %d = %+v, want %+v", cname, i, got[i], want[i])
			}
		}
	}
}
