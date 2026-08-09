import type { WindowOptions, WindowPiece } from "#platform/knowledge/types.js";
import { DEFAULT_WINDOW_OPTIONS } from "#platform/knowledge/windowing/text.js";

/**
 * State-machine text windower that accepts text in arbitrary chunks and emits
 * WindowPieces as they complete. Memory usage is bounded to the current window
 * tail — the full source text is never resident.
 *
 * Output is byte-identical to windowText() for the same text and geometry
 * when all chunks are concatenated.
 */
export class StreamWindower {
  private readonly target: number;
  private readonly overlap: number;

  // Internal buffer — bytes received but not yet emitted
  private buf = "";
  private bufStart = 0; // absolute offset of buf[0] in the source

  // Sentence scanner state
  private chars = 0;
  private sentStart = 0; // absolute offset
  private terminated = false;
  private markPos = 0; // absolute offset of the hard-split point

  // Window accumulator
  private sentences: Array<{ start: number; end: number; chars: number }> = [];
  private windowRunes = 0;

  private ordinal = 0;

  constructor(opts?: Partial<WindowOptions>) {
    this.target = opts?.targetRunes ?? DEFAULT_WINDOW_OPTIONS.targetRunes;
    this.overlap = opts?.overlapRunes ?? DEFAULT_WINDOW_OPTIONS.overlapRunes;
  }

  /**
   * Feed a chunk of text. Returns any WindowPieces that completed during this
   * chunk. Call close() after the last chunk to flush the tail.
   */
  write(chunk: string): WindowPiece[] {
    this.buf += chunk;
    return this.scan(false);
  }

  /**
   * Signal end of stream. Returns any remaining WindowPieces.
   */
  close(): WindowPiece[] {
    const pieces = this.scan(true);

    // Flush the in-progress window from remaining sentences
    if (this.sentences.length > 0) {
      const piece = this.emitWindow();
      if (piece) pieces.push(piece);
    } else if (this.sentStart < this.bufStart + this.buf.length) {
      // Remaining text that never formed a sentence
      const text = this.buf.slice(this.sentStart - this.bufStart);
      if (text.trim().length > 0) {
        const piece = this.emitWindow([{
          start: this.sentStart,
          end: this.sentStart + text.length,
          chars: this.chars
        }]);
        if (piece) pieces.push(piece);
      }
    }

    return pieces;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private absoluteIndex(bufIdx: number): number {
    return this.bufStart + bufIdx;
  }

  private scan(isFinal: boolean): WindowPiece[] {
    const pieces: WindowPiece[] = [];
    let i = this.sentStart - this.bufStart; // buf-relative position

    while (i < this.buf.length) {
      const ch = this.buf[i];
      const abs = this.absoluteIndex(i);
      this.chars++;

      if (this.chars === this.target) {
        this.markPos = abs + 1;
      } else if (this.chars > this.target && this.markPos > 0) {
        // Hard split
        const splitBufIdx = this.markPos - this.bufStart;
        const piece = this.closeSentence(this.markPos, this.target);
        if (piece) pieces.push(piece);
        i = splitBufIdx;
        continue;
      }

      if (ch === "\n") {
        const piece = this.closeSentence(abs + 1, this.chars);
        if (piece) pieces.push(piece);
        i++;
      } else if (ch === "." || ch === "!" || ch === "?") {
        this.terminated = true;
        i++;
      } else if (this.terminated && (ch === " " || ch === "\t" || ch === "\r")) {
        const piece = this.closeSentence(abs + 1, this.chars);
        if (piece) pieces.push(piece);
        i++;
      } else {
        if (ch !== " " && ch !== "\t") {
          this.terminated = false;
        }
        i++;
      }
    }

    // Release buf prefix that we no longer need
    const keepFrom = this.sentStart - this.bufStart;
    if (keepFrom > 0) {
      this.buf = this.buf.slice(keepFrom);
      this.bufStart = this.sentStart;
    }

    void isFinal; // close() handles the tail separately
    return pieces;
  }

  private closeSentence(
    absEnd: number,
    sentChars: number
  ): WindowPiece | null {
    const sent = { start: this.sentStart, end: absEnd, chars: sentChars };
    this.sentStart = absEnd;
    this.chars = 0;
    this.terminated = false;
    this.markPos = 0;

    this.sentences.push(sent);
    this.windowRunes += sent.chars;

    if (this.windowRunes >= this.target) {
      return this.emitWindow();
    }
    return null;
  }

  private emitWindow(extra?: Array<{ start: number; end: number; chars: number }>): WindowPiece | null {
    const sents = extra ? [...this.sentences, ...extra] : this.sentences;
    if (sents.length === 0) return null;

    const winStart = sents[0].start;
    const winEnd = sents[sents.length - 1].end;
    const text = this.buf.slice(winStart - this.bufStart, winEnd - this.bufStart);

    if (text.trim().length === 0) {
      this.sentences = [];
      this.windowRunes = 0;
      return null;
    }

    const piece: WindowPiece = { start: winStart, end: winEnd, text, ordinal: this.ordinal++ };

    // Compute overlap tail
    let overlapChars = 0;
    let overlapIdx = sents.length;
    while (overlapIdx > 1) {
      const prev = sents[overlapIdx - 1];
      if (overlapChars + prev.chars > this.overlap) break;
      overlapChars += prev.chars;
      overlapIdx--;
    }

    this.sentences = sents.slice(overlapIdx);
    this.windowRunes = this.sentences.reduce((s, x) => s + x.chars, 0);

    return piece;
  }
}
