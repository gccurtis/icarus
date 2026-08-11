package knowledge

// stream_window.go is windowSpans as a state machine: the same sentence
// splitting, the same oversized hard-split, the same accumulate-and-overlap
// window rule, driven by text arriving in arbitrary chunks instead of one string.
//
// It exists so a file can be windowed without being resident. windowSpans needs
// the whole document — it indexes into it to slice sentences, to hard-split, and
// to test whether a window is blank — so a 5MB file cost 5MB of text plus, for a
// single-sentence file, a 40MB table of per-rune byte offsets. This holds a window
// and its overlap tail, whatever the file's size.
//
// windowSpans remains the definition. Every span this produces must be
// byte-identical to what that function produces for the same text and geometry,
// because a span's byte identity is what the reuse map keys on: a windower that
// merely agreed closely would re-embed windows it disagreed about and cite ranges
// that no longer match the text they were built from.
// TestStreamWindowerMatchesWindowSpansByteForByte is that gate, run across nine
// chunkings and six geometries.

import (
	"strings"
	"unicode/utf8"
)

// streamWindower turns a byte stream into windowSpans. Write text in any chunking,
// collect the spans each call decides, then close for the tail.
//
// Three stages run at once over one pass of the bytes, mirroring what windowSpans
// does in three passes:
//
//  1. the sentence scanner, a direct port of sentenceSpans' loop;
//  2. the oversized splitter, which replaces splitOversized's per-rune offset
//     table with two counters;
//  3. the window rule, which accumulates sentences to the target and re-opens on
//     the overlap tail.
//
// All offsets are absolute in the whole document, never chunk-relative, because
// that is what a stored window range means.
type streamWindower struct {
	target, overlap int

	// buf holds the document bytes from bufStart onward — everything still needed
	// to decide or emit a window, and nothing else.
	buf      []byte
	bufStart int

	// The sentence scanner. scan is the next byte to decode; sentStart, sentRunes
	// and terminated are sentenceSpans' loop state, carried across chunk
	// boundaries. terminated is why a chunk may not end a sentence: a '.' at the
	// end of one chunk and the space that closes it at the start of the next are
	// one decision.
	scan       int
	sentStart  int
	sentRunes  int
	terminated bool

	// The oversized splitter. markOff is the byte offset just past the sentence's
	// target'th rune — the single int that replaces the offset table, because a
	// hard split only ever needs to know where the *current* chunk ends.
	// oversized is latched at rune target+1, not at rune target: a sentence of
	// exactly target runes is not split, so the split cannot be committed until a
	// further rune proves the sentence exceeds the target.
	markOff    int
	oversized  bool
	chunkStart int
	chunkRunes int

	// The window rule. sents are the sentences of the window being accumulated
	// (after any hard split), runes their combined rune count, and ord the next
	// ordinal to hand out — assigned only to windows that survive the blank
	// filter, so ordinals stay contiguous.
	sents []sentenceSpan
	runes int
	ord   int

	// out collects the spans decided during the current write/close call.
	out []windowPiece
}

// windowPiece is a decided window and its text. The text travels with the span
// because the buffer holding it is released immediately afterwards — and because
// a window carries its own text now anyway, so the caller would only slice it
// back out of a copy it is not supposed to keep.
type windowPiece struct {
	windowSpan
	text string
}

// newStreamWindower normalizes the geometry exactly as windowSpans does, so the
// two cannot disagree about a degenerate target or an overlap wider than the
// window.
func newStreamWindower(target, overlap int) *streamWindower {
	if target <= 0 {
		target = 1
	}
	if overlap < 0 || overlap >= target {
		overlap = target / 10
	}
	return &streamWindower{target: target, overlap: overlap}
}

// write consumes a chunk and returns the spans it completed — possibly none, for
// a chunk that lands mid-sentence.
func (w *streamWindower) write(chunk string) []windowPiece {
	w.buf = append(w.buf, chunk...)
	w.out = nil
	w.decode(false)
	return w.out
}

// close finishes the document: it decodes whatever is left (including a truncated
// final rune, which `for range` also reports as one RuneError), flushes the
// trailing sentence, and emits the last window.
//
// The last window is EOF-only. windowSpans emits it when its sentence cursor
// reaches the end, and there is no other way to know a window is final.
func (w *streamWindower) close() []windowPiece {
	w.out = nil
	w.decode(true)
	end := w.bufStart + len(w.buf)
	// sentenceSpans appends a trailing span only when bytes remain unclaimed, so
	// text ending on a sentence boundary produces no empty final sentence.
	if w.sentStart < end {
		w.closeSentence(end)
	}
	w.flushWindow()
	return w.out
}

// decode runs the sentence scanner over the buffered bytes.
//
// Unless this is the final call it stops at an incomplete rune rather than
// decoding it, because more bytes may complete it. utf8.FullRune draws exactly
// that line: a truncated multi-byte lead is incomplete, while a byte that can
// never begin a valid rune is complete and decodes to one RuneError — which is
// what `for range` does, and matching it is what keeps the two windowers
// agreeing on malformed input.
func (w *streamWindower) decode(final bool) {
	for w.scan < w.bufStart+len(w.buf) {
		rest := w.buf[w.scan-w.bufStart:]
		if !final && !utf8.FullRune(rest) {
			return
		}
		r, size := utf8.DecodeRune(rest)
		at := w.scan
		w.scan += size
		w.sentRunes++

		// Record where a hard split would cut, then commit the split one rune
		// later, once the sentence is known to exceed the target.
		if w.sentRunes == w.target {
			w.markOff = w.scan
		}
		if !w.oversized && w.sentRunes == w.target+1 {
			w.oversized = true
			w.admit(sentenceSpan{start: w.sentStart, end: w.markOff, runes: w.target})
			w.chunkStart, w.chunkRunes = w.markOff, 0
		}
		if w.oversized {
			w.chunkRunes++
			if w.chunkRunes == w.target {
				w.admit(sentenceSpan{start: w.chunkStart, end: w.scan, runes: w.target})
				w.chunkStart, w.chunkRunes = w.scan, 0
			}
		}

		// sentenceSpans' four cases, in its order. A newline is checked first and
		// is unconditional, so it never reaches the terminated-whitespace case.
		switch {
		case r == '\n':
			w.closeSentence(w.scan)
		case r == '.' || r == '!' || r == '?':
			w.terminated = true
		case w.terminated && (r == ' ' || r == '\t' || r == '\r'):
			w.closeSentence(w.scan)
		default:
			w.terminated = false
		}
		_ = at
	}
}

// closeSentence ends the sentence at end (exclusive) and resets the scanner for
// the next one.
//
// A sentence that was never oversized is admitted whole. One that was has already
// had its full chunks admitted, so only the remainder is left — and only when
// there is one, since a sentence whose length is a multiple of the target ends
// exactly on a chunk boundary.
func (w *streamWindower) closeSentence(end int) {
	switch {
	case !w.oversized:
		w.admit(sentenceSpan{start: w.sentStart, end: end, runes: w.sentRunes})
	case w.chunkRunes > 0:
		w.admit(sentenceSpan{start: w.chunkStart, end: end, runes: w.chunkRunes})
	}
	w.sentStart, w.sentRunes, w.terminated = end, 0, false
	w.oversized, w.chunkStart, w.chunkRunes, w.markOff = false, end, 0, 0
	w.trim()
}

// admit offers one sentence to the window rule.
//
// The loop is windowSpans' accumulation seen from the other side. There, a window
// closes when the cursor finds a sentence that does not fit; here the sentence
// arrives and closes the window. It loops because the overlap tail retained after
// a close may itself leave no room for the new sentence, in which case another
// window closes immediately — which is exactly what windowSpans does when it
// re-opens at `next` and the very next sentence overruns the target again.
//
// Progress is guaranteed: flushWindow always retains strictly fewer sentences
// than it held, so an empty deque is reached in bounded steps and the first
// sentence of a window is always admitted unconditionally.
func (w *streamWindower) admit(s sentenceSpan) {
	for len(w.sents) > 0 && w.runes+s.runes > w.target {
		w.flushWindow()
	}
	w.sents = append(w.sents, s)
	w.runes += s.runes
}

// flushWindow emits the accumulated sentences as one window and re-opens on the
// overlap tail.
//
// The retention walk is windowSpans' backwards loop, including its guard: it may
// never retain the window's own first sentence, however large the overlap budget
// is. That guard is what makes the sentence cursor strictly advance, and
// therefore what makes window starts strictly increase — the invariant region
// stitching depends on.
func (w *streamWindower) flushWindow() {
	if len(w.sents) == 0 {
		return
	}
	start, end := w.sents[0].start, w.sents[len(w.sents)-1].end

	// The blank filter, applied here rather than in a second pass. A blank window
	// has nothing to embed, and it is not harmlessly ignored downstream: an
	// embeddings provider that rejects an empty string answers the WHOLE batch
	// with an empty result, so one blank window zeroes every vector beside it.
	// Ordinals are handed out only to survivors, so they stay contiguous.
	if body := w.text(start, end); strings.TrimSpace(body) != "" {
		w.out = append(w.out, windowPiece{windowSpan{ordinal: w.ord, start: start, end: end}, body})
		w.ord++
	}

	keep, tail := len(w.sents), 0
	for keep > 1 && tail+w.sents[keep-1].runes <= w.overlap {
		tail += w.sents[keep-1].runes
		keep--
	}
	w.sents = append(w.sents[:0], w.sents[keep:]...)
	w.runes = tail
	w.trim()
}

// text returns a document range out of the buffer. Every caller asks only for
// ranges the buffer still covers, which trim is what guarantees.
func (w *streamWindower) text(start, end int) string {
	return string(w.buf[start-w.bufStart : end-w.bufStart])
}

// trim releases buffered bytes below the earliest offset still needed: the first
// live sentence, or — with no live sentences — the sentence being read, or the
// hard-split chunk being accumulated inside it.
//
// This is the whole memory argument. Without it the buffer is the document.
func (w *streamWindower) trim() {
	low := w.sentStart
	if len(w.sents) > 0 {
		low = w.sents[0].start
	} else if w.oversized {
		low = w.chunkStart
	}
	if low <= w.bufStart {
		return
	}
	w.buf = append(w.buf[:0], w.buf[low-w.bufStart:]...)
	w.bufStart = low
}
